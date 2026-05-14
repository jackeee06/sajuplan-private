#!/usr/bin/env bash
# ============================================================
# 사주문 배포 환경 설정 (단일 진실 원천)
# ============================================================
#
# 사용법:
#   DEPLOY_TARGET=test  ./deploy.sh api    # 테스트 서버 (기본, sajumoon.kr)
#   DEPLOY_TARGET=prod  ./deploy.sh api    # 운영 서버  (sajumoon.co.kr)
#
# - 모든 도메인은 이 파일의 case 한 곳에서만 정한다.
# - SSH_HOST 는 운영 서버 IP 결정되면 prod 섹션을 갱신.
# - .env / nginx vhost 등 서버 측 시크릿/설정은 별도 관리 (rsync 시 .env 제외).
# ============================================================

# 하위 호환: dev → test 로 자동 매핑 (옛 스크립트/CI 호환)
if [[ "${DEPLOY_TARGET:-}" == "dev" ]]; then
  DEPLOY_TARGET="test"
fi

case "${DEPLOY_TARGET:-test}" in
  test)
    # 테스트 서버 — 현재 라이브 동작 환경
    SSH_HOST="${SSH_HOST:-root@172.235.211.75}"
    USER_DOMAIN="sajumoon.kr"
    API_DOMAIN="api.sajumoon.kr"
    MNG_PATH="/mng/"
    USER_REMOTE="/data/wwwroot/sajumoon.kr"
    MNG_REMOTE="/data/wwwroot/sajumoon.kr/mng"
    API_REMOTE="/data/wwwroot/api.sajumoon.kr"
    PM2_NAME="sajumoon-api"
    SAJUMOON_ENV="test"
    ;;

  prod)
    # 운영 서버 — sajumoon.co.kr (104.64.128.103, OneInStack on Ubuntu 24.04)
    SSH_HOST="${SSH_HOST:-root@104.64.128.103}"
    USER_DOMAIN="sajumoon.co.kr"
    API_DOMAIN="api.sajumoon.co.kr"
    MNG_PATH="/mng/"
    USER_REMOTE="/data/wwwroot/sajumoon.co.kr"
    MNG_REMOTE="/data/wwwroot/sajumoon.co.kr/mng"
    API_REMOTE="/data/wwwroot/api.sajumoon.co.kr"
    PM2_NAME="sajumoon-api"
    SAJUMOON_ENV="prod"
    ;;

  *)
    echo "✗ DEPLOY_TARGET 은 'test' 또는 'prod' 이어야 합니다 (현재: ${DEPLOY_TARGET})" >&2
    exit 1
    ;;
esac

# 파생 URL — 코드/healthcheck 에서 공통 사용
USER_BASE_URL="https://${USER_DOMAIN}"
API_BASE_URL="https://${API_DOMAIN}"

export DEPLOY_TARGET="${DEPLOY_TARGET:-test}"
export SAJUMOON_ENV
export SSH_HOST USER_DOMAIN API_DOMAIN MNG_PATH
export USER_REMOTE MNG_REMOTE API_REMOTE PM2_NAME
export USER_BASE_URL API_BASE_URL
