"""Phase 7 운영 알림 인프라 셋업 — 양 서버.

수행 항목:
  1. setting 테이블에 namespace='ops' 시드 (admin_alert.*)
  2. alimtalk_template 에 'ops_admin_alert' 템플릿 예시 INSERT (사용자가 BizM 콘솔에서 동일 본문 등록 필요)
  3. .env 에 CRON_TOKEN 추가 (이미 있으면 SKIP)
  4. crontab URL 갱신 (?token=... 추가)
  5. pm2 reload — 새 CRON_TOKEN 반영

재실행 안전:
  - ON CONFLICT DO NOTHING (시드)
  - .env 이미 있으면 SKIP
  - crontab 이미 token= 있으면 SKIP
"""
from __future__ import annotations
import base64
import os
import secrets
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr", "api.sajumoon.kr"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com", "api.sajuplan.com"),
]

# 시드 SQL — setting + alimtalk_template
SEED_SQL = """
-- ops namespace 시드
INSERT INTO setting (namespace, key, value) VALUES
  ('ops', 'admin_alert.enabled',       'true'),
  ('ops', 'admin_alert.recipients',    ''),
  ('ops', 'admin_alert.template_code', 'ops_admin_alert'),
  ('ops', 'admin_alert.cooldown_sec',  '300')
ON CONFLICT (namespace, key) DO NOTHING;

-- 알림톡 템플릿 예시 (사용자가 BizM 콘솔에서 동일 본문으로 승인받아야 함)
INSERT INTO alimtalk_template (template_code, message, is_active)
VALUES (
  'ops_admin_alert',
  E'[사주플랜 운영 알림]\\n\\n유형: #{category}\\n시각: #{at}\\n\\n#{detail}',
  true
)
ON CONFLICT (template_code) DO NOTHING;

SELECT '=== ops settings ===' AS section;
SELECT key, COALESCE(NULLIF(value,''),'(미설정)') AS value
  FROM setting WHERE namespace='ops' ORDER BY key;

SELECT '=== ops_admin_alert template ===' AS section;
SELECT template_code, is_active, LEFT(message, 80) AS preview
  FROM alimtalk_template WHERE template_code='ops_admin_alert';
"""


def run_sql_remote(c: paramiko.SSHClient, env_file: str, sql: str) -> tuple[int, str]:
    b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, stdout, _ = c.exec_command(f"bash -lc {repr(inner)}")
    out = stdout.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    return rc, out


def run_cmd(c: paramiko.SSHClient, cmd: str) -> tuple[int, str, str]:
    _, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def ensure_cron_token(c: paramiko.SSHClient, env_path: str) -> str:
    """기존 CRON_TOKEN 추출, 없으면 새로 생성해 .env 에 append."""
    rc, out, _ = run_cmd(c, f"grep '^CRON_TOKEN=' {env_path} 2>/dev/null | head -1 | cut -d= -f2-")
    existing = out.strip().strip('"').strip("'")
    if existing:
        print(f"  ✓ CRON_TOKEN 이미 .env 에 있음 (길이 {len(existing)})")
        return existing
    new_token = secrets.token_urlsafe(32)
    print(f"  + CRON_TOKEN 신규 생성 → .env 추가 (길이 {len(new_token)})")
    # append (이중 쓰기 방지: 다시 한 번 grep 후 없을 때만)
    cmd = f"grep -q '^CRON_TOKEN=' {env_path} || echo 'CRON_TOKEN={new_token}' >> {env_path}"
    rc, _, err = run_cmd(c, cmd)
    if rc != 0:
        print(f"  ✗ .env append 실패: {err}")
    return new_token


