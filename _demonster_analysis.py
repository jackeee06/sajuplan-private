# -*- coding: utf-8 -*-
"""
디몬스터 미팅 이력 분석 — gid=534672580 (디몬미팅이력 과거저장용)

규칙:
- CSV 위→아래 = 과거→최신
- 마지막 데이터 행이 2026년 5월
- 날짜에 연도가 없으므로 월이 작아지는 지점(예: 12→1, 11→2 등) 또는 같은 월 반복 후 더 작아진 시점을 연도 경계로 추정
- 금액 단위: 만원
"""

import csv
import re
from collections import defaultdict, OrderedDict

CSV_PATH = r"c:\claudeworkspace\sajumoon\_demonster_meetings.csv"

# 1) CSV 로드
rows = []
with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
    reader = csv.reader(f)
    for r in reader:
        rows.append(r)

# 2) 날짜+금액 추출 (헤더/구분행 무시)
date_pat = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")

records = []  # (row_index, month, day, quote_int_or_None, contract_status, source)
for i, r in enumerate(rows):
    if len(r) < 5:
        continue
    raw_date = r[0].strip() if r[0] else ""
    m = date_pat.match(raw_date)
    if not m:
        continue
    month = int(m.group(1))
    day = int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        continue
    raw_q = (r[4] or "").strip().replace(",", "")
    try:
        quote = int(float(raw_q)) if raw_q else None
    except ValueError:
        quote = None
    contract = r[13].strip() if len(r) > 13 else ""
    source = r[3].strip() if len(r) > 3 else ""
    records.append((i, month, day, quote, contract, source))

print(f"총 미팅 레코드 수: {len(records)}")

# 3) 연도 추정
# 끝에서 거꾸로 — 마지막 레코드는 2026/05, 그 위로 가면서 월이 더 크면 같은 해, 같은 달 반복도 같은 해, 월이 작아지면 그대로 같은 해(연중 내려가는 정상흐름), 월이 갑자기 더 큰 값(예: 1→12)으로 점프하면 그 위는 전년도

# 사용자 진술: 위→아래가 과거→최신, 마지막=2026/05
# 즉 아래→위로 시간 거꾸로. 시간역행 시 월 변화는 보통 감소 또는 동일. 월이 *증가*하면 (예: 1월 보다 위가 12월) 그 위는 전년도.

records_sorted = records  # 이미 파일 순서
# 거꾸로 순회
years = [None] * len(records_sorted)
current_year = 2026
prev_month = None
for idx in range(len(records_sorted) - 1, -1, -1):
    m = records_sorted[idx][1]
    if prev_month is not None and m > prev_month:
        # 위로 갈수록 월이 커졌다 = 연도가 하나 줄어든 것
        current_year -= 1
    years[idx] = current_year
    prev_month = m

# 4) 연도-월 집계
ym_count = defaultdict(int)
ym_amount = defaultdict(int)
ym_contracts = defaultdict(int)

contract_signals = ("작업시작", "계약", "부산", "메타", "부천")  # "작업시작" 또는 계약 관련 단서
for (i, mo, d, q, contract, src), yr in zip(records_sorted, years):
    key = (yr, mo)
    ym_count[key] += 1
    if q:
        ym_amount[key] += q

# 5) 정렬 + 출력
all_keys = sorted(set(list(ym_count.keys()) + list(ym_amount.keys())))
year_min = min(k[0] for k in all_keys)
year_max = max(k[0] for k in all_keys)

print(f"\n연도 범위: {year_min} ~ {year_max}")
print(f"\n=== 연도×월 매트릭스 (건수 / 견적합계 만원) ===\n")

# 표 출력
print(f"{'월':<5}", end="")
for y in range(year_min, year_max + 1):
    print(f"{y:>22}", end="")
print()
print(f"{'':<5}", end="")
for y in range(year_min, year_max + 1):
    print(f"{'건수':>10}{'금액(만원)':>12}", end="")
print()
print("-" * (5 + 22 * (year_max - year_min + 1)))

for mo in range(1, 13):
    print(f"{mo:>2}월 ", end="")
    for y in range(year_min, year_max + 1):
        c = ym_count.get((y, mo), 0)
        a = ym_amount.get((y, mo), 0)
        if c == 0 and a == 0:
            print(f"{'-':>10}{'-':>12}", end="")
        else:
            print(f"{c:>10}{a:>12,}", end="")
    print()

# 6) 5월/6월만 별도 추출 (핵심 관심사)
print(f"\n=== 핵심: 매년 5월·6월 비교 ===\n")
for mo in (5, 6):
    print(f"  ▶ {mo}월")
    for y in range(year_min, year_max + 1):
        c = ym_count.get((y, mo), 0)
        a = ym_amount.get((y, mo), 0)
        if c or a:
            print(f"    {y}년 {mo}월: {c:>3}건 / {a:>7,}만원")
    print()

# 7) 연도별 총합
print("=== 연도별 총합 ===\n")
year_count = defaultdict(int)
year_amount = defaultdict(int)
for (y, m), c in ym_count.items():
    year_count[y] += c
for (y, m), a in ym_amount.items():
    year_amount[y] += a
for y in range(year_min, year_max + 1):
    print(f"  {y}: {year_count[y]:>4}건 / {year_amount[y]:>9,}만원")

# 8) 주별 (월의 어느 주) — 5/6월만
print(f"\n=== 5·6월 주별 분포 (참고) ===\n")
def week_of_month(day):
    return (day - 1) // 7 + 1

