"""테스트 서버 index.html 만 새 빌드 결과로 교체 (env 치환 포함).
hung deploy 가 favicon 파일은 옮겼지만 index.html 까지 못 갔던 케이스 복구용."""
import os, sys, paramiko
from pathlib import Path

pw = os.environ["SSHPASS"]
LOCAL_DIST = Path(r"C:\claudeworkspace\sajumoon\web\user\dist\index.html.template")
data = LOCAL_DIST.read_bytes().decode("utf-8")
# __SAJUMOON_ENV__ -> test
data = data.replace("__SAJUMOON_ENV__", "test")
data_bytes = data.encode("utf-8")
print(f"new index.html size: {len(data_bytes)} bytes")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("172.235.211.75", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
stdin, stdout, _ = c.exec_command("cat > /data/wwwroot/sajumoon.kr/index.html", timeout=30)
stdin.write(data_bytes); stdin.channel.shutdown_write()
rc = stdout.channel.recv_exit_status()
print(f"upload rc={rc}")

# verify
_, out, _ = c.exec_command("head -10 /data/wwwroot/sajumoon.kr/index.html")
print(out.read().decode("utf-8", errors="replace"))
c.close()
