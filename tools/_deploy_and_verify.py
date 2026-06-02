"""배포 + E2E 자동 검증 wrapper.

사용:
  python tools/_deploy_and_verify.py api                  # api 만 배포 + 검증
  python tools/_deploy_and_verify.py user                 # web/user 배포 + 검증
  python tools/_deploy_and_verify.py mng                  # web/mng 배포 + 검증
  python tools/_deploy_and_verify.py both                 # api + user + mng 모두

플래그:
  --quick       핵심 spec(10/11/12) 만 빠르게 (배포 직후 30초)
  --target=X    test|prod|both (기본: prod)
  --no-e2e      E2E 검증 skip (배포만)
  --retry       1차 실패 시 retry-failed 자동 재실행

동작:
  1. 해당 영역 배포 (양 서버)
  2. Playwright E2E 자동 실행 (기본 prod, --target 으로 변경 가능)
  3. 통과: ✅ 성공 / 실패: ❌ + 실패 spec 출력 + (--retry 면) retry-failed 자동

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
        ("root@104.64.128.103", "/data/wwwroot/api.sajuplan.com"),
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


def run_e2e(target: str, quick: bool, retry_on_fail: bool) -> int:
    """배포 후 E2E. _run_e2e.py 를 호출 — quick/retry-failed 옵션 활용."""
    e2e_dir = ROOT / "e2e"
    if not (e2e_dir / "node_modules").is_dir():
        print("e2e/node_modules 없음 — npm install 먼저 실행 필요", file=sys.stderr)
        return 1

    cmd = ["python", "tools/_run_e2e.py", target]
    if quick:
        cmd.append("--quick")

    rc = run(cmd, cwd=ROOT)
    if rc == 0 or not retry_on_fail:
        return rc

    print(f"\n⚠️  1차 실행 실패 — retry-failed 1회 재시도")
    rc2 = run(["python", "tools/_run_e2e.py", target, "--retry-failed"], cwd=ROOT)
    return rc2


def _parse_args(argv: list[str]) -> dict:
    """argparse 없이 가벼운 파싱 — 기존 호환 유지."""
    opts = {
        "kind": None,
        "quick": False,
        "target": "prod",
        "no_e2e": False,
        "retry": False,
    }
    for a in argv:
        if a in ("api", "user", "mng", "both"):
            opts["kind"] = a
        elif a == "--quick":
            opts["quick"] = True
        elif a == "--no-e2e":
            opts["no_e2e"] = True
        elif a == "--retry":
            opts["retry"] = True
        elif a.startswith("--target="):
            t = a.split("=", 1)[1]
            if t not in ("test", "prod", "both"):
                print(f"--target 값 오류: {t} (test|prod|both)", file=sys.stderr)
                return {}
            opts["target"] = t
        else:
            print(f"알 수 없는 인자: {a}", file=sys.stderr)
            return {}
    return opts


def main() -> int:
    opts = _parse_args(sys.argv[1:])
    if not opts or not opts.get("kind"):
        print("usage: _deploy_and_verify.py <api|user|mng|both> [--quick] [--target=test|prod|both] [--no-e2e] [--retry]",
              file=sys.stderr)
        return 2
    kind = opts["kind"]
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

    if opts["no_e2e"]:
        print("\n✅ 배포 성공 (--no-e2e 로 E2E 검증 skip)")
        return 0

    # 2) E2E 검증
    print("\n" + "=" * 60)
    mode_desc = "핵심 spec only" if opts["quick"] else "전체 spec"
    print(f"🤖 배포 완료 — E2E 자동 검증 시작 (target={opts['target']}, {mode_desc})")
    print("=" * 60)
    rc = run_e2e(opts["target"], opts["quick"], opts["retry"])
    if rc != 0:
        print(f"\n❌ E2E 검증 실패 rc={rc}")
        print("   상세: e2e/playwright-report/index.html 열어보거나")
        print("        cd e2e && npx playwright show-report")
        print(f"   재실행: python tools/_run_e2e.py {opts['target']} --retry-failed")
        return rc

    print("\n" + "=" * 60)
    print("✅ 배포 + E2E 검증 모두 성공")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
