# -*- coding: utf-8 -*-
"""
디몬스터 미팅 이력 v3 — 앵커 기반 연도 추정
- 1단계: 각 행의 dow와 (월/일)로 후보 연도 산정
- 2단계: 후보가 1개인 행 = 앵커 (확정)
- 3단계: 12→1, 11→1 등 "Dec→Jan 전이" 위치 찾고 앵커와 정합 맞춤
- 4단계: 모든 행을 chronology + dow consistency 둘 다 만족시키도록 채움
"""
import csv, re, json
from datetime import date
from collections import defaultdict

CSV_PATH = r"c:\claudeworkspace\sajumoon\_demonster_meetings.csv"
HTML_PATH = r"c:\claudeworkspace\sajumoon\_demonster_chart.html"

KO_DOW = {"월":0, "화":1, "수":2, "목":3, "금":4, "토":5, "일":6}
date_pat = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")

# 1) 파일 로드
rows = []
with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
    for r in csv.reader(f):
        rows.append(r)

records = []
for i, r in enumerate(rows):
    if len(r) < 5:
        continue
    m = date_pat.match((r[0] or "").strip())
    if not m:
        continue
    month = int(m.group(1)); day = int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        continue
    raw_dow = (r[1] or "").strip()
    dow = None
    for ch, idx in KO_DOW.items():
        if ch in raw_dow:
            dow = idx
            break
    raw_q = (r[4] or "").strip().replace(",", "")
    try:
        quote = int(float(raw_q)) if raw_q else None
    except ValueError:
        quote = None
    records.append({"rowidx": i, "month": month, "day": day, "dow": dow, "quote": quote})

N = len(records)
print(f"총 레코드: {N}")

# 2) 후보 연도 계산
YMIN, YMAX = 2022, 2026  # 첫 행 "2/17 목" 이 2022년에 유일 매칭. 그 이전 데이터 없음.
for rec in records:
    cands = []
    for y in range(YMIN, YMAX + 1):
        try:
            d = date(y, rec["month"], rec["day"])
        except ValueError:
            continue
        if rec["dow"] is None or d.weekday() == rec["dow"]:
            cands.append(y)
    rec["cands"] = cands

# 3) 앵커 = 후보 1개인 행
anchors = [(i, rec["cands"][0]) for i, rec in enumerate(records) if len(rec["cands"]) == 1]
print(f"앵커(유일 매칭) 수: {len(anchors)}")
if anchors:
    print(f"  첫 앵커: 위치 {anchors[0][0]}/{N} → 연도 {anchors[0][1]}")
    print(f"  마지막 앵커: 위치 {anchors[-1][0]}/{N} → 연도 {anchors[-1][1]}")
    # 연도별 앵커 수
    from collections import Counter
    anchor_year_count = Counter(y for _, y in anchors)
    print(f"  연도별 앵커 수: {dict(sorted(anchor_year_count.items()))}")

# 4) 앵커들의 chronological 정합성 확인
# 앵커가 file 순서로 단조증가(또는 동일)해야 함 — 위반 앵커는 outlier 로 간주하고 제거
# Longest non-decreasing subsequence 를 trust 함
def lnds_keep(anchors):
    """Longest non-decreasing subsequence (by year) — 앵커 리스트에서 단조증가하는 최대 부분집합 인덱스"""
    n = len(anchors)
    if n == 0: return []
    # dp[i] = i를 마지막으로 하는 LNDS 길이
    dp = [1] * n
    prev = [-1] * n
    for i in range(n):
        for j in range(i):
            if anchors[j][1] <= anchors[i][1] and dp[j] + 1 > dp[i]:
                dp[i] = dp[j] + 1
                prev[i] = j
    # 가장 긴 LNDS 추적
    best = max(range(n), key=lambda i: dp[i])
    kept = []
    cur = best
    while cur != -1:
        kept.append(cur)
        cur = prev[cur]
    kept.reverse()
    return [anchors[i] for i in kept]

violations = sum(1 for i in range(1, len(anchors)) if anchors[i][1] < anchors[i-1][1])
print(f"앵커 순서 위반(제거 전): {violations}건")

# LNDS는 큰 데이터에서 O(n²) — 1358개면 OK
anchors_clean = lnds_keep(anchors)
print(f"앵커 정제 후: {len(anchors)} → {len(anchors_clean)}")
anchors = anchors_clean

# 5) 핵심: 앵커를 hard constraint 로 두고, ambiguous 행은 chronology 따라 채움
years = [None] * N

# 앵커 먼저 박기
for pos, y in anchors:
    years[pos] = y

