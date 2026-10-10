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
5. 检查 JavaScript 语法及访客地球仪的回归测试。

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
- `most-emblem.png`：经历栏中华人民共和国科学技术部使用的国徽；
- `ustc-logo.jpg`：中国科学技术大学校徽；
- `huawei-logo.png`：华为标志；
- `favicon.svg`：浏览器标签页图标。

替换后运行 `npm run check`，不要把图片放进 `dist/`。

### 修改颜色和排版

编辑 [src/styles.css](src/styles.css)。全站主色定义在文件开头的 CSS 变量中；桌面、平板和手机布局的媒体查询也在同一文件内。

### 51LA 访问采集与真实来源地球仪

中英文主页与完整档案均通过 [content/51la-snippet.html](content/51la-snippet.html) 接入同一个 51LA 应用：`3RSi0ApWyvRKOoCj`。构建时将官方两段安装代码直接写入四个 HTML 的 `<head>`，先按普通同步标签加载 HTTPS SDK，再调用一次 `LA.init`，让安装检测能直接看到采集标签和应用编号，而不是依赖外部 JS 动态插入。仅在 `xijunlee.github.io` 上初始化；本地预览和其他域名即使加载 SDK 也不调用 `LA.init`，地球仪本身不加载采集代码。SDK 加载失败时初始化跳过，不影响后续页面脚本；同步外部标签可能让加载过程等候 SDK。旧 `src/analytics.js` 只用于兼容缓存页面，新页面不再引用它。

页尾已经切换为 51LA；中英文页面读取同一份 `visitor-data.json`。累计浏览量 PV 和累计访客数 UV 分别取自官方概况接口 `totalPv`、`totalUv`，不从地球仪光点或会话条数推算，也不与旧 MapMyVisitors 数字合计。51LA 的历史起点为新应用开始采集的时间，旧平台历史记录不会自动迁入。

官方采集编号不是 OpenAPI 凭据。[官方数据 API 调用说明](https://v6.51.la/doc/index.html#/调用说明/README)要求独立的 AccessKey、SecretKey 和签名。凭据只保存在本仓库 **Settings → Secrets and variables → Actions → Repository secrets**，名称为 `LA_ACCESS_KEY` 和 `LA_SECRET_KEY`，由 GitHub Actions 的同步步骤读取。SecretKey 仅在 CI 内参与签名或响应解密，不发送至 API，不写进 `src/`、`dist/`、日志或公开仓库。不降低接口安全等级。

### 数据同步、范围和配额

`.github/workflows/deploy-pages.yml` 每天北京时间 **10:17** 更新并发布（GitHub 定时任务可能延迟），同一天的普通代码发布通过 Actions cache 重用已同步的快照，避免重复消耗 API 配额。[scripts/sync-51la.mjs](scripts/sync-51la.mjs) 每日最多请求一次概况、两页地域明细（每页 100 条），即正常最多 93 次/月；手动运行 `Verify 51LA data access` 另占两次调用。未购买或开通付费额度，不执行关闭 VPN／切换网络的测试。

需要立即同步并发布时，在 `Deploy academic website` 的手动运行表单中勾选 `force_sync`；只有 SSH 推送权限时，也可在本次推送的最后一个提交信息中显式加入 `[force-51la-sync]`。该次运行会忽略当日已尝试标记，额外消耗最多三次 API 调用，不改变普通推送和定时任务的每日一次规则。强制同步替换同一天的地域数据，不重复累加。脚本同时比较线上快照与不可变的 Actions 缓存，优先保留较新的数据，避免后续普通发布覆盖手动更新结果；失败时保留已有有效数据。

接口诊断同时保留 HTTP 状态与官方文档列出的错误编号（例如 `5007` 时间戳、`5008` AccessKey、`5009` 签名）。即使 HTTP 为 `401`，也先读取响应中的编号，不将“未授权”直接等同于密钥未更新。日志不会输出源站错误消息、响应正文、密钥、签名或访客明细；未识别编号只记录 `unknown`，非 JSON 响应仅标记该类型。

地球仪汇总每天**上一完整自然日（UTC+8）**的真实会话地域，保留最近 90 个已同步日期；不冒充全历史或实时位置。数字显示源站快照的更新时间，已同步日期范围、缺口、未知地域数量和记录不完整说明放在“来源地区”数字的悬停提示中，不再占用说明行。光点按国家或中国省级地区合并，悬停条数是**已记录会话数**，不是 UV。位置是地区示意点，不是个人定位。首次接入不自动回补此前历史；若某日超过 200 条，悬停提示会标明“地域记录不完整”，不会把截断结果声称为完整数据。

CI 内收到原始明细后只提取地域并映射到固定目录，输出地区 ID、会话数量和公共示意坐标；**原始 IP、UUID、来路、入口页、访问时间及未识别地域原文均不发布**。请求失败时保留上一份有效快照；超过 48 小时会标明“上次成功同步”。从未取到数据则显示破折号及不可用提示，真实的 0 则正常显示 0。地球仪绘图失败不影响已读取的 PV、UV。

绘图代码、Natural Earth 陆地轮廓、D3 与 TopoJSON 均随网站本地托管，不依赖 MapMyVisitors 或浏览器端海外 CDN。地图资源来源与许可证见 [ATTRIBUTION.md](src/assets/geo/ATTRIBUTION.md)，中英文访客统计区域的更新时间下方保留“统计数据 / Statistics”和“Map credits”链接，分别访问统计后台与地图许可说明。旧 `visitor-globe.html` 只保留无追踪的兼容提示。统计区域不再显示服务品牌及“暂无访客来源记录”说明。左侧 PV、UV 与来源地区数量并排成三组，数字字体统一，各自上下堆叠标签；“每日同步”与更新时间在同一行，极窄屏幕可自然换行。右侧地球仪仍沿用“加入我们”申请卡片的列几何和中心线。

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
