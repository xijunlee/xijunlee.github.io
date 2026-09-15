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
    2: '分析视觉—语言—动作模型在异构计算平台上的约束与具身系统部署加速。',
}
descriptions_en = {
    4: 'Combines graph structural priors with language models for combinatorial optimization.',
    8: 'Connects integer linear programming with learning through differentiable optimization.',
    18: 'Generates mixed-integer programming instances when solver training data is limited.',
    21: 'Learns cut selection with a hierarchical sequence model for efficient mixed-integer programming.',
    2: 'Characterizes VLA models across heterogeneous hardware and accelerates deployment in embodied systems.',
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
ccf_a_papers=sorted((p for p in papers if p['rank']=='A'), key=lambda p: (-(p['year'] or 0), p['id']))
index=index.replace('{{CCF_A_PAPERS}}',''.join(paper_html(p) for p in ccf_a_papers))
index=index.replace('{{GRANT_PREVIEW}}',grants).replace('{{PATENT_PREVIEW}}',patents).replace('{{STUDENT_PREVIEW}}',students)
index=index.replace('<strong id="metric-ccf">—</strong>', '<strong id="metric-ccf">23<span>篇</span></strong>')
index=index.replace('分类核对中 · 全部署名','CCF 2026 · B 类 4 篇 / C 类 4 篇')
(OUT/'index.html').write_text(index)
english=(SRC/'en.html').read_text()
english=english.replace('{{CCF_A_PAPERS_EN}}',''.join(paper_html(p, 'en') for p in ccf_a_papers))
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

def normalize_archive_markup(markup):
    """Apply approved factual and terminology corrections to preserved source markup."""
    markup=clean_links(markup)
    markup=markup.replace('School of Software', 'School of Computer Science')
    markup=markup.replace('an Assistant Professor and Ph.D. supervisor at Shanghai Jiao Tong University,', 'an Assistant Professor and Ph.D. supervisor at the School of Computer Science, Shanghai Jiao Tong University,')
    markup=markup.replace('Robotics/GPU/NPU/CPU', 'Embodied Intelligence/GPU/NPU/CPU')
    markup=markup.replace('<b>Long-Horizon Planning for Robotics</b>', '<b>Embodied Intelligence and Long-Horizon Planning</b>')
    markup=markup.replace('Long-Horizon Planning for Robotics', 'Embodied Intelligence and Long-Horizon Planning')
    markup=markup.replace('PanGu', 'Pangu')
    markup=re.sub(r'<li>\s*<p>where\s+&lsquo;\*&rsquo;.*?</p>\s*</li>', '', markup, flags=re.S)
    markup=re.sub(r'(?<=</b>)[*#]+', '', markup)
    markup=re.sub(r'([A-Za-z])[*#]+(?=[,;:])', r'\1', markup)
    markup=re.sub(r'\(CORE A\*?,\s*(CCF [ABC])\)', r'(\1)', markup)
    return markup

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

def reference_links(markup, lang='zh'):
    label_map={'pdf':'论文','code':'代码','page':'页面','media':'报道','certificate':'证书',
               'cert. 1':'证书 1','cert. 2':'证书 2','news':'新闻','video':'视频',
               'slides':'幻灯片','poster':'海报','result':'结果','solution':'方案'}
    links=[]
    for href,label in re.findall(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', markup, re.S):
        plain=text(label); translated=label_map.get(plain.lower(), plain) if lang == 'zh' else plain
        links.append(f'<a href="{escape(unescape(href), quote=True)}" target="_blank" rel="noopener noreferrer">[{escape(translated)}]</a>')
    return ' '.join(links)

def translated_list(name, translations, preserve_prefix=False, lang='zh'):
    source=entries(name)
    assert len(source)==len(translations), (name,len(source),len(translations))
    list_match=re.search(r'<(ul|ol)>', sections[name])
    list_tag=list_match.group(1) if list_match else 'ul'
    items=[]
    for markup,translation in zip(source,translations):
        prefix=''
        if preserve_prefix:
            match=re.match(r'(\[[^]]+\])', text(markup))
            prefix=(match.group(1)+' ') if match else ''
        links=reference_links(markup, lang)
        items.append(f'<li><p>{prefix}{translation}{(" "+links) if links else ""}</p></li>')
    return f'<{list_tag}>'+''.join(items)+f'</{list_tag}>'

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
    '结束在华为诺亚方舟实验室的工作，并于 2024 年 10 月加入上海交通大学计算机学院任助理教授。',
]
experience_zh = [
    '中华人民共和国科学技术部借调，2026 年 1 月至今',
    '上海交通大学计算机学院助理教授，2024 年 10 月至今',
    '华为诺亚方舟实验室主任研究员，2024 年 3 月至 2024 年 9 月',
    '华为诺亚方舟实验室高级研究工程师 A，2022 年 3 月至 2024 年 2 月',
    '华为诺亚方舟实验室高级研究工程师 B，2019 年 12 月至 2022 年 2 月',
    '华为诺亚方舟实验室研究工程师，2018 年 4 月至 2019 年 11 月',
    '华为诺亚方舟实验室研究实习生，2017 年 8 月至 2018 年 3 月',
]
interest_zh = ['学习优化','具身智能','面向优化与推理的大语言模型','面向代码优化的大语言模型','数学规划求解器','强化学习','运筹学','元启发式算法','物流、供应链、存储系统等领域应用']
grant_zh = [
    '<b>负责人</b>，国家自然科学基金青年科学基金 C 类，2026—2028，30 万元',
    '<b>负责人</b>，上海市自然科学基金，2025—2028，25 万元',
    '<b>负责人</b>，上海交通大学“AI for Engineering”赋能计划 B 类，2025—2027，50 万元',
    '<b>负责人</b>，上海交通大学新进教师启动计划，2024—2027',
    '<b>负责人</b>，空天飞行器技术航空科技重点实验室基金，2025—2026',
    '<b>核心成员</b>，科技创新 2030—“新一代人工智能”重大项目，2022—2025，约 600 万元',
]
award_zh = [
    '第十九届“挑战杯”人工智能+专项赛特等奖（指导教师），2025，共青团中央、中国科协、教育部等', '战地英雄奖，2024，华为 2012 实验室',
    'Pangu 大模型“四野特别攻关奖”，2024，华为 2012 实验室', '总裁个人奖，2023，华为 2012 实验室',
    '总裁个人奖，2023，华为供应链部门', '战地英雄奖，2022，华为 2012 实验室',
    '质量之星奖，2021，华为 2012 实验室', '金牌团队奖，2020，华为 2012 实验室',
    '创新先锋奖，2020，华为 2012 实验室', '优秀新员工，2018，华为 2012 实验室',
    '上海交通大学优秀毕业生，2018 年 6 月，上海交通大学', '国家奖学金（全体学生前 5%），2017，教育部',
    '国家奖学金（全体学生前 5%），2014，教育部', '创维企业奖学金一等奖（前 5%），2015，创维集团',
    '美国大学生数学建模竞赛 Meritorious Award，2014，美国数学及其应用联合会',
]
competition_zh = ['SAT Competition 2023 并行赛道第 3 名','NeurIPS 2021 ML4CO Competition Dual Track 学生榜第 1 名','美国大学生数学建模竞赛 Meritorious Award，2014']
teaching_zh = ['主讲：GE6001 科学写作、学术规范与伦理，上海交通大学，2025—2026 秋季学期','主讲：CAMP1205-01 计算导论，上海交通大学，2024—2025 夏季学期','主讲：Python 程序设计导论，上海交通大学，2024—2025 秋季学期','助教：SE3332 机器学习导论，上海交通大学，2024—2025 春季学期']
education_zh = ['中国科学技术大学，电子工程与信息科学博士，2019 年 9 月—2024 年 3 月','上海交通大学，计算机软件工程硕士，2015 年 9 月—2018 年 3 月','华南理工大学，应用数学学士，2011 年 9 月—2015 年 6 月']
software_zh = ['OptVerse AI 求解器中的机器学习：设计原则与应用','AI 助力求解性能持续全面突破，诺亚方舟助力天筹求解器登顶 5 项权威榜单']
software_en = ['Machine Learning Inside the OptVerse AI Solver: Design Principles and Applications','AI Drives Broad Solver-Performance Breakthroughs as Noah’s Ark Lab Helps OptVerse Top Five Authoritative Rankings']
talk_zh = [
    '“将图结构先验与语言模型结合用于组合优化”，2025 大模型时代 Learning to Optimize：从算法创新到跨行业应用研讨会',
    '“天筹 AI 求解器及运筹优化落地实践”，国防科技大学 AI4OR 研讨会',
    '“顺序很重要：以机器学习技术提升数学规划求解器”，MOS2023 中国运筹学会会议',
    '“顺序很重要：以机器学习技术提升数学规划求解器”，香港中文大学（深圳）与深圳市大数据研究院',
    '“Learning to Optimize 前沿”，港中深—华为计算数学论坛与中国科学技术大学 MIRA Lab 学术讲座',
]
talk_en = [
    '“Integrating Graph Structural Priors with Language Models for Combinatorial Optimization,” at the 2025 Learning to Optimize in the Era of Large Models: From Algorithmic Innovation to Cross-Industry Applications workshop',
    '“OptVerse AI Solver and Applied Operations Optimization,” at the AI4OR workshop, National University of Defense Technology',
    '“Order Matters: Boosting Mathematical Programming Solvers via Machine Learning Techniques,” at MOS2023, Operations Research Society of China',
    '“Order Matters: Boosting Mathematical Programming Solvers via Machine Learning Techniques,” at The Chinese University of Hong Kong, Shenzhen and Shenzhen Research Institute of Big Data',
    '“Frontiers of Learning to Optimize,” at the CUHK-Shenzhen–Huawei Computing Mathematics Forum and the MIRA Lab Seminar, University of Science and Technology of China',
]
students_en_archive = [
    'Yunfan Zhou (Ph.D. student)', 'Tianyu Wang (Ph.D. student)', 'Chao Shen (Ph.D. student)', 'Qi Liu (Ph.D. student)',
    'Jiexiang Yang (Master student, <b>NeurIPS</b> 2025, <b>Outstanding Thesis</b>, Grand Prize in the 19th “Challenge Cup” AI+ category)',
    'Jinghao Wang (Master student, <b>NeurIPS</b> 2025, Grand Prize in the 19th “Challenge Cup” AI+ category)',
    'Zhengdong He (Master student, Grand Prize in the 19th “Challenge Cup” AI+ category)',
    'Ye Zhu (Master student, Grand Prize in the 19th “Challenge Cup” AI+ category)',
    'Junqing Song (Master student, Grand Prize in the 19th “Challenge Cup” AI+ category)',
    'Mingrui Yu (Master student, Zhiyuan Honors Bachelor Degree)', 'Jiabo Xu (Master student)',
    'Xinyuan Li (Undergraduate student, Strengthening Foundation Plan)',
]
alumni_en_archive = ['Mengqi Guo (Master, <b>CSCWD</b> 2026; career destination: Aviation Industry Corporation of China)']
patent_en_archive = [
    'CN122308802A End-to-end generation of FPGA-executable programs for Xilinx environments: <b>Xijun Li</b>, Tianyu Wang, Jianguo Yao',
    'CN120996196A Long-horizon planning with foundation models and symbolic solvers in open embodied environments: <b>Xijun Li</b>, Ye Zhu, Jianguo Yao',
    'CN120578395A Structure-aware code generation for combinatorial optimization problems: <b>Xijun Li</b>, Jianguo Yao',
    'CN116661676A Bandwidth control method, data processing system, and related devices: <b>Xijun Li</b>, Yunfan Zhou, Wensi Li, Ji Zhang, Mingxuan Yuan',
    'CN111738409A Resource scheduling method and related devices: <b>Xijun Li</b>, Weilin Luo, Jiawen Lu, Mingxuan Yuan',
    'CN116468099A Model structure optimization method and apparatus: <b>Xijun Li</b>, Fangzhou Zhu, Huiling Zhen, Xiaojin Fu, Meng Lu, Jia Zeng, Mingxuan Yuan',
    'CN115496247A Service data processing method and apparatus: <b>Xijun Li</b>, Xiaotian Hao, Mingxuan Yuan, Jianye Hao, Jia Zeng',
    'CN117370715A Cloud-based objective-function solving method, apparatus, and computing device: <b>Xijun Li</b>, Jianshu Li, Zhihai Wang, Jia Zeng',
    '92041897CN02 Mathematical-programming instance generation method, system, and electronic device: <b>Xijun Li</b>, Zhiwu An, Fangzhou Zhu, Zijie Geng, Jie Wang',
    'CN117371674A Goal-programming solution method, node-selection method, and apparatus: <b>Xijun Li</b>, Muming Yang, Yufei Kuang, Jia Zeng',
    'CN116933908A Computer-task processing method and related devices: Meng Lu, Huiling Zhen, <b>Xijun Li</b>, Fangzhou Zhu, Mingxuan Yuan, Jia Zeng',
    'CN111915060A Combinatorial-optimization task processing method and apparatus: Huiling Zhen, Zhenkun Wang, <b>Xijun Li</b>, Qingfu Zhang, Mingxuan Yuan',
    'CN114237835A Task-solving method and apparatus: Fangzhou Zhu, Wanqian Luo, Huiling Zhen, <b>Xijun Li</b>, Mingxuan Yuan, Jia Zeng',
    'CN112818280B Information processing method and related devices: Huiling Zhen, Zhenkun Wang, Qingfu Zhang, <b>Xijun Li</b>, Xiongwei Han',
    'CN114117715A Multi-objective task optimization method and apparatus: Zhenkun Wang, Huiling Zhen, <b>Xijun Li</b>, Qingfu Zhang, Mingxuan Yuan',
    'CN116050522A Presolve configuration method and apparatus: Weilin Luo, Bowen Pang, <b>Xijun Li</b>, Chang Liu, Junchi Yan, Jia Zeng',
    'CN116483633A Data augmentation method and related apparatus: Junhua Huang, Wanqian Luo, <b>Xijun Li</b>, Huiling Zhen, Yang Li, Junchi Yan',
    'CN117422206B Method, device, and storage medium for improving engineering decision and scheduling efficiency: Jie Wang, Haoyang Liu, Yufei Kuang, <b>Xijun Li</b>, Yongdong Zhang, Feng Wu',
    'CN121387435A Cross-virtual-machine collaborative parallel computing for blockchain as a service: Jianguo Yao, Bingjie Tu, Shicai Luo, Wei Jin, <b>Xijun Li</b>',
    'CN122734452A Event-level sample construction for compound spacecraft faults using controlled simulation: Renjun He, Qi Liu, <b>Xijun Li</b>, Mingrui Yu, Yuanpeng Fang, Jianglei Zhu, Huan Chen, Jie Zhang, Wuji Liu, Ting Li',
    'CN122734602A Evidence-constrained multistage diagnosis and audit triage for spacecraft faults: Renjun He, Mingrui Yu, <b>Xijun Li</b>, Qi Liu, Yuanpeng Fang, Jianglei Zhu, Huan Chen, Jie Zhang, Wuji Liu, Ting Li',
]

custom_zh = {
    'News': translated_list('News', news_zh, preserve_prefix=True),
    'About': '<p>李希君现任上海交通大学计算机学院助理教授、博士生导师，并担任<a href="https://tcloud.sjtu.edu.cn/people/lixijun/" target="_blank" rel="noopener noreferrer">上海市可扩展计算与系统重点实验室</a>成员。2018—2024 年在华为诺亚方舟实验室工作，曾任主任研究员。2024 年 3 月通过华为—中科大联合培养博士项目获中国科学技术大学博士学位，导师为<a href="https://miralab.ai/people/jie-wang/" target="_blank" rel="noopener noreferrer">王杰教授</a>；2018 年获上海交通大学硕士学位，导师为<a href="http://www.se.sjtu.edu.cn/Data/List/leadership" target="_blank" rel="noopener noreferrer">姚建国教授</a>。研究聚焦学习优化、大模型优化与推理、具身智能，成果发表于 TPAMI、NeurIPS、ICLR、ICML、KDD、ICDE、SIGMOD 等会议与期刊。曾参与<a href="https://www.huaweicloud.com/product/optverse.html" target="_blank" rel="noopener noreferrer">华为云天筹 OptVerse AI 求解器</a>和<a href="https://www.huaweicloud.com/product/pangu.html" target="_blank" rel="noopener noreferrer">华为 Pangu 大模型</a>研发，并担任 ICLR、NeurIPS 等会议领域主席。</p>',
    'Experience': translated_list('Experience', experience_zh),
    'Recent Interest': translated_list('Recent Interest', interest_zh),
    'Grant': translated_list('Grant', grant_zh),
    'Selected Award': translated_list('Selected Award', award_zh),
    'Competitions': translated_list('Competitions', competition_zh),
    'Software': translated_list('Software', software_zh),
    'Teaching': translated_list('Teaching', teaching_zh),
    'Invited Talk': translated_list('Invited Talk', talk_zh),
    'Education': translated_list('Education', education_zh),
}

custom_en = {
    'Patent': translated_list('Patent', patent_en_archive, lang='en'),
    'Software': translated_list('Software', software_en, lang='en'),
    'Invited Talk': translated_list('Invited Talk', talk_en, lang='en'),
    'Supervised and Co-supervised Students': translated_list('Supervised and Co-supervised Students', students_en_archive, lang='en'),
    'Alumni': translated_list('Alumni', alumni_en_archive, lang='en'),
}

def english_archive_markup(markup):
    markup=normalize_archive_markup(markup)
    replacements={
        '<b>李希君</b>, 上海, 上海交通大学: 基于信息熵的数据交易定价研究': '<b>Xijun Li</b>, Shanghai Jiao Tong University: Information-Entropy-Based Pricing for Data Transactions',
        '共青团中央，中国科协，教育部等': 'Central Committee of the Communist Youth League of China, China Association for Science and Technology, Ministry of Education, et al.',
        'MOS2023 中国运筹学会': 'MOS2023, Operations Research Society of China',
        'CUHKSZ 香港中文大学 (深圳)': 'The Chinese University of Hong Kong, Shenzhen',
        'SRIBD 深圳大数据研究院': 'Shenzhen Research Institute of Big Data',
        'CUHKSZ-HUAWEI Computing Mathematic Forum 港中深-华为计算数学论坛': 'CUHK-Shenzhen–Huawei Computing Mathematics Forum',
        'MIRA Lab Seminar of USTC 中国科学技术大学 MIRA Lab 学术讲座': 'MIRA Lab Seminar, USTC',
    }
    for source,replacement in replacements.items():
        markup=markup.replace(source,replacement)
    cjk_parenthetical=re.compile(r'\s*\([^()]*[\u3400-\u9fff][^()]*\)')
    while cjk_parenthetical.search(markup):
        markup=cjk_parenthetical.sub('',markup)
    return markup

def translate_people(markup):
    replacements={'Ph.D. student':'博士生','Master student':'硕士生','Undergraduate studeent':'本科生',
                  'Undergraduate student':'本科生','Master,':'硕士，','PhD graduated from':'博士毕业于',
                  'PhD student @':'博士生，就读于','Msc graduated from':'硕士毕业于','Msc student @':'硕士生，就读于',
                  'graduated from':'本科毕业于','Excellent Intern':'优秀实习生','certificate':'证书'}
    for a,b in replacements.items(): markup=markup.replace(a,b)
    return markup

def archive_link(href, label):
    return f'<a href="{escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(label)}</a>'

def archive_profile(lang):
    zh=lang == 'zh'
    role='上海交通大学计算机学院助理教授、博士生导师' if zh else 'Assistant Professor and Ph.D. Advisor, School of Computer Science, Shanghai Jiao Tong University'
    degree='中国科学技术大学博士' if zh else 'Ph.D., University of Science and Technology of China'
    membership='中国民主促进会会员' if zh else 'Member of the China Association for Promoting Democracy (CAPD)'
    address='上海市闵行区东川路 800 号软件大楼 1411 室' if zh else 'Rm 1411, Software Bldg, 800 Dongchuan Road, Minhang, Shanghai, China'
    profile_labels=['上海交大主页','Google Scholar','个人简历','GitHub','会议倒计时'] if zh else ['SJTU Homepage','Google Scholar','Curriculum Vitae','GitHub','Conference Countdown']
    profile_urls=[
        'https://www.cs.sjtu.edu.cn/en/jiaoshiml/lixijun.html',
        'https://scholar.google.com/citations?user=QXU_QbMAAAAJ&hl=en',
        'https://xijun-doc.oss-cn-hongkong.aliyuncs.com/SJTU_XijunLi_CV2025.pdf',
        'https://github.com/SJTU-L2O',
        'https://ccfddl.com/',
    ]
    identity_lines='<br>'.join([
        archive_link('https://en.sjtu.edu.cn/', role),
        archive_link('https://en.ustc.edu.cn/', degree),
        archive_link('https://www.mj.org.cn/', membership),
    ])
    links=' '.join(f'[{archive_link(url,label)}]' for url,label in zip(profile_urls,profile_labels))
    email_label='邮箱' if zh else 'E-mail'
    address_label='地址' if zh else 'Address'
    field_colon='：' if zh else ': '
    return f'''<div id="toptitle"><h1>{'李希君（Xijun Li）' if zh else 'Xijun Li (李希君)'}</h1></div><table class="imgtable archive-profile"><tbody><tr><td><a href="https://xijunlee.github.io/" target="_blank" rel="noopener noreferrer"><img src="assets/portrait.png" alt="{'李希君肖像' if zh else 'Portrait of Xijun Li'}" width="134" height="180"></a></td><td><p>{identity_lines}<br><br>{email_label}{field_colon}lixijun AT sjtu DOT edu DOT cn ({'优先' if zh else 'preferred'}), xijun.lee AT hotmail DOT com<br>{address_label}{field_colon}{address}<br><br><span class="archive-profile-links">{links}</span></p></td></tr></tbody></table>'''

def archive_recruitment(lang):
    zh=lang == 'zh'
    heading='招生与研究机会' if zh else 'Open Positions & Research Opportunities'
    intern_title='科研实习生 · 长期招收' if zh else 'Research Interns · Year-round Recruitment'
    intern_copy='实验室具备充足的具身智能、GPU、NPU 与 CPU 等研究资源，并长期开放科研实习岗位。' if zh else 'Our lab provides abundant resources for embodied intelligence, GPU, NPU, and CPU research, with research internship applications welcome year-round.'
    student_title='博士生、硕士生与本科生' if zh else 'Ph.D., Master, and Undergraduate Students'
    student_copy='欢迎对 Learning to Optimize 以及大语言模型优化与推理感兴趣、有内驱力的同学联系。请将个人简历发送至邮箱预约交流。' if zh else 'We welcome self-driven students interested in Learning to Optimize and large language models for optimization and reasoning. Email your CV to arrange a discussion.'
    apply_label='查看申请细则 ↗' if zh else 'Application details (Chinese) ↗'
    email_label='发送个人简历 ↗' if zh else 'Email your CV ↗'
    colon='：' if zh else ': '
    title=f'【{heading}】' if zh else f'[{heading}]'
    return f'''<div class="infoblock archive-recruit" aria-label="{heading}"><div class="blockcontent"><p class="archive-recruit-title">{title}</p><ul><li><p><b>{intern_title}</b>{colon}{intern_copy} {archive_link('https://qcni2w0qwumb.feishu.cn/wiki/LmiqwT1bEiHADOkVMXnce8qOnTh?from=from_copylink', apply_label)}</p></li><li><p><b>{student_title}</b>{colon}{student_copy} {archive_link('mailto:lixijun@sjtu.edu.cn', email_label)}</p></li></ul></div></div>'''

people_sections={'Supervised and Co-supervised Students','Alumni','Interns and Collaborators'}
archive_rows=[]
for h in headings:
    level=h.group(1)
    name=text(h.group(2))
    en_part=english_archive_markup(custom_en.get(name, sections[name]))
    zh_part=normalize_archive_markup(custom_zh.get(name, sections[name]))
    if name in people_sections:
        zh_part=translate_people(zh_part)
    archive_rows.append({
        'level': level,
        'name': name,
        'id': slug(name),
        'en_title': name,
        'zh_title': heading_zh.get(name, name),
        'en': en_part,
        'zh': zh_part,
    })

def archive_section(row, lang):
    title=row[f'{lang}_title']
    return f'''<section class="archive-section archive-level-{row['level']}" data-archive-key="{escape(row['name'], quote=True)}"><h{row['level']} id="{row['id']}">{escape(title)}</h{row['level']}>{row[lang]}</section>'''

def archive_page(lang):
    zh=lang == 'zh'
    home='index.html' if zh else 'en.html'
    counterpart='archive.html' if zh else 'archive-zh.html'
    title='完整学术档案' if zh else 'Full Academic Profile'
    subtitle='论文、项目、专利、教学、学术服务与学生培养' if zh else 'Publications, projects, patents, teaching, academic service, and student supervision'
    nav=''.join(f'<a href="#{row["id"]}">{escape(row["zh_title"] if zh else row["en_title"])}</a>' for row in archive_rows)
    body=archive_profile(lang)+archive_recruitment(lang)+''.join(archive_section(row,lang) for row in archive_rows)
    switch=f'<span aria-current="page">中</span><a href="{counterpart}" lang="en">EN</a>' if zh else f'<a href="{counterpart}" lang="zh-CN">中</a><span aria-current="page">EN</span>'
    description='李希君的完整学术档案：论文、项目、专利、经历、教学、服务和学生培养。' if zh else 'Complete academic archive of Xijun Li: publications, patents, grants, experience, teaching, service, and students.'
    return f'''<!doctype html><html lang="{'zh-CN' if zh else 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · {'李希君' if zh else 'Xijun Li'}</title><meta name="description" content="{description}"><meta name="theme-color" content="#f3f8fc"><link rel="stylesheet" href="styles.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"></head><body data-lang="{lang}"><a class="skip-link" href="#archive-main">{'跳至主要内容' if zh else 'Skip to main content'}</a><header class="site-header"><div class="container header-inner"><a class="wordmark" href="{home}" aria-label="{'李希君主页' if zh else 'Xijun Li homepage'}"><img class="site-logo" src="assets/sjtu-banner-blue.png" alt="{'上海交通大学 Shanghai Jiao Tong University' if zh else 'Shanghai Jiao Tong University 上海交通大学'}"></a><div class="lang-switch archive-language">{switch}</div><a class="nav-join" href="{home}#join">{'招生与实习' if zh else 'Join Us'} ↗</a></div></header><div class="container archive-hero"><a class="archive-back" href="{home}">← {'返回主页' if zh else 'Back to homepage'}</a><h1>{title}</h1><p>{subtitle}</p></div><div class="container archive-layout"><nav class="archive-nav" aria-label="{'档案目录' if zh else 'Archive sections'}">{nav}</nav><main id="archive-main" class="legacy-content">{body}</main></div><footer class="site-footer container"><a href="{home}">← {'返回主页' if zh else 'Back to homepage'}</a><a href="{counterpart}" lang="{'en' if zh else 'zh-CN'}">{'English profile' if zh else '中文档案'} ↗</a><span>© 2026 Xijun Li</span></footer></body></html>'''

archive=archive_page('en')
archive_zh=archive_page('zh')
(OUT/'archive.html').write_text(archive)
(OUT/'archive-zh.html').write_text(archive_zh)

# The archive pair must expose the same information in the same order.
def href_sequence(markup):
    return [unescape(u) for u in re.findall(r'<a\s+[^>]*href="([^"]+)"', markup)]

profile_en,profile_zh=archive_profile('en'),archive_profile('zh')
recruit_en,recruit_zh=archive_recruitment('en'),archive_recruitment('zh')
assert href_sequence(profile_en) == href_sequence(profile_zh)
assert href_sequence(recruit_en) == href_sequence(recruit_zh)
assert len(re.findall(r'<li\b', recruit_en)) == len(re.findall(r'<li\b', recruit_zh)) == 2
for row in archive_rows:
    assert href_sequence(row['en']) == href_sequence(row['zh']), f'Archive links differ: {row["name"]}'
    assert len(re.findall(r'<li\b', row['en'])) == len(re.findall(r'<li\b', row['zh'])), f'Archive items differ: {row["name"]}'
assert [row['id'] for row in archive_rows] == [slug(text(h.group(2))) for h in headings]
assert len(re.findall(r'class="archive-section ', archive)) == len(re.findall(r'class="archive-section ', archive_zh)) == len(headings)
assert len(re.findall(r'<li\b', archive)) == len(re.findall(r'<li\b', archive_zh))
assert href_sequence(profile_en+recruit_en+''.join(row['en'] for row in archive_rows)) == href_sequence(profile_zh+recruit_zh+''.join(row['zh'] for row in archive_rows))

# Verify that every public link from the source survives in both archive languages.
original_public=re.sub(r'<!--.*?-->', '', re.search(r'<body>(.*?)</body>',ORIGINAL,re.S).group(1), flags=re.S).split('<div id="footer">',1)[0]
old_links=set(unescape(u) for u in re.findall(r'<a\s+href="([^"]+)"', original_public))
for page_markup in (archive,archive_zh):
    new_links=set(href_sequence(page_markup))
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
for asset in ('assets/portrait.png','assets/favicon.svg','assets/sjtu-logo.png','assets/sjtu-banner-blue.png','assets/ustc-logo.jpg','assets/huawei-logo.png','styles.css','app.js','data.js'):
    assert (OUT/asset).is_file(), asset
for page in ('index.html','en.html','archive.html','archive-zh.html'):
    assert 'PanGu' not in (OUT/page).read_text(), page
print(f'Built {OUT}')
print(f'CCF 2026: A={stats["A"]}, B={stats["B"]}, C={stats["C"]}; 38 publication entries, 11 preprints, 21 patent entries, 6 grants.')
archive_item_count=len(re.findall(r'<li\b', archive))
print(f'Bilingual archives aligned: {len(archive_rows)} sections, {archive_item_count} list items, and {len(old_links)} distinct source links per language. Local anchors verified.')
