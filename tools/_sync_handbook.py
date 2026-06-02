"""_HANDBOOK 디렉토리 전체를 PROD api 서버로 SFTP 동기화."""
import sys, io, os, glob, paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
            allow_agent=False, look_for_keys=False, timeout=20)
sftp = ssh.open_sftp()

remote_root = "/data/wwwroot/api.sajumoon.co.kr/_HANDBOOK"

# 디렉토리 생성
for d in ["admin","alert","auth","board","chat","counselor","member","payment","promotion","stats","system"]:
    ssh.exec_command(f"mkdir -p {remote_root}/{d}")[1].channel.recv_exit_status()

files = glob.glob("_HANDBOOK/**/*", recursive=True)
files = [f for f in files if os.path.isfile(f)]

for local in files:
    rel = local.replace(os.sep, "/").replace("_HANDBOOK/", "")
    remote = f"{remote_root}/{rel}"
    sftp.put(local, remote)
    print(f"  {rel}")

sftp.close()
ssh.close()
print(f"total {len(files)} files synced")