ymw_count = defaultdict(int)
ymw_amount = defaultdict(int)
for (i, mo, d, q, contract, src), yr in zip(records_sorted, years):
    if mo in (5, 6):
        w = week_of_month(d)
        ymw_count[(yr, mo, w)] += 1
        if q:
            ymw_amount[(yr, mo, w)] += q

for mo in (5, 6):
    print(f"  ▶ {mo}월 주차별")
    print(f"    {'년도':<7}{'1주':>10}{'2주':>10}{'3주':>10}{'4주':>10}{'5주':>10}")
    for y in range(year_min, year_max + 1):
        if not any((y, mo, w) in ymw_count for w in range(1,6)):
            continue
        row = f"    {y:<7}"
        for w in range(1, 6):
            c = ymw_count.get((y, mo, w), 0)
            a = ymw_amount.get((y, mo, w), 0)
            if c == 0:
                row += f"{'-':>10}"
            else:
                row += f"{c}건/{a:,}".rjust(10)
        print(row)
    print()

# 9) HTML 차트 출력
html_path = r"c:\claudeworkspace\sajumoon\_demonster_chart.html"
years_list = list(range(year_min, year_max + 1))
months = list(range(1, 13))

# 데이터 직렬화
import json
chart_data = {
    "years": years_list,
    "months": months,
    "count": {f"{y}-{m}": ym_count.get((y, m), 0) for y in years_list for m in months},
    "amount": {f"{y}-{m}": ym_amount.get((y, m), 0) for y in years_list for m in months},
}

html = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>디몬스터 미팅 이력 분석</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  body { font-family: 'Pretendard', -apple-system, sans-serif; padding: 24px; background: #fafafa; color: #1f2937; max-width: 1280px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 32px 0 12px; color: #374151; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .chart-wrap { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 24px; }
  canvas { max-height: 380px; }
  table { border-collapse: collapse; font-size: 13px; width: 100%; background: white; border-radius: 8px; overflow: hidden; }
  th, td { padding: 8px 12px; text-align: right; border-bottom: 1px solid #f3f4f6; }
  th:first-child, td:first-child { text-align: left; font-weight: 600; }
  th { background: #f9fafb; font-weight: 600; color: #374151; }
  .hl { background: #fef3c7; font-weight: 600; }
  .note { font-size: 12px; color: #9ca3af; margin-top: 8px; }
</style>
</head>
<body>
<h1>디몬스터 미팅 이력 — 연도×월 분석</h1>
<div class="sub">시트: 디몬미팅이력(과거저장용) · 단위: 만원 · 연도는 월 흐름으로 추정 (마지막=2026년 5월 기준)</div>

<div class="chart-wrap">
  <h2 style="margin-top:0">월별 견적 합계 (만원)</h2>
  <canvas id="amountChart"></canvas>
</div>

<div class="chart-wrap">
  <h2 style="margin-top:0">월별 미팅 건수</h2>
  <canvas id="countChart"></canvas>
</div>

<div class="chart-wrap">
  <h2 style="margin-top:0">5월·6월 연도별 비교 (핵심 관심사)</h2>
  <canvas id="mayJunChart"></canvas>
</div>

<div class="chart-wrap">
  <h2 style="margin-top:0">상세 표 — 견적 합계 (만원)</h2>
  <table id="dataTable"></table>
  <div class="note">노란 강조: 5월·6월</div>
</div>

<script>
const data = __DATA__;
const palette = ['#9b7af7','#f472b6','#34d399','#fbbf24','#60a5fa','#fb7185','#a78bfa','#22d3ee','#f59e0b','#10b981'];

function mkLine(canvasId, key, title) {
  const datasets = data.years.map((y, i) => ({
    label: y + '년',
    data: data.months.map(m => data[key][y + '-' + m] || 0),
    borderColor: palette[i % palette.length],
    backgroundColor: palette[i % palette.length] + '33',
    tension: 0.3,
    pointRadius: 3,
    borderWidth: 2,
  }));
  new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels: data.months.map(m => m + '월'), datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } }
    }
  });
}

mkLine('amountChart', 'amount', '금액');
mkLine('countChart', 'count', '건수');

// 5/6월 막대
new Chart(document.getElementById('mayJunChart'), {
  type: 'bar',
  data: {
    labels: data.years.map(y => y + '년'),
    datasets: [
      { label: '5월 금액(만원)', data: data.years.map(y => data.amount[y+'-5']||0), backgroundColor: '#9b7af7' },
      { label: '6월 금액(만원)', data: data.years.map(y => data.amount[y+'-6']||0), backgroundColor: '#f472b6' },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } }
  }
});

// 표
const tbl = document.getElementById('dataTable');
let html = '<thead><tr><th>월</th>';
data.years.forEach(y => html += '<th>' + y + '</th>');
html += '</tr></thead><tbody>';
data.months.forEach(m => {
  const hl = (m===5||m===6) ? ' class="hl"' : '';
  html += '<tr' + hl + '><td>' + m + '월</td>';
  data.years.forEach(y => {
    const v = data.amount[y+'-'+m] || 0;
    html += '<td>' + (v? v.toLocaleString() : '-') + '</td>';
  });
  html += '</tr>';
});
html += '</tbody>';
tbl.innerHTML = html;
</script>
</body>
</html>
"""
html = html.replace("__DATA__", json.dumps(chart_data, ensure_ascii=False))
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
print(f"\nHTML 차트 저장: {html_path}")
