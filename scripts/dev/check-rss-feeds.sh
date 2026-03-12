#!/usr/bin/env bash
set -euo pipefail

USER_AGENT="Mozilla/5.0 (compatible; WorldMonitor-RSS-Check/1.0)"
MAX_TIME="${MAX_TIME:-8}"
CONCURRENCY="${CONCURRENCY:-5}"

echo "Scanning RSS source files..."
echo

<<<<<<< HEAD
# find URLs but exclude large directories
grep -rIhoE "https?://[a-zA-Z0-9./:_?&=%+-]+" . \
--exclude-dir=node_modules \
--exclude-dir=.git \
--exclude-dir=dist \
--exclude-dir=build \
| sort -u \
| while read -r url
do
  # additional validation
  if [[ "$url" =~ ^https?://[a-zA-Z0-9./:_?&=%+-]+$ ]]; then
    code=$(curl -L --max-time "${MAX_TIME:-8}" \
      -o /dev/null -s -w "%{http_code}" --url "$url")
=======
urls=$(grep -rIhoE "https?://[a-zA-Z0-9./:_?&=%+-]+" "${SEARCH_PATHS[@]}" \
  | grep -Ei "rss|feed|atom" \
  | sort -u)
>>>>>>> 9678516f (fix(devtools): improve RSS validator with UA header, concurrency and f
urls=$(grep -rIhoE "https?://[a-zA-Z0-9./:_?&=%+-]+" "${SEARCH_PATHS[@]}" \
  | grep -Ei "rss|feed|atom" 
  | sort -u)

check_feed() {
  url="$1"

  status=$(curl -L \
    -H "User-Agent: $USER_AGENT" \
    --max-time "$MAX_TIME" \
    -o /dev/null -s -w "%{http_code}" "$url")

  if [[ "$status" != "200" ]]; then
    echo "⚠️  $status  $url"
    return
  fi

  body=$(curl -L \
    -H "User-Agent: $USER_AGENT" \
    --max-time "$MAX_TIME" \
    -s "$url")

  if echo "$body" | grep -qiE "<rss|<feed"; then
    echo "✅ RSS OK  $url"
  else
    echo "⚠️  Not RSS  $url"
  fi
}

export -f check_feed
export USER_AGENT MAX_TIME

echo "$urls" | xargs -P"$CONCURRENCY" -I{} bash -c 'check_feed "$@"' _ {}

echo
echo "Scan complete."
