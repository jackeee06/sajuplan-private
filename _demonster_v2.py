# -*- coding: utf-8 -*-
"""
디몬스터 미팅 이력 v2 — 요일(dow) 기반 연도 추정
- 각 행에 (월, 일, 요일) 이 모두 있으면, 해당 (월, 일, 요일) 조합과 일치하는 연도를 후보로 좁힘
- 위→아래 = 과거→최신 / 마지막 = 2026-05-29
- 후보 중 직전(아래) 행 연도와 같거나 ±1년 이내, 그리고 시간 흐름과 일관된 값을 선택
"""

import csv, re, json
from datetime import date
from collections import defaultdict

CSV_PATH = r"c:\claudeworkspace\sajumoon\_demonster_meetings.csv"
HTML_PATH = r"c:\claudeworkspace\sajumoon\_demonster_chart.html"

KO_DOW = {"월":0, "화":1, "수":2, "목":3, "금":4, "토":5, "일":6}
date_pat = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")

rows = []
with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
    for r in csv.reader(f):
        rows.append(r)

# 1) raw 데이터 추출
records = []  # (rowidx, month, day, dow_int or None, quote or None)
for i, r in enumerate(rows):
    if len(r) < 5: continue
    raw_date = (r[0] or "").strip()
    m = date_pat.match(raw_date)
    if not m: continue
    month = int(m.group(1)); day = int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31): continue
    raw_dow = (r[1] or "").strip()
    # 요일은 첫 글자만 본다 ("수 " "목요일" 등 변형 대응)
    dow = None
    for ch, idx in KO_DOW.items():
        if ch in raw_dow:
            dow = idx
            break
    raw_q = (r[4] or "").strip().replace(",", "")
    try: quote = int(float(raw_q)) if raw_q else None
    except ValueError: quote = None
    records.append((i, month, day, dow, quote))

print(f"총 미팅 레코드 수: {len(records)}")

# 2) 요일 기반 연도 후보 산정
def candidate_years(month, day, dow, ymin=2018, ymax=2026):
    cands = []
    for y in range(ymin, ymax+1):
        try:
            d = date(y, month, day)
        except ValueError:
            continue
        if dow is None or d.weekday() == dow:
            cands.append(y)
    return cands

# 3) 아래에서 위로 진행하며 연도 결정
# 시작: 마지막 행은 5/29 금 = 2026 (검증: date(2026,5,29).weekday() == 4 ?)
print(f"date(2026,5,29).weekday() = {date(2026,5,29).weekday()} (4=금)")

years = [None] * len(records)
# 마지막 행 anchor
last_i, last_m, last_d, last_dow, _ = records[-1]
last_cands = candidate_years(last_m, last_d, last_dow)
# 가장 최근(=2026 에 가까운) 후보 선택
last_year = max(last_cands) if last_cands else 2026
years[-1] = last_year
print(f"마지막 레코드: {last_m}/{last_d} dow={last_dow} → 후보={last_cands} → 선정={last_year}")

# 위로 진행
for idx in range(len(records) - 2, -1, -1):
    _, mo, d, dow, _ = records[idx]
    next_year = years[idx+1]
    cands = candidate_years(mo, d, dow)
    if not cands:
        # 요일 없거나 매칭 안 됨 → 직전 연도 따라감
        years[idx] = next_year
        continue
    # 시간역행 (위로 갈수록 과거): 후보는 next_year 이하여야 함
    # 동시에 너무 멀어지지 않아야 함 (보통 같은 해 또는 직전 해)
    valid = [y for y in cands if y <= next_year]
    if not valid:
        # 후보가 다 next_year보다 미래 — 이상함. 가장 가까운 거 사용
        years[idx] = min(cands, key=lambda y: abs(y - next_year))
        continue
    # next_year 와 가장 가까운 valid 선택
    years[idx] = max(valid)  # 같은 해 우선, 안 되면 직전 해

# 4) 집계
ym_count = defaultdict(int)
ym_amount = defaultdict(int)
ymw_count = defaultdict(int)
ymw_amount = defaultdict(int)

for (i, mo, d, dow, q), yr in zip(records, years):
    ym_count[(yr, mo)] += 1
    if q: ym_amount[(yr, mo)] += q
    # ISO 주차 (월 안의 주차로 단순화)
    w = (d - 1) // 7 + 1
    ymw_count[(yr, mo, w)] += 1
    if q: ymw_amount[(yr, mo, w)] += q

