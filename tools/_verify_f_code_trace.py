"""검증 F — 코드 경로 트레이스.

csrid / earning_balance / m2net_membid 등 분리/단일화 핵심 컬럼 사용처 점검.
- 사용 위치 카운트
- 각 컬럼이 read-only 인지 mutated 되는지
- 누락 가능한 경로 식별
"""
import os
import sys
import io

# stdout 강제 UTF-8 (Windows cp949 에러 회피)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def grep_count(pattern: str, path: str) -> tuple[int, list[str]]:
    """파일 패턴 매치 카운트 + 파일별 카운트."""
    try:
        # ripgrep 못 쓰니까 Python 기반 grep
        from pathlib import Path
        files = {}
        for f in Path(path).rglob("*.ts"):
            with open(f, "r", encoding="utf-8", errors="ignore") as fh:
                txt = fh.read()
            n = txt.count(pattern)
            if n > 0:
                files[str(f.relative_to(path))] = n
        return sum(files.values()), [(f, n) for f, n in sorted(files.items(), key=lambda x: -x[1])[:20]]
    except Exception as e:
        return 0, [(f"ERROR: {e}", 0)]


def main() -> int:
    api_path = "c:/claudeworkspace/sajumoon/api/src"

    targets = [
        ("csrid", "상담사 m2net ID"),
        ("earning_balance", "수익포인트 잔액"),
        ("paid_balance", "소비포인트 결제분"),
        ("free_balance", "소비포인트 무료분"),
        ("m2net_membid", "회원 m2net ID"),
        ("'earning'", "수익포인트 kind 분기"),
        ("rel_table = 'consultation'", "상담 적립 마커"),
        ("rel_table = 'settlement_monthly'", "정산 차감 마커"),
    ]

    for pat, label in targets:
        total, files = grep_count(pat, api_path)
        print(f"\n[{label}] '{pat}' — 총 {total} 회 ({len(files)} 파일)")
        for f, n in files:
            print(f"  {n:>3}  {f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
