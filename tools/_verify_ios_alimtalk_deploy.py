"""배포 검증: prod 의 5개 발송처에 iosSkip: false 가 반영됐는지 grep + 잘못 올라간 경로(/root/C:) 정리."""
from __future__ import annotations
import os, sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HOST = "104.64.128.103"
BASE = "/data/wwwroot/api.sajumoon.co.kr/src/user"
FILES = [
    f"{BASE}/consult/consult.service.ts",
    f"{BASE}/counselors/counselors.service.ts",
    f"{BASE}/reviews/reviews.service.ts",
    f"{BASE}/qna/qna.service.ts",
]


def main() -> int:
    pw = os.environ["SSHPASS"]
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    print("=== iosSkip 반영 확인 (true 가 남아있으면 안 됨) ===")
    for f in FILES:
        _, o, _ = c.exec_command(f"grep -c 'iosSkip: false' '{f}'; grep -c 'iosSkip: true' '{f}'")
        vals = o.read().decode().split()
        false_n = vals[0] if vals else "?"
        true_n = vals[1] if len(vals) > 1 else "?"
        print(f"  {f.split('/user/')[1]:45s} false={false_n} true={true_n}")
    print("\n=== 잘못 올라간 경로 정리 (/root/C:) ===")
    _, o, _ = c.exec_command("rm -rf '/root/C:'; echo removed; ls -d '/root/C:' 2>&1 | head -1")
    print(o.read().decode())
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
