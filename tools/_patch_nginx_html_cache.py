"""
[2026-05-25] HTML cache 정책 nginx vhost 설정에 추가.

각 vhost 에 `location ~ \\.html$` 블록을 삽입해
HTML 파일에 Cache-Control: no-cache, must-revalidate 헤더 적용.

JS/CSS 는 Vite 해시 파일명이라 그대로 30일 캐시 유지(이미 설정됨).
결과: 사용자 캐시 삭제 불필요. 새 배포 즉시 반영.
"""
import paramiko
import time

PROD = "104.64.128.103"
TEST = "172.235.211.75"
USER = "root"
PASS = "saju26moon@!!"

# 삽입할 새 location 블록 (HSTS도 같이 — add_header 가 인헤리트 끊으므로)
NEW_BLOCK = """
  # [2026-05-25] HTML/SPA 항상 새 버전 받도록 — 캐시 무효화
  location ~ \\.html$ {
    add_header Cache-Control "no-cache, must-revalidate" always;
    add_header Strict-Transport-Security "max-age=15768000" always;
    expires off;
  }
"""

# (host, config_path) 목록
TARGETS = [
    (PROD, "/usr/local/nginx/conf/vhost/sajuplan.com.conf"),
    (PROD, "/usr/local/nginx/conf/vhost/sajumoon.co.kr.conf"),
    (TEST, "/usr/local/nginx/conf/vhost/sajumoon.kr.conf"),
]

MARKER = "[2026-05-25] HTML/SPA"


def run(host, cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=USER, password=PASS, timeout=15)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    ssh.close()
    return out, err


def fetch(host, path):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=USER, password=PASS, timeout=15)
    sftp = ssh.open_sftp()
    with sftp.open(path, "r") as f:
        content = f.read().decode()
    sftp.close()
    ssh.close()
    return content


def push(host, path, content):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=USER, password=PASS, timeout=15)
    sftp = ssh.open_sftp()
    with sftp.open(path, "w") as f:
        f.write(content)
    sftp.close()
    ssh.close()


def patch_one(host, path):
    print(f"\n=== {host} : {path} ===")
    content = fetch(host, path)
    if MARKER in content:
        print("  [skip] already applied")
        return True

    new_content = content

    # 적용 위치 — 첫 번째 'location ~' 또는 'location /' 직전에 삽입
    # 가장 안전한 위치: server { ... 안에서 location 시작 직전
    # gzip_min_length 1024; 이 가장 신뢰성 있는 marker
    # 없으면 첫 'location' 직전
    inserted = False
    if "gzip_min_length 1024;" in content:
        new_content = content.replace(
            "gzip_min_length 1024;",
            "gzip_min_length 1024;\n" + NEW_BLOCK,
            1,
        )
        inserted = True
    elif "index index.html" in content and "location" in content:
        # test 서버 같은 구조
        # 첫 'location ~' 앞에 삽입
        idx = content.find("location ~")
        if idx > 0:
            new_content = content[:idx] + NEW_BLOCK + "\n  " + content[idx:]
            inserted = True

    if not inserted:
        print("  [FAIL] insertion point not found - manual review needed")
        return False

    # 백업
    ts = int(time.time())
    backup = f"{path}.bak.{ts}"
    out, err = run(host, f"cp {path} {backup}")
    print(f"  [backup] {backup}")

    # 새 파일 업로드
    push(host, path, new_content)
    print("  [patched]")

    # nginx -t 검증
    out, err = run(host, "/usr/local/nginx/sbin/nginx -t 2>&1")
    if "syntax is ok" not in (out + err) or "test is successful" not in (out + err):
        print("  [FAIL] nginx -t failed - rolling back:")
        print(out + err)
        run(host, f"cp {backup} {path}")
        return False
    print("  [OK] nginx -t passed")

    # nginx reload
    out, err = run(host, "/usr/local/nginx/sbin/nginx -s reload 2>&1")
    print(f"  [reload] {(out + err).strip() or 'OK'}")
    return True


if __name__ == "__main__":
    results = []
    for host, path in TARGETS:
        ok = patch_one(host, path)
        results.append((host, path, ok))

    print("\n=== 결과 ===")
    for host, path, ok in results:
        print(f"  {'✓' if ok else '✗'} {host} {path}")
