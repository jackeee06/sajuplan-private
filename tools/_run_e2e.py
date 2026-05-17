"""배포 직후 Playwright E2E 자동 실행 wrapper.

사용:
  python tools/_run_e2e.py          # test 서버 (기본)
  python tools/_run_e2e.py prod     # 운영 서버
  python tools/_run_e2e.py both     # 양쪽

권장 사용:
  배포 (`_patch_api.py` / `_patch_frontend.py`) 직후 호출.
  실패 시 즉시 운영자 알림 (선택).

종료 코드:
  0  모두 통과
  1  하나 이상 실패
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


def run(target: str) -> int:
    e2e_dir = Path(__file__).resolve().parent.parent / "e2e"
    if not (e2e_dir / "package.json").is_file():
        print(f"[e2e] {e2e_dir} 에 package.json 없음. 셋업 필요.", file=sys.stderr)
        return 1

    env = os.environ.copy()
    env["TARGET"] = target
    print(f"\n{'=' * 60}\nE2E 실행 — TARGET={target}\n{'=' * 60}")
    # npx playwright test (chromium 만)
    cmd = ["npx", "playwright", "test", "--reporter=list"]
    proc = subprocess.run(cmd, cwd=str(e2e_dir), env=env, shell=True)
    return proc.returncode


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else "test"

    if target == "both":
        rc1 = run("test")
        rc2 = run("prod")
        if rc1 != 0 or rc2 != 0:
            print(f"\n❌ E2E 실패 — test={rc1}, prod={rc2}", file=sys.stderr)
            return 1
        print("\n✅ E2E 양쪽 모두 통과")
        return 0
    if target not in ("test", "prod"):
        print("usage: _run_e2e.py [test|prod|both]", file=sys.stderr)
        return 2
    rc = run(target)
    if rc != 0:
        print(f"\n❌ E2E 실패 — TARGET={target}", file=sys.stderr)
    else:
        print(f"\n✅ E2E 통과 — TARGET={target}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