# 5) 출력
ymin = min(y for (y, _) in ym_count.keys())
ymax = max(y for (y, _) in ym_count.keys())
print(f"\n연도 범위: {ymin} ~ {ymax}\n")

print("=== 연도별 등장 월 (커버리지 점검) ===")
yr_months = defaultdict(set)
for (i, mo, d, dow, q), yr in zip(records, years):
    yr_months[yr].add(mo)
for yr in sorted(yr_months.keys()):
    months = sorted(yr_months[yr])
    missing = sorted(set(range(1,13)) - set(months))
    print(f"  {yr}: 등장 {months} / 누락 {missing if missing else '없음'}")

print(f"\n=== 연도별 총합 ===")
yr_count = defaultdict(int); yr_amt = defaultdict(int)
for (y, m), c in ym_count.items(): yr_count[y] += c
for (y, m), a in ym_amount.items(): yr_amt[y] += a
for y in range(ymin, ymax+1):
    print(f"  {y}: {yr_count[y]:>4}건 / {yr_amt[y]:>9,}만원")

print(f"\n=== 5월·6월 비교 (핵심) ===")
for mo in (5, 6):
    print(f"  ▶ {mo}월")
    for y in range(ymin, ymax+1):
        c = ym_count.get((y, mo), 0)
        a = ym_amount.get((y, mo), 0)
        if c or a:
            print(f"    {y}년 {mo}월: {c:>3}건 / {a:>7,}만원")
    print()

print("=== 5월·6월 주차별 ===")
for mo in (5, 6):
    print(f"  ▶ {mo}월 주차별")
    print(f"    {'년도':<6}{'1주':>12}{'2주':>12}{'3주':>12}{'4주':>12}{'5주':>12}")
    for y in range(ymin, ymax+1):
        if not any((y, mo, w) in ymw_count for w in range(1,6)): continue
        row = f"    {y:<6}"
        for w in range(1,6):
            c = ymw_count.get((y, mo, w), 0)
            a = ymw_amount.get((y, mo, w), 0)
            if c == 0:
                row += f"{'-':>12}"
            else:
                row += f"{c}건/{a:,}".rjust(12)
        print(row)
    print()

# 6) HTML 차트
years_list = list(range(ymin, ymax+1))
months = list(range(1, 13))
chart_data = {
    "years": years_list,
    "months": months,
    "count": {f"{y}-{m}": ym_count.get((y, m), 0) for y in years_list for m in months},
    "amount": {f"{y}-{m}": ym_amount.get((y, m), 0) for y in years_list for m in months},
    "may_weeks": {f"{y}-w{w}": ymw_amount.get((y, 5, w), 0) for y in years_list for w in range(1,6)},
    "jun_weeks": {f"{y}-w{w}": ymw_amount.get((y, 6, w), 0) for y in years_list for w in range(1,6)},
    "may_weeks_count": {f"{y}-w{w}": ymw_count.get((y, 5, w), 0) for y in years_list for w in range(1,6)},
    "jun_weeks_count": {f"{y}-w{w}": ymw_count.get((y, 6, w), 0) for y in years_list for w in range(1,6)},
}

