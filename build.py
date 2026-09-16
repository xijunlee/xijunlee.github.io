"""Build and validate the bilingual static academic website."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape, unescape
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
CONTENT = ROOT / 'content'
OUT = ROOT / 'dist'

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

def parse_archive_source(path):
    """Read the editable archive sections while preserving their public HTML."""
    source = path.read_text(encoding='utf-8')
    pattern = re.compile(
        r'<section class="archive-section archive-level-(?P<level>[23])" '
        r'data-archive-key="(?P<key>[^"]+)"><h(?P=level) id="(?P<id>[^"]+)">'
        r'(?P<title>.*?)</h(?P=level)>(?P<body>.*?)</section>',
        re.S,
    )
    rows = [match.groupdict() for match in pattern.finditer(source)]
    for row in rows:
        row['key'] = unescape(row['key'])
        row['title'] = unescape(row['title'])
    assert rows and len(rows) == source.count('<section class="archive-section '), f'Invalid archive markup: {path}'
    assert len({row['key'] for row in rows}) == len(rows), f'Duplicate archive key: {path}'
    assert len({row['id'] for row in rows}) == len(rows), f'Duplicate archive id: {path}'
    return rows

archive_en_rows = parse_archive_source(CONTENT / 'archive-en.html')
archive_zh_rows = parse_archive_source(CONTENT / 'archive-zh.html')
assert [row['key'] for row in archive_en_rows] == [row['key'] for row in archive_zh_rows], 'Archive section order differs'
assert [row['level'] for row in archive_en_rows] == [row['level'] for row in archive_zh_rows], 'Archive heading levels differ'
assert [row['id'] for row in archive_en_rows] == [row['id'] for row in archive_zh_rows], 'Archive anchors differ'

archive_rows = [{
    'level': en['level'], 'name': en['key'], 'id': en['id'],
    'en_title': en['title'], 'zh_title': zh['title'],
    'en': clean_links(en['body']), 'zh': clean_links(zh['body']),
} for en, zh in zip(archive_en_rows, archive_zh_rows)]
sections = {row['name']: row['en'] for row in archive_rows}
sections_zh = {row['name']: row['zh'] for row in archive_rows}

required_sections = {
    'News', 'About', 'Experience', 'Research', 'Recent Interest', 'Publication',
    'Grant', 'Selected Award', 'Patent', 'Preprint', 'Teaching', 'Education',
    'Service', 'Supervised and Co-supervised Students', 'Alumni',
    'Interns and Collaborators',
}
assert required_sections <= sections.keys(), f'Missing archive sections: {required_sections - sections.keys()}'

def entries(name, lang='en'):
    source = sections_zh if lang == 'zh' else sections
    return [x for x in re.findall(r'<li>\s*<p>(.*?)</p>\s*</li>', source[name], re.S) if not text(x).startswith('where ')]

venue_ranks = {
    'TPAMI': 'A', 'NeurIPS': 'A', 'ICML': 'A', 'ICLR': 'A',
    'KDD': 'A', 'ICDE': 'A', 'DAC': 'A',
    'MSST': 'B', 'CIKM': 'B', 'ICDCS': 'B', 'IEEE Transactions on Cybernetics': 'B',
    'CSCWD': 'C', 'MDM': 'C', 'IJCNN': 'C', 'Neurocomputing': 'C',
}
venue_names = list(venue_ranks) + ['SIGMOD', 'Machine Intelligence Research', 'TAES', 'Complex & Intelligent Systems', 'AAAI']
descriptions = {
    'STRCMP: Integrating Graph Structural Priors with Language Models for Combinatorial Optimization': '将图结构先验与语言模型结合，用于组合优化问题求解。',
    'Differentiable Integer Linear Programming': '探索可微整数线性规划，将优化问题与学习过程相连接。',
    'A Deep Instance Generative Framework for MILP Solvers Under Limited Data Availability': '在数据有限的条件下，为混合整数线性规划求解器生成问题实例。',
    'Learning Cut Selection for Mixed-Integer Linear Programming via Hierarchical Sequence Model': '通过层次化序列模型学习割平面选择，提升混合整数规划求解效率。',
    'Characterizing Vision-Language-Action Models across XPUs: Constraints and Acceleration for On-Robot Deployment': '分析视觉—语言—动作模型在异构计算平台上的约束与具身系统部署加速。',
}
descriptions_en = {
    'STRCMP: Integrating Graph Structural Priors with Language Models for Combinatorial Optimization': 'Combines graph structural priors with language models for combinatorial optimization.',
    'Differentiable Integer Linear Programming': 'Connects integer linear programming with learning through differentiable optimization.',
    'A Deep Instance Generative Framework for MILP Solvers Under Limited Data Availability': 'Generates mixed-integer programming instances when solver training data is limited.',
    'Learning Cut Selection for Mixed-Integer Linear Programming via Hierarchical Sequence Model': 'Learns cut selection with a hierarchical sequence model for efficient mixed-integer programming.',
    'Characterizing Vision-Language-Action Models across XPUs: Constraints and Acceleration for On-Robot Deployment': 'Characterizes VLA models across heterogeneous hardware and accelerates deployment in embodied systems.',
}
known_years = {
    'Promoting Generalization for Exact Combinatorial Solvers via Adversarial Instance Augmentation': 2026,
    'Accelerate Presolve in Large-Scale Linear Programming via Reinforcement Learning': 2025,
    'Learning to Cut via Hierarchical Sequence/Set Model for Efficient Mixed-Integer Programming': 2024,
}
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
    is_thesis = 'master thesis' in plain.lower() or '基于信息熵的数据交易定价研究' in plain
    venue = next((v for v in venue_names if re.search(r'\b' + re.escape(v) + r'\b', tv)), '学位论文' if is_thesis else '其他')
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
    year = int(year_match.group(1)) if year_match else known_years.get(title)
    rank = venue_ranks.get(venue, 'other')
    note = ''
    if 'Accelerating Linear Programming Solving by Exploiting the Performance Variability' in title:
        rank = 'other'
        note = 'Workshop'
    elif 'ML4CO Competition' in plain:
        rank = 'other'
        note = '竞赛报告'
    elif venue == 'SIGMOD':
        rank = 'other'
        note = '论文类型待核对 · 会议 CCF A'
    elif is_thesis:
        rank = 'other'
        note = '硕士学位论文'
    elif rank == 'other':
        note = 'CCF 目录外'
    papers.append({'id': i, 'title': title, 'authors_html': authors_html, 'venue': venue,
                   'year': year, 'rank': rank, 'note': note, 'links': links,
                   'spotlight': 'Spotlight' in plain,
                   'description': descriptions.get(title, ''), 'description_en': descriptions_en.get(title, ''),
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
                   'links': links, 'spotlight': False, 'description': '',
                   'description_en': '',
                   'search': plain, 'type': 'preprint'})

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
publication_count = len(entries('Publication'))
preprint_count = len(entries('Preprint'))
patent_count = len(entries('Patent'))
grant_count = len(entries('Grant'))
news_count = len(entries('News'))
student_count = len(entries('Supervised and Co-supervised Students'))
pi_grant_count = sum('(PI)' in text(item) for item in entries('Grant'))
core_grant_count = grant_count - pi_grant_count
assert all((publication_count, patent_count, grant_count, news_count, student_count)), 'A required archive list is empty'

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
for p in entries('Patent', 'zh')[:3]:
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

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for f in SRC.iterdir():
    if f.is_file(): shutil.copy2(f, OUT/f.name)
shutil.copytree(SRC/'assets', OUT/'assets', dirs_exist_ok=True)
template_values = {
    'PUBLICATION_COUNT': publication_count,
    'PREPRINT_COUNT': preprint_count,
    'CCF_A_COUNT': stats['A'],
    'CCF_B_COUNT': stats['B'],
    'CCF_C_COUNT': stats['C'],
    'PATENT_COUNT': patent_count,
    'PI_GRANT_COUNT': pi_grant_count,
    'CORE_GRANT_COUNT': core_grant_count,
    'NEWS_COUNT': news_count,
}

def apply_values(markup):
    for key, value in template_values.items():
        markup = markup.replace('{{' + key + '}}', str(value))
    return markup

index=apply_values((SRC/'index.html').read_text(encoding='utf-8'))
ccf_a_papers=sorted((p for p in papers if p['rank']=='A'), key=lambda p: (-(p['year'] or 0), p['id']))
index=index.replace('{{CCF_A_PAPERS}}',''.join(paper_html(p) for p in ccf_a_papers))
index=index.replace('{{GRANT_PREVIEW}}',grants).replace('{{PATENT_PREVIEW}}',patents).replace('{{STUDENT_PREVIEW}}',students)
(OUT/'index.html').write_text(index, encoding='utf-8')
english=apply_values((SRC/'en.html').read_text(encoding='utf-8'))
english=english.replace('{{CCF_A_PAPERS_EN}}',''.join(paper_html(p, 'en') for p in ccf_a_papers))
english=english.replace('{{GRANT_PREVIEW_EN}}',grants_en).replace('{{PATENT_PREVIEW_EN}}',patents_en).replace('{{STUDENT_PREVIEW_EN}}',students_en)
(OUT/'en.html').write_text(english, encoding='utf-8')
client_data = {'papers': [{key: value for key, value in paper.items() if key != 'type'} for paper in papers]}
(OUT/'data.js').write_text('window.ACADEMIC_DATA = '+json.dumps(client_data,ensure_ascii=False,separators=(',', ':')).replace('</','<\\/')+';\n', encoding='utf-8')
index=index.replace('<script src="app.js" defer></script>', '<script src="data.js" defer></script>\n  <script src="app.js" defer></script>')
(OUT/'index.html').write_text(index, encoding='utf-8')
english=english.replace('<script src="app.js" defer></script>', '<script src="data.js" defer></script>\n  <script src="app.js" defer></script>')
(OUT/'en.html').write_text(english, encoding='utf-8')

# Archive content lives in content/archive-en.html and content/archive-zh.html.

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
    heading='招生与研究机会' if zh else 'Open Positions &amp; Research Opportunities'
    intern_title='科研实习生 · 长期招收' if zh else 'Research Interns · Year-round Recruitment'
    intern_copy='实验室具备充足的具身智能、GPU、NPU 与 CPU 等研究资源，并长期开放科研实习岗位。' if zh else 'Our lab provides abundant resources for embodied intelligence, GPU, NPU, and CPU research, with research internship applications welcome year-round.'
    student_title='博士生与硕士生' if zh else 'Ph.D. and Master Students'
    student_copy='欢迎对 Learning to Optimize 以及大语言模型优化与推理感兴趣、有内驱力的同学联系。请将个人简历发送至邮箱预约交流。' if zh else 'We welcome self-driven students interested in Learning to Optimize and large language models for optimization and reasoning. Email your CV to arrange a discussion.'
    apply_label='查看申请细则 ↗' if zh else 'Application details (Chinese) ↗'
    email_label='发送个人简历 ↗' if zh else 'Email your CV ↗'
    colon='：' if zh else ': '
    title=f'【{heading}】' if zh else f'[{heading}]'
    return f'''<div class="infoblock archive-recruit" aria-label="{heading}"><div class="blockcontent"><p class="archive-recruit-title">{title}</p><ul><li><p><b>{intern_title}</b>{colon}{intern_copy} {archive_link('https://qcni2w0qwumb.feishu.cn/wiki/LmiqwT1bEiHADOkVMXnce8qOnTh?from=from_copylink', apply_label)}</p></li><li><p><b>{student_title}</b>{colon}{student_copy} {archive_link('mailto:lixijun@sjtu.edu.cn', email_label)}</p></li></ul></div></div>'''

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
    page_title = f"上海交通大学 · 李希君 · {title}" if zh else f"Shanghai Jiao Tong University · Xijun Li · {title}"
    design_credit = '© 2026 · 由李希君和 Codex 共同设计' if zh else '© 2026 · Co-designed by Xijun Li and Codex'
    return f'''<!doctype html><html lang="{'zh-CN' if zh else 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{page_title}</title><meta name="description" content="{description}"><meta name="theme-color" content="#f3f8fc"><link rel="stylesheet" href="styles.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"></head><body data-lang="{lang}"><a class="skip-link" href="#archive-main">{'跳至主要内容' if zh else 'Skip to main content'}</a><header class="site-header"><div class="container header-inner"><a class="wordmark" href="{home}" aria-label="{'李希君主页' if zh else 'Xijun Li homepage'}"><img class="site-logo" src="assets/sjtu-banner-blue.png" alt="{'上海交通大学 Shanghai Jiao Tong University' if zh else 'Shanghai Jiao Tong University 上海交通大学'}"></a><div class="lang-switch archive-language">{switch}</div><a class="nav-join" href="{home}#join">{'招生与实习' if zh else 'Join Us'} ↗</a></div></header><div class="container archive-hero"><a class="archive-back" href="{home}">← {'返回主页' if zh else 'Back to homepage'}</a><h1>{title}</h1><p>{subtitle}</p></div><div class="container archive-layout"><nav class="archive-nav" aria-label="{'档案目录' if zh else 'Archive sections'}">{nav}</nav><main id="archive-main" class="legacy-content">{body}</main></div><footer class="site-footer container"><a href="{home}">← {'返回主页' if zh else 'Back to homepage'}</a><a href="{counterpart}" lang="{'en' if zh else 'zh-CN'}">{'English profile' if zh else '中文档案'} ↗</a><span>{design_credit}</span></footer></body></html>'''

archive=archive_page('en')
archive_zh=archive_page('zh')
(OUT/'archive.html').write_text(archive, encoding='utf-8')
(OUT/'archive-zh.html').write_text(archive_zh, encoding='utf-8')

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
assert [row['id'] for row in archive_rows] == [slug(row['name']) for row in archive_rows]
assert len(re.findall(r'class="archive-section ', archive)) == len(re.findall(r'class="archive-section ', archive_zh)) == len(archive_rows)
assert len(re.findall(r'<li\b', archive)) == len(re.findall(r'<li\b', archive_zh))
assert href_sequence(profile_en+recruit_en+''.join(row['en'] for row in archive_rows)) == href_sequence(profile_zh+recruit_zh+''.join(row['zh'] for row in archive_rows))

archive_links=set(href_sequence(profile_en+recruit_en+''.join(row['en'] for row in archive_rows)))
assert '{{' not in index and '}}' not in index
assert '{{' not in english and '}}' not in english
for page in ('index.html','en.html','archive.html','archive-zh.html'):
    html=(OUT/page).read_text(encoding='utf-8')
    ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids)), f'Duplicate ids: {page}'
    for href in re.findall(r'href="([^"]+)"',html):
        if href.startswith('#') and len(href)>1: assert href[1:] in ids, (page,href)
        if re.match(r'^(?:https?:|mailto:)', href):
            continue
        target_name, _, fragment = href.partition('#')
        target = OUT / (target_name or page)
        assert target.is_file(), f'Missing local target in {page}: {href}'
        if fragment:
            target_html = target.read_text(encoding='utf-8')
            assert f'id="{fragment}"' in target_html, f'Missing anchor in {page}: {href}'
for asset in ('assets/portrait.png','assets/favicon.svg','assets/sjtu-logo.png','assets/sjtu-banner-blue.png','assets/ustc-logo.jpg','assets/huawei-logo.png','styles.css','app.js','data.js','.nojekyll'):
    assert (OUT/asset).is_file(), asset
for page in ('index.html','en.html','archive.html','archive-zh.html'):
    assert 'PanGu' not in (OUT/page).read_text(encoding='utf-8'), page
print(f'Built {OUT}')
print(f'CCF 2026: A={stats["A"]}, B={stats["B"]}, C={stats["C"]}; {publication_count} publication entries, {preprint_count} preprints, {patent_count} patent entries, {grant_count} grants.')
archive_item_count=len(re.findall(r'<li\b', archive))
print(f'Bilingual archives aligned: {len(archive_rows)} sections, {archive_item_count} list items, and {len(archive_links)} distinct content links per language. Local files and anchors verified.')
