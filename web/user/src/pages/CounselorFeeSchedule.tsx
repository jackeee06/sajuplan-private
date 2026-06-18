import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  counselorGradeApi,
  ApiError,
  type FeeScheduleRow,
  type GradeProgressInfo,
} from '../lib/api'

/**
 * 실시간 상담수수료 — 상담사 마이페이지 → "실시간 상담수수료" 진입.
 *
 * 핵심 메시지: "시간을 채우면 실시간으로 즉시 승급된다."
 *   → 상단에 본인 진척도 + 다음 등급 보상(시간당 상담료 상승) 라이브 배너로 강조.
 *
 * 구성:
 *   ① 라이브 승급 배너 (개인화) — 당월 누적 / 다음 등급까지 남은 시간 / 보상 미리보기
 *   ② 등급별 수수료 표 (DB 동적) — 본인 등급 행 강조 + 다음 등급 "다음 목표" 뱃지
 *   ③ 승급 즉시 적용 + 차별점 홍보 이미지 (정적 /img/sunggup.jpg)
 */

/** 등급의 시간당 상담료 최대치 (단가 옵션 중 최고) */
function maxHourly(row: FeeScheduleRow): number {
  return row.options.reduce((m, o) => Math.max(m, o.hourly_earning), 0)
}

export default function CounselorFeeSchedule() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<FeeScheduleRow[] | null>(null)
  const [progress, setProgress] = useState<GradeProgressInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    counselorGradeApi
      .getFeeSchedule()
      .then((r) => { if (alive) setRows(r) })
      .catch((e: unknown) => {
        if (!alive) return
        setErr(e instanceof ApiError ? e.message : '수수료 정보를 불러오지 못했습니다.')
      })
    // 진척도 — 실패해도 표는 보이게 (배너만 숨김)
    counselorGradeApi
      .getProgress()
      .then((p) => { if (alive) setProgress(p) })
      .catch(() => { /* 비상담사/오류 시 배너 생략 */ })
    return () => { alive = false }
  }, [])

  // 보상 미리보기 — 다음 등급 시간당 상담료 최대치
  const nextRow =
    progress && rows ? rows.find((r) => r.grade === progress.next_grade) ?? null : null
  const nextMaxHourly = nextRow ? maxHourly(nextRow) : null

  return (
    <div className="mobile-frame flex flex-col pb-[60px]">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          실시간 상담수수료
        </h1>
      </header>

      <main className="flex-1 px-4 py-4 space-y-5">
        {/* ① 라이브 승급 배너 (개인화) — 핵심 메시지 강조 */}
        {progress && (
          <section
            className="rounded-[16px] p-4 border border-[#fbcfe8]"
            style={{ background: 'linear-gradient(135deg, #f3f0ff 0%, #fce7f3 100%)' }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[15px]">⚡</span>
              <span className="text-[14px] font-bold text-[#be185d]">
                실시간 승급 — 시간만 채우면 바로!
              </span>
            </div>

            {progress.next_grade_label && progress.next_threshold_hours != null ? (
              <>
                <div className="mt-3 flex items-end justify-between">
                  <div className="text-[13px] text-[#6A7282]">
                    이번 달 누적{' '}
                    <span className="text-[20px] font-bold text-[#8259F5] tabular-nums align-middle">
                      {progress.total_hours.toFixed(1)}
                    </span>
                    <span className="text-[13px] font-medium text-[#8259F5]">시간</span>
                  </div>
                  <div className="text-[12px] text-[#6A7282] text-right">
                    <span className="font-semibold text-[#1E2939]">{progress.next_grade_label}</span>까지{' '}
                    <span className="font-bold text-[#be185d] tabular-nums">
                      {Math.max(0, progress.next_threshold_hours - progress.total_hours).toFixed(1)}h
                    </span>
                  </div>
                </div>

                {/* 진척바 */}
                <div className="mt-2 h-2.5 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8259F5] to-[#ec4899] transition-all"
                    style={{ width: `${Math.min(100, Math.max(2, progress.progress_pct))}%` }}
                  />
                </div>

                {/* 보상 미리보기 — 달성 시 시간당 상담료 상승 */}
                {nextMaxHourly != null && (
                  <div className="mt-3 px-3 py-2.5 rounded-[10px] bg-white/80 flex items-center justify-between">
                    <span className="text-[12px] text-[#6A7282] leading-tight">
                      달성 즉시 시간당 상담료<br className="hidden" /> 최대
                    </span>
                    <span className="text-[15px] font-bold text-[#1E2939] tabular-nums">
                      {nextMaxHourly.toLocaleString()}원
                      <span className="text-[12px] font-semibold text-[#16a34a] ml-1">↑</span>
                    </span>
                  </div>
                )}

                <p className="mt-2 text-[11px] text-[#9CA3AF] leading-[150%]">
                  다음 달까지 기다릴 필요 없어요. 목표 시간을 채우는 그 순간 등급·단가가 즉시 올라갑니다.
                </p>
              </>
            ) : (
              // 최고 등급
              <div className="mt-3">
                <p className="text-[14px] font-semibold text-[#1E2939]">
                  🏆 최고 등급 달성! 이번 달 누적{' '}
                  <span className="text-[#8259F5] tabular-nums">{progress.total_hours.toFixed(1)}시간</span>
                </p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  최고 단가 범위가 모두 열려 있어요. 이대로 유지하면 다음 달도 최고 등급입니다.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ② 수수료 표 (DB 동적) */}
        <section>
          {/* 타이틀 배너 */}
          <div className="rounded-t-[12px] bg-[#2b2a6b] py-3 text-center">
            <span className="text-[18px] font-bold text-white tracking-tight">
              사주플랜 상담수수료
            </span>
          </div>

          {err ? (
            <div className="rounded-b-[12px] border border-t-0 border-[#E5E7EB] py-8 text-center text-[13px] text-[#9CA3AF]">
              {err}
            </div>
          ) : !rows ? (
            <div className="rounded-b-[12px] border border-t-0 border-[#E5E7EB] py-8 text-center text-[13px] text-[#9CA3AF]">
              불러오는 중…
            </div>
          ) : (
            <table className="w-full border-collapse text-center tabular-nums">
              <thead>
                <tr className="bg-[#4845a3] text-white">
                  <th className="py-2.5 px-1 text-[12px] font-semibold w-[22%] border-r border-white/15">달성시간</th>
                  <th className="py-2.5 px-1 text-[12px] font-semibold w-[24%] border-r border-white/15">등급</th>
                  <th className="py-2.5 px-1 text-[12px] font-semibold w-[26%] border-r border-white/15">고객이용료</th>
                  <th className="py-2.5 px-1 text-[12px] font-semibold w-[28%]">시간당 상담료</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g, gi) => {
                  const span = Math.max(1, g.options.length)
                  const isCurrent = progress?.grade === g.grade
                  const isNext = progress?.next_grade === g.grade
                  const rowBg = isCurrent
                    ? 'bg-[#f3f0ff]'
                    : isNext
                      ? 'bg-[#fdf2f8]'
                      : gi % 2 === 0
                        ? 'bg-white'
                        : 'bg-[#f7f6fc]'
                  return g.options.map((opt, oi) => (
                    <tr key={`${g.grade}-${opt.customer_fee}`} className={`${rowBg} border-b border-[#EEEEF4]`}>
                      {oi === 0 && (
                        <>
                          <td
                            rowSpan={span}
                            className="px-1 py-2 text-[12.5px] font-medium text-[#1E2939] border-r border-[#EEEEF4] align-middle"
                          >
                            {g.threshold_hours}시간~
                          </td>
                          <td
                            rowSpan={span}
                            className="px-1 py-2 border-r border-[#EEEEF4] align-middle"
                          >
                            <span className={`text-[13px] font-bold ${isCurrent ? 'text-[#8259F5]' : isNext ? 'text-[#ec4899]' : 'text-[#4845a3]'}`}>
                              {g.grade_label}
                            </span>
                            {isCurrent && (
                              <span className="mt-1 block mx-auto w-fit text-[9px] px-1.5 py-0.5 rounded-full bg-[#8259F5] text-white font-medium leading-none">
                                현재
                              </span>
                            )}
                            {isNext && (
                              <span className="mt-1 block mx-auto w-fit text-[9px] px-1.5 py-0.5 rounded-full bg-[#ec4899] text-white font-medium leading-none">
                                다음 목표
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-1 py-2 text-[12.5px] text-[#364153] border-r border-[#EEEEF4]">
                        {opt.customer_fee.toLocaleString()}원
                      </td>
                      <td className="px-1 py-2 text-[13px] font-semibold text-[#1E2939]">
                        {opt.hourly_earning.toLocaleString()}원
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          )}

          <p className="mt-2 text-[11px] leading-[150%] text-[#9CA3AF]">
            · 시간당 상담료는 60분 기준이며, 고객이용료(등급별 단가)에 따라 달라집니다.<br />
            · 고객이용료는 30초당 코인 단가, 시간당 상담료는 상담사가 받는 수익금입니다.
          </p>
        </section>

        {/* ③ 홍보 그래픽 (정적 이미지) */}
        <section>
          <img
            src="/img/sunggup.jpg"
            alt="상담사 승급 즉시 적용 — 목표 상담시간 달성 시 즉시 승급되는 사주플랜만의 성장형 수익 구조"
            className="w-full rounded-[12px]"
          />
        </section>
      </main>
    </div>
  )
}
