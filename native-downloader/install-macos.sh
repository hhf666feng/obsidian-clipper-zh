#!/bin/sh
set -eu

HOST_NAME="obsidian_clipper_zh_downloader"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TARGET_DIR="$HOME/.obsidian-clipper-zh/native-downloader"
RUNNER_PATH="$TARGET_DIR/$HOST_NAME"

usage() {
	cat <<USAGE
Usage:
  $0 chrome <chrome-extension-id>
  $0 edge <edge-extension-id>
  $0 firefox
  $0 all <chrome-or-edge-extension-id>

Install yt-dlp first, for example:
  brew install yt-dlp
USAGE
}

write_runner() {
	mkdir -p "$TARGET_DIR"
	cp "$SCRIPT_DIR/host.cjs" "$TARGET_DIR/host.cjs"
	chmod 755 "$TARGET_DIR/host.cjs"
	cat > "$RUNNER_PATH" <<EOF
#!/bin/sh
export PATH="/opt/homebrew/bin:/usr/local/bin:\$HOME/.local/bin:\$PATH"
exec /usr/bin/env node "$TARGET_DIR/host.cjs"
EOF
	chmod 755 "$RUNNER_PATH"
}

write_chromium_manifest() {
	browser_dir="$1"
	extension_id="$2"
	if [ -z "$extension_id" ]; then
		echo "Chrome/Edge installation requires the extension id." >&2
		exit 1
	fi

	host_dir="$HOME/Library/Application Support/$browser_dir/NativeMessagingHosts"
	mkdir -p "$host_dir"
	cat > "$host_dir/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Obsidian Clipper zh video downloader",
  "path": "$RUNNER_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$extension_id/"
  ]
}
EOF
	echo "Installed $browser_dir native host: $host_dir/$HOST_NAME.json"
}

write_firefox_manifest() {
	host_dir="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
	mkdir -p "$host_dir"
	cat > "$host_dir/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Obsidian Clipper zh video downloader",
  "path": "$RUNNER_PATH",
  "type": "stdio",
  "allowed_extensions": [
    "clipper@obsidian.md"
  ]
}
EOF
	echo "Installed Firefox native host: $host_dir/$HOST_NAME.json"
}

if [ "$#" -lt 1 ]; then
	usage
	exit 1
fi

browser="$1"
extension_id="${2:-}"

write_runner

case "$browser" in
	chrome)
		write_chromium_manifest "Google/Chrome" "$extension_id"
		;;
	edge)
		write_chromium_manifest "Microsoft Edge" "$extension_id"
		;;
	firefox)
		write_firefox_manifest
		;;
	all)
		write_chromium_manifest "Google/Chrome" "$extension_id"
		write_chromium_manifest "Microsoft Edge" "$extension_id"
		write_firefox_manifest
		;;
	*)
		usage
		exit 1
		;;
esac

echo "Native downloader installed. Restart the browser before testing auto download."
