import os, paramiko

pw = os.environ["SSHPASS"]
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

_, out, _ = client.exec_command("grep DATABASE_URL /data/wwwroot/api.sajumoon.co.kr/.env | head -1")
db_url = out.read().decode().strip().replace("DATABASE_URL=", "").strip("'\"")

def q(sql):
    _, out2, _ = client.exec_command(f'psql "{db_url}" -c "{sql}" 2>&1')
    return out2.read().decode("utf-8", errors="replace").strip()

# canonical HTTPS URL 저장 — 웹 코드(native-bridge.ts)에서 kakaoplus://home/{id} 로 변환
print(q("UPDATE setting SET value = 'https://pf.kakao.com/_IhVbX/chat' WHERE namespace='site' AND key = 'kakao_channel_url';"))
print(q("SELECT namespace, key, value FROM setting WHERE namespace='site' AND key = 'kakao_channel_url';"))
client.close()
