import { useMemo } from 'react'
import { BookOpen, Smartphone } from 'lucide-react'
import {
  CATEGORY_META,
  PUSH_CATALOG,
  STATUS_META,
  countByCategory,
  countByStatus,
  groupByCategory,
  type PushCatalogItem,
} from '../data/pushCatalog'

/**
 * 푸시 알림 가이드 — 운영자 참조 페이지.
 *
 * 한 페이지에 모든 푸시 항목을 카테고리별 그리드로 나열.
 * Ctrl+F 검색 친화 · 인쇄 가능 · 별도 필터 없음 (사장님 요구).
 */
export default function PushGuide() {
  const grouped = useMemo(() => groupByCategory(), [])
  const totals = useMemo(() => countByStatus(), [])
  const catCounts = useMemo(() => countByCategory(), [])

  return (
    <div className="max-w-[1500px] space-y-4">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">푸시 알림 가이드</h1>
        <span className="text-xs text-gray-500">— 모든 푸시 종류 한눈에</span>
      </div>

      {/* ─── 한 줄 요약 ─── */}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <BookOpen className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-700 dark:text-gray-200 font-medium">총 {PUSH_CATALOG.length}건</span>
        </span>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border"
            style={{ backgroundColor: meta.bg, borderColor: meta.color + '33', color: meta.color }}
            title={meta.desc}
          >
            <span>{meta.icon}</span>
            <span className="font-medium">{meta.label}</span>
            <span className="tabular-nums">{totals[key as keyof typeof totals]}건</span>
          </span>
        ))}
        <span className="text-gray-300 dark:text-gray-600">|</span>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border"
            style={{ backgroundColor: meta.bg, borderColor: meta.color + '33', color: meta.color }}
          >
            <span className="font-medium">{meta.label}</span>
            <span className="tabular-nums">{catCounts[key as keyof typeof catCounts]}</span>
          </span>
        ))}
      </div>

      {/* ─── 안내 박스 ─── */}
      <div className="rounded-md border border-brand-100 bg-brand-50/40 dark:bg-brand-900/10 dark:border-brand-900 px-3 py-2 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
        <strong className="text-brand-700 dark:text-brand-300">사용법:</strong> 푸시 종류가 많아 헷갈릴 때 이 페이지를 열어보세요.
        각 항목마다 <em>언제·누구에게·어떻게</em> 발송되는지 자세히 적혀 있습니다.
        새 푸시 추가 시 같은 PR 에서 이 데이터(<code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px]">web/mng/src/data/pushCatalog.ts</code>)도 함께 업데이트하면 항상 최신 상태로 유지됩니다.
      </div>

      {/* ─── 카테고리별 섹션 ─── */}
      {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((catKey) => {
        const items = grouped[catKey]
        if (items.length === 0) return null
        const meta = CATEGORY_META[catKey]
        return (
          <section key={catKey} className="space-y-2" id={`cat-${catKey}`}>
            <div className="flex items-center gap-2 border-l-4 pl-2 py-0.5" style={{ borderColor: meta.color }}>
              <h2 className="text-[15px] font-semibold" style={{ color: meta.color }}>
                {meta.label}
              </h2>
              <span className="text-[12px] text-gray-500 tabular-nums">{items.length}건</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
              {items.map((item) => (
                <PushCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ───────────────────────── 개별 카드 ───────────────────────── */

function PushCard({ item }: { item: PushCatalogItem }) {
  const cat = CATEGORY_META[item.category]
  const status = STATUS_META[item.status]

  return (
    <article
      id={item.id}
      className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-[12.5px] leading-relaxed hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
    >
      {/* 헤더: 아이콘 + 이름 + 상태 */}
      <header className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="text-lg leading-none mt-0.5">{item.icon}</span>
          <h3 className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {item.name}
          </h3>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-medium border whitespace-nowrap"
          style={{ backgroundColor: status.bg, borderColor: status.color + '33', color: status.color }}
          title={status.desc}
        >
          <span>{status.icon}</span>
          <span>{status.label}</span>
        </span>
      </header>

      {/* 한 줄 요약 */}
      <p className="text-[12px] text-gray-600 dark:text-gray-400 mb-2 italic">{item.oneLine}</p>

      {/* 메인 정보 — 라벨 6자 정렬 */}
      <dl className="space-y-1 text-[12px]">
        <Row label="언제" value={item.trigger} />
        <Row
          label="누구"
          value={
            <>
              <span className="font-medium text-gray-800 dark:text-gray-200">{item.audience}</span>
              {item.audienceDetail && (
                <span className="text-gray-500 dark:text-gray-400"> — {item.audienceDetail}</span>
              )}
            </>
          }
        />

        {/* 알림 내용 — 실제 푸시 시뮬레이션 박스 */}
        <div className="pt-1.5">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">알림 내용</span>
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-2 py-1.5">
            <div className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
            <div className="text-[11.5px] text-gray-600 dark:text-gray-400 leading-snug">{item.body}</div>
          </div>
        </div>

        <Row label="경험" value={item.experience} />
        {item.link && (
          <Row
            label="이동"
            value={
              <code className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded">
                {item.link}
              </code>
            }
          />
        )}

        {/* 관리자 참고 */}
        <div className="pt-1.5 mt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">관리자 참고</span>
          <p className="text-[11.5px] text-gray-700 dark:text-gray-300 leading-snug">{item.adminNote}</p>
        </div>

        {/* 기술 정보 — 작게 */}
        <div className="pt-1.5 mt-1.5 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-1.5 text-[10.5px]">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: cat.bg, color: cat.color }}
          >
            {cat.label}
          </span>
          <code className="text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-1 py-0.5 rounded">
            type={item.id}
          </code>
          {item.codeHint && (
            <span className="text-gray-400 dark:text-gray-500 italic" title="구현 위치">
              {item.codeHint}
            </span>
          )}
        </div>
      </dl>
    </article>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 w-9 text-[11px] font-medium text-gray-500 dark:text-gray-400 pt-0.5">{label}</dt>
      <dd className="flex-1 text-[12px] text-gray-700 dark:text-gray-300 leading-snug">{value}</dd>
    </div>
  )
}
