#!/usr/bin/env bash
# 前端发布（在 Jenkins workspace 里执行）
#
# dist 落到 releases/<时间戳> → current 软链原子切换 → 清旧版。
# 前端是纯静态：切链的那一瞬间用户刷新就是新版，**零中断、不重启任何进程、不用 reload nginx**
# （nginx 的 root 指向 current 软链，每个请求实时解析）。
set -euo pipefail

MIRROR_HOME="${MIRROR_HOME:-/opt/mirror}"
SITE_ROOT="${SITE_ROOT:-$MIRROR_HOME/frontend}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
DIST="${DIST:-dist}"

[[ -d "$DIST" ]] || { echo "✗ 没找到构建产物 $DIST，先执行 npm run build" >&2; exit 1; }
[[ -f "$DIST/index.html" ]] || { echo "✗ $DIST/index.html 缺失，构建不完整" >&2; exit 1; }

RELEASE_DIR="$SITE_ROOT/releases/$(date '+%Y%m%d-%H%M%S')"
mkdir -p "$RELEASE_DIR"
cp -r "$DIST"/. "$RELEASE_DIR"/
chown -R mirror:mirror "$RELEASE_DIR" 2>/dev/null || true

ln -sfn "$RELEASE_DIR" "$SITE_ROOT/current"
echo "✓ current → $(basename "$RELEASE_DIR")"

( cd "$SITE_ROOT/releases" && ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf )
echo "✓ 清理完成（保留最近 $KEEP_RELEASES 个版本）"
