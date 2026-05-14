#!/usr/bin/env bash
#
# 푸시 발송 테스트 스크립트.
#
# 사용법:
#   ./tools/push-test.sh token <FCM_TOKEN> "제목" "본문"     → 단일 토큰
#   ./tools/push-test.sh topic chl_2       "제목" "본문"     → 토픽 (chl_all|chl_2|chl_5)
#   ./tools/push-test.sh self              "제목" "본문"     → DB 의 가장 최근 활성 토큰
#
# 사전 조건:
#   - 관리자 로그인 → 쿠키를 ~/.sajumoon-admin-cookies 에 저장 (자동)
#   - ENV: ADMIN_LOGIN_ID / ADMIN_PASSWORD (없으면 deploy.sh 와 동일하게 admin/saju1004@)
#

set -euo pipefail

API="${API:-https://api.sajumoon.kr}"
COOKIE_JAR="${HOME}/.sajumoon-admin-cookies"
ADMIN_LOGIN_ID="${ADMIN_LOGIN_ID:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-saju1004@}"

login() {
  curl -sS -c "$COOKIE_JAR" -H "Content-Type: application/json" \
    -d "{\"mb_id\":\"$ADMIN_LOGIN_ID\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$API/api/admin/auth/login" >/dev/null
}

call() {
  # 한번 호출, 401 이면 로그인 후 재시도
  local body="$1"
  local resp
  resp=$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "$API/api/admin/notifications/push-test")
  if echo "$resp" | grep -q '"statusCode":401'; then
    echo "▸ admin 로그인 필요 — 로그인 후 재시도" >&2
    login
    resp=$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$API/api/admin/notifications/push-test")
  fi
  echo "$resp"
}

mode="${1:-}"; shift || true
case "$mode" in
  token)
    token="${1:?토큰 필요}"; title="${2:-테스트 푸시}"; content="${3:-Hello from sajumoon}"
    body=$(printf '{"token":%s,"title":%s,"content":%s}' \
      "$(jq -Rn --arg v "$token" '$v')" \
      "$(jq -Rn --arg v "$title" '$v')" \
      "$(jq -Rn --arg v "$content" '$v')")
    call "$body" | jq .
    ;;
  topic)
    topic="${1:?토픽 필요 (chl_all/chl_2/chl_5)}"; title="${2:-테스트 푸시}"; content="${3:-Hello from sajumoon}"
    body=$(printf '{"topic":%s,"title":%s,"content":%s}' \
      "$(jq -Rn --arg v "$topic" '$v')" \
      "$(jq -Rn --arg v "$title" '$v')" \
      "$(jq -Rn --arg v "$content" '$v')")
    call "$body" | jq .
    ;;
  self)
    title="${1:-테스트 푸시}"; content="${2:-Hello from sajumoon}"
    # 최근 활성 토큰 조회
    login
    token=$(curl -sS -b "$COOKIE_JAR" "$API/api/admin/notifications/push-tokens?limit=1" \
      | jq -r '.items[0].token // empty')
    if [ -z "$token" ]; then echo "활성 토큰 없음" >&2; exit 1; fi
    echo "▸ 사용 토큰: ${token:0:30}…"
    body=$(printf '{"token":%s,"title":%s,"content":%s}' \
      "$(jq -Rn --arg v "$token" '$v')" \
      "$(jq -Rn --arg v "$title" '$v')" \
      "$(jq -Rn --arg v "$content" '$v')")
    call "$body" | jq .
    ;;
  *)
    cat >&2 <<EOF
사용법:
  $0 token <FCM_TOKEN> "<제목>" "<본문>"
  $0 topic chl_2       "<제목>" "<본문>"
  $0 self              "<제목>" "<본문>"
EOF
    exit 1
    ;;
esac
