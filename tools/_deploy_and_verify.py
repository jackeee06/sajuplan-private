"""배포 + E2E 자동 검증 wrapper.

사용:
  python tools/_deploy_and_verify.py api                  # api 만 배포 + 검증
  python tools/_deploy_and_verify.py user                 # web/user 배포 + 검증
  python tools/_deploy_and_verify.py mng                  # web/mng 배포 + 검증
  python tools/_deploy_and_verify.py both                 # api + user + mng 모두

동작:
  1. 해당 영역 배포 (양 서버)
  2. Playwright E2E 11개 시나리오 prod 실행
  3. 통과: ✅ 성공 보고 / 실패: ❌ + 실패한 시나리오 출력

SSHPASS 필요.
"""
from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent


def run(cmd: list[str] | str, cwd: Path | None = None, env_extra: dict | None = None) -> int:
    print(f"\n▶ {' '.join(cmd) if isinstance(cmd, list) else cmd}", flush=True)
    env = os.environ.copy()
    if env_extra:
        env.update(env_extra)
    if isinstance(cmd, str):
        return subprocess.call(cmd, shell=True, cwd=cwd, env=env)
    return subprocess.call(cmd, cwd=cwd, env=env)


def deploy_api() -> int:
    for host, remote in [
        ("root@172.235.211.75", "/data/wwwroot/api.sajumoon.kr"),
        ("root@104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr"),
    ]:
        rc = run(["python", "tools/_patch_api.py", host, remote, "sajumoon-api"], cwd=ROOT)
        if rc != 0:
            return rc
    return 0


def deploy_frontend(kind: str) -> int:
    rc = run(["npm", "run", "build"], cwd=ROOT / "web" / kind)
    if rc != 0:
        return rc
    return run(["python", "tools/_patch_frontend.py", kind], cwd=ROOT)


def run_e2e() -> int:
    e2e_dir = ROOT / "e2e"
    if not (e2e_dir / "node_modules").is_dir():
        print("e2e/node_modules 없음 — npm install 먼저 실행 필요", file=sys.stderr)
        return 1
    return run(["npx", "playwright", "test"], cwd=e2e_dir, env_extra={"TARGET": "prod"})


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("api", "user", "mng", "both"):
        print("usage: _deploy_and_verify.py <api|user|mng|both>", file=sys.stderr)
        return 2
    kind = sys.argv[1]
    if not os.environ.get("SSHPASS"):
        print("SSHPASS 필요", file=sys.stderr)
        return 1

    # 1) 배포
    if kind in ("api", "both"):
        if (rc := deploy_api()) != 0:
            print(f"\n❌ api 배포 실패 rc={rc}", file=sys.stderr)
            return rc
    if kind in ("user", "both"):
        if (rc := deploy_frontend("user")) != 0:
            print(f"\n❌ user 배포 실패 rc={rc}", file=sys.stderr)
            return rc
    if kind in ("mng", "both"):
        if (rc := deploy_frontend("mng")) != 0:
            print(f"\n❌ mng 배포 실패 rc={rc}", file=sys.stderr)
            return rc

    # 2) E2E 검증
    print("\n" + "=" * 60)
    print("🤖 배포 완료 — E2E 자동 검증 시작 (prod)")
    print("=" * 60)
    rc = run_e2e()
    if rc != 0:
        print(f"\n❌ E2E 검증 실패 rc={rc}")
        print("   상세: e2e/playwright-report/index.html 열어보거나")
        print("        cd e2e && npx playwright show-report")
        return rc

    print("\n" + "=" * 60)
    print("✅ 배포 + E2E 검증 모두 성공")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
