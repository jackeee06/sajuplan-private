# -*- coding: utf-8 -*-
import csv, re
from collections import defaultdict

CSV_PATH = r"c:\claudeworkspace\sajumoon\_demonster_meetings.csv"
date_pat = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")

rows = []
with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
    for r in csv.reader(f):
        rows.append(r)

records = []
for i, r in enumerate(rows):
    if len(r) < 5: continue
    raw = (r[0] or "").strip()
    m = date_pat.match(raw)
    if not m: continue
    month = int(m.group(1)); day = int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31): continue
    raw_q = (r[4] or "").strip().replace(",", "")
    try: quote = int(float(raw_q)) if raw_q else None
    except ValueError: quote = None
    records.append((i, month, day, quote))

# 연도 추정 (현재 알고리즘)
years = [None] * len(records)
current_year = 2026
prev_month = None
for idx in range(len(records)-1, -1, -1):
    m = records[idx][1]
    if prev_month is not None and m > prev_month:
        current_year -= 1
    years[idx] = current_year
    prev_month = m

# 연도 경계 (year 가 바뀌는 지점) 의 ±5 행 출력
boundaries = []
for idx in range(1, len(records)):
    if years[idx] != years[idx-1]:
        boundaries.append(idx)

print("=== 연도 경계 지점 ===\n")
for b in boundaries:
    print(f"경계: 행 {records[b-1][0]} → {records[b][0]}")
    print(f"  {years[b-1]} → {years[b]}")
    for k in range(max(0,b-3), min(len(records), b+4)):
        marker = "  >>> " if k == b else "      "
        i, mo, d, q = records[k]
        print(f"{marker}rowidx={i} {mo}/{d} 견적={q} year={years[k]}")
    print()

# 각 연도별 월별 건수
print("\n=== 연도별 등장한 월 ===\n")
yr_months = defaultdict(set)
for (i, mo, d, q), yr in zip(records, years):
    yr_months[yr].add(mo)
for yr in sorted(yr_months.keys()):
    months = sorted(yr_months[yr])
    print(f"  {yr}: {months}")
