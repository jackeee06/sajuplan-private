"""
[2026-05-25] nginx vhost 파일 첫 줄에 도메인 역할 안내 주석 추가.

미래의 운영자(또는 다른 admin) 가 "이 도메인이 뭐지?" 하면서
TEST 환경 sajumoon.kr 를 끊어버리지 않도록 명시.
"""
import paramiko
import time

PROD = "104.64.128.103"
TEST = "172.235.211.75"
USER = "root"
PASS = "saju26moon@!!"

# (host, path, comment_block)
TARGETS = [
    (PROD, "/usr/local/nginx/conf/vhost/sajuplan.com.conf", """# ============================================================
# 사주플랜 PROD (운영) — 실제 사용자 도메인
# 절대 끊지 말 것
# 자세한 내용: /CLAUDE.md (도메인 매핑 섹션)
# ============================================================
"""),
    (PROD, "/usr/local/nginx/conf/vhost/api.sajuplan.com.conf", """# ============================================================
# 사주플랜 PROD API (운영 API) — 사용자 백엔드
# 절대 끊지 말 것
# 자세한 내용: /CLAUDE.md (도메인 매핑 섹션)
# ============================================================
"""),
    (PROD, "/usr/local/nginx/conf/vhost/sajumoon.co.kr.conf", """# ============================================================
# 사주플랜 PROD (legacy 옛 브랜드 도메인) — sajuplan.com 과 같은 wwwroot 서빙
# 외부 링크/검색엔진에서 옛 도메인 진입 호환용. 끊지 말 것.
# 자세한 내용: /CLAUDE.md (도메인 매핑 섹션)
# ============================================================
"""),
    (PROD, "/usr/local/nginx/conf/vhost/api.sajumoon.co.kr.conf", """# ============================================================
# 사주플랜 PROD API (legacy 옛 API 도메인) — api.sajuplan.com 과 함께 작동
# 외부 시스템(m2net 등)이 옛 도메인 호출할 가능성. 끊지 말 것.
# 자세한 내용: /CLAUDE.md (도메인 매핑 섹션)
# ============================================================
"""),
    (TEST, "/usr/local/nginx/conf/vhost/sajumoon.kr.conf", """# ============================================================
# 사주플랜 TEST (테스트 환경) — 배포 전 검증용 도메인
# 절대 끊지 말 것. 끊으면 모든 개발/QA 사이클 막힘.
# 외부 의존성: m2net 가맹점 등록 URL이 이 도메인 가리킬 가능성.
# 자세한 내용: /CLAUDE.md (도메인 매핑 섹션)
# ============================================================
"""),
    (TEST, "/usr/local/nginx/conf/vhost/api.sajumoon.kr.conf", """# ============================================================
# 사주플랜 TEST API (테스트 백엔드) — sajumoon.kr 의 백엔드
# 절대 끊지 말 것.
# 자세한 내용: /CLAUDE.md (도메인 매핑 섹션)
# ============================================================
"""),
]

MARKER = "사주플랜"  # 이미 적용된 파일 감지


def fetch(host, path):
    """SFTP 로 파일 읽어옴."""
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
    """SFTP 로 파일 덮어쓰기."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=USER, password=PASS, timeout=15)
    sftp = ssh.open_sftp()
    with sftp.open(path, "w") as f:
        f.write(content)
    sftp.close()
    ssh.close()


def run(host, cmd):
    """원격 명령 실행."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=USER, password=PASS, timeout=15)
    _stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    ssh.close()
    return out, err


def annotate_one(host, path, comment):
    """vhost 파일 맨 위에 주석 블록 추가 + 검증."""
    print(f"\n=== {host} : {path} ===")
    try:
        content = fetch(host, path)
    except FileNotFoundError:
        print("  [skip] file not found")
        return False

    if MARKER in content.splitlines()[0:6][0:1][0] if content.splitlines()[:1] else False:
        # 첫 줄에 사주플랜 들어있으면 이미 적용
        pass
    # 더 간단히: 첫 6줄에 marker 있나
    head = "\n".join(content.splitlines()[:8])
    if MARKER in head:
        print("  [skip] already annotated")
        return True

    new_content = comment + content

    ts = int(time.time())
    backup = f"{path}.bak.{ts}"
    run(host, f"cp {path} {backup}")
    print(f"  [backup] {backup}")

    push(host, path, new_content)
    print("  [patched]")

    out, err = run(host, "/usr/local/nginx/sbin/nginx -t 2>&1")
    if "test is successful" not in (out + err):
        print("  [FAIL] nginx -t failed - rolling back:")
        print(out + err)
        run(host, f"cp {backup} {path}")
        return False
    print("  [OK] nginx -t passed")

    # reload 는 헤더 자체 추가가 아니므로 생략 가능하지만 일관성 위해 reload
    out, err = run(host, "/usr/local/nginx/sbin/nginx -s reload 2>&1")
    print(f"  [reload] {(out + err).strip() or 'OK'}")
    return True


if __name__ == "__main__":
    results = []
    for host, path, comment in TARGETS:
        ok = annotate_one(host, path, comment)
        results.append((host, path, ok))

    print("\n=== Summary ===")
    for host, path, ok in results:
        print(f"  {'OK' if ok else 'FAIL'}  {host} {path}")
