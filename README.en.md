## Fork-specific changes

This fork differs from the official [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) main version by improving Chinese-language content archiving. It normalizes lazy-loaded images in WeChat official account articles so Obsidian's local image saving can download the original article images, and it now has initial one-click clipping support for Bilibili, Douyin, and YouTube video pages. Video clips save the title, creator, publish time, cover image, description, summary, video link, and captions or transcripts when they are available. This fork uses the Simplified Chinese README as the default and keeps this English README available separately.

Languages: [Simplified Chinese](README.md) | English

## Problems this fork solves

This fork is intended for users searching for issues like these:

- Obsidian Web Clipper does not save images locally when clipping WeChat official account articles.
- Images from WeChat articles become placeholders, blank images, duplicate images, or incorrect Markdown image URLs.
- WeChat lazy-loading keeps the original image URLs in `data-src` or `data-srcset`, while clipping captures runtime URLs with `wx_lazy`, `#imgIndex`, or `tp=webp`.
- Articles clipped from `mp.weixin.qq.com` include `mmbiz.qpic.cn` images that Obsidian cannot reliably download or archive.
- You want Obsidian's local image saving to capture the original WeChat article images without manually scrolling, refreshing images, or running a second pass inside Obsidian.
- Obsidian Web Clipper clips Bilibili, Douyin, or YouTube video pages as plain web pages and misses the title, creator, cover image, publish time, description, captions, or transcript.
- You want to archive videos in Obsidian with a ready-made video note, summary, transcript, source link, and optional download command.
- You want video archiving metadata without a browser extension that embeds a video downloader or automatically runs local commands.

Obsidian Web Clipper helps you highlight and capture the web in your favorite browser. Anything you save is stored as durable Markdown files that you can read offline, and preserve for the long term.

- **[Download Web Clipper](https://obsidian.md/clipper)**
- **[Documentation](https://help.obsidian.md/web-clipper)**
- **[Troubleshooting](https://help.obsidian.md/web-clipper/troubleshoot)**

## Get started

Install the extension by downloading it from the official directory for your browser:

- **[Chrome Web Store](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf)** for Chrome, Brave, Arc, Orion, and other Chromium-based browsers.
- **[Firefox Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/web-clipper-obsidian/)** for Firefox and Firefox Mobile.
- **[Safari Extensions](https://apps.apple.com/us/app/obsidian-web-clipper/id6720708363)** for macOS, iOS, and iPadOS.
- **[Edge Add-Ons](https://microsoftedge.microsoft.com/addons/detail/obsidian-web-clipper/eigdjhmgnaaeaonimdklocfekkaanfme)** for Microsoft Edge.

## Use the extension

Documentation is available on the [Obsidian Help site](https://help.obsidian.md/web-clipper), which covers how to use [highlighting](https://help.obsidian.md/web-clipper/highlight), [templates](https://help.obsidian.md/web-clipper/templates), [variables](https://help.obsidian.md/web-clipper/variables), [filters](https://help.obsidian.md/web-clipper/filters), and more.

Web Clipper also normalizes lazy-loaded images before extracting content. This helps pages that keep their real image URLs in attributes such as `data-src` or `data-srcset`, including WeChat official account articles, so image capture and Obsidian's local image saving use the original image URLs instead of placeholders or runtime lazy-load URLs.

For Bilibili, Douyin, and YouTube video pages, Web Clipper automatically selects the built-in Video clipping template and injects variables such as `{{videoTitle}}`, `{{videoAuthor}}`, `{{videoPublished}}`, `{{videoCover}}`, `{{videoDescription}}`, `{{videoSummary}}`, `{{videoTranscript}}`, `{{videoPlatform}}`, and `{{videoDownloadCommand}}`. The default summary is generated from the description or the beginning of the transcript and does not call an external AI provider. If you already use the interpreter, you can still add prompt variables to your own video templates for AI summaries.

Video downloading is off by default. When enabled, the extension only writes an external command to the note, for example the `yt-dlp` command `yt-dlp "{{url}}" -o "{{videoTitle}}.%(ext)s"`. The extension does not run the command, does not download video streams itself, and does not bypass platform restrictions.

## Contribute

### Translations

You can help translate Web Clipper into your language. Submit your translation via pull request using the format found in the [/_locales](/src/_locales) folder.

### Features and bug fixes

See the [help wanted](https://github.com/obsidianmd/obsidian-clipper/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) tag for issues where contributions are welcome.

## Roadmap

In no particular order:

- [ ] A separate icon for Web Clipper
- [ ] Annotate highlights
- [ ] Template directory
- [ ] Sync settings across browsers
- [x] One-click clipping for video platforms such as Bilibili, Douyin, and YouTube, including title, creator, publish time, cover image, description, video link, captions or transcripts, and other metadata useful for Obsidian archives
- [ ] Continue improving video clipping with more reliable transcript capture, mobile share-link handling, short-video page support, template examples, and manual acceptance checks
- [x] Template validation
- [x] Template logic (if/for)
- [x] Save images locally, [added in Obsidian 1.8.0](https://obsidian.md/changelog/2024-12-18-desktop-v1.8.0/)
- [x] Translate UI into more languages — help is welcomed

## Developers

To build the extension:

```
npm run build
```

This will create three directories:
- `dist/` for the Chromium version
- `dist_firefox/` for the Firefox version
- `dist_safari/` for the Safari version

### Install the extension locally

For Chromium browsers, such as Chrome, Brave, Edge, and Arc:

1. Open your browser and navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` directory

For Firefox:

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to the `dist_firefox` directory and select the `manifest.json` file

If you want to run the extension permanently you can do so with the Nightly or Developer versions of Firefox.

1. Type `about:config` in the URL bar
2. In the Search box type `xpinstall.signatures.required`
3. Double-click the preference, or right-click and select "Toggle", to set it to `false`.
4. Go to `about:addons` > gear icon > **Install Add-on From File…**

For iOS Simulator testing on macOS:

1. Run `npm run build` to build the extension
2. Open `xcode/Obsidian Web Clipper/Obsidian Web Clipper.xcodeproj` in Xcode
3. Select the **Obsidian Web Clipper (iOS)** scheme from the scheme selector
4. Choose an iOS Simulator device and click **Run** to build and launch the app
5. Once the app is running on the simulator, open **Safari**
6. Navigate to a webpage and tap the **Extensions** button in Safari to access the Web Clipper extension

### Run tests

```
npm test
```

Or run in watch mode during development:

```
npm run test:watch
```

When changing content extraction or image handling, run the focused regression tests:

```
npx vitest run src/api.test.ts src/utils/lazy-images.test.ts src/utils/filters/image.test.ts
```

When changing video clipping logic, run:

```
npx vitest run src/utils/video-clipping.test.ts src/api.test.ts
```

## Third-party libraries

- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) for browser compatibility
- [defuddle](https://github.com/kepano/defuddle) for content extraction and Markdown conversion
- [dayjs](https://github.com/iamkun/dayjs) for date parsing and formatting
- [lz-string](https://github.com/pieroxy/lz-string) to compress templates to reduce storage space
- [lucide](https://github.com/lucide-icons/lucide) for icons
- [dompurify](https://github.com/cure53/DOMPurify) for sanitizing HTML

## License

Obsidian Web Clipper source code is open source under the MIT License. All trademarks, icons, marketing copy, and other marketing assets are excluded from that license.
