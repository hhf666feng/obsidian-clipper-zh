# 本机视频下载助手

这个助手让 `obsidian-clipper-zh` 在视频页面剪切完成后自动启动本地 `yt-dlp` 下载。浏览器扩展负责发送下载任务，助手负责在本机后台启动下载进程。

## macOS

先安装 `yt-dlp`：

```sh
brew install yt-dlp
```

Chrome 或 Edge 需要先加载扩展，然后从浏览器扩展管理页复制 extension ID，再安装本机 host：

```sh
./install-macos.sh chrome <extension-id>
./install-macos.sh edge <extension-id>
```

Firefox：

```sh
./install-macos.sh firefox
```

安装后重启浏览器。

扩展只会把视频 URL、标题、作者、平台、知识库名、笔记路径和下载目录发送给这个助手。助手不会通过 shell 拼接执行命令，而是直接启动配置好的 `yt-dlp` 可执行文件。默认目录模板是 `{{vaultRoot}}/99-Assets/{{path}}`，助手会从本机 Obsidian 配置中解析知识库真实路径，例如 `/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos`。

下载仍受平台登录状态、地区、会员权限和 `yt-dlp` 支持范围限制。本项目不内置下载器，也不绕过平台限制。
