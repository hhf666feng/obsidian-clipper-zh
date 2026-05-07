## 版本差异说明

这是基于官方 [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) 的 fork 版本。相比官方主版本，本版本面向中文内容归档做了增强：一是修复微信公众号文章懒加载图片，让 Obsidian 本地图片保存能下载原始文章图片；二是支持 B 站、抖音、YouTube 视频页面一键剪切，自动保存标题、作者、发布时间、封面、简介、摘要、视频链接，以及可获取到的字幕或转写；三是支持剪切后通过本机助手自动调用 `yt-dlp`，把视频文件下载到本地。本版本默认使用简体中文 README，并保留英文 README。

语言：简体中文 | [English](README.en.md)

## 解决的问题

如果你在搜索下面这些问题，这个 fork 主要就是为它们准备的：

- Obsidian Web Clipper 裁剪微信公众号文章时，图片没有保存到本地。
- 微信公众号文章里的图片变成占位图、空图、重复图片，或 Markdown 里只剩错误的图片地址。
- 公众号图片因为懒加载机制，真实地址藏在 `data-src`、`data-srcset` 里，网页剪切时拿到的是 `wx_lazy`、`#imgIndex`、`tp=webp` 等运行时地址。
- 从 `mp.weixin.qq.com` 裁剪文章后，`mmbiz.qpic.cn` 图片无法被 Obsidian 正确下载或归档。
- 想让 Obsidian 的“本地保存图片”功能直接保存微信公众号原图，不再手动滚动页面、刷新图片、或在 Obsidian 端二次处理。
- Obsidian Web Clipper 剪切 B 站视频、抖音视频、YouTube 视频时，只得到普通网页内容，缺少标题、作者、封面、发布时间、简介、字幕或转写。
- 想把视频内容归档到 Obsidian：一键生成视频笔记、视频摘要、字幕转写、原始链接和默认下载命令。
- 想点一下剪切，就自动把 B 站、抖音、YouTube 视频文件下载到本地，不再复制 `yt-dlp` 命令手动执行。
- 想保存视频资料，但希望下载动作由可审计的本机助手完成，不在浏览器扩展里内置视频下载器。

Obsidian Web Clipper 可帮助你在常用浏览器中高亮并裁剪网页。保存的内容会以耐久的 Markdown 文件形式存入你的 Obsidian 仓库，方便离线阅读和长期保存。

- **[下载 Web Clipper](https://obsidian.md/clipper)**
- **[使用文档](https://help.obsidian.md/web-clipper)**
- **[故障排查](https://help.obsidian.md/web-clipper/troubleshoot)**

## 快速开始

请从对应浏览器的官方扩展商店安装：

- **[Chrome Web Store](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf)**：适用于 Chrome、Brave、Arc、Orion 以及其他基于 Chromium 的浏览器。
- **[Firefox Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/web-clipper-obsidian/)**：适用于 Firefox 和 Firefox Mobile。
- **[Safari Extensions](https://apps.apple.com/us/app/obsidian-web-clipper/id6720708363)**：适用于 macOS、iOS 和 iPadOS。
- **[Edge Add-Ons](https://microsoftedge.microsoft.com/addons/detail/obsidian-web-clipper/eigdjhmgnaaeaonimdklocfekkaanfme)**：适用于 Microsoft Edge。

## 使用扩展

详细文档请查看 [Obsidian Help](https://help.obsidian.md/web-clipper)。文档覆盖了 [高亮](https://help.obsidian.md/web-clipper/highlight)、[模板](https://help.obsidian.md/web-clipper/templates)、[变量](https://help.obsidian.md/web-clipper/variables)、[过滤器](https://help.obsidian.md/web-clipper/filters) 等功能。

Web Clipper 会在提取内容前规范化懒加载图片。对于把真实图片地址放在 `data-src`、`data-srcset` 等属性中的网页，包括微信公众号文章，图片裁剪和 Obsidian 本地图片保存会优先使用原始图片地址，而不是占位图或运行时懒加载地址。

对于 B 站、抖音、YouTube 视频页，Web Clipper 会自动选中内置“视频剪切”模板，并注入 `{{videoTitle}}`、`{{videoAuthor}}`、`{{videoPublished}}`、`{{videoCover}}`、`{{videoDescription}}`、`{{videoSummary}}`、`{{videoTranscript}}`、`{{videoPlatform}}`、`{{videoDownloadCommand}}` 等变量。摘要默认基于简介或字幕前段生成，不调用外部 AI；如果你已经配置了解释器，也可以继续在模板中使用提示变量生成 AI 摘要。

自动视频下载默认开启。浏览器扩展本身不能直接启动本地程序，所以本版本提供 `native-downloader` 本机助手：安装一次助手并安装 `yt-dlp` 后，剪切视频页会在保存笔记后自动发送下载任务，助手会在后台调用 `yt-dlp` 把视频保存到本地，默认目录是 `~/Downloads/Obsidian Web Clipper Videos`。笔记里仍会保留 `yt-dlp "{{url}}" -o "{{videoTitle}}.%(ext)s"` 这类下载命令，方便审计和手动重跑。

### 启用自动视频下载

1. 安装 `yt-dlp`，macOS 推荐：

```sh
brew install yt-dlp
```

2. 构建或解压扩展包后，在 `native-downloader` 目录安装本机助手：

```sh
./native-downloader/install-macos.sh chrome <chrome-extension-id>
./native-downloader/install-macos.sh edge <edge-extension-id>
./native-downloader/install-macos.sh firefox
```

Chromium 浏览器需要先在扩展管理页复制当前扩展 ID。安装后重启浏览器，再剪切视频页面即可自动开始本地下载。下载仍受平台登录、地区、会员权限和 `yt-dlp` 支持范围限制；本项目不内置下载器，也不绕过平台限制。

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
- [x] 一键剪切视频平台内容，例如 B 站、抖音、YouTube 等；自动保存标题、作者、发布时间、封面、简介、视频链接、字幕或转写等适合 Obsidian 归档的元数据
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
