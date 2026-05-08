#!/bin/sh
set -eu

HOST_NAME="obsidian_clipper_zh_downloader"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TARGET_DIR="$HOME/.obsidian-clipper-zh/native-downloader"
RUNNER_PATH="$TARGET_DIR/$HOST_NAME"
DEFAULT_CHROMIUM_EXTENSION_IDS="cnjifjpddelmedmihgijeibhnjfabmlf loleablfepealcmhdgghdinaacdcciab"

usage() {
	cat <<USAGE
Usage:
  $0 chrome [chrome-extension-id...]
  $0 chromium [chrome-extension-id...]
  $0 edge [edge-extension-id...]
  $0 brave [brave-extension-id...]
  $0 arc [arc-extension-id...]
  $0 firefox
  $0 all [chromium-extension-id...]

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
	shift
	if [ "$#" -lt 1 ]; then
		set -- $DEFAULT_CHROMIUM_EXTENSION_IDS
	else
		set -- $DEFAULT_CHROMIUM_EXTENSION_IDS "$@"
	fi

	host_dir="$HOME/Library/Application Support/$browser_dir/NativeMessagingHosts"
	mkdir -p "$host_dir"
	{
		cat <<EOF
{
  "name": "$HOST_NAME",
  "description": "Obsidian Clipper zh video downloader",
  "path": "$RUNNER_PATH",
  "type": "stdio",
  "allowed_origins": [
EOF
		first="true"
		for extension_id in "$@"; do
			if [ -z "$extension_id" ]; then
				continue
			fi
			if [ "$first" = "true" ]; then
				first="false"
			else
				printf ',\n'
			fi
			printf '    "chrome-extension://%s/"' "$extension_id"
		done
		cat <<EOF

  ]
}
EOF
	} > "$host_dir/$HOST_NAME.json"
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
shift

write_runner

case "$browser" in
	chrome)
		write_chromium_manifest "Google/Chrome" "$@"
		;;
	chromium)
		write_chromium_manifest "Chromium" "$@"
		;;
	edge)
		write_chromium_manifest "Microsoft Edge" "$@"
		;;
	brave)
		write_chromium_manifest "BraveSoftware/Brave-Browser" "$@"
		;;
	arc)
		write_chromium_manifest "Arc/User Data" "$@"
		;;
	firefox)
		write_firefox_manifest
		;;
	all)
		write_chromium_manifest "Google/Chrome" "$@"
		write_chromium_manifest "Chromium" "$@"
		write_chromium_manifest "Microsoft Edge" "$@"
		write_chromium_manifest "BraveSoftware/Brave-Browser" "$@"
		write_chromium_manifest "Arc/User Data" "$@"
		write_firefox_manifest
		;;
	*)
		usage
		exit 1
		;;
esac

echo "Native downloader installed. Restart the browser before testing auto download."
