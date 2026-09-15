"""Build the static sample using the preserved academic homepage as its content source."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape, unescape
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUT = ROOT / 'dist'
ORIGINAL = (ROOT / 'source/original.html').read_text()

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []
    def handle_data(self, data):
        self.parts.append(data)

def text(markup):
    p = Text(); p.feed(markup)
    return ' '.join(''.join(p.parts).split())

def slug(title):
    return re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')

def clean_links(markup):
    markup = re.sub(r'target=&ldquo;blank&rdquo;', 'target="_blank" rel="noopener noreferrer"', markup)
    markup = re.sub(r'target="blank"', 'target="_blank" rel="noopener noreferrer"', markup)
    return markup

headings = list(re.finditer(r'<h([23])>(.*?)</h\1>', ORIGINAL, re.S))
sections = {}
for i, h in enumerate(headings):
    name = text(h.group(2))
    end = headings[i+1].start() if i+1 < len(headings) else ORIGINAL.index('<div id="footer">')
    sections[name] = clean_links(ORIGINAL[h.end():end])

def entries(name):
    return [x for x in re.findall(r'<li>\s*<p>(.*?)</p>\s*</li>', sections[name], re.S) if not text(x).startswith('where ')]

venue_ranks = {
    'TPAMI': 'A', 'NeurIPS': 'A', 'ICML': 'A', 'ICLR': 'A',
    'KDD': 'A', 'ICDE': 'A', 'DAC': 'A',
    'MSST': 'B', 'CIKM': 'B', 'ICDCS': 'B', 'IEEE Transactions on Cybernetics': 'B',
    'CSCWD': 'C', 'MDM': 'C', 'IJCNN': 'C', 'Neurocomputing': 'C',
}
venue_names = list(venue_ranks) + ['SIGMOD', 'Machine Intelligence Research', 'TAES', 'Complex & Intelligent Systems', 'AAAI']
descriptions = {
    4: '将图结构先验与语言模型结合，用于组合优化问题求解。',
    8: '探索可微整数线性规划，将优化问题与学习过程相连接。',
    18: '在数据有限的条件下，为混合整数线性规划求解器生成问题实例。',
    21: '通过层次化序列模型学习割平面选择，提升混合整数规划求解效率。',
    2: '分析视觉—语言—动作模型在异构计算平台上的约束与机器人部署加速。',
}
descriptions_en = {
    4: 'Combines graph structural priors with language models for combinatorial optimization.',
    8: 'Connects integer linear programming with learning through differentiable optimization.',
    18: 'Generates mixed-integer programming instances when solver training data is limited.',
    21: 'Learns cut selection with a hierarchical sequence model for efficient mixed-integer programming.',
    2: 'Characterizes VLA models across heterogeneous hardware and accelerates on-robot deployment.',
}
selected_ids = [4, 8, 18, 21, 2]
papers = []
for i, markup in enumerate(entries('Publication'), 1):
    plain = text(markup)
    links = [{'href': unescape(href), 'label': text(label)} for href, label in re.findall(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', markup, re.S)]
    head = re.split(r'\s*\[<a', markup)[0].strip()
    author_separator = re.search(r'[:;] ', head)
    if author_separator:
        authors_html = head[:author_separator.start()]
        title_venue_html = head[author_separator.end():]
    else:
        authors_html, title_venue_html = '', head
    tv = text(title_venue_html)
    venue = next((v for v in venue_names if re.search(r'\b' + re.escape(v) + r'\b', tv)), '学位论文' if i == 38 else '其他')
    bold_pos = re.search(r'<b>(?!Xijun Li|李希君)', title_venue_html)
    if bold_pos:
        title = text(title_venue_html[:bold_pos.start()]).rstrip(' .')
        if 'IEEE Transactions on Pattern Analysis' in title:
            title = title.split('. IEEE Transactions on Pattern Analysis')[0]
    else:
        title = tv.rstrip(' .')
    if not title:
        title = tv
    title = title.rstrip(' (')
    year_match = re.search(r'\b(20\d\d)\b', tv)
    year = int(year_match.group(1)) if year_match else {1: 2026, 7: 2025, 11: 2024}.get(i)
    rank = venue_ranks.get(venue, 'other')
    note = ''
    if i in (20, 30, 32, 38):
        rank = 'other'
        note = {20: 'Workshop', 30: '竞赛报告', 32: '论文类型待核对 · 会议 CCF A', 38: '硕士学位论文'}[i]
    elif rank == 'other':
        note = 'CCF 目录外'
    papers.append({'id': i, 'title': title, 'authors_html': authors_html, 'venue': venue,
                   'year': year, 'rank': rank, 'note': note, 'links': links,
                   'spotlight': 'Spotlight' in plain, 'selected': i in selected_ids,
                   'description': descriptions.get(i, ''), 'description_en': descriptions_en.get(i, ''), 'original_html': markup,
                   'search': plain, 'type': 'publication'})

for i, markup in enumerate(entries('Preprint'), 101):
    plain = text(markup)
    head = re.split(r'\s*\[<a', markup)[0].strip()
    if ': ' in head:
        authors_html, title_html = head.split(': ', 1)
    else:
        authors_html, title_html = '', head
    links = [{'href': unescape(h), 'label': text(l)} for h, l in re.findall(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', markup, re.S)]
    papers.append({'id': i, 'title': text(title_html).rstrip(' .'), 'authors_html': authors_html,
                   'venue': 'Preprint', 'year': None, 'rank': 'other', 'note': '预印本 / 技术报告',
                   'links': links, 'spotlight': False, 'selected': False, 'description': '',
                   'description_en': '',
                   'original_html': markup, 'search': plain, 'type': 'preprint'})

def paper_html(p, lang='zh'):
    archive_name = 'archive-zh.html' if lang == 'zh' else 'archive.html'
    href = escape(p['links'][0]['href'], quote=True) if p['links'] else archive_name + '#publication'
    note_en = {'Workshop': 'Workshop', '竞赛报告': 'Competition paper',
               '论文类型待核对 · 会议 CCF A': 'Paper type pending · venue is CCF A',
               '硕士学位论文': 'Master thesis', 'CCF 目录外': 'Outside CCF directory',
               '预印本 / 技术报告': 'Preprint / technical report'}
    badge = 'CCF ' + p['rank'] if p['rank'] != 'other' else (note_en.get(p['note'], p['note']) if lang == 'en' else p['note'])
    links = ''.join(f'<a href="{escape(x["href"], quote=True)}" target="_blank" rel="noopener noreferrer">{escape(x["label"])} ↗</a>' for x in p['links'])
    spotlight_label = '✧ 亮点论文' if lang == 'zh' else '✧ Spotlight'
    spotlight = f'<span class="spotlight">{spotlight_label}</span>' if p['spotlight'] else ''
    description = p['description_en'] if lang == 'en' else p['description']
    aria = 'Read' if lang == 'en' else '阅读'
    return f'''<article class="paper"><div class="paper-meta"><div class="paper-venue">{escape(p['venue'])}</div><div class="paper-year">{p['year'] or '—'}</div><span class="ccf-badge">{escape(badge)}</span></div><div><h3><a href="{href}" target="_blank" rel="noopener noreferrer">{escape(p['title'])}</a></h3>{('<p class="paper-description">'+escape(description)+'</p>') if description else ''}<p class="paper-authors">{p['authors_html']}</p><div class="paper-resources">{spotlight}{links}</div></div><a class="paper-arrow" href="{href}" target="_blank" rel="noopener noreferrer" aria-label="{aria} {escape(p['title'], quote=True)}">↗</a></article>'''

stats = {r: sum(p['rank'] == r for p in papers if p['type'] == 'publication') for r in ('A','B','C','other')}
assert len(entries('Publication')) == 38
assert len(entries('Preprint')) == 11
assert len(entries('Patent')) == 21
assert len(entries('Grant')) == 6
assert len(entries('Supervised and Co-supervised Students')) == 12
assert stats == {'A': 23, 'B': 4, 'C': 4, 'other': 7}, stats

grant_preview = [
    ('国家自然科学基金青年科学基金 C 类', '主持 · 2026—2028'),
    ('上海市自然科学基金', '主持 · 2025—2028'),
    ('上海交大 AI for Engineering 赋能计划 B 类', '主持 · 2025—2027'),
    ('科技创新 2030 —“新一代人工智能”重大项目', '核心成员 · 2022—2025'),
]
grants = ''.join(f'<div class="grant-item"><span class="grant-number">0{i}</span><div><strong>{name}</strong><p>{label}</p></div></div>' for i,(name,label) in enumerate(grant_preview,1))
grant_preview_en = [
    ('NSFC Young Scientists Fund, Category C', 'PI · 2026—2028'),
    ('Shanghai Natural Science Foundation', 'PI · 2025—2028'),
    ('SJTU “AI for Engineering” Program, Category B', 'PI · 2025—2027'),
    ('National AI 2030 Major Project', 'Core member · 2022—2025'),
]
grants_en = ''.join(f'<div class="grant-item"><span class="grant-number">0{i}</span><div><strong>{name}</strong><p>{label}</p></div></div>' for i,(name,label) in enumerate(grant_preview_en,1))
patents = ''
for p in entries('Patent')[:3]:
    s=text(p); number,title=s.split(' ',1); title=title.split('：')[0]
    patents += f'<div class="patent-item"><span>{escape(number)}</span><h4>{escape(title)}</h4></div>'
patent_preview_en = [
    ('CN122308802A', 'End-to-end generation of FPGA-executable programs for Xilinx environments'),
    ('CN120996196A', 'Long-horizon planning with foundation models and symbolic solvers in open embodied environments'),
    ('CN120578395A', 'Structure-aware code generation for combinatorial optimization'),
]
patents_en = ''.join(f'<div class="patent-item"><span>{number}</span><h4>{title}</h4></div>' for number,title in patent_preview_en)
students = ''
students_en = ''
for p in entries('Supervised and Co-supervised Students'):
    s=text(p); name=s.split(' (')[0]
    label='博士生' if 'Ph.D.' in s else '本科生' if 'Undergraduate' in s else '硕士生'
    students += f'<div class="person"><strong>{escape(name)}</strong><span>{label}</span></div>'
    label_en='Ph.D. student' if 'Ph.D.' in s else 'Undergraduate' if 'Undergraduate' in s else 'Master student'
    students_en += f'<div class="person"><strong>{escape(name)}</strong><span>{label_en}</span></div>'

OUT.mkdir(exist_ok=True)
for f in SRC.iterdir():
    if f.is_file(): shutil.copy2(f, OUT/f.name)
shutil.copytree(SRC/'assets', OUT/'assets', dirs_exist_ok=True)
index=(SRC/'index.html').read_text()
index=index.replace('{{SELECTED_PAPERS}}',''.join(paper_html(next(p for p in papers if p['id']==i)) for i in selected_ids))
index=index.replace('{{GRANT_PREVIEW}}',grants).replace('{{PATENT_PREVIEW}}',patents).replace('{{STUDENT_PREVIEW}}',students)
index=index.replace('<strong id="metric-ccf">—</strong>', '<strong id="metric-ccf">23<span>篇</span></strong>')
index=index.replace('分类核对中 · 全部署名','CCF 2026 · B 类 4 篇 / C 类 4 篇')
(OUT/'index.html').write_text(index)
english=(SRC/'en.html').read_text()
english=english.replace('{{SELECTED_PAPERS_EN}}',''.join(paper_html(next(p for p in papers if p['id']==i), 'en') for i in selected_ids))
english=english.replace('{{GRANT_PREVIEW_EN}}',grants_en).replace('{{PATENT_PREVIEW_EN}}',patents_en).replace('{{STUDENT_PREVIEW_EN}}',students_en)
english=english.replace('<strong id="metric-ccf">—</strong>', '<strong id="metric-ccf">23<span>papers</span></strong>')
english=english.replace('Classification verified · all authorships','CCF 2026 · 4 B / 4 C publications')
(OUT/'en.html').write_text(english)
data={'papers': papers, 'stats': stats, 'selected_ids': selected_ids,
      'source_date': '2026-09-15', 'ccf_edition': '第七版（2026）',
      'ccf_source': 'https://www.ccf.org.cn/ccf/contentcore/resource/download?ID=112CF3BF7E1140ACEB271ADAED12A67ADFABB8FF099E40C2759502A85C8A281F'}
(OUT/'data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(OUT/'data.js').write_text('window.ACADEMIC_DATA = '+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';\n')
index=index.replace('<script src="app.js" defer></script>', '<script src="data.js" defer></script>\n  <script src="app.js" defer></script>')
(OUT/'index.html').write_text(index)
english=english.replace('<script src="app.js" defer></script>', '<script src="data.js" defer></script>\n  <script src="app.js" defer></script>')
(OUT/'en.html').write_text(english)

body=re.search(r'<body>(.*?)</body>', ORIGINAL,re.S).group(1)
body=re.sub(r'<!--.*?-->', '', body, flags=re.S)
body=clean_links(body)
body=re.sub(r'<h([23])>(.*?)</h\1>', lambda m:f'<h{m.group(1)} id="{slug(text(m.group(2)))}">{m.group(2)}</h{m.group(1)}>', body, flags=re.S)
body=body.replace('https://xijun-album.oss-cn-hangzhou.aliyuncs.com/avatar/xijun_portrait_nano_banana.png','assets/portrait.png')
nav=''.join(f'<a href="#{slug(text(h.group(2)))}">{escape(text(h.group(2)))}</a>' for h in headings)
archive=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Full Academic Profile · Xijun Li</title><meta name="description" content="Complete academic archive of Xijun Li: publications, patents, grants, experience, teaching, service and students."><link rel="stylesheet" href="styles.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"></head><body data-lang="en"><a class="skip-link" href="#archive-main">Skip to main content</a><header class="site-header"><div class="container header-inner"><a class="wordmark" href="en.html"><span class="monogram">XL<span>•</span></span><span class="wordmark-name">Xijun Li <span>李希君</span></span></a><div class="lang-switch archive-language"><a href="archive-zh.html" lang="zh-CN">中</a><span aria-current="page">EN</span></div><a class="nav-join" href="en.html#join">Join Us ↗</a></div></header><div class="container archive-hero"><a class="archive-back" href="en.html">← Back to homepage</a><h1>Full Academic Profile</h1><p>Publications, projects, patents, teaching, service and people</p></div><div class="container archive-layout"><nav class="archive-nav" aria-label="Archive sections">{nav}</nav><main id="archive-main" class="legacy-content">{body}</main></div><footer class="site-footer container"><a href="en.html">← Back to homepage</a><a href="archive-zh.html" lang="zh-CN">中文档案 ↗</a><span>© 2026 Xijun Li</span></footer></body></html>'''
(OUT/'archive.html').write_text(archive)

heading_zh = {
    'News':'动态', 'About':'个人简介', 'Experience':'工作经历', 'Research':'研究',
    'Recent Interest':'研究方向', 'Publication':'学术论文', 'Grant':'科研项目',
    'Selected Award':'荣誉与奖励', 'Patent':'专利', 'Preprint':'预印本',
    'Competitions':'竞赛', 'Software':'软件与系统', 'Teaching':'教学',
    'Invited Talk':'受邀报告', 'Education':'教育经历', 'Service':'学术服务',
    'Area Chair & Program Committee':'领域主席与程序委员会',
    'Conference Reviewer':'会议审稿', 'Journal Reviewer':'期刊审稿',
    'Supervised and Co-supervised Students':'指导与共同指导学生', 'Alumni':'毕业生',
    'Interns and Collaborators':'实习生与合作者',
}

def reference_links(markup):
    label_map={'pdf':'论文','code':'代码','page':'页面','media':'报道','certificate':'证书',
               'cert. 1':'证书 1','cert. 2':'证书 2','news':'新闻','video':'视频',
               'slides':'幻灯片','poster':'海报','result':'结果','solution':'方案'}
    links=[]
    for href,label in re.findall(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', markup, re.S):
        plain=text(label); translated=label_map.get(plain.lower(), plain)
        links.append(f'<a href="{escape(unescape(href), quote=True)}" target="_blank" rel="noopener noreferrer">[{escape(translated)}]</a>')
    return ' '.join(links)

def translated_list(name, translations):
    source=entries(name)
    assert len(source)==len(translations), (name,len(source),len(translations))
    return '<ul>'+''.join(f'<li><p>{translation} {reference_links(markup)}</p></li>' for markup,translation in zip(source,translations))+'</ul>'

news_zh = [
    '在工信部指导的新型工业化智库论坛作“未来产业：发展方向、重点与战略布局”主题报告。',
    '受邀担任 ICLR 2027 领域主席（Area Chair）。',
    '祝贺学生 Xiyuan 获数学科学学院“强基计划”科创实践项目。',
    '祝贺 Mingrui 获致远荣誉本科学位。',
    '一篇论文被 IEEE TPAMI 接收，祝贺 Haoyang。',
    '获评 ICML 2026 Gold Reviewer。',
    '受邀担任 NeurIPS 2026 领域主席（Area Chair）。',
    '指导团队获第十九届“挑战杯”人工智能+专项赛特等奖。',
    '获评 NeurIPS 2025 Top Reviewer。',
    '在华为组织的“大模型时代的 Learning to Optimize”研讨会作报告。',
    '三篇论文被 NeurIPS 2025 接收。',
    '受邀担任 ICLR 2026 领域主席（Area Chair）。',
    '获批国家自然科学基金青年科学基金 C 类项目，担任负责人。',
    '获批上海市自然科学基金项目，担任负责人。',
    '祝贺 Jiexiang 的本科毕业论文获上海交通大学计算机学院优秀毕业论文（前 5%）。',
    '一篇论文被 IEEE TPAMI 接收，祝贺 Yufei。',
    '两篇论文被 ICLR 2025 接收，祝贺 Zijie 和 Haoyang。',
    '结束在华为诺亚方舟实验室的工作，并于 2024 年 10 月加入上海交通大学软件学院任助理教授。',
]
experience_zh = [
    '中华人民共和国科学技术部借调，2026 年 1 月至今',
    '上海交通大学助理教授，2024 年 10 月至今',
    '华为诺亚方舟实验室主任研究员，2024 年 3 月至 2024 年 9 月',
    '华为诺亚方舟实验室高级研究工程师 A，2022 年 3 月至 2024 年 2 月',
    '华为诺亚方舟实验室高级研究工程师 B，2019 年 12 月至 2022 年 2 月',
    '华为诺亚方舟实验室研究工程师，2018 年 4 月至 2019 年 11 月',
    '华为诺亚方舟实验室研究实习生，2017 年 8 月至 2018 年 3 月',
]
interest_zh = ['学习型优化','机器人长程规划','面向优化与推理的大语言模型','面向代码优化的大语言模型','数学规划求解器','强化学习','运筹学','元启发式算法','物流、供应链、存储系统等领域应用']
grant_zh = [
    '<b>负责人</b>，国家自然科学基金青年科学基金 C 类，2026—2028，30 万元',
    '<b>负责人</b>，上海市自然科学基金，2025—2028，25 万元',
    '<b>负责人</b>，上海交通大学“AI for Engineering”赋能计划 B 类，2025—2027，50 万元',
    '<b>负责人</b>，上海交通大学新进教师启动计划，2024—2027',
    '<b>负责人</b>，空天飞行器技术航空科技重点实验室基金，2025—2026',
    '<b>核心成员</b>，科技创新 2030—“新一代人工智能”重大项目，2022—2025，约 600 万元',
]
award_zh = [
    '第十九届“挑战杯”人工智能+专项赛特等奖（指导教师），2025', '战地英雄奖，华为 2012 实验室，2024',
    '盘古大模型“四野特别攻关奖”，华为 2012 实验室，2024', '总裁个人奖，华为 2012 实验室，2023',
    '总裁个人奖，华为供应链部门，2023', '战地英雄奖，华为 2012 实验室，2022',
    '质量之星奖，华为 2012 实验室，2021', '金牌团队奖，华为 2012 实验室，2020',
    '创新先锋奖，华为 2012 实验室，2020', '优秀新员工，华为 2012 实验室，2018',
    '上海交通大学优秀毕业生，2018', '国家奖学金（前 5%），教育部，2017',
    '国家奖学金（前 5%），教育部，2014', '创维企业奖学金一等奖（前 5%），2015',
    '美国大学生数学建模竞赛 Meritorious Award，2014',
]
competition_zh = ['SAT Competition 2023 并行赛道第 3 名','NeurIPS 2021 ML4CO Competition Dual Track 学生榜第 1 名','美国大学生数学建模竞赛 Meritorious Award，2014']
teaching_zh = ['主讲：GE6001 科学写作、学术规范与伦理，上海交通大学，2025—2026 秋季学期','主讲：CAMP1205-01 计算导论，上海交通大学，2024—2025 夏季学期','主讲：Python 程序设计导论，上海交通大学，2024—2025 秋季学期','助教：SE3332 机器学习导论，上海交通大学，2024—2025 春季学期']
education_zh = ['中国科学技术大学，电子工程与信息科学博士，2019 年 9 月—2024 年 3 月','上海交通大学，计算机软件工程硕士，2015 年 9 月—2018 年 3 月','华南理工大学，应用数学学士，2011 年 9 月—2015 年 6 月']

custom_zh = {
    'News': translated_list('News', news_zh),
    'About': '<p>李希君现任上海交通大学助理教授、博士生导师，并担任上海市可扩展计算与系统重点实验室成员。2018—2024 年在华为诺亚方舟实验室工作，曾任主任研究员。2024 年 3 月通过华为—中科大联合培养博士项目获中国科学技术大学博士学位，导师为王杰教授；2018 年获上海交通大学硕士学位，导师为姚建国教授。研究聚焦学习型优化、大模型优化与推理、机器人长程规划，成果发表于 TPAMI、NeurIPS、ICLR、ICML、KDD、ICDE、SIGMOD 等会议与期刊。曾参与华为云天筹 OptVerse AI 求解器和盘古大模型研发，并担任 ICLR、NeurIPS 等会议领域主席。</p>',
    'Experience': translated_list('Experience', experience_zh),
    'Recent Interest': translated_list('Recent Interest', interest_zh),
    'Grant': translated_list('Grant', grant_zh),
    'Selected Award': translated_list('Selected Award', award_zh),
    'Competitions': translated_list('Competitions', competition_zh),
    'Teaching': translated_list('Teaching', teaching_zh),
    'Education': translated_list('Education', education_zh),
}

def translate_people(markup):
    replacements={'Ph.D. student':'博士生','Master student':'硕士生','Undergraduate studeent':'本科生',
                  'Undergraduate student':'本科生','Master,':'硕士，','PhD graduated from':'博士毕业于',
                  'PhD student @':'博士生，就读于','Msc graduated from':'硕士毕业于','Msc student @':'硕士生，就读于',
                  'graduated from':'本科毕业于','Excellent Intern':'优秀实习生','certificate':'证书'}
    for a,b in replacements.items(): markup=markup.replace(a,b)
    return markup

lead_zh='''<div id="toptitle"><h1>李希君 Xijun Li</h1></div><table class="imgtable"><tr><td><img src="assets/portrait.png" alt="李希君肖像" width="134" height="180"></td><td><p>上海交通大学助理教授、博士生导师<br>中国科学技术大学博士<br><br>邮箱：lixijun AT sjtu DOT edu DOT cn<br>地址：上海市闵行区东川路 800 号软件大楼 1411 室<br><br><a href="https://scholar.google.com/citations?user=QXU_QbMAAAAJ&amp;hl=en" target="_blank" rel="noopener noreferrer">[Google Scholar]</a> <a href="https://xijun-doc.oss-cn-hongkong.aliyuncs.com/SJTU_XijunLi_CV2025.pdf" target="_blank" rel="noopener noreferrer">[个人简历]</a> <a href="https://github.com/SJTU-L2O" target="_blank" rel="noopener noreferrer">[GitHub]</a></p></td></tr></table>'''
zh_parts=[lead_zh]
for h in headings:
    original_name=text(h.group(2)); translated_name=heading_zh.get(original_name, original_name)
    part=custom_zh.get(original_name, sections[original_name])
    if original_name in ('Supervised and Co-supervised Students','Alumni','Interns and Collaborators'):
        part=translate_people(part)
    zh_parts.append(f'<h{h.group(1)} id="{slug(original_name)}">{escape(translated_name)}</h{h.group(1)}>{part}')
body_zh=''.join(zh_parts)
nav_zh=''.join(f'<a href="#{slug(text(h.group(2)))}">{escape(heading_zh.get(text(h.group(2)), text(h.group(2))))}</a>' for h in headings)
archive_zh=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>完整学术档案 · 李希君</title><meta name="description" content="李希君的完整学术档案：论文、项目、专利、经历、教学、服务和学生培养。"><link rel="stylesheet" href="styles.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"></head><body data-lang="zh"><a class="skip-link" href="#archive-main">跳至主要内容</a><header class="site-header"><div class="container header-inner"><a class="wordmark" href="index.html"><span class="monogram">XL<span>•</span></span><span class="wordmark-name">李希君 <span>Xijun Li</span></span></a><div class="lang-switch archive-language"><span aria-current="page">中</span><a href="archive.html" lang="en">EN</a></div><a class="nav-join" href="index.html#join">招生与实习 ↗</a></div></header><div class="container archive-hero"><a class="archive-back" href="index.html">← 返回主页</a><h1>完整学术档案</h1><p>论文、项目、专利、教学、学术服务与学生培养</p></div><div class="container archive-layout"><nav class="archive-nav" aria-label="档案目录">{nav_zh}</nav><main id="archive-main" class="legacy-content">{body_zh}</main></div><footer class="site-footer container"><a href="index.html">← 返回主页</a><a href="archive.html" lang="en">English profile ↗</a><span>© 2026 Xijun Li</span></footer></body></html>'''
(OUT/'archive-zh.html').write_text(archive_zh)

# Verify all original public text and external links survive in the archive.
original_public=re.sub(r'<!--.*?-->', '', re.search(r'<body>(.*?)</body>',ORIGINAL,re.S).group(1), flags=re.S)
assert text(original_public) == text(body), 'Archive text was lost during migration'
old_links=set(unescape(u) for u in re.findall(r'<a\s+href="([^"]+)"', original_public))
new_links=set(unescape(u) for u in re.findall(r'<a\s+href="([^"]+)"', archive))
assert old_links <= new_links, old_links-new_links
assert '{{' not in index and '}}' not in index
assert '{{' not in english and '}}' not in english
for page in ('index.html','en.html','archive.html','archive-zh.html'):
    html=(OUT/page).read_text()
    ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids)), f'Duplicate ids: {page}'
    for href in re.findall(r'href="([^"]+)"',html):
        if href.startswith('#') and len(href)>1: assert href[1:] in ids, (page,href)
        if href.startswith('archive.html#'):
            assert f'id="{href.split("#")[1]}"' in archive, href
        if href.startswith('archive-zh.html#'):
            assert f'id="{href.split("#")[1]}"' in archive_zh, href
for asset in ('assets/portrait.png','assets/favicon.svg','styles.css','app.js','data.js'):
    assert (OUT/asset).is_file(), asset
print(f'Built {OUT}')
print(f'CCF 2026: A={stats["A"]}, B={stats["B"]}, C={stats["C"]}; 38 publication entries, 11 preprints, 21 patent entries, 6 grants.')
print(f'Archive preserves all original public text and {len(old_links)} distinct original links. Local anchors verified.')
