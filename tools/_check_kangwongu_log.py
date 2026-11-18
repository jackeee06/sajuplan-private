"""강원구 6/26 00:3x 충전요청/AG9/autopay push 흔적 검색 (읽기전용)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\"")
            break
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
def run(cmd):
    _, o, e = c.exec_command(cmd)
    return o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')

L = "/root/.pm2/logs/sajumoon-api-out-0.log"
print("==== 6/26 00:3x~00:4x 사이 member 251 / 302137 관련 로그 전체 ====")
print(run(f"grep -n '06/26/2026, 12:3' {L} | grep -i '251\\|302137\\|autopay\\|autoPay\\|AG9\\|Ag9\\|charge\\|Charge\\|위조\\|미등록\\|membid' | head -60"))
print("==== autopay / AG9 charge 관련 (6/26 전체) ====")
print(run(f"grep -n 'autoPayCharge\\|autoPayRegister\\|handleAutopayPush\\|autopay-push\\|AutopayPush' {L} | grep '06/26/2026' | head -40"))
print("==== '위조' / '미등록' / 'OpsAlert' (6/26) ====")
print(run(f"grep -n '위조\\|미등록\\|등록 안 한\\|등록 안한' {L} | grep '06/26/2026' | head -20"))
print("==== membid 302137 가 박힌 모든 라인 (6/26) ====")
print(run(f"grep -n '302137' {L} | grep '06/26/2026' | head -30"))
print("==== error 로그 6/26 (autopay/charge/251) ====")
print(run("grep -n '06/26/2026' /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null | grep -i 'autopay\\|charge\\|251\\|302137\\|위조' | head -30"))
c.close()
