import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import FloatingActions from '../components/FloatingActions'
import Pagination from '../components/Pagination'
import { ApiError, consultApi, type ConsultMyStats, type ConsultStatsItem } from '../lib/api'

/**
 * 상담사 "나의 상담 통계" — 기간별 집계 + 상세 리스트.
 *
 *  /mypage/my-consult-stats
 *
 *  경쟁사(사주나루) 의 "나의 상담 관리" 와 같은 목적이지만 사주플랜 톤으로 재구성:
 *   - 기간 프리셋 칩 (오늘 / 7일 / 30일 / 이번달 / 직접입력)
 *   - 합계 카드 3분할 (상담건 / 부재건 / 상담시간)
 *   - 파생지표 한 줄 (평균 통화 · 일평균 · 부재율)  ← 차별화
 *   - 타입 토글 (전체 / 전화 / 채팅)
 *   - 상세 리스트 + 페이지네이션
 *   - 최대 6개월(186일) 조회 제한
 */

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom'
type Tab = 'all' | 'call' | 'chat'

const PAGE_SIZE = 20

function toYMD(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date()
  const to = toYMD(today)
  if (p === 'today') return { from: to, to }
  if (p === '7d') {
    const f = new Date(today); f.setDate(f.getDate() - 6)
    return { from: toYMD(f), to }
  }
  if (p === '30d') {
    const f = new Date(today); f.setDate(f.getDate() - 29)
    return { from: toYMD(f), to }
  }
  // month — 이번달 1일 ~ 오늘
  const f = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toYMD(f), to }
}

function formatHMS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}시간 ${m}분`
  if (m > 0) return `${m}분 ${sec}초`
  return `${sec}초`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd} ${hh}:${mi}`
}

