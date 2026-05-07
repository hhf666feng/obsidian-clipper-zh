语言：[English](README.md) | 简体中文

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

## 第三方库

- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill)：浏览器兼容
- [defuddle](https://github.com/kepano/defuddle)：内容提取和 Markdown 转换
- [dayjs](https://github.com/iamkun/dayjs)：日期解析和格式化
- [lz-string](https://github.com/pieroxy/lz-string)：压缩模板，减少存储占用
- [lucide](https://github.com/lucide-icons/lucide)：图标
- [dompurify](https://github.com/cure53/DOMPurify)：HTML 清理和消毒

## 许可证

Obsidian Web Clipper 源代码基于 MIT License 开源。商标、图标、营销文案以及其他营销资产不包含在该许可证范围内。