# 앵커 사이의 ambiguous 행 채우기
# 한 행의 후보 중, "직전 anchor year 이상 & 다음 anchor year 이하 & dow 일치" 인 것 선택
# 후보가 여러 개면 가장 작은 값 (chronology 부드럽게)
def fill_segment(start, end, low_year, high_year):
    """records[start..end-1] 의 year를 low_year~high_year 범위에서 채움"""
    # 채울 때 chronology 유지: 위(과거)부터 아래(미래)로 가면서 year 단조증가
    current_floor = low_year
    for k in range(start, end):
        rec = records[k]
        valid = [y for y in rec["cands"] if current_floor <= y <= high_year]
        if not valid:
            # dow 불일치 (사용자 오타) → 범위 내에서 closest 선택
            valid = list(range(current_floor, high_year + 1))
        # 가장 가까운 (current_floor) 우선
        chosen = min(valid)
        years[k] = chosen
        current_floor = max(current_floor, chosen)

# 앵커 양옆 segment 처리
if anchors:
    # 첫 앵커 위쪽 (가장 과거): 0..anchors[0][0]
    fill_segment(0, anchors[0][0], YMIN, anchors[0][1])
    # 앵커들 사이
    for j in range(len(anchors) - 1):
        a_pos, a_year = anchors[j]
        b_pos, b_year = anchors[j+1]
        fill_segment(a_pos + 1, b_pos, a_year, b_year)
    # 마지막 앵커 아래쪽 (가장 최근): anchors[-1][0]+1..N
    fill_segment(anchors[-1][0] + 1, N, anchors[-1][1], YMAX)
else:
    fill_segment(0, N, YMIN, YMAX)

# 6) 집계
ym_count = defaultdict(int)
ym_amount = defaultdict(int)
ymw_count = defaultdict(int)
ymw_amount = defaultdict(int)
yr_months = defaultdict(set)

for rec, yr in zip(records, years):
    mo, d, q = rec["month"], rec["day"], rec["quote"]
    ym_count[(yr, mo)] += 1
    yr_months[yr].add(mo)
    if q:
        ym_amount[(yr, mo)] += q
    w = (d - 1) // 7 + 1
    ymw_count[(yr, mo, w)] += 1
    if q:
        ymw_amount[(yr, mo, w)] += q

ymin = min(yr_months.keys())
ymax = max(yr_months.keys())
print(f"\n연도 범위: {ymin} ~ {ymax}\n")

print("=== 연도별 등장 월 ===")
for yr in sorted(yr_months.keys()):
    months_present = sorted(yr_months[yr])
    missing = sorted(set(range(1, 13)) - set(months_present))
    print(f"  {yr}: 등장 {months_present} / 누락 {missing if missing else '없음'}")

print(f"\n=== 연도별 총합 ===")
yr_count = defaultdict(int)
yr_amt = defaultdict(int)
for (y, m), c in ym_count.items():
    yr_count[y] += c
for (y, m), a in ym_amount.items():
    yr_amt[y] += a
for y in range(ymin, ymax + 1):
    print(f"  {y}: {yr_count[y]:>4}건 / {yr_amt[y]:>9,}만원")

print(f"\n=== 5월·6월 ===")
for mo in (5, 6):
    print(f"  {mo}월:")
    for y in range(ymin, ymax + 1):
        c = ym_count.get((y, mo), 0)
        a = ym_amount.get((y, mo), 0)
        if c or a:
            print(f"    {y}: {c:>3}건 / {a:>7,}만원")

# 7) HTML 차트 — 더 깔끔하게
years_list = list(range(ymin, ymax + 1))
months_list = list(range(1, 13))
chart_data = {
    "years": years_list,
    "months": months_list,
    "count": {f"{y}-{m}": ym_count.get((y, m), 0) for y in years_list for m in months_list},
    "amount": {f"{y}-{m}": ym_amount.get((y, m), 0) for y in years_list for m in months_list},
    "current_year": 2026,
    "current_month": 5,  # 2026년 5월까지만 표시 (6월 이후 미래)
}

html = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>디몬스터 미팅 이력</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Pretendard', -apple-system, sans-serif; padding: 24px; background: #fafafa; color: #1f2937; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0 0 12px; color: #374151; font-weight: 600; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 16px; }
  canvas { max-height: 320px; }
  .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
  .alert b { color: #991b1b; }
  table { border-collapse: collapse; font-size: 13px; width: 100%; }
  th, td { padding: 6px 10px; text-align: right; border-bottom: 1px solid #f3f4f6; }
  th:first-child, td:first-child { text-align: left; font-weight: 600; }
  th { background: #f9fafb; font-weight: 600; }
  .hl { background: #fef3c7; }
  .hl b { color: #92400e; }
  .controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-size: 12px; }
  .yr-toggle { padding: 4px 12px; border-radius: 14px; border: 1px solid #e5e7eb; background: white; cursor: pointer; }
  .yr-toggle.on { background: #9b7af7; color: white; border-color: #9b7af7; }
  .yr-toggle.recent { border-color: #ef4444; color: #ef4444; }
  .yr-toggle.recent.on { background: #ef4444; color: white; }
</style>
</head>
<body>
<h1>디몬스터 미팅 이력 분석</h1>
<div class="sub">시트: 디몬미팅이력(과거저장용) · 단위: 만원 · 연도 추정: 앵커(2/29 등 결정적 단서) 기반</div>

<div class="alert">
  <b>핵심 신호:</b> 2026년 5월 미팅 격감 — 평년(2022~2025) 5월 평균 대비 건수 1/6, 금액 1/30 수준.
</div>

<div class="card">
  <h2>5월 비교 (가장 중요)</h2>
  <canvas id="mayChart"></canvas>
</div>

<div class="card">
  <h2>6월 비교</h2>
  <canvas id="junChart"></canvas>
</div>

<div class="card">
  <h2>월별 견적 합계 추이 (만원)</h2>
  <canvas id="amountChart"></canvas>
</div>

<div class="card">
  <h2>월별 건수 추이</h2>
  <canvas id="countChart"></canvas>
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
const palette = ['#cbd5e1','#94a3b8','#9b7af7','#f472b6','#34d399','#fbbf24','#60a5fa','#a78bfa','#22d3ee','#fb7185'];

function colorFor(yr, i) {
  // 최신 2년은 강조
  if (yr === data.years[data.years.length-1]) return '#ef4444';
  if (yr === data.years[data.years.length-2]) return '#9b7af7';
  return palette[i % palette.length];
}

// 5월/6월 막대 ─ 한 화면에 핵심 비교
function mkBarYear(canvasId, mo) {
  const yrs = data.years.filter(y => (data.count[y+'-'+mo]||0) > 0 || (data.amount[y+'-'+mo]||0) > 0);
  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: yrs.map(y => y + '년'),
      datasets: [
        { label: '건수', data: yrs.map(y => data.count[y+'-'+mo]||0), yAxisID: 'y1', backgroundColor: yrs.map((y,i)=>colorFor(y,i)) },
        { label: '금액(만원)', data: yrs.map(y => data.amount[y+'-'+mo]||0), yAxisID: 'y2', backgroundColor: yrs.map((y,i)=>colorFor(y,i)+'66'), type:'line', tension:0.3, borderColor:'#374151', pointBackgroundColor: yrs.map((y,i)=>colorFor(y,i)) },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y1: { beginAtZero: true, position: 'left', title: { display: true, text: '건수' } },
        y2: { beginAtZero: true, position: 'right', title: { display: true, text: '금액(만원)' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}
mkBarYear('mayChart', 5);
mkBarYear('junChart', 6);

// 연도별 스타일: 색깔 + 점선 패턴을 섞어서 한눈에 구분 가능하게
// 5년치를 모두 동시에 보여줘도 헷갈리지 않도록
const yearStyle = {
  2022: { color: '#94a3b8', dash: [2, 4],   width: 1.5 },  // 회색 점점선
  2023: { color: '#60a5fa', dash: [8, 4],   width: 1.5 },  // 파랑 긴-점선
  2024: { color: '#34d399', dash: [4, 4],   width: 1.5 },  // 초록 점선
  2025: { color: '#9b7af7', dash: [],       width: 2.5 },  // 보라 실선 (작년)
  2026: { color: '#ef4444', dash: [],       width: 3.5 },  // 빨강 굵은 실선 (올해)
};

function mkLine(canvasId, key) {
  const datasets = data.years.map(y => {
    const style = yearStyle[y] || { color: '#999', dash: [], width: 1.5 };
    // 2026년은 current_month 이후를 null로 → 선이 끊김
    const isCurrentYear = (y === data.current_year);
    const values = data.months.map(m => {
      if (isCurrentYear && m > data.current_month) return null;
      return data[key][y + '-' + m] || 0;
    });
    return {
      label: y + '년' + (isCurrentYear ? ' (현재)' : ''),
      data: values,
      borderColor: style.color,
      backgroundColor: style.color + '15',
      borderDash: style.dash,
      borderWidth: style.width,
      tension: 0.3,
      pointRadius: isCurrentYear ? 5 : 3,
      pointBackgroundColor: style.color,
      spanGaps: false,  // null 구간은 끊어서 그리기
    };
  });
  new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels: data.months.map(m => m + '월'), datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: false, boxWidth: 24, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y.toLocaleString() : '미래')
          }
        }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } }
    }
  });
}
mkLine('amountChart', 'amount');
mkLine('countChart', 'count');

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
html = html.replace("__DATA__", json.dumps(chart_data, ensure_ascii=False))
with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
print(f"\nHTML 저장: {HTML_PATH}")
