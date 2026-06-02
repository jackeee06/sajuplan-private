"""배포 직후 Playwright E2E 자동 실행 wrapper.

사용:
  python tools/_run_e2e.py                    # test 서버 (기본)
  python tools/_run_e2e.py prod               # 운영 서버
  python tools/_run_e2e.py both               # 양쪽
  python tools/_run_e2e.py test --grep 09     # 09 번 spec 만
  python tools/_run_e2e.py test --quick       # 핵심 spec (10/11/12) 만 빠르게
  python tools/_run_e2e.py test --retry-failed
                                              # 실패 spec 만 재실행 (직전 JSON 리포트 기반)

권장 사용:
  배포 (`_patch_api.py` / `_patch_frontend.py`) 직후 호출.
  실패 시 retry-failed 로 1회 자동 재시도.

종료 코드:
  0  모두 통과
  1  하나 이상 실패
  2  사용법 오류
"""
from __future__ import annotations
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:  # pylint: disable=broad-except
        # stdout 인코딩 재설정 실패는 무시 — 콘솔 환경 차이일 뿐
        pass


E2E_DIR = Path(__file__).resolve().parent.parent / "e2e"
JSON_REPORT = E2E_DIR / "last-run.json"

# --quick 모드에서 실행할 spec 파일들 (배포 직후 30초 안에 끝나는 핵심만)
QUICK_SPECS = [
    "10-user-coin-terminology",
    "11-user-public-pages-deep",
    "12-api-healthcheck",
]


def _build_cmd(grep: str | None, specs: list[str] | None) -> list[str]:
    """playwright CLI 인자 빌드. reporter 는 playwright.config.ts 가 결정."""
    cmd = ["npx", "playwright", "test"]
    if grep:
        cmd += ["--grep", grep]
    if specs:
        for s in specs:
            cmd.append(f"tests/{s}.spec.ts")
    return cmd


def run(target: str, grep: str | None = None, specs: list[str] | None = None) -> tuple[int, list[str]]:
    """spec 실행. (return_code, failed_spec_files) 반환."""
    if not (E2E_DIR / "package.json").is_file():
        print(f"[e2e] {E2E_DIR} 에 package.json 없음. 셋업 필요.", file=sys.stderr)
        return 1, []

    env = os.environ.copy()
    env["TARGET"] = target

    print(f"\n{'=' * 60}\nE2E 실행 — TARGET={target}"
          + (f" grep={grep}" if grep else "")
          + (f" specs={specs}" if specs else "")
          + f"\n{'=' * 60}")

    cmd = _build_cmd(grep, specs)
    proc = subprocess.run(cmd, cwd=str(E2E_DIR), env=env, shell=True, check=False)

    failed = _parse_failed_specs()
    return proc.returncode, failed


def _parse_failed_specs() -> list[str]:
    """직전 JSON 리포트에서 실패한 spec 파일 경로 추출."""
    if not JSON_REPORT.is_file():
        return []
    try:
        data = json.loads(JSON_REPORT.read_text(encoding="utf-8"))
    except Exception:
        return []

    failed: set[str] = set()

    def walk_suite(suite: dict) -> None:
        for s in suite.get("suites", []) or []:
            walk_suite(s)
        for spec in suite.get("specs", []) or []:
            for tst in spec.get("tests", []) or []:
                for run in tst.get("results", []) or []:
                    if run.get("status") in ("failed", "timedOut", "interrupted"):
                        f = spec.get("file") or suite.get("file")
                        if f:
                            failed.add(f.replace("\\", "/"))
                        break
    for root in data.get("suites", []) or []:
        walk_suite(root)
    return sorted(failed)


def _read_last_failed() -> list[str]:
    """직전 실행의 failed spec — '15-foo.spec.ts' 형식만 추출."""
    raws = _parse_failed_specs()
    out: list[str] = []
    for r in raws:
        base = Path(r).name.replace(".spec.ts", "")
        if base:
            out.append(base)
    return out


def main() -> int:
    """CLI 진입. 인자 파싱 후 run() 호출."""
    parser = argparse.ArgumentParser(
        description="Playwright E2E wrapper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("target", nargs="?", default="test", choices=["test", "prod", "both"])
    parser.add_argument("--grep", default=None, help="title 부분 일치 필터")
    parser.add_argument("--quick", action="store_true", help=f"핵심 spec 만: {', '.join(QUICK_SPECS)}")
    parser.add_argument("--retry-failed", action="store_true", help="직전 실행에서 실패한 spec 만 재실행")
    parser.add_argument("--spec", action="append", default=None, help="특정 spec 만 (예: --spec 09-dual-role-mode)")
    args = parser.parse_args()

    specs: list[str] | None = None
    if args.retry_failed:
        specs = _read_last_failed()
        if not specs:
            print("[e2e] 직전 실패 spec 없음 — 전체 실행하지 않고 종료", file=sys.stderr)
            return 0
        print(f"[e2e] 재실행 spec ({len(specs)}개): {specs}")
    elif args.spec:
        specs = args.spec
    elif args.quick:
        specs = QUICK_SPECS

    if args.target == "both":
        rc1, f1 = run("test", grep=args.grep, specs=specs)
        rc2, f2 = run("prod", grep=args.grep, specs=specs)
        if rc1 != 0 or rc2 != 0:
            print(f"\n❌ E2E 실패 — test={rc1}, prod={rc2}", file=sys.stderr)
            if f1: print(f"  test 실패 spec: {f1}", file=sys.stderr)
            if f2: print(f"  prod 실패 spec: {f2}", file=sys.stderr)
            print(f"\nℹ️  재실행: python tools/_run_e2e.py test --retry-failed")
            return 1
        print("\n✅ E2E 양쪽 모두 통과")
        return 0

    rc, failed = run(args.target, grep=args.grep, specs=specs)
    if rc != 0:
        print(f"\n❌ E2E 실패 — TARGET={args.target}", file=sys.stderr)
        if failed:
            print(f"  실패 spec ({len(failed)}개):", file=sys.stderr)
            for f in failed:
                print(f"    - {f}", file=sys.stderr)
            print(f"\nℹ️  재실행: python tools/_run_e2e.py {args.target} --retry-failed")
    else:
        print(f"\n✅ E2E 통과 — TARGET={args.target}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
