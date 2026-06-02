#!/usr/bin/env python3
"""사주플랜 전환 배포 (순차 SFTP, 스레딩 없음)"""
from __future__ import annotations
import os, sys, posixpath
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

ROOT = Path(__file__).resolve().parent.parent

API_FILES = [
    ("api/src/pg-callbacks/m2net-push.service.ts",        "src/pg-callbacks/m2net-push.service.ts"),
    ("api/src/shared/mailer/mailer.service.ts",            "src/shared/mailer/mailer.service.ts"),
    ("api/src/shared/ops-alert/ops-alert.service.ts",      "src/shared/ops-alert/ops-alert.service.ts"),
    ("api/src/shared/ag9/ag9.module.ts",                   "src/shared/ag9/ag9.module.ts"),
    ("api/src/user/auth/auth.controller.ts",               "src/user/auth/auth.controller.ts"),
    ("api/src/user/auth/auth.service.ts",                  "src/user/auth/auth.service.ts"),
    ("api/src/user/charge/charge.module.ts",               "src/user/charge/charge.module.ts"),
    ("api/src/user/charge/charge.service.ts",              "src/user/charge/charge.service.ts"),
    ("api/src/user/charge/dto/register-card.dto.ts",       "src/user/charge/dto/register-card.dto.ts"),
    ("api/src/user/chat/chat.service.ts",                  "src/user/chat/chat.service.ts"),
    ("api/src/user/consult/consult.service.ts",            "src/user/consult/consult.service.ts"),
    ("api/src/user/qna/qna.service.ts",                    "src/user/qna/qna.service.ts"),
    ("api/src/user/sms/sms.service.ts",                    "src/user/sms/sms.service.ts"),
    ("api/src/admin/banners/banners.service.ts",           "src/admin/banners/banners.service.ts"),
    ("api/src/admin/coupon-zones/coupon-zones.service.ts", "src/admin/coupon-zones/coupon-zones.service.ts"),
    ("api/src/shared/env/runtime-env.ts",                  "src/shared/env/runtime-env.ts"),
    ("api/.env.defaults",                                  ".env.defaults"),
]

EXCLUDE = {".env", ".env.example", "node_modules", ".git", "uploads", "logs", "secrets"}

SERVERS = [
    dict(label="PROD", host="104.64.128.103", env="prod",
         api_remote="/data/wwwroot/api.sajuplan.com",
         user_remote="/data/wwwroot/sajumoon.co.kr",
         mng_remote="/data/wwwroot/sajumoon.co.kr/mng",
         pm2="sajumoon-api"),
    dict(label="TEST", host="172.235.211.75", env="test",
         api_remote="/data/wwwroot/api.sajumoon.kr",
         user_remote="/data/wwwroot/sajumoon.kr",
         mng_remote="/data/wwwroot/sajumoon.kr/mng",
         pm2="sajumoon-api"),
]


def connect(host: str, pw: str) -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username="root", password=pw,
              allow_agent=False, look_for_keys=False,
              timeout=20, banner_timeout=20, auth_timeout=20)
    t = c.get_transport()
    if t:
        t.set_keepalive(15)
    return c


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str]:
    i, o, e = ssh.exec_command(f"bash -lc {repr(cmd)}", timeout=timeout)
    i.close()
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    rc = o.channel.recv_exit_status()
    return rc, out + err


def deploy_api(ssh: paramiko.SSHClient, api_remote: str, pm2: str) -> bool:
    print(f"  [API] {len(API_FILES)}개 파일 업로드...")
    for local_rel, remote_rel in API_FILES:
        lp = ROOT / local_rel
        if not lp.exists():
            print(f"    skip (없음): {local_rel}")
            continue
        data = lp.read_bytes()
        rp = f"{api_remote.rstrip('/')}/{remote_rel}"
        rdir = rp.rsplit("/", 1)[0]
        run(ssh, f"mkdir -p '{rdir}'", timeout=10)
        i, o, _ = ssh.exec_command(f"cat > '{rp}'", timeout=30)
        i.write(data)
        i.channel.shutdown_write()
        o.channel.recv_exit_status()
        print(f"    ✓ {remote_rel} ({len(data):,}b)")

    print(f"  [API] 원격 빌드 중...")
    rc, out = run(ssh,
        f"set -e; cd '{api_remote}' && npm run build 2>&1 | tail -5 && "
        f"pm2 reload '{pm2}' --update-env 2>&1 | tail -3",
        timeout=240)
    print(out)
    if rc != 0:
        print(f"  ✗ API 빌드 실패", file=sys.stderr)
        return False
    print("  ✓ API 완료")
    return True


def ensure_dir(sftp: paramiko.SFTPClient, path: str) -> None:
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur = f"{cur}/{p}"
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def deploy_frontend(ssh: paramiko.SSHClient, src: Path, dst: str, label: str) -> bool:
    sftp = ssh.open_sftp()
    try:
        ensure_dir(sftp, dst)
        files = []
        for root, dirs, fnames in os.walk(src):
            dirs[:] = [d for d in dirs if d not in EXCLUDE]
            for fn in fnames:
                full = Path(root) / fn
                rel = full.relative_to(src).as_posix()
                files.append((full, posixpath.join(dst, rel)))

        print(f"  [{label}] {len(files)}개 파일 업로드...")
        for i, (lp, rp) in enumerate(files, 1):
            rdir = rp.rsplit("/", 1)[0]
            ensure_dir(sftp, rdir)
            sftp.put(str(lp), rp)
            if i % 50 == 0:
                print(f"    {i}/{len(files)}...")
        print(f"  ✓ {label} 완료")
        return True
    except Exception as ex:
        print(f"  ✗ {label} 실패: {ex}", file=sys.stderr)
        return False
    finally:
        sftp.close()


def deploy_server(srv: dict, pw: str) -> bool:
    print(f"\n{'='*55}")
    print(f"▶ {srv['label']} ({srv['host']})")
    print(f"{'='*55}")
    try:
        ssh = connect(srv["host"], pw)
    except Exception as ex:
        print(f"  ✗ SSH 연결 실패: {ex}")
        return False
    try:
        ok1 = deploy_api(ssh, srv["api_remote"], srv["pm2"])
        ok2 = deploy_frontend(ssh, ROOT / "web/user/dist", srv["user_remote"], "user")
        ok3 = deploy_frontend(ssh, ROOT / "web/mng/dist",  srv["mng_remote"],  "mng")
        # __SAJUMOON_ENV__ → prod|test 치환 (deploy.sh sed 단계 대체)
        env = srv["env"]
        for path in [f"{srv['user_remote']}/index.html", f"{srv['mng_remote']}/index.html"]:
            run(ssh, f"sed -i 's/__SAJUMOON_ENV__/{env}/g' {path}", timeout=10)
        print(f"  ✓ env={env} 치환 완료")
        return ok1 and ok2 and ok3
    finally:
        ssh.close()
        print(f"  SSH 종료: {srv['label']}")


def main() -> int:
    pw = os.environ.get("SSHPASS", "")
    if not pw:
        print("✗ SSHPASS 환경변수 필요", file=sys.stderr)
        return 2

    results = {}
    for srv in SERVERS:
        results[srv["label"]] = deploy_server(srv, pw)

    print(f"\n{'='*55}")
    print("최종 결과")
    for label, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {label}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
