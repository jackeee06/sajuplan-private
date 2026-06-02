import paramiko, os, sys
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'],
          allow_agent=False, look_for_keys=False, timeout=10)
# pm2 로그에서 qa_ask 관련 최근 50줄
cmd = "pm2 logs sajumoon-api --nostream --lines 300 2>&1 | grep -i 'qa_ask\\|alimtalk.*qna\\|qna.*alimtalk' | tail -30"
_, out, _ = c.exec_command(f"bash -c {repr(cmd)}", timeout=20)
result = out.read().decode()
print(result if result.strip() else "(qa_ask 관련 로그 없음 — 최근 300줄 내)")
c.close()
