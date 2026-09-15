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
                   'description': descriptions.get(i, ''), 'original_html': markup,
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
                   'original_html': markup, 'search': plain, 'type': 'preprint'})

def paper_html(p):
    href = escape(p['links'][0]['href'], quote=True) if p['links'] else 'archive.html#publication'
    badge = 'CCF ' + p['rank'] if p['rank'] != 'other' else p['note']
    links = ''.join(f'<a href="{escape(x["href"], quote=True)}" target="_blank" rel="noopener noreferrer">{escape(x["label"])} ↗</a>' for x in p['links'])
    spotlight = '<span class="spotlight">✧ Spotlight</span>' if p['spotlight'] else ''
    return f'''<article class="paper"><div class="paper-meta"><div class="paper-venue">{escape(p['venue'])}</div><div class="paper-year">{p['year'] or '—'}</div><span class="ccf-badge">{escape(badge)}</span></div><div><h3><a href="{href}" target="_blank" rel="noopener noreferrer">{escape(p['title'])}</a></h3>{('<p class="paper-description">'+escape(p['description'])+'</p>') if p['description'] else ''}<p class="paper-authors">{p['authors_html']}</p><div class="paper-resources">{spotlight}{links}</div></div><a class="paper-arrow" href="{href}" target="_blank" rel="noopener noreferrer" aria-label="阅读 {escape(p['title'], quote=True)}">↗</a></article>'''

stats = {r: sum(p['rank'] == r for p in papers if p['type'] == 'publication') for r in ('A','B','C','other')}
assert len(entries('Publication')) == 38
assert len(entries('Preprint')) == 11
assert len(entries('Patent')) == 21
assert len(entries('Grant')) == 6
assert len(entries('Supervised and Co-supervised Students')) == 12
assert stats == {'A': 23, 'B': 4, 'C': 4, 'other': 7}, stats

grant_preview = [
    ('国家自然科学基金青年科学基金 C 类', 'PI · 2026—2028'),
    ('上海市自然科学基金', 'PI · 2025—2028'),
    ('上海交大 AI for Engineering 赋能计划 B 类', 'PI · 2025—2027'),
    ('科技创新 2030 —“新一代人工智能”重大项目', '核心成员 · 2022—2025'),
]
grants = ''.join(f'<div class="grant-item"><span class="grant-number">0{i}</span><div><strong>{name}</strong><p>{label}</p></div></div>' for i,(name,label) in enumerate(grant_preview,1))
patents = ''
for p in entries('Patent')[:3]:
    s=text(p); number,title=s.split(' ',1); title=title.split('：')[0]
    patents += f'<div class="patent-item"><span>{escape(number)}</span><h4>{escape(title)}</h4></div>'
students = ''
for p in entries('Supervised and Co-supervised Students'):
    s=text(p); name=s.split(' (')[0]
    label='博士生' if 'Ph.D.' in s else '本科生' if 'Undergraduate' in s else '硕士生'
    students += f'<div class="person"><strong>{escape(name)}</strong><span>{label}</span></div>'

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
data={'papers': papers, 'stats': stats, 'selected_ids': selected_ids,
      'source_date': '2026-09-15', 'ccf_edition': '第七版（2026）',
      'ccf_source': 'https://www.ccf.org.cn/ccf/contentcore/resource/download?ID=112CF3BF7E1140ACEB271ADAED12A67ADFABB8FF099E40C2759502A85C8A281F'}
(OUT/'data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(OUT/'data.js').write_text('window.ACADEMIC_DATA = '+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';\n')
index=index.replace('<script src="app.js" defer></script>', '<script src="data.js" defer></script>\n  <script src="app.js" defer></script>')
(OUT/'index.html').write_text(index)

body=re.search(r'<body>(.*?)</body>', ORIGINAL,re.S).group(1)
body=re.sub(r'<!--.*?-->', '', body, flags=re.S)
body=clean_links(body)
body=re.sub(r'<h([23])>(.*?)</h\1>', lambda m:f'<h{m.group(1)} id="{slug(text(m.group(2)))}">{m.group(2)}</h{m.group(1)}>', body, flags=re.S)
body=body.replace('https://xijun-album.oss-cn-hangzhou.aliyuncs.com/avatar/xijun_portrait_nano_banana.png','assets/portrait.png')
nav=''.join(f'<a href="#{slug(text(h.group(2)))}">{escape(text(h.group(2)))}</a>' for h in headings)
archive=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>完整学术档案 · Xijun Li</title><meta name="description" content="Complete academic archive of Xijun Li: publications, patents, grants, experience, teaching, service and students."><link rel="stylesheet" href="styles.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"></head><body><a class="skip-link" href="#archive-main">跳至主要内容</a><header class="site-header"><div class="container header-inner"><a class="wordmark" href="index.html"><span class="monogram">XL<span>•</span></span><span class="wordmark-name">李希君 <span>Xijun Li</span></span></a><a class="nav-join" style="margin-left:auto" href="index.html#join">招生与实习 ↗</a></div></header><div class="container archive-hero"><a class="archive-back" href="index.html">← 返回主页</a><h1>完整学术档案</h1><p>Complete academic profile · Publications, projects, patents, teaching & people</p></div><div class="container archive-layout"><nav class="archive-nav" aria-label="Archive sections">{nav}</nav><main id="archive-main" class="legacy-content">{body}</main></div><footer class="site-footer container"><a href="index.html">← 返回主页</a><span>© 2026 Xijun Li</span></footer></body></html>'''
(OUT/'archive.html').write_text(archive)

# Verify all original public text and external links survive in the archive.
original_public=re.sub(r'<!--.*?-->', '', re.search(r'<body>(.*?)</body>',ORIGINAL,re.S).group(1), flags=re.S)
assert text(original_public) == text(body), 'Archive text was lost during migration'
old_links=set(unescape(u) for u in re.findall(r'<a\s+href="([^"]+)"', original_public))
new_links=set(unescape(u) for u in re.findall(r'<a\s+href="([^"]+)"', archive))
assert old_links <= new_links, old_links-new_links
assert '{{' not in index and '}}' not in index
for page in ('index.html','archive.html'):
    html=(OUT/page).read_text()
    ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids)), f'Duplicate ids: {page}'
    for href in re.findall(r'href="([^"]+)"',html):
        if href.startswith('#') and len(href)>1: assert href[1:] in ids, (page,href)
        if href.startswith('archive.html#'):
            assert f'id="{href.split("#")[1]}"' in archive, href
for asset in ('assets/portrait.png','assets/favicon.svg','styles.css','app.js','data.js'):
    assert (OUT/asset).is_file(), asset
print(f'Built {OUT}')
print(f'CCF 2026: A={stats["A"]}, B={stats["B"]}, C={stats["C"]}; 38 publication entries, 11 preprints, 21 patent entries, 6 grants.')
print(f'Archive preserves all original public text and {len(old_links)} distinct original links. Local anchors verified.')