export default function CounselorMyConsultStats() {
  const navigate = useNavigate()

  // 기본은 "이번달" — 매일 들어와도 합리적인 디폴트.
  const [preset, setPreset] = useState<Preset>('month')
  const initial = presetRange('month')
  const [from, setFrom] = useState<string>(initial.from)
  const [to, setTo] = useState<string>(initial.to)

  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<ConsultMyStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 프리셋 클릭 — 기간 자동 채움 + 페이지 리셋.
  const applyPreset = useCallback((p: Preset) => {
    setPreset(p)
    setPage(1)
    if (p !== 'custom') {
      const r = presetRange(p)
      setFrom(r.from); setTo(r.to)
    }
  }, [])

  // fetch — preset/from/to/tab/page 변경 시.
  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    consultApi
      .myStats({ from, to, type: tab, page, limit: PAGE_SIZE })
      .then((res) => { if (alive) setData(res) })
      .catch((e: unknown) => {
        if (!alive) return
        const msg = e instanceof ApiError ? e.message : '통계를 불러오지 못했습니다.'
        setErr(msg); setData(null)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [from, to, tab, page])

  // 타입 토글 — 페이지 리셋.
  const switchTab = (t: Tab) => { setTab(t); setPage(1) }

  // 직접입력 모드 from/to 변경 — 페이지 리셋만 (변경은 검색 버튼으로).
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)
  useEffect(() => { if (preset !== 'custom') { setCustomFrom(from); setCustomTo(to) } }, [from, to, preset])
  const onSearchCustom = () => {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) { setErr('시작일이 종료일보다 늦을 수 없습니다.'); return }
    setFrom(customFrom); setTo(customTo); setPage(1)
  }

  // 페이지네이션 — has_more 기준 한 페이지 더 있다고 가정.
  const totalPages = useMemo(() => {
    if (!data) return 1
    // 정확한 total 이 없으니 현재 페이지 기준 + 다음 페이지 있으면 +1.
    return data.has_more ? page + 1 : page
  }, [data, page])

  const totalConsults = (data?.total_count ?? 0) + (data?.missed_count ?? 0)

  return (
    <div className="mobile-frame flex flex-col pb-[80px] relative bg-white min-h-screen">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[20px] font-semibold leading-[120%] text-[#030712]">
          나의 상담 통계
        </h1>
      </header>

      <main className="flex-1 px-4 pt-3 flex flex-col gap-4">
        {/* 기간 프리셋 칩 */}
        <section>
          <div className="flex flex-wrap gap-2">
            {([
              ['today', '오늘'],
              ['7d', '최근 7일'],
              ['30d', '최근 30일'],
              ['month', '이번달'],
              ['custom', '직접입력'],
            ] as Array<[Preset, string]>).map(([key, label]) => {
              const active = preset === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={
                    'px-3.5 h-[38px] rounded-pill text-[15px] leading-none border transition ' +
                    (active
                      ? 'bg-[#f3f0ff] border-[#8259F5] text-[#8259F5] font-medium'
                      : 'bg-[#F9FAFB] border-[#F3F4F6] text-[#6A7282]')
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* 직접입력 모드 — 날짜 picker 2개 + 검색 */}
          {preset === 'custom' && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 h-[44px] px-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[14px] text-[#252B36] focus:outline-none focus:border-[#8259F5]"
              />
              <span className="text-[#9CA3AF]">~</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 h-[44px] px-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[14px] text-[#252B36] focus:outline-none focus:border-[#8259F5]"
              />
              <button
                type="button"
                onClick={onSearchCustom}
                className="h-[44px] px-4 rounded-[12px] bg-[#8259F5] text-white text-[14px] font-medium"
              >
                검색
              </button>
            </div>
          )}

          {/* 적용 기간 표시 */}
          <p className="mt-2.5 text-[14px] text-[#6A7282]">
            기간 <span className="text-[#252B36] font-medium">{from} ~ {to}</span>
            <span className="ml-1 text-[#9CA3AF]">({data?.days ?? '-'}일)</span>
          </p>
        </section>

        {/* 합계 카드 3분할 — 한 줄 (라벨 좌, 숫자 우) */}
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-[16px] bg-[#F8F5FF] border border-[#EDE4FF] px-3 py-3.5 flex items-center justify-between gap-1">
            <span className="text-[14px] text-[#6A7282] shrink-0">상담</span>
            <span className="text-[22px] font-semibold text-[#8259F5] leading-none whitespace-nowrap">
              {(data?.total_count ?? 0).toLocaleString()}
              <span className="text-[14px] font-normal text-[#6A7282] ml-0.5">건</span>
            </span>
          </div>
          <div className="rounded-[16px] bg-[#FFF5F5] border border-[#FFE2E2] px-3 py-3.5 flex items-center justify-between gap-1">
            <span className="text-[14px] text-[#6A7282] shrink-0">부재</span>
            <span className="text-[22px] font-semibold text-[#FF6467] leading-none whitespace-nowrap">
              {(data?.missed_count ?? 0).toLocaleString()}
              <span className="text-[14px] font-normal text-[#6A7282] ml-0.5">건</span>
            </span>
          </div>
          <div className="rounded-[16px] bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-3.5 flex items-center justify-between gap-1">
            <span className="text-[14px] text-[#6A7282] shrink-0">시간</span>
            <span className="text-[18px] font-semibold text-[#252B36] leading-none whitespace-nowrap">
              {formatHMS(data?.total_seconds ?? 0)}
            </span>
          </div>
        </section>

        {/* 파생지표 한 줄 — 경쟁사와 차별화하는 핵심 */}
        <section className="rounded-[12px] bg-[#FAFAFA] border border-[#F3F4F6] px-3.5 py-3 flex items-center justify-between text-[14px] text-[#6A7282]">
          <span>평균 통화 <span className="text-[#252B36] font-medium">{formatHMS(data?.avg_seconds ?? 0)}</span></span>
          <span className="text-[#E5E7EB]">·</span>
          <span>일평균 <span className="text-[#252B36] font-medium">{(data?.daily_avg ?? 0).toLocaleString()}</span>건</span>
          <span className="text-[#E5E7EB]">·</span>
          <span>부재율 <span className="text-[#252B36] font-medium">{data?.missed_rate_pct ?? 0}%</span></span>
        </section>

        {/* 타입 토글 — 전체 / 전화 / 채팅 */}
        <section>
          <div className="flex bg-[#F9FAFB] rounded-pill p-1 border border-[#F3F4F6]">
            {([
              ['all', '전체'],
              ['call', '전화'],
              ['chat', '채팅'],
            ] as Array<[Tab, string]>).map(([key, label]) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTab(key)}
                  className={
                    'flex-1 h-[40px] rounded-pill text-[15px] leading-none transition ' +
                    (active
                      ? 'bg-[#8259F5] text-white font-medium'
                      : 'text-[#6A7282]')
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* 리스트 영역 */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between px-1 py-2.5">
            <span className="text-[15px] text-[#6A7282]">
              총 <span className="text-[#8259F5] font-medium">{totalConsults.toLocaleString()}</span>건
            </span>
            <span className="text-[14px] text-[#9CA3AF]">최신순</span>
          </div>

          {loading && (
            <div className="py-10 text-center text-[15px] text-[#9CA3AF]">불러오는 중...</div>
          )}

          {!loading && err && (
            <div className="py-10 text-center text-[15px] text-[#FF6467]">{err}</div>
          )}

          {!loading && !err && data && data.items.length === 0 && (
            <div className="py-10 text-center text-[15px] text-[#9CA3AF]">
              선택한 기간에 상담 내역이 없습니다.
            </div>
          )}

          {!loading && !err && data && data.items.length > 0 && (
            <ul className="flex flex-col">
              {data.items.map((it) => (
                <li
                  key={it.id}
                  className={
                    'py-4 flex items-center gap-4 border-b ' +
                    (it.is_missed
                      ? 'border-[#FFE2E2] bg-[#FFF8F8] -mx-4 px-4'
                      : 'border-[#F3F4F6]')
                  }
                >
                  <div
                    className={
                      'w-[40px] h-[40px] rounded-full flex items-center justify-center text-[12px] font-medium shrink-0 ' +
                      (it.consult_type === 'call'
                        ? 'bg-[#f3f0ff] text-[#8259F5]'
                        : 'bg-[#E8F8F4] text-[#00BBA7]')
                    }
                  >
                    {it.consult_type === 'call' ? '전화' : '채팅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] text-[#252B36] font-medium leading-[140%]">
                      {formatDateTime(it.started_at ?? it.created_at)}
                    </p>
                    <p className="mt-1 text-[15px] text-[#6A7282] leading-[140%] flex items-center flex-wrap gap-x-2">
                      {it.is_missed ? (
                        <span className="inline-flex items-center gap-1 text-[#FF6467] font-semibold">
                          <span className="w-[6px] h-[6px] rounded-full bg-[#FF6467]" />
                          부재
                        </span>
                      ) : (
                        <span className="text-[#252B36]">
                          {it.usetm_label || formatHMS(it.usetm_seconds)}
                        </span>
                      )}
                      {it.customer_no && (
                        <span className="text-[#9CA3AF]">고객 {it.customer_no}</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && !err && data && (data.items.length > 0 || page > 1) && (
            <div className="pt-4 pb-2 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              />
            </div>
          )}
        </section>

        {/* 6개월 안내 */}
        <p className="text-[14px] text-[#9CA3AF] text-center pt-1">
          ※ 최대 6개월 이내 기간만 조회할 수 있습니다.
        </p>
      </main>

      <FloatingActions />
      <BottomNav myHref="/counselor/mypage" />
    </div>
  )
}
