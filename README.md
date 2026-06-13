# Obsidian Web Clipper 中文增强版

语言：简体中文 | [English](README.en.md)

这是基于官方 [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) 的中文增强 fork。它保留官方剪藏、高亮、模板和变量能力，并针对中文资料归档补强了三件事：

- 微信公众号文章图片归档：修复懒加载图片地址，让 Obsidian 的本地保存图片能拿到原图。
- 视频剪切：支持 B 站、抖音、YouTube 一键生成结构化视频笔记。
- 本地视频下载：剪切后可通过本机助手调用 `yt-dlp`，把视频、字幕和下载日志保存到 Obsidian 库内。

当前发布版：[v1.6.2-zh.18](https://github.com/hhf666feng/obsidian-clipper-zh/releases/tag/v1.6.2-zh.18)

## 适合谁

这个 fork 主要解决这些场景：

- 剪藏微信公众号时，图片变成占位图、空图、重复图，或只留下 `wx_lazy`、`#imgIndex`、`tp=webp` 这类运行时地址。
- 从 `mp.weixin.qq.com` 保存文章后，`mmbiz.qpic.cn` 图片不能被 Obsidian 稳定下载到本地。
- 剪切 B 站、抖音、YouTube 视频时，不想只保存普通网页正文，而是希望自动记录标题、作者、发布时间、封面、简介、来源链接、摘要和字幕。
- 想把视频文件也归档进 Obsidian，不再复制 `yt-dlp` 命令手动下载。
- 希望下载动作由可审计的本机助手完成，而不是在浏览器扩展里内置下载器或绕过平台限制。

## 安装

这个 fork 的功能不在官方扩展商店版里。请从本仓库 [Releases](https://github.com/hhf666feng/obsidian-clipper-zh/releases) 下载对应浏览器的 zip 包；如果你已经安装官方 Web Clipper，建议先禁用官方版，避免两个扩展同时响应剪切。

### Chrome、Brave、Edge、Arc

1. 下载 `obsidian-web-clipper-1.6.2-zh.18-chrome.zip` 并解压。
2. 打开 `chrome://extensions`。
3. 开启 **Developer mode**。
4. 点击 **Load unpacked**，选择解压后的目录。

### Firefox

1. 下载 `obsidian-web-clipper-1.6.2-zh.18-firefox.zip` 并解压。
2. 打开 `about:debugging#/runtime/this-firefox`。
3. 点击 **Load Temporary Add-on**。
4. 选择解压目录里的 `manifest.json`。

如果需要长期安装未签名扩展，可使用 Firefox Developer Edition 或 Nightly，并在 `about:config` 中将 `xpinstall.signatures.required` 设为 `false` 后，从 `about:addons` 安装 zip 或 manifest。

### Safari

Safari 扩展受 Apple 签名和打包限制。仓库仍会生成 Safari 构建产物，主要用于本地开发和 Xcode 调试；日常使用建议优先用 Chromium 或 Firefox 版本验证中文增强功能。

## 核心功能

### 微信公众号图片归档

剪切前会规范化懒加载图片，优先使用 `data-src`、`data-srcset` 等属性里的原始图片地址，而不是占位图或运行时懒加载地址。这样 Obsidian 的“本地保存图片”功能可以直接下载公众号原图。

### 视频剪切模板

B 站、抖音、YouTube 页面会自动选中内置“视频剪切”模板，并注入这些变量：

- `{{videoTitle}}`
- `{{videoAuthor}}`
- `{{videoPublished}}`
- `{{videoCover}}`
- `{{videoDescription}}`
- `{{videoSummary}}`
- `{{videoTranscript}}`
- `{{videoPlatform}}`
- `{{videoUrl}}`
- `{{videoDownloadCommand}}`
- `{{videoDownloadCommandInstallGuide}}`

默认摘要来自视频简介或字幕前段，不调用外部 AI。你也可以继续用官方模板、解释器和提示变量生成自己的 AI 摘要。

| 平台 | 已支持内容 |
| --- | --- |
| B 站 | 标题、作者、发布时间、封面、简介、规范链接；修复首次剪切时标题污染和真实页面元数据回退问题 |
| 抖音 | PC 视频页、短链、移动分享页、`iesdouyin.com`；提取真实标题、作者、发布时间、封面、规范链接和页面内视频直链 |
| YouTube | 标题、作者、封面、描述、canonical watch URL；避免短链或页面中间态 URL 影响归档和下载 |

### 默认保存路径

内置站点路由会把不同来源保存到更清晰的目录：

| 来源 | 默认笔记目录 |
| --- | --- |
| 微信公众号 | `Clippings/微信公众号` |
| B 站 | `Clippings/哔哩哔哩` |
| 抖音 | `Clippings/抖音` |
| YouTube | `Clippings/YouTube` |

如果你之前已经安装过旧版本，升级后会自动补齐缺失的内置路由，同时保留你自己改过的路径规则。

## 自动下载视频

浏览器扩展不能直接启动本地程序，所以本 fork 提供 `native-downloader` 本机助手。安装一次后，剪切视频页时扩展会把下载任务发送给助手，助手在后台调用 `yt-dlp`。

### 1. 安装 yt-dlp

macOS 推荐使用 Homebrew：

```sh
brew install yt-dlp
```

如果你机器上同时存在 pyenv/pip 安装的旧 `yt-dlp`，建议确认 Homebrew 版本可用：

```sh
/opt/homebrew/bin/yt-dlp --version
```

本机助手会优先使用显式配置路径、Homebrew 路径和常见本地安装路径，再回退到 PATH，避免旧 shim 抢先执行。

### 2. 安装本机助手

在解压后的扩展目录中运行：

```sh
./native-downloader/install-macos.sh all
```

如果你重新打包后产生了不同的 Chromium extension ID，可以显式传入：

```sh
./native-downloader/install-macos.sh chrome <extension-id>
./native-downloader/install-macos.sh edge <extension-id>
./native-downloader/install-macos.sh firefox
```

安装后重启浏览器。

### 3. 下载结果放在哪里

默认下载目录模板是：

```text
{{vaultRoot}}/99-Assets/{{path}}
```

例如你的 Obsidian 库是：

```text
/Users/admin/Documents/Obsidian Vault
```

抖音视频笔记保存到：

```text
Clippings/抖音
```

视频文件会保存到：

```text
/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/抖音
```

笔记中会写入本地视频嵌入、保存位置、下载日志和文稿链接，例如：

```md
![[99-Assets/Clippings/抖音/视频标题.mp4]]
```

### 4. Cookie 和字幕

默认 Cookie 模式是“使用浏览器 Cookie”：扩展会读取当前视频站点的 Cookie，写成临时 `cookies.txt` 交给 `yt-dlp --cookies`，任务结束后自动删除。日志不会记录 Cookie 值。

可选模式：

- `使用浏览器 Cookie`：默认值，适合 B 站、抖音、YouTube 登录态下载。
- `不使用 Cookie`：适合公开资源。
- `使用 cookies.txt 文件`：适合手动导出的 Cookie 文件。

文稿文件会先写入“正在生成”的占位内容。如果 `yt-dlp` 能拿到平台字幕或自动字幕，会生成 `视频名.transcript.md`；如果平台没有公开字幕，文稿会保留明确的“暂未生成”说明。当前不内置 Whisper 等本地语音识别，也不会把 B 站弹幕当作文稿。

## 常见排查

### 剪切成功，但视频没有下载

检查最新日志：

```sh
ls -lt ~/.obsidian-clipper-zh/logs | head
```

常见原因：

- 没安装本机助手，或安装后没有重启浏览器。
- `yt-dlp` 不可用或版本太旧。
- 平台需要登录 Cookie。
- 视频受地区、会员、平台风控或 `yt-dlp` 支持范围限制。

### YouTube 命令行失败，但扩展能下载

终端里直接执行 `yt-dlp` 可能命中 pyenv/pip 的旧版本。优先试：

```sh
/opt/homebrew/bin/yt-dlp "https://www.youtube.com/watch?v=..."
```

### 字幕文件没有生成

先查字幕列表：

```sh
/opt/homebrew/bin/yt-dlp --list-subs "https://www.youtube.com/watch?v=..."
```

如果输出 `has no subtitles` 或 `has no automatic captions`，说明平台没有公开可抓取字幕，扩展不会凭空生成转写。

### 抖音仍保存到 `Clippings/Videos`

升级到 `v1.6.2-zh.18` 后会补齐默认路由。也可以在设置页的“文件夹路由”中确认有这些规则：

```text
domain:douyin.com => Clippings/抖音
domain:iesdouyin.com => Clippings/抖音
```

## 与官方版的关系

官方文档仍适用于剪藏、高亮、模板、变量和过滤器等基础能力：

- [下载官方 Web Clipper](https://obsidian.md/clipper)
- [官方使用文档](https://help.obsidian.md/web-clipper)
- [官方故障排查](https://help.obsidian.md/web-clipper/troubleshoot)

这个 fork 的中文增强功能以本仓库 release 包为准。

## 贡献

### 翻译

你可以帮助把 Web Clipper 翻译成更多语言。请参考 [/_locales](/src/_locales) 目录中的格式，通过 pull request 提交翻译。

### 功能和 bug 修复

欢迎查看带有 [help wanted](https://github.com/obsidianmd/obsidian-clipper/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) 标签的 issue，这些是适合社区贡献的任务。

## 路线图

以下事项没有特定优先级：

- [ ] 为 Web Clipper 提供独立图标
- [ ] 标注高亮内容
- [ ] 模板目录
- [ ] 跨浏览器同步设置
- [x] 一键剪切 B 站、抖音、YouTube 等视频平台内容
- [x] 剪切后通过本机助手自动调用 `yt-dlp` 下载视频文件到本地
- [ ] 持续增强视频平台剪切：更稳定的字幕获取、移动分享链接解析、短视频页面适配、模板示例和手动验收清单
- [x] 模板校验
- [x] 模板逻辑（if/for）
- [x] 本地保存图片，已在 [Obsidian 1.8.0](https://obsidian.md/changelog/2024-12-18-desktop-v1.8.0/) 中加入
- [x] 将界面翻译成更多语言，欢迎参与

## 开发者

构建扩展：

```sh
npm run build
```

构建完成后会生成三个目录：

- `dist/`：Chromium 版本
- `dist_firefox/`：Firefox 版本
- `dist_safari/`：Safari 版本

### 本地安装扩展

对于 Chrome、Brave、Edge、Arc 等 Chromium 浏览器：

1. 打开浏览器并进入 `chrome://extensions`
2. 启用 **Developer mode**
3. 点击 **Load unpacked**，选择 `dist` 目录

对于 Firefox：

1. 打开 Firefox 并进入 `about:debugging#/runtime/this-firefox`
2. 点击 **Load Temporary Add-on**
3. 进入 `dist_firefox` 目录并选择 `manifest.json` 文件

如果想长期运行这个扩展，可以使用 Firefox Nightly 或 Firefox Developer 版本：

1. 在地址栏输入 `about:config`
2. 在搜索框中输入 `xpinstall.signatures.required`
3. 双击该配置项，或右键选择 "Toggle"，将其设置为 `false`
4. 进入 `about:addons` > 齿轮图标 > **Install Add-on From File…**

在 macOS 上测试 iOS Simulator：

1. 运行 `npm run build` 构建扩展
2. 在 Xcode 中打开 `xcode/Obsidian Web Clipper/Obsidian Web Clipper.xcodeproj`
3. 在 scheme 选择器中选择 **Obsidian Web Clipper (iOS)**
4. 选择一个 iOS Simulator 设备并点击 **Run** 构建和启动应用
5. 应用在模拟器中运行后，打开 **Safari**
6. 打开任意网页，点击 Safari 中的 **Extensions** 按钮即可访问 Web Clipper 扩展

### 运行测试

```sh
npm test
```

开发时也可以使用 watch 模式：

```sh
npm run test:watch
```

修改内容提取或图片处理逻辑时，请运行聚焦的回归测试：

```sh
npx vitest run src/api.test.ts src/utils/lazy-images.test.ts src/utils/filters/image.test.ts
```

修改视频剪切逻辑时，请运行：

```sh
npx vitest run src/utils/video-download-request.test.ts src/utils/video-clipping.test.ts src/api.test.ts
```

## 第三方库

- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill)：浏览器兼容
- [defuddle](https://github.com/kepano/defuddle)：内容提取和 Markdown 转换
- [dayjs](https://github.com/iamkun/dayjs)：日期解析和格式化
- [lz-string](https://github.com/pieroxy/lz-string)：压缩模板，减少存储占用
- [lucide](https://github.com/lucide-icons/lucide)：图标
- [dompurify](https://github.com/cure53/DOMPurify)：HTML 清理和消毒

## 许可证

Obsidian Web Clipper 源代码基于 MIT License 开源。商标、图标、营销文案以及其他营销资产不包含在该许可证范围内。
