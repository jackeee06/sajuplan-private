import os, sys, paramiko

pw = os.environ["SSHPASS"]
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

def sh(cmd):
    _, out, err = client.exec_command(cmd)
    return (out.read() + err.read()).decode("utf-8", errors="replace").strip()

CONF = "/usr/local/nginx/conf/vhost/sajuplan.com.conf"

# 백업
print(sh(f"cp {CONF} {CONF}.bak.$(date +%Y%m%d%H%M%S)"))

# uploads 블록 삽입 — 정적파일 regex 블록 바로 앞에 추가
INSERT = (
    "\n  # [2026-06-08] 상담사 프로필 사진 — API 서버 uploads 폴더 연결\n"
    "  location ^~ /uploads/ {\n"
    "    alias /data/wwwroot/api.sajumoon.co.kr/uploads/;\n"
    "    expires 30d;\n"
    "    access_log off;\n"
    "  }\n"
)

# 현재 내용 읽기
current = sh(f"cat {CONF}")

# 이미 추가됐는지 확인
if "/uploads/" in current:
    print("이미 /uploads/ 설정 존재. 스킵.")
else:
    # 정적파일 regex 앞에 삽입
    TARGET = "  location ~* \\.(jpg|jpeg|png"
    new_conf = current.replace(TARGET, INSERT + "  " + TARGET[2:])

    # 파일 쓰기
    stdin, _, _ = client.exec_command(f"tee {CONF}")
    stdin.write(new_conf.encode("utf-8"))
    stdin.channel.shutdown_write()

    # nginx 문법 검사
    print("=== nginx 문법 검사 ===")
    print(sh("/usr/local/nginx/sbin/nginx -t 2>&1"))

    # reload
    print("\n=== nginx reload ===")
    print(sh("/usr/local/nginx/sbin/nginx -s reload 2>&1"))

    # 검증
    print("\n=== URL 테스트 ===")
    result = sh("curl -s -o /dev/null -w '%{http_code}' https://sajuplan.com/uploads/member/1779435810281_93zl4g.jpg")
    print(f"sajuplan.com/uploads/member/... → {result}")

client.close()