def update_crontab(c: paramiko.SSHClient, token: str, api_domain: str) -> None:
    """crontab 의 grade/recalculate, settlement/monthly 라인에 ?token= 추가."""
    rc, current, _ = run_cmd(c, "crontab -l 2>/dev/null || true")
    if rc != 0 and not current:
        print("  (crontab 비어있음 — install 스크립트 먼저 돌려야 함)")
        return

    new_lines = []
    modified = False
    for ln in current.splitlines():
        s = ln.strip()
        if not s:
            new_lines.append(ln)
            continue
        if ("grade/recalculate" in s or "settlement/monthly" in s) and "token=" not in s:
            # 단순 패턴 replace — 닫는 따옴표 직전에 ?token= 추가
            new = s.replace("/recalculate'", f"/recalculate?token={token}'")
            new = new.replace("/monthly'", f"/monthly?token={token}'")
            new_lines.append(new)
            if new != ln:
                modified = True
                # 로그에 token 노출 안 되게 마스킹
                print(f"  + token 추가: {new[:60].replace(token, '***')}...")
        else:
            new_lines.append(ln)

    if not modified:
        print("  ✓ crontab 토큰 이미 적용됨 — SKIP")
        return

    new_content = "\n".join(ln for ln in new_lines if ln) + "\n"
    b64 = base64.b64encode(new_content.encode("utf-8")).decode("ascii")
    inner = f"echo {b64} | base64 -d | crontab -"
    rc, _, err = run_cmd(c, f"bash -lc {repr(inner)}")
    if rc != 0:
        print(f"  ✗ crontab 적용 실패: {err}")


def pm2_reload(c: paramiko.SSHClient, api_path: str, pm2_name: str) -> None:
    """새 .env 반영을 위해 pm2 reload --update-env."""
    cmd = f"cd {api_path} && pm2 reload {pm2_name} --update-env 2>&1 | tail -5"
    rc, out, _ = run_cmd(c, f"bash -lc {repr(cmd)}")
    print(f"  {out.strip()}")


def setup_one(label: str, host: str, api_path: str, api_domain: str, pw: str) -> int:
    print(f"\n========== [{label}] {host} ==========")
    env_file = f"{api_path}/.env"
    pm2_name = "sajumoon-api"

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    try:
        # 1. DB 시드
        print("─ 1. ops 시드 + alimtalk 템플릿")
        rc, out = run_sql_remote(c, env_file, SEED_SQL)
        if rc != 0:
            print(f"  ✗ 시드 실패 (rc={rc})")
        else:
            # output 마지막 부분만 (요약)
            print("  ✓ 시드 적용")
            for line in out.splitlines()[-20:]:
                if line.strip():
                    print(f"    {line}")

        # 2. CRON_TOKEN
        print("─ 2. CRON_TOKEN 확보")
        token = ensure_cron_token(c, env_file)

        # 3. crontab URL 업데이트
        print("─ 3. crontab token 적용")
        update_crontab(c, token, api_domain)

        # 4. pm2 reload (새 .env 반영)
        print("─ 4. pm2 reload --update-env")
        pm2_reload(c, api_path, pm2_name)

        # 5. 최종 확인
        rc, final_cron, _ = run_cmd(c, "crontab -l")
        print("─ 5. 최종 crontab")
        for ln in final_cron.splitlines():
            if "grade/recalculate" in ln or "settlement/monthly" in ln:
                # token 부분 마스킹
                masked = ln
                if "token=" in masked:
                    masked = masked.split("token=")[0] + "token=***"
                print(f"    {masked}")
        return 0
    finally:
        c.close()


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1
    rc = 0
    for label, host, api_path, api_domain in TARGETS:
        r = setup_one(label, host, api_path, api_domain, pw)
        if r != 0:
            rc = r
    print("\n" + ("=" * 60))
    print("⚠ 운영자 카톡 수신을 위한 후속 작업:")
    print("  1. 어드민 → 설정 → 운영알림 탭에서 수신 휴대폰 등록")
    print("  2. BizM 콘솔에 'ops_admin_alert' 템플릿 승인 요청 (본문은 DB 의 message 그대로)")
    return rc


if __name__ == "__main__":
    sys.exit(main())
