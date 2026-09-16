# 李希君个人学术主页

上海交通大学李希君的中英双语学术主页，面向成果展示、学术交流与招生。网站为纯静态页面，不需要数据库、服务器端程序或第三方前端框架。

## 页面组成

- `index.html`：中文主页
- `en.html`：英文主页
- `archive-zh.html`：中文完整学术档案
- `archive.html`：英文完整学术档案

构建后的文件位于 `dist/`。该目录由程序自动生成，不要直接修改，也不需要提交到 Git。

## 项目结构

```text
.
├── content/
│   ├── archive-zh.html       # 中文完整档案内容
│   └── archive-en.html       # 英文完整档案内容
├── src/
│   ├── index.html            # 中文主页模板
│   ├── en.html               # 英文主页模板
│   ├── styles.css            # 全站样式与响应式布局
│   ├── app.js                # 菜单、论文筛选与搜索
│   └── assets/               # 照片、校徽、机构标志和 favicon
├── scripts/publish.sh        # 一键检查、提交并推送
├── .github/workflows/        # GitHub Pages 自动构建与部署
├── build.py                  # 构建、统计和完整性检查
├── package.json              # 常用命令入口
└── README.md                 # 本教程
```

## 本地运行

### 1. 所需工具

- Python 3
- Node.js（自带 `npm`）
- Git

项目没有第三方软件包，因此不需要运行 `npm install`。

### 2. 构建和检查

```bash
npm run check
```

该命令会：

1. 清空并重新生成 `dist/`；
2. 自动统计论文、CCF 分类、预印本、专利、项目和动态数量；
3. 检查中英文档案章节、条目及链接是否对齐；
4. 检查所有站内页面、锚点和图片文件；
5. 检查 JavaScript 语法。

任何一步失败都会停止构建，并给出需要修正的位置。

### 3. 本地预览

```bash
npm run preview
```

浏览器访问：

- 中文主页：<http://127.0.0.1:4317/index.html>
- 英文主页：<http://127.0.0.1:4317/en.html>

按 `Ctrl+C` 停止预览服务。

## 日常修改方法

### 修改首页文字或首页精选内容

同时修改：

- 中文：[src/index.html](src/index.html)
- 英文：[src/en.html](src/en.html)

首页中的个人简介、近期四条动态、研究方向、精选项目、学生成果和招生文案都在这两个文件中。

### 修改完整学术档案

同时修改：

- 中文：[content/archive-zh.html](content/archive-zh.html)
- 英文：[content/archive-en.html](content/archive-en.html)

两份文件必须保持：

- 相同的章节顺序；
- 相同的 `data-archive-key` 和标题 `id`；
- 每个章节相同的条目数量；
- 对应条目包含相同的外部链接，链接顺序一致。

构建程序会自动检查这些要求。

### 新增论文

1. 在两份档案的 `Publication` 章节相同位置各添加一个 `<li><p>...</p></li>`。
2. 英文条目建议沿用以下格式，首页会据此识别作者、标题、会议、年份和链接：

```html
<li><p>Author A, <b>Xijun Li</b>: Paper Title. <b>NeurIPS</b> 2027
[<a href="论文链接" target="_blank" rel="noopener noreferrer">pdf</a>]
</p></li>
```

3. 如果会议尚未出现在 [build.py](build.py) 的 `venue_ranks` 中，请在该表加入会议缩写和 CCF 类别。
4. 运行 `npm run check`。首页的论文总数及 CCF A/B/C 数量会自动更新。

### 新增动态、项目、专利或学生

在两份档案对应章节中各添加一条，并保持位置和链接一致：

- 动态：`News`
- 项目：`Grant`
- 专利：`Patent`
- 学生：`Supervised and Co-supervised Students`
- 毕业生：`Alumni`
- 实习生与合作者：`Interns and Collaborators`

动态、项目和专利总数会自动更新。首页只展示精选条目；如需更换首页展示内容，再同步修改 `src/index.html` 和 `src/en.html`。

### 更换照片或标志

直接替换 `src/assets/` 中的同名文件：

- `portrait.png`：个人照片，建议保持当前纵横比；
- `sjtu-banner-blue.png`：页眉上海交通大学完整校徽；
- `sjtu-logo.png`：经历栏上海交通大学校徽；
- `ustc-logo.jpg`：中国科学技术大学校徽；
- `huawei-logo.png`：华为标志；
- `favicon.svg`：浏览器标签页图标。

替换后运行 `npm run check`，不要把图片放进 `dist/`。

### 修改颜色和排版

编辑 [src/styles.css](src/styles.css)。全站主色定义在文件开头的 CSS 变量中；桌面、平板和手机布局的媒体查询也在同一文件内。

## 首次发布到 GitHub Pages

个人主页仓库应命名为 `xijunlee.github.io`，发布地址为 `https://xijunlee.github.io/`。

### 情况 A：GitHub 仓库是空的

在当前项目目录执行：

```bash
git remote add origin git@github.com:xijunlee/xijunlee.github.io.git
git branch -M main
```

如果使用 HTTPS：

```bash
git remote add origin https://github.com/xijunlee/xijunlee.github.io.git
git branch -M main
```

### 情况 B：GitHub 上已有旧主页

先在其他目录克隆旧仓库作为备份，再把本项目文件复制进该克隆目录。请保留旧仓库的 `.git/`，不要复制本项目的 `.git/` 和 `dist/`。这样可以保留旧网站的完整提交历史，并避免强制推送。

### 在 GitHub 开启 Pages

1. 打开仓库的 **Settings**；
2. 进入 **Pages**；
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**；
4. 保存设置。

项目内的 `.github/workflows/deploy-pages.yml` 会在每次推送 `main` 分支后自动构建 `dist/` 并发布。工作流采用 GitHub 官方的 Pages actions；官方说明见 [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) 和 [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

### 第一次推送

```bash
./scripts/publish.sh "首次发布新版个人主页"
```

推送后，在仓库的 **Actions** 页面查看 `Deploy academic website`。首次发布通常需要几分钟。

## 以后的一键更新

完成修改并预览后，执行：

```bash
./scripts/publish.sh "更新论文与近期动态"
```

脚本会依次构建、检查、提交全部修改并推送到 `origin/main`。GitHub Actions 随后自动发布新版本。

也可以通过 npm 执行：

```bash
npm run publish -- "更新论文与近期动态"
```

只检查流程、不提交也不推送：

```bash
./scripts/publish.sh --dry-run
```

## 回退错误更新

先查看提交记录：

```bash
git log --oneline
```

为错误提交创建安全的反向提交，再推送：

```bash
git revert 提交编号
./scripts/publish.sh "回退错误更新"
```

不要直接修改 `dist/`，也不要使用强制推送覆盖远程历史。

## 常见问题

### 构建提示中英文档案不一致

检查两份 `content/archive-*.html` 中对应章节的条目数量和链接顺序。新增信息时应同时更新中文和英文。

### 推送成功但网站没有更新

检查：

1. GitHub **Settings → Pages → Source** 是否为 **GitHub Actions**；
2. 当前分支是否为 `main`；
3. GitHub **Actions** 页面中的构建是否通过；
4. 浏览器是否仍在使用缓存，可尝试强制刷新。

### 脚本提示没有 `origin`

尚未连接 GitHub 仓库。按“首次发布”添加远程仓库，再重新执行发布脚本。

### 本地端口 4317 被占用

停止之前的预览进程，或者直接运行：

```bash
python3 -m http.server 8000 --directory dist
```

然后访问 <http://127.0.0.1:8000/>。
