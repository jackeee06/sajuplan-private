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

# namespace 포함해서 확인
print(q("SELECT namespace, key, value FROM setting WHERE key LIKE '%kakao%' ORDER BY namespace, key;"))
client.close()
