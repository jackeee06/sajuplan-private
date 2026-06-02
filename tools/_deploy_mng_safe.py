"""안전 mng 배포 — 자동 검증 + 실패 시 롤백 + OpsAlert.

기존 _deploy_mng_settlements.py 를 대체. 2026-06-02 사장님 명시 안전망 추가.

흐름:
  1. 배포 전 prod index.html 백업 (.bak)
  2. assets/* + index.html SFTP
  3. env 치환 (__SAJUMOON_ENV__ → prod)
  4. 자동 검증:
     a. https://sajuplan.com/mng/ 200 OK
     b. index.html 안에 'env: __SAJUMOON_ENV__' 잔존 X (치환 성공)
     c. JS hash 파일 200 OK
  5. 실패 시:
     a. prod index.html.bak → index.html 복원 (롤백)
     b. /api/cron/manual-alert POST 발사 (사장님 카톡 알림)
     c. exit 1
  6. 성공 시: bak 삭제 + exit 0
"""
from __future__ import annotations
import os, sys, time, glob, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

LOCAL = r"C:\claudeworkspace\sajumoon\web\mng\dist"
REMOTE = "/data/wwwroot/sajumoon.co.kr/mng"
EXTERNAL_URL = "https://sajuplan.com/mng/"


def fail(c, reason: str, tok: str):
    """롤백 + OpsAlert + exit 1."""
    print(f"\n❌ 배포 실패: {reason}")
    print("[1] 롤백 — index.html.bak 복원 시도")
    _, o, _ = c.exec_command(f"if [ -f {REMOTE}/index.html.bak ]; then cp {REMOTE}/index.html.bak {REMOTE}/index.html && echo OK; else echo NO_BACKUP; fi", get_pty=False)
    print(o.read().decode("utf-8", errors="replace").strip())

    print("[2] OpsAlert 발사 (사장님 카톡)")
    cat = "배포 실패 — 자동 롤백"
    detail = f"mng 배포 검증 실패: {reason}\n{EXTERNAL_URL} 즉시 확인 필요.\n자동 롤백 시도함."
    cmd = (
        f"curl -s -X POST -H 'X-Cron-Token: {tok}' -H 'Content-Type: application/json' "
        f"-d '{{\"category\":\"{cat}\",\"detail\":\"{detail}\"}}' "
        f"https://api.sajuplan.com/api/cron/manual-alert"
    )
    _, o, _ = c.exec_command(cmd, get_pty=False)
    print("OpsAlert 응답:", o.read().decode("utf-8", errors="replace").strip())
    c.close()
    sys.exit(1)


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)

    # CRON_TOKEN 미리 가져오기 (실패 시 알림용)
    _, o, _ = c.exec_command("grep '^CRON_TOKEN=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1 | cut -d= -f2-", get_pty=False)
    tok = o.read().decode("utf-8", errors="replace").strip().strip("'\"")

    # ── [1] 배포 전 백업 ──
    print("[1] index.html 백업")
    _, o, _ = c.exec_command(f"cp {REMOTE}/index.html {REMOTE}/index.html.bak && ls -la {REMOTE}/index.html.bak", get_pty=False)
    print(o.read().decode("utf-8", errors="replace").strip())

    # ── [2] SFTP ──
    s = c.open_sftp()
    assets = glob.glob(os.path.join(LOCAL, "assets", "*"))
    print(f"\n[2] SFTP assets/ ({len(assets)} files) + index.html")
    for f in assets:
        s.put(f, f"{REMOTE}/assets/{os.path.basename(f)}")
    s.put(os.path.join(LOCAL, "index.html"), f"{REMOTE}/index.html")
    s.close()
    print(f"[2] done")

    # ── [3] env 치환 ──
    print("\n[3] env 치환")
    _, o, _ = c.exec_command(f"sed -i 's/__SAJUMOON_ENV__/prod/g' {REMOTE}/index.html", get_pty=False)
    o.read()

    # ── [4] 자동 검증 ──
    print("\n[4] 자동 검증")
    # 4a. 200 OK
    _, o, _ = c.exec_command(f'curl -s -o /dev/null -w "%{{http_code}}" {EXTERNAL_URL}', get_pty=False)
    code = o.read().decode("utf-8", errors="replace").strip()
    if code != "200":
        fail(c, f"mng 페이지 응답 {code} (200 기대)", tok)
    print(f"  [4a] {EXTERNAL_URL} → {code} ✅")

    # 4b. env 치환 검증
    _, o, _ = c.exec_command(f"curl -s {EXTERNAL_URL} | grep -c '__SAJUMOON_ENV__'", get_pty=False)
    remaining = int(o.read().decode("utf-8", errors="replace").strip() or 0)
    if remaining > 0:
        fail(c, f"env 치환 실패 — '__SAJUMOON_ENV__' 가 {remaining}개 잔존", tok)
    print(f"  [4b] env 치환 OK (__SAJUMOON_ENV__ 0개)")

    # 4c. JS hash 파일 200 OK
    _, o, _ = c.exec_command(f"curl -s {EXTERNAL_URL} | grep -oE 'index-[A-Za-z0-9_-]+\\.js' | head -1", get_pty=False)
    js_hash = o.read().decode("utf-8", errors="replace").strip()
    _, o, _ = c.exec_command(f'curl -s -o /dev/null -w "%{{http_code}}" {EXTERNAL_URL}assets/{js_hash}', get_pty=False)
    js_code = o.read().decode("utf-8", errors="replace").strip()
    if js_code != "200":
        fail(c, f"JS 파일 {js_hash} 응답 {js_code}", tok)
    print(f"  [4c] JS {js_hash} → {js_code} ✅")

    # 4d. CSS hash 파일 200 OK
    _, o, _ = c.exec_command(f"curl -s {EXTERNAL_URL} | grep -oE 'index-[A-Za-z0-9_-]+\\.css' | head -1", get_pty=False)
    css_hash = o.read().decode("utf-8", errors="replace").strip()
    _, o, _ = c.exec_command(f'curl -s -o /dev/null -w "%{{http_code}}" {EXTERNAL_URL}assets/{css_hash}', get_pty=False)
    css_code = o.read().decode("utf-8", errors="replace").strip()
    if css_code != "200":
        fail(c, f"CSS 파일 {css_hash} 응답 {css_code}", tok)
    print(f"  [4d] CSS {css_hash} → {css_code} ✅")

    # ── [5] 백업 정리 (성공 시) ──
    print("\n[5] 배포 성공 — index.html.bak 정리")
    _, o, _ = c.exec_command(f"rm -f {REMOTE}/index.html.bak && echo OK", get_pty=False)
    print(o.read().decode("utf-8", errors="replace").strip())

    print(f"\n✅ 배포 + 검증 완료. {EXTERNAL_URL}")
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
