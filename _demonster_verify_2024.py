# -*- coding: utf-8 -*-
"""
2024년 데이터가 시트에 정말 있는지 직접 검증
- 각 (month, day, dow) 조합이 *오직* 2024년만 맞는 행들을 찾는다
- 그러면 그 행이 2024년임이 명백
"""
import csv, re
from datetime import date

CSV_PATH = r"c:\claudeworkspace\sajumoon\_demonster_meetings.csv"
KO_DOW = {"월":0, "화":1, "수":2, "목":3, "금":4, "토":5, "일":6}
date_pat = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")

rows = []
with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
    for r in csv.reader(f):
        rows.append(r)

# 각 행이 어느 연도들과 일치하는지 후보 산정
matches_2024_only = []
matches_2024_at_all = []

for i, r in enumerate(rows):
    if len(r) < 5: continue
    m = date_pat.match((r[0] or "").strip())
    if not m: continue
    month = int(m.group(1)); day = int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31): continue
    raw_dow = (r[1] or "").strip()
    dow = None
    for ch, idx in KO_DOW.items():
        if ch in raw_dow:
            dow = idx; break
    if dow is None: continue

    cands = []
    for y in range(2018, 2027):
        try:
            d = date(y, month, day)
            if d.weekday() == dow:
                cands.append(y)
        except ValueError:
            continue

    if 2024 in cands:
        matches_2024_at_all.append((i, month, day, dow, cands, r))
    if cands == [2024]:
        matches_2024_only.append((i, month, day, dow, r))

print(f"=== (월/일/요일)이 2024년에 *유일하게* 매칭되는 행 수: {len(matches_2024_only)}건 ===")
print(f"=== (월/일/요일)이 2024년에 매칭될 수 있는 모든 행 수: {len(matches_2024_at_all)}건 ===\n")

print("샘플 (2024년 유일 매칭, 다른 연도일 수 없음):")
for i, mo, d, dow, r in matches_2024_only[:15]:
    dow_ko = "월화수목금토일"[dow]
    proj = (r[8] or "")[:40] if len(r) > 8 else ""
    print(f"  rowidx={i:>4} {mo:>2}/{d:<2} ({dow_ko}) 견적={r[4]:<6} {proj}")

print(f"\n파일 행 분포:")
if matches_2024_only:
    rowidxs = [x[0] for x in matches_2024_only]
    print(f"  최저 rowidx: {min(rowidxs)} / 최고: {max(rowidxs)}")
    # 월별 분포
    from collections import Counter
    mo_dist = Counter(x[1] for x in matches_2024_only)
    print(f"  월별 분포 (2024 유일):")
    for mo in sorted(mo_dist.keys()):
        print(f"    {mo}월: {mo_dist[mo]}건")

print(f"\n파일 행 분포 (2024 가능 — 다른 연도와 공존):")
if matches_2024_at_all:
    rowidxs = [x[0] for x in matches_2024_at_all]
    print(f"  최저 rowidx: {min(rowidxs)} / 최고: {max(rowidxs)}")
    from collections import Counter
    mo_dist = Counter(x[1] for x in matches_2024_at_all)
    print(f"  월별 분포 (2024 가능):")
    for mo in sorted(mo_dist.keys()):
        print(f"    {mo}월: {mo_dist[mo]}건")
