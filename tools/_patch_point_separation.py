"""포인트 분리 작업 외과 패치 — API 6개 파일만 송신 후 빌드 + pm2 reload.

사용:
    SSHPASS='...' python tools/_patch_point_separation.py test
    SSHPASS='...' python tools/_patch_point_separation.py prod
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

TARGETS = {
    "test": {
        "host": "172.235.211.75",
        "api_remote": "/data/wwwroot/api.sajumoon.kr",
        "pm2": "sajumoon-api",
    },
    "prod": {
        "host": "104.64.128.103",
        "api_remote": "/data/wwwroot/api.sajumoon.co.kr",
        "pm2": "sajumoon-api",
    },
}

# 포인트 분리 작업으로 변경된 파일 (로컬 → 원격 상대경로)
FILES = [
    ("api/src/pg-callbacks/m2net-push.service.ts",
     "src/pg-callbacks/m2net-push.service.ts"),
    ("api/src/cron/settlement-cron.service.ts",
     "src/cron/settlement-cron.service.ts"),
    ("api/src/cron/health-check.service.ts",
     "src/cron/health-check.service.ts"),
    ("api/src/cron/reset.service.ts",
     "src/cron/reset.service.ts"),
    ("api/src/admin/counselor-ops/counselor-ops.service.ts",
     "src/admin/counselor-ops/counselor-ops.service.ts"),
    ("api/src/admin/members/members.service.ts",
     "src/admin/members/members.service.ts"),
    ("api/src/admin/dashboard/dashboard.service.ts",
     "src/admin/dashboard/dashboard.service.ts"),
    ("api/src/user/settlements/settlements.service.ts",
     "src/user/settlements/settlements.service.ts"),
    ("api/src/admin/points/points.service.ts",
     "src/admin/points/points.service.ts"),
    # [2026-05-23] PG-m2net 직통 이중 적립 자동 정정
    ("api/src/user/charge/charge.service.ts",
     "src/user/charge/charge.service.ts"),
    # [2026-05-23] 계좌 입력 검증 강화 (한글 예금주 + 10~14자리)
    ("api/src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts",
     "src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts"),
    # [2026-05-23] 채팅 알림톡 + 3분 자동 취소 + 글로벌 모달 polling + 안 읽음/이전 대화
    ("api/src/user/consult/consult.service.ts",
     "src/user/consult/consult.service.ts"),
    ("api/src/user/consult/consult.controller.ts",
     "src/user/consult/consult.controller.ts"),
    ("api/src/user/consult/consult.module.ts",
     "src/user/consult/consult.module.ts"),
    ("api/src/user/chat/chat.service.ts",
     "src/user/chat/chat.service.ts"),
    ("api/src/user/chat/chat.controller.ts",
     "src/user/chat/chat.controller.ts"),
    ("api/src/cron/cron.controller.ts",
     "src/cron/cron.controller.ts"),
    ("api/src/cron/cron.module.ts",
     "src/cron/cron.module.ts"),
    # [2026-05-24] 순이익 시뮬레이터
    ("api/src/admin/profit-sim/profit-sim.service.ts",
     "src/admin/profit-sim/profit-sim.service.ts"),
    ("api/src/admin/profit-sim/profit-sim.controller.ts",
     "src/admin/profit-sim/profit-sim.controller.ts"),
    ("api/src/admin/profit-sim/profit-sim.module.ts",
     "src/admin/profit-sim/profit-sim.module.ts"),
    ("api/src/admin/admin.module.ts",
     "src/admin/admin.module.ts"),
]


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in TARGETS:
        print("usage: _patch_point_separation.py <test|prod>", file=sys.stderr)
        return 2
    target = sys.argv[1]
    info = TARGETS[target]

    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 2

    root = Path(__file__).resolve().parent.parent
    api_remote = info["api_remote"]
    pm2_name = info["pm2"]

    print(f"▶ [{target}] connect root@{info['host']}", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        info["host"], port=22, username="root", password=pw,
        timeout=20, banner_timeout=20, auth_timeout=20,
        look_for_keys=False, allow_agent=False,
    )
    transport = ssh.get_transport()
    if transport is not None:
        transport.set_keepalive(15)

    try:
        for local_rel, remote_rel in FILES:
            local_path = root / local_rel
            remote_path = f"{api_remote.rstrip('/')}/{remote_rel}"
            data = local_path.read_bytes()
            print(f"  put {local_rel}  ({len(data):,} bytes)", flush=True)
            remote_dir = remote_path.rsplit('/', 1)[0]
            ssh.exec_command(f"mkdir -p '{remote_dir}'", timeout=10)[1].channel.recv_exit_status()
            stdin, stdout, stderr = ssh.exec_command(f"cat > '{remote_path}'", timeout=60)
            stdin.write(data)
            stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            err = stderr.read().decode("utf-8", errors="replace")
            if rc != 0:
                print(f"  ✗ put 실패 rc={rc}: {err}", file=sys.stderr)
                return rc

        cmd = (
            f"set -eo pipefail; cd '{api_remote}' && "
            f"echo '[remote] npm run build' && npm run build 2>&1 | tail -20 && "
            f"echo '[remote] pm2 reload {pm2_name}' && "
            f"(pm2 reload '{pm2_name}' --update-env 2>&1 || PM2_CWD='{api_remote}' pm2 start ecosystem.config.js) && "
            f"pm2 status '{pm2_name}' | tail -3"
        )
        print(f"▶ [{target}] remote build + reload", flush=True)
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
            print(f"✗ [{target}] remote 종료코드={rc}", file=sys.stderr)
            return rc
        print(f"✓ [{target}] done")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
