#!/usr/bin/env python3
"""api 변경 파일만 SFTP put + 원격 build + pm2 reload (deploy_sync.py 우회용 외과 패치).

사용:
  python tools/_patch_api.py <host> <api_remote_path> <pm2_name>

# 양 서버 코드 경로 (도메인과 다름 — 자주 헷갈림)
# ⚠️ prod 의 코드 경로는 api.sajumoon.co.kr (api.sajuplan.com 아님!) — 2026-05-22 확인
# - test: root@172.235.211.75:/data/wwwroot/api.sajumoon.kr
# - prod: root@104.64.128.103:/data/wwwroot/api.sajumoon.co.kr  (도메인은 api.sajuplan.com)
# pm2 cwd 확인: tools/_check_prod_path.py
#
# Windows: Git Bash 의 자동 경로 변환 함정 있음 (/data/... → C:/Program Files/Git/data/...)
#          PowerShell 로 실행하거나 MSYS_NO_PATHCONV=1 환경변수 사용.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Windows 콘솔(cp949) 에서 한글/유니코드 출력 시 에러 방지
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

# 옮길 파일: (로컬 상대경로, 원격 상대경로)
# 2026-05-17: 상담사 후기 알림톡 추가
# audit A~G 전체 변경분 외과 패치 (18개 파일) — 이전 배포 분
FILES = [
    # 🟣 ID 단일화 작업 (2026-05-22) — 한 사람 한 mb_id, 회원 → 상담사 승격, m2net 컬럼 분리
    ("api/src/user/auth/auth.service.ts", "src/user/auth/auth.service.ts"),
    # 2026-05-25: 비밀번호 정책 강화 (8자리 + 영문/숫자 혼합) — 가입 DTO 검증
    ("api/src/user/auth/dto/signup.dto.ts", "src/user/auth/dto/signup.dto.ts"),
    # 2026-05-27: 5분 잔여 알림 — 채팅/전화 + 전역 알림 polling
    ("api/src/shared/alerts/alerts.service.ts", "src/shared/alerts/alerts.service.ts"),
    ("api/src/shared/alerts/alerts.module.ts", "src/shared/alerts/alerts.module.ts"),
    ("api/src/app.module.ts", "src/app.module.ts"),
    ("api/src/user/chat/chat.service.ts", "src/user/chat/chat.service.ts"),
    ("api/src/pg-callbacks/m2net-push.service.ts", "src/pg-callbacks/m2net-push.service.ts"),
    ("api/src/user/notifications/notifications.controller.ts", "src/user/notifications/notifications.controller.ts"),
    ("api/src/user/counselor-apply/counselor-apply.service.ts", "src/user/counselor-apply/counselor-apply.service.ts"),
    ("api/src/admin/counselor-apply/counselor-apply.service.ts", "src/admin/counselor-apply/counselor-apply.service.ts"),
    # 2026-05-22: counselor-apply 승인 흐름에서 m2net 연동 실패 시 OpsAlert 발송 (csrid 누락 운영자가 인지 못하던 문제)
    ("api/src/admin/counselor-apply/counselor-apply.module.ts", "src/admin/counselor-apply/counselor-apply.module.ts"),
    # 2026-05-22: 관리자 개인 메모장
    ("api/src/admin/memo/memo.service.ts", "src/admin/memo/memo.service.ts"),
    ("api/src/admin/memo/memo.controller.ts", "src/admin/memo/memo.controller.ts"),
    ("api/src/admin/memo/memo.module.ts", "src/admin/memo/memo.module.ts"),
    # (members.service.ts 는 아래에 이미 등록되어 있음 — 새 promoteToCounselor 메서드 포함)
    # 🔴 권한 가드 보안 사고 수정 (2026-05-22) — 일반관리자가 본인을 슈퍼로 만들 수 있던 escalation 차단
    ("api/src/admin/permissions/permissions.controller.ts", "src/admin/permissions/permissions.controller.ts"),
    # 🔴 보안 감사 (2026-05-22) — 충전금액 설정 / 약관 콘텐츠 슈퍼 전용
    ("api/src/admin/account-settings/account-settings.controller.ts", "src/admin/account-settings/account-settings.controller.ts"),
    ("api/src/admin/contents/contents.controller.ts", "src/admin/contents/contents.controller.ts"),
    # 🔴 보안 감사 2차 (2026-05-22) — 매출/돈 직결 5개 컨트롤러 슈퍼 가드
    ("api/src/admin/payouts/payouts.controller.ts", "src/admin/payouts/payouts.controller.ts"),
    ("api/src/admin/grade/grade.controller.ts", "src/admin/grade/grade.controller.ts"),
    ("api/src/admin/points/points.controller.ts", "src/admin/points/points.controller.ts"),
    ("api/src/admin/payments/payments.controller.ts", "src/admin/payments/payments.controller.ts"),
    ("api/src/admin/referrals/referrals.controller.ts", "src/admin/referrals/referrals.controller.ts"),
    # 상담사 신청 캡차 제거 (2026-05-21) — SMS 인증으로 봇 차단 충분, UX 우선
    ("api/src/user/counselor-apply/counselor-apply.controller.ts", "src/user/counselor-apply/counselor-apply.controller.ts"),
    ("api/src/user/counselor-apply/counselor-apply.module.ts", "src/user/counselor-apply/counselor-apply.module.ts"),
    # 선지급 시스템 Phase 1~3 (2026-05-21) — 가용한도/신청/취소/계좌 + 어드민 일괄처리 + 카톡 3단 + 슈퍼 가드 + health-check
    ("api/src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts", "src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts"),
    ("api/src/user/counselor-mypage-payout/counselor-mypage-payout.controller.ts", "src/user/counselor-mypage-payout/counselor-mypage-payout.controller.ts"),
    ("api/src/user/counselor-mypage-payout/counselor-mypage-payout.module.ts", "src/user/counselor-mypage-payout/counselor-mypage-payout.module.ts"),
    ("api/src/user/user.module.ts", "src/user/user.module.ts"),
    ("api/src/admin/payouts/payouts.service.ts", "src/admin/payouts/payouts.service.ts"),
    ("api/src/admin/payouts/payouts.controller.ts", "src/admin/payouts/payouts.controller.ts"),
    ("api/src/admin/payouts/payouts.module.ts", "src/admin/payouts/payouts.module.ts"),
    ("api/src/admin/admin.module.ts", "src/admin/admin.module.ts"),
    ("api/src/admin/dashboard/dashboard.service.ts", "src/admin/dashboard/dashboard.service.ts"),
    ("api/src/admin/settings/settings.controller.ts", "src/admin/settings/settings.controller.ts"),
    # 슈퍼관리자 전화번호 토글 (2026-05-20 추가) — JWT 에 is_super 포함 + members API 마스킹 분기
    ("api/src/admin/auth/admin-auth.guard.ts", "src/admin/auth/admin-auth.guard.ts"),
    ("api/src/admin/auth/auth.service.ts", "src/admin/auth/auth.service.ts"),
    ("api/src/admin/auth/auth.controller.ts", "src/admin/auth/auth.controller.ts"),
    # 대시보드 alerts (2026-05-19 추가)
    ("api/src/admin/dashboard/dashboard.controller.ts", "src/admin/dashboard/dashboard.controller.ts"),
    ("api/src/admin/dashboard/dashboard.service.ts", "src/admin/dashboard/dashboard.service.ts"),
    # 상담사 추천 수당 (2026-05-17 추가)
    ("api/src/admin/referrals/referrals.service.ts", "src/admin/referrals/referrals.service.ts"),
    ("api/src/admin/referrals/referrals.controller.ts", "src/admin/referrals/referrals.controller.ts"),
    ("api/src/admin/referrals/referrals.module.ts", "src/admin/referrals/referrals.module.ts"),
    ("api/src/admin/admin.module.ts", "src/admin/admin.module.ts"),
    # 상담사 후기 알림톡 (2026-05-17 추가)
    ("api/src/user/reviews/reviews.module.ts", "src/user/reviews/reviews.module.ts"),
    ("api/src/user/reviews/reviews.service.ts", "src/user/reviews/reviews.service.ts"),
    # 2026-05-28: 상담사 수익금 페이지 강한 분리 — 회원 적립/차감 row 제외, 상담 적립만
    ("api/src/user/settlements/settlements.service.ts", "src/user/settlements/settlements.service.ts"),
    # 이전 audit 변경분 ↓
    ("api/src/admin/alimtalk-bulk/alimtalk-bulk.service.ts", "src/admin/alimtalk-bulk/alimtalk-bulk.service.ts"),
    ("api/src/admin/grade/grade.service.ts", "src/admin/grade/grade.service.ts"),
    ("api/src/admin/members/members.controller.ts", "src/admin/members/members.controller.ts"),
    ("api/src/admin/members/members.service.ts", "src/admin/members/members.service.ts"),
    ("api/src/admin/settings/settings.service.ts", "src/admin/settings/settings.service.ts"),
    ("api/src/app.module.ts", "src/app.module.ts"),
    ("api/src/cron/cron.controller.ts", "src/cron/cron.controller.ts"),
    ("api/src/cron/cron.module.ts", "src/cron/cron.module.ts"),
    ("api/src/cron/grade-cron.service.ts", "src/cron/grade-cron.service.ts"),
    # 2026-05-30 use_seconds=0 chat_room 영구실패 사고 fix — retry-cron 가드 + 컨텍스트 알림
    ("api/src/cron/retry-cron.service.ts", "src/cron/retry-cron.service.ts"),
    ("api/src/cron/health-check.service.ts", "src/cron/health-check.service.ts"),
    ("api/src/cron/settlement-cron.service.ts", "src/cron/settlement-cron.service.ts"),
    # 2026-05-27 5차: chat module exports UserChatService (cron 에서 chat 호출 위함)
    ("api/src/user/chat/chat.module.ts", "src/user/chat/chat.module.ts"),
    ("api/src/main.ts", "src/main.ts"),
    ("api/src/pg-callbacks/m2net-push.controller.ts", "src/pg-callbacks/m2net-push.controller.ts"),
    ("api/src/pg-callbacks/m2net-push.module.ts", "src/pg-callbacks/m2net-push.module.ts"),
    ("api/src/pg-callbacks/m2net-push.service.ts", "src/pg-callbacks/m2net-push.service.ts"),
    # 단기통화 자동환불 마커 추가 (2026-05-22) — 수동 환불 차단 가드
    ("api/src/admin/refunds/refunds.service.ts", "src/admin/refunds/refunds.service.ts"),
    # 고객보호비용 내역 페이지 endpoint (2026-05-22)
    ("api/src/admin/short-call-refunds/short-call-refunds.service.ts", "src/admin/short-call-refunds/short-call-refunds.service.ts"),
    ("api/src/admin/short-call-refunds/short-call-refunds.controller.ts", "src/admin/short-call-refunds/short-call-refunds.controller.ts"),
    ("api/src/admin/short-call-refunds/short-call-refunds.module.ts", "src/admin/short-call-refunds/short-call-refunds.module.ts"),
    # 어드민 상담사 운영 종합 페이지 (2026-05-22)
    ("api/src/admin/counselor-ops/counselor-ops.service.ts", "src/admin/counselor-ops/counselor-ops.service.ts"),
    ("api/src/admin/counselor-ops/counselor-ops.controller.ts", "src/admin/counselor-ops/counselor-ops.controller.ts"),
    ("api/src/admin/counselor-ops/counselor-ops.module.ts", "src/admin/counselor-ops/counselor-ops.module.ts"),
    ("api/src/admin/admin.module.ts", "src/admin/admin.module.ts"),
    ("api/src/pg-callbacks/callback-ip-allowlist.guard.ts", "src/pg-callbacks/callback-ip-allowlist.guard.ts"),
    ("api/src/shared/db/db.module.ts", "src/shared/db/db.module.ts"),
    ("api/src/shared/ops-alert/ops-alert.service.ts", "src/shared/ops-alert/ops-alert.service.ts"),
    ("api/src/user/auth/auth.controller.ts", "src/user/auth/auth.controller.ts"),
    ("api/src/user/charge/charge.module.ts", "src/user/charge/charge.module.ts"),
    ("api/src/user/charge/charge.service.ts", "src/user/charge/charge.service.ts"),
    ("api/src/user/charge/pg-callback.controller.ts", "src/user/charge/pg-callback.controller.ts"),
    # 🟣 ID 단일화 잔여 수정 (2026-05-22) — 회원 m2net id 는 m2net_membid 컬럼 (csrid 는 상담사 전용)
    ("api/src/user/chat/chat.service.ts", "src/user/chat/chat.service.ts"),
    ("api/src/admin/payments/payments.service.ts", "src/admin/payments/payments.service.ts"),
    ("api/src/cron/reset.service.ts", "src/cron/reset.service.ts"),
    ("api/src/user/consult/consult.service.ts", "src/user/consult/consult.service.ts"),
    ("api/src/user/consult/consult.controller.ts", "src/user/consult/consult.controller.ts"),
    ("api/src/user/counselor-mypage-grade/counselor-mypage-grade.controller.ts", "src/user/counselor-mypage-grade/counselor-mypage-grade.controller.ts"),
    ("api/src/user/counselors/counselors.controller.ts", "src/user/counselors/counselors.controller.ts"),
    ("api/src/user/counselors/counselors.service.ts", "src/user/counselors/counselors.service.ts"),
    # 2026-05-22: counselor_request_alert + 상담요청하기 (부재 상담사 호출)
    ("api/src/user/counselors/counselors.module.ts", "src/user/counselors/counselors.module.ts"),
    ("api/src/user/points/points.controller.ts", "src/user/points/points.controller.ts"),
    ("api/src/user/settlements/settlements.controller.ts", "src/user/settlements/settlements.controller.ts"),
    ("api/src/user/sms/sms.service.ts", "src/user/sms/sms.service.ts"),
    # 2026-05-25: 메인 통계 디폴트(override) + 실제 자동집계 합산
    ("api/src/user/stats/stats.service.ts", "src/user/stats/stats.service.ts"),
]


def parse_host(s: str) -> tuple[str, str, int]:
    user = "root"
    port = 22
    if "@" in s:
        user, s = s.split("@", 1)
    if ":" in s:
        s, p = s.split(":", 1)
        port = int(p)
    return user, s, port


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: _patch_api.py <user@host[:port]> <api_remote> <pm2_name>", file=sys.stderr)
        return 2
    host_arg, api_remote, pm2_name = sys.argv[1], sys.argv[2], sys.argv[3]
    user, host, port = parse_host(host_arg)

    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 2

    root = Path(__file__).resolve().parent.parent
    print(f"▶ connect {user}@{host}:{port}", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        host, port=port, username=user, password=pw,
        timeout=20, banner_timeout=20, auth_timeout=20, look_for_keys=False, allow_agent=False,
    )
    transport = ssh.get_transport()
    if transport is not None:
        transport.set_keepalive(15)

    try:
        for local_rel, remote_rel in FILES:
            local_path = root / local_rel
            remote_path = f"{api_remote.rstrip('/')}/{remote_rel}"
            data = local_path.read_bytes()
            print(f"  put {local_rel}  ({len(data):,} bytes) → {remote_path}", flush=True)
            # 신규 폴더 대비 — 부모 디렉토리 보장
            remote_dir = remote_path.rsplit('/', 1)[0]
            ssh.exec_command(f"mkdir -p '{remote_dir}'", timeout=10)[1].channel.recv_exit_status()
            # SFTP 가 chroot/path 이슈로 실패할 수 있어 ssh exec + cat > 으로 우회
            stdin, stdout, stderr = ssh.exec_command(f"cat > '{remote_path}'", timeout=60)
            stdin.write(data)
            stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            err = stderr.read().decode("utf-8", errors="replace")
            if rc != 0:
                print(f"  ✗ put 실패 rc={rc}: {err}", file=sys.stderr)
                return rc

        # 2026-05-22 버그 수정: 이전엔 `set -e` 만 있었는데 `npm run build 2>&1 | tail -20` 의
        # exit code 는 tail 의 0 이라 빌드 실패가 set -e 에 안 잡혔음. 결과적으로 빌드 실패하고도
        # pm2 reload 강행되고 ✓ done 보고. dist/ 는 갱신 안 됐는데 사용자는 성공으로 인지.
        # `pipefail` 추가로 파이프 첫 명령 실패가 전체 실패로 잡힘.
        cmd = (
            f"set -eo pipefail; cd '{api_remote}' && "
            f"echo '[remote] npm run build' && npm run build 2>&1 | tail -20 && "
            f"echo '[remote] pm2 reload {pm2_name}' && "
            f"(pm2 reload '{pm2_name}' --update-env 2>&1 || PM2_CWD='{api_remote}' pm2 start ecosystem.config.js) && "
            f"pm2 status '{pm2_name}' | tail -3"
        )
        print(f"▶ remote build + reload", flush=True)
        stdin, stdout, stderr = ssh.exec_command(f"bash -lc {repr(cmd)}", timeout=300)
        stdin.close()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        rc = stdout.channel.recv_exit_status()
        if out:
            print(out)
        if err:
            print(err, file=sys.stderr)
        if rc != 0:
            print(f"✗ remote 종료코드={rc}", file=sys.stderr)
            return rc
        print(f"✓ done {host}")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
