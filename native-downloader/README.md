# 本机视频下载助手

这个助手让 `obsidian-clipper-zh` 在视频页面剪切完成后自动启动本地 `yt-dlp` 下载。浏览器扩展负责发送下载任务，助手负责在本机后台启动下载进程。

## macOS

先安装 `yt-dlp`：

```sh
brew install yt-dlp
```

Chrome 版本的本地包固定使用 `cnjifjpddelmedmihgijeibhnjfabmlf` 这个扩展 ID，和官方 Web Clipper 一致。安装本机 host 时可以直接运行：

```sh
./install-macos.sh all
```

如果你用的是自己重新打包后产生的其他 Chromium extension ID，也可以显式传入；安装脚本会保留默认 ID，并追加你传入的 ID：

```sh
./install-macos.sh chrome <extension-id>
./install-macos.sh chromium <extension-id>
./install-macos.sh edge <extension-id>
./install-macos.sh brave <extension-id>
./install-macos.sh arc <extension-id>
```

Firefox：

```sh
./install-macos.sh firefox
```

安装后重启浏览器。

如果同一台机器上用多个 Chromium 系浏览器测试，可以一次写入多个浏览器的 native messaging 配置：

```sh
./install-macos.sh all <extension-id>
```

扩展只会把视频 URL、标题、作者、平台、知识库名、笔记路径和下载目录发送给这个助手。助手不会通过 shell 拼接执行命令，而是直接启动配置好的 `yt-dlp` 可执行文件。默认目录模板是 `{{vaultRoot}}/99-Assets/{{path}}`，助手会从本机 Obsidian 配置中解析知识库真实路径，例如 `/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos`。

下载仍受平台登录状态、地区、会员权限和 `yt-dlp` 支持范围限制。本项目不内置下载器，也不绕过平台限制。助手会在下载视频时请求平台字幕和自动字幕；文稿文件会先写入“正在生成”的占位内容，如果 `yt-dlp` 能拿到字幕，会在同目录生成 `视频名.transcript.md` 文稿正文。当前不内置 Whisper 等语音识别模型，也不会把 B 站弹幕当作文稿。抖音下载默认使用扩展从当前浏览器读取到的目标站点 Cookie，但仍可能受账号登录态、地区和平台风控影响。下载进程的日志会写入 `~/.obsidian-clipper-zh/logs/`，如果笔记保存成功但视频文件或文稿没有出现，先查看这里的最新日志。

B 站、抖音等平台的下载或字幕接口可能要求登录 Cookie。扩展设置里的默认选项是“使用浏览器 Cookie”：扩展会读取当前浏览器中目标视频站点的 Cookie，发送给本机助手写入一次性的临时 `cookies.txt`，再调用 `yt-dlp --cookies`。下载任务结束后助手会删除临时文件，日志不会写入 Cookie 值。

如果当前浏览器 Cookie 读取不到，助手会回退到浏览器/Profile 配置，让 `yt-dlp --cookies-from-browser` 自行读取。也可以改用手动导出的 cookies.txt 文件。对应参数形式：

```sh
yt-dlp --cookies ~/.obsidian-clipper-zh/cookies/video-download-*.cookies.txt ...
yt-dlp --cookies-from-browser chrome ...
yt-dlp --cookies-from-browser "chrome:Profile 1" ...
yt-dlp --cookies ~/Downloads/cookies.txt ...
```