html_template = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>디몬스터 미팅 이력 — 연도×월 분석</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Pretendard', -apple-system, sans-serif; padding: 24px; background: #fafafa; color: #1f2937; max-width: 1280px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 0 0 12px; color: #374151; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 20px; }
  canvas { max-height: 380px; }
  table { border-collapse: collapse; font-size: 13px; width: 100%; }
  th, td { padding: 6px 10px; text-align: right; border-bottom: 1px solid #f3f4f6; }
  th:first-child, td:first-child { text-align: left; font-weight: 600; }
  th { background: #f9fafb; font-weight: 600; }
  .hl { background: #fef3c7; font-weight: 600; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; }
  .alert b { color: #991b1b; }
</style>
</head>
<body>
<h1>디몬스터 미팅 이력 — 연도×월 분석</h1>
<div class="sub">시트: 디몬미팅이력(과거저장용) · 단위: 만원 · 연도 추정: 요일(dow) 기반 정밀 매칭 · 2026년 5월은 5/28까지 (월 마감 전)</div>

<div class="alert">
  <b>핵심 신호:</b> 2026년 5월(5/28 까지) 미팅 건수·금액이 평년 대비 급감했습니다. 아래 차트와 표 참조.
</div>

<div class="card">
  <h2>월별 견적 합계 (만원)</h2>
  <canvas id="amountChart"></canvas>
</div>

<div class="card">
  <h2>월별 미팅 건수</h2>
  <canvas id="countChart"></canvas>
</div>

<div class="grid2">
  <div class="card">
    <h2>5월 — 연도별 비교</h2>
    <canvas id="mayChart"></canvas>
  </div>
  <div class="card">
    <h2>6월 — 연도별 비교</h2>
    <canvas id="junChart"></canvas>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <h2>5월 주차별 금액 (만원)</h2>
    <canvas id="mayWeekChart"></canvas>
  </div>
  <div class="card">
    <h2>6월 주차별 금액 (만원)</h2>
    <canvas id="junWeekChart"></canvas>
  </div>
</div>

<div class="card">
  <h2>전체 매트릭스 — 견적 합계 (만원)</h2>
  <table id="amountTable"></table>
</div>

<div class="card">
  <h2>전체 매트릭스 — 건수</h2>
  <table id="countTable"></table>
</div>

<script>
const data = __DATA__;
const palette = ['#9b7af7','#f472b6','#34d399','#fbbf24','#60a5fa','#fb7185','#ef4444','#a78bfa','#22d3ee','#f59e0b'];

function mkLine(canvasId, key) {
  const datasets = data.years.map((y, i) => {
    const isLatest = (y === data.years[data.years.length-1]);
    return {
      label: y + '년',
      data: data.months.map(m => data[key][y + '-' + m] || 0),
      borderColor: isLatest ? '#ef4444' : palette[i % palette.length],
      backgroundColor: (isLatest ? '#ef4444' : palette[i % palette.length]) + '22',
      tension: 0.3,
      pointRadius: isLatest ? 5 : 3,
      borderWidth: isLatest ? 3 : 2,
    };
  });
  new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels: data.months.map(m => m + '월'), datasets },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } }
    }
  });
}

mkLine('amountChart', 'amount');
mkLine('countChart', 'count');

function mkBar(canvasId, mo) {
  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: data.years.map(y => y + '년'),
      datasets: [
        { label: '건수', data: data.years.map(y => data.count[y+'-'+mo]||0), yAxisID: 'y1', backgroundColor: '#9b7af7' },
        { label: '금액(만원)', data: data.years.map(y => data.amount[y+'-'+mo]||0), yAxisID: 'y2', backgroundColor: '#f472b6' },
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } },
      scales: {
        y1: { beginAtZero: true, position: 'left', title: { display: true, text: '건수' } },
        y2: { beginAtZero: true, position: 'right', title: { display: true, text: '금액(만원)' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}
mkBar('mayChart', 5);
mkBar('junChart', 6);

function mkWeekChart(canvasId, prefix) {
  const datasets = data.years.map((y, i) => {
    const isLatest = (y === data.years[data.years.length-1]);
    return {
      label: y + '년',
      data: [1,2,3,4,5].map(w => data[prefix][y+'-w'+w] || 0),
      backgroundColor: isLatest ? '#ef4444' : palette[i % palette.length],
    };
  });
  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: { labels: ['1주','2주','3주','4주','5주'], datasets },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } }
    }
  });
}
mkWeekChart('mayWeekChart', 'may_weeks');
mkWeekChart('junWeekChart', 'jun_weeks');

function fillTable(tableId, key) {
  const tbl = document.getElementById(tableId);
  let html = '<thead><tr><th>월</th>';
  data.years.forEach(y => html += '<th>' + y + '</th>');
  html += '</tr></thead><tbody>';
  data.months.forEach(m => {
    const hl = (m===5||m===6) ? ' class="hl"' : '';
    html += '<tr' + hl + '><td>' + m + '월</td>';
    data.years.forEach(y => {
      const v = data[key][y+'-'+m] || 0;
      html += '<td>' + (v? v.toLocaleString() : '-') + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody>';
  tbl.innerHTML = html;
}
fillTable('amountTable', 'amount');
fillTable('countTable', 'count');
</script>
</body>
</html>
"""
html = html_template.replace("__DATA__", json.dumps(chart_data, ensure_ascii=False))
with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
print(f"\nHTML 차트: {HTML_PATH}")
