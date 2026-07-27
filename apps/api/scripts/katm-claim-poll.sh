#!/bin/sh
#
# Fetch KATM claim/get for a range of claim ids, save every response,
# then archive the folder.
#
# Usage:
#   sh katm-claim-poll.sh                            # claims 1000..1062, 15s apart
#   CLAIM_FROM=1050 CLAIM_TO=1062 sh katm-claim-poll.sh
#   INTERVAL=2 sh katm-claim-poll.sh                 # faster sweep
#
# Errors (HTTP 500, timeouts, connection refused) are logged and skipped —
# the sweep always continues to the next claim id.
# Stop early with Ctrl-C — the archive is still created.

# POSIX sh compatible (dash on Debian/Ubuntu): no pipefail, no BASH_SOURCE.
set -u

URL="${URL:-https://api.infokredit.uz/katm-api/v1/claim/get}"
LOGIN="${KATM_LOGIN:-*********}"
PASSWORD="${KATM_PASSWORD:-********}"

CLAIM_FROM="${CLAIM_FROM:-1000}"
CLAIM_TO="${CLAIM_TO:-1062}"
CODE="${CODE:-20659}"
HEAD="${HEAD:-RET}"

INTERVAL="${INTERVAL:-2}"         # seconds between requests
CURL_TIMEOUT="${CURL_TIMEOUT:-30}" # per-request timeout

RUN_ID="claims-${CLAIM_FROM}-${CLAIM_TO}-$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-$(cd "$(dirname "$0")" && pwd)/katm-runs}/${RUN_ID}"
mkdir -p "$OUT_DIR"

SUMMARY="${OUT_DIR}/summary.tsv"
printf 'claim_id\thttp_code\tcurl_exit\tbytes\tfile\n' >"$SUMMARY"

archive() {
  archive_path="${OUT_DIR}.tar.gz"
  tar -czf "$archive_path" -C "$(dirname "$OUT_DIR")" "$(basename "$OUT_DIR")"
  echo
  echo "Responses : $OUT_DIR"
  echo "Summary   : $SUMMARY"
  echo "Archive   : $archive_path"
}

trap 'echo; echo "Interrupted."; archive; exit 130' INT TERM

echo "Fetching ${URL}"
echo "  claims=${CLAIM_FROM}..${CLAIM_TO} code=${CODE} head=${HEAD}"
echo "  interval=${INTERVAL}s  out=${OUT_DIR}"
echo

claim_id="$CLAIM_FROM"
while [ "$claim_id" -le "$CLAIM_TO" ]; do
  body_file="${OUT_DIR}/claim-${claim_id}.json"
  meta_file="${OUT_DIR}/claim-${claim_id}.meta.txt"

  payload=$(cat <<JSON
{
  "security": {
    "pLogin": "${LOGIN}",
    "pPassword": "${PASSWORD}"
  },
  "data": {
    "pClaimId": "${claim_id}",
    "pCode": "${CODE}",
    "pHead": "${HEAD}"
  }
}
JSON
)

  http_code=$(curl --silent --show-error \
    --max-time "$CURL_TIMEOUT" \
    --request POST \
    --url "$URL" \
    --header 'content-type: application/json' \
    --data "$payload" \
    --output "$body_file" \
    --write-out '%{http_code}' 2>"$meta_file")
  curl_status=$?

  bytes=0
  [ -f "$body_file" ] && bytes=$(wc -c <"$body_file" | tr -d ' ')

  {
    echo "claim_id=${claim_id}"
    echo "time=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "http_code=${http_code}"
    echo "curl_exit=${curl_status}"
    echo "bytes=${bytes}"
  } >>"$meta_file"

  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$claim_id" "$http_code" "$curl_status" "$bytes" "$(basename "$body_file")" >>"$SUMMARY"

  echo "[$(date +%H:%M:%S)] claim ${claim_id}: http=${http_code} curl_exit=${curl_status} bytes=${bytes}"

  claim_id=$((claim_id + 1))
  [ "$claim_id" -le "$CLAIM_TO" ] && sleep "$INTERVAL"
done

archive
