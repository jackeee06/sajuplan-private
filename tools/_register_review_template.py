"""상담사 후기 알림용 alimtalk_template 등록 (BizM 콘솔 등록 전 DB 선등록)."""
import os, sys, paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

TEMPLATE_CODE = "review_for_counselor"
MESSAGE = """[사주플랜 후기알림]

#{상담사명}님께 남겨진 새로운 상담 후기가 있습니다.

확인 후 답변을 남기시면 다른 분들의 선택에 도움이 됩니다.

▶ 후기 확인하기 : #{url}"""
BTN_NAME = "후기 확인하기"
BTN_URL = "https://sajuplan.com/#{url}"


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, out, _ = c.exec_command(
        "grep '^DATABASE_URL=' /data/wwwroot/api.sajuplan.com/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
        timeout=15,
    )
    url = out.read().decode().strip()

    msg_escaped = MESSAGE.replace("'", "''")
    btn_name_escaped = BTN_NAME.replace("'", "''")
    btn_url_escaped = BTN_URL.replace("'", "''")

    sql = (
        f"INSERT INTO alimtalk_template (template_code, message, primary_btn_name, primary_btn_url, is_active) "
        f"VALUES ('{TEMPLATE_CODE}', '{msg_escaped}', '{btn_name_escaped}', '{btn_url_escaped}', true) "
        f"ON CONFLICT (template_code) DO UPDATE "
        f"SET message = EXCLUDED.message, primary_btn_name = EXCLUDED.primary_btn_name, "
        f"    primary_btn_url = EXCLUDED.primary_btn_url, is_active = EXCLUDED.is_active"
    )
    cmd = f'psql "{url}" -c "{sql}"'
    _, out, err = c.exec_command(cmd, timeout=30)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace")
    if e.strip():
        print("stderr:", e)

    # 확인
    _, out, _ = c.exec_command(
        f"psql '{url}' -At -c \"SELECT template_code, length(message), is_active FROM alimtalk_template WHERE template_code = '{TEMPLATE_CODE}'\"",
        timeout=30,
    )
    print(f"\n=== 등록 결과 ===")
    print(out.read().decode("utf-8", "replace"))
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
