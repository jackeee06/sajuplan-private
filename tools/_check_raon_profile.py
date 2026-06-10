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

# jackee(id=91)가 상담사로서 받은 후기 + 답변 있는 것
print("=== jackee(id=91) counselor 후기 중 답변 있는 것 ===")
print(q("""
SELECT r.id AS review_id, rr.content AS reply_content, rr.created_at
FROM post_review r
JOIN post_review_reply rr ON rr.review_id = r.id
WHERE r.counselor_id = 91
ORDER BY rr.created_at DESC LIMIT 3;
"""))

# jackee member_file profile 확인
print("\n=== jackee(id=91) member_file profile ===")
print(q("SELECT id, stored_name, stored_name_webp FROM member_file WHERE member_id=91 AND kind='profile' ORDER BY id DESC LIMIT 1;"))

client.close()
