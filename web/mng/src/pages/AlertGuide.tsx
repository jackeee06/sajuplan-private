import { useMemo } from 'react'
import { BellRing } from 'lucide-react'
import {
  ALERT_CATALOG,
  CATEGORY_META,
  CHANNEL_STATUS_META,
  activeChannelCount,
  isDecisionFinalized,
  type AlertCatalogItem,
  type ChannelDetail,
  type ChannelStatus,
} from '../data/alertCatalog'

/**
 * 알림 가이드 — 푸시/인앱/알림톡 3채널 통합 매트릭스.
 * 표 형식: 한 행 = 한 이벤트, 셀 안에서 줄바꿈 wrap.
 * sticky 헤더, 카테고리 좌측 컬러 보더, 중복 행 강조.
 */
export default function AlertGuide() {
  const summary = useMemo(() => {
    const total = ALERT_CATALOG.length
    let dup = 0, push = 0, inApp = 0, alimtalk = 0, finalized = 0, pending = 0
    for (const it of ALERT_CATALOG) {
      if (activeChannelCount(it) >= 2) dup += 1
      if (it.push.status === 'active') push += 1
      if (it.inApp.status === 'active') inApp += 1
      if (it.alimtalk.status === 'active') alimtalk += 1
      if (isDecisionFinalized(it)) finalized += 1
      else pending += 1
    }
    return { total, dup, push, inApp, alimtalk, finalized, pending }
  }, [])

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">알림 가이드</h1>
        <span className="text-xs text-gray-500">— 푸시·인앱·알림톡 3채널 통합 매트릭스</span>
      </div>

      {/* ─── 요약 ─── */}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Chip label={`총 ${summary.total}건`} color="#374151" bg="#f3f4f6" />
        <Chip label={`🔒 결정완료 ${summary.finalized}`} color="#15803d" bg="#dcfce7" />
        <Chip label={`🔍 검토중 ${summary.pending}`} color="#a855f7" bg="#f3e8ff" />
        <Chip label={`⚠️ 중복 ${summary.dup}건`} color="#a16207" bg="#fef3c7" />
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <Chip label={`📱 푸시 ${summary.push}`} color="#15803d" bg="#dcfce7" />
        <Chip label={`🪟 인앱 ${summary.inApp}`} color="#15803d" bg="#dcfce7" />
        <Chip label={`💬 알림톡 ${summary.alimtalk}`} color="#15803d" bg="#dcfce7" />
        <span className="text-gray-300 dark:text-gray-600">|</span>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <Chip
            key={key}
            label={`${meta.label} ${ALERT_CATALOG.filter((it) => it.category === key).length}`}
            color={meta.color}
            bg={meta.bg}
          />
        ))}
      </div>

      {/* ─── 안내 박스 1: 읽는 법 + 데이터 출처 ─── */}
      <div className="rounded-md border border-brand-100 bg-brand-50/40 dark:bg-brand-900/10 dark:border-brand-900 px-3 py-2 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
        <strong className="text-brand-700 dark:text-brand-300">읽는 법:</strong> 한 행이 하나의 알림 이벤트입니다.
        <strong> 📱 푸시 / 🪟 인앱 / 💬 알림톡</strong> 컬럼에서 어느 채널이 동작 중인지 확인. 같은 이벤트에 2개 이상 채널이 활성이면 ⚠️ <strong>중복 위험</strong> — 행 배경 노랑.
        <strong className="text-brand-700 dark:text-brand-300"> 권장</strong> 컬럼이 정리 방향을 안내. 데이터 출처: <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px]">web/mng/src/data/alertCatalog.ts</code>
      </div>

      {/* ─── 안내 박스 2: 3채널의 본질 차이 (운영자 온보딩) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11.5px] leading-relaxed">
        <div className="rounded-md border border-cyan-200 bg-cyan-50/40 dark:bg-cyan-900/10 dark:border-cyan-900 px-3 py-2">
          <div className="text-[12px] font-semibold text-cyan-700 dark:text-cyan-300 mb-1">📱 푸시 — 백그라운드 깨우기</div>
          <div className="text-gray-700 dark:text-gray-300">앱 안 켠 사용자에게 도달. <strong>사주플랜은 거의 안 씀</strong> — 사용자 부담 ↑. 상담 요청 도착(상담사용 매출 직결) 1개만 active.</div>
        </div>
        <div className="rounded-md border border-purple-200 bg-purple-50/40 dark:bg-purple-900/10 dark:border-purple-900 px-3 py-2">
          <div className="text-[12px] font-semibold text-purple-700 dark:text-purple-300 mb-1">🪟 인앱 — 능동 진입 시점</div>
          <div className="text-gray-700 dark:text-gray-300">사용자가 앱 켠 순간 = 관심 최고조. <strong>가장 자연스러운 채널</strong>. 홈 배너/모달/토스트/채팅방 메시지 등 모두 포함.</div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10 dark:border-emerald-900 px-3 py-2">
          <div className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1">💬 알림톡 — 외부 도달</div>
          <div className="text-gray-700 dark:text-gray-300">한국 메신저 문화 → 자연스럽고 신뢰. <strong>즉시성/법적/외부 필요시만</strong>. 결제 안내, 인증, 비번찾기, 후기/Q&A 알림 등.</div>
        </div>
      </div>

      {/* ─── 안내 박스 3: 상태 칩 5종 의미 ─── */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-3 py-2 text-[11.5px] leading-relaxed">
        <span className="font-semibold text-gray-700 dark:text-gray-200 mr-2">🏷️ 상태 칩:</span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>✅ 사용중</span><span className="text-gray-600 dark:text-gray-400">실제 발송 중</span></span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>❌ 안 함</span><span className="text-gray-600 dark:text-gray-400">검토 후 결정 (재고민 X)</span></span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>➖ 미사용</span><span className="text-gray-600 dark:text-gray-400">처음부터 부적합</span></span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: '#fef9c3', color: '#a16207' }}>📝 예정</span><span className="text-gray-600 dark:text-gray-400">구현/검토 대기</span></span>
        <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: '#f3e8ff', color: '#a855f7' }}>❓ 확인필요</span><span className="text-gray-600 dark:text-gray-400">미검토</span></span>
      </div>

      {/* ─── 안내 박스 4: 결정 기준 (사장님 일관 적용) ─── */}
      <details className="rounded-md border border-amber-200 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-900 px-3 py-2 text-[11.5px] leading-relaxed">
        <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300 select-none">📌 새 알림 추가 시 결정 기준 8가지 (펼치기)</summary>
        <ol className="mt-2 ml-4 list-decimal space-y-1 text-gray-700 dark:text-gray-300">
          <li><strong>마케팅성</strong> (생일/추천인/쿠폰만료/휴면복귀) → 모두 ❌ "고객 귀찮게 함"</li>
          <li><strong>앱 밖 사용자에게 굳이 알릴 필요 X</strong> → 푸시 ❌</li>
          <li><strong>알림톡 이미 있으면</strong> → 푸시 중복 ❌</li>
          <li><strong>사용자 능동 진입 시 가치 있음</strong> → 인앱 ✅ (가장 자연)</li>
          <li><strong>즉시성 + 매출 직결</strong> → 푸시 예외 허용 (상담 요청 도착)</li>
          <li><strong>법적/약정 의무</strong> → 알림톡 (인증/비번찾기)</li>
          <li><strong>항상 노출되는 정보</strong> (가격 정책 등) → 알림 불필요</li>
          <li><strong>인앱 모달 이미 있으면</strong> → 알림톡 중복 X (가입환영/약관변경)</li>
        </ol>
      </details>

      {/* ─── 표 ─── (작은 모니터 시 가로 스크롤 자동) */}
      <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="table-fixed border-collapse text-[12.5px]" style={{ width: 1760, minWidth: 1760 }}>
          <colgroup>
            <col style={{ width: 200 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 230 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700">
            <tr className="text-left text-[11.5px] font-semibold text-gray-700 dark:text-gray-200">
              <Th>이벤트</Th>
              <Th>카테고리</Th>
              <Th>트리거 (언제)</Th>
              <Th>대상</Th>
              <Th>알림 내용</Th>
              <Th>사용자 경험</Th>
              <Th className="text-center">📱 푸시</Th>
              <Th className="text-center">🪟 인앱</Th>
              <Th className="text-center">💬 알림톡</Th>
              <Th>권장</Th>
              <Th>관리자 참고</Th>
            </tr>
          </thead>
          <tbody>
            {ALERT_CATALOG.map((item, idx) => (
              <Row key={item.id} item={item} idx={idx} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────── 행 ─────────────── */

function Row({ item, idx }: { item: AlertCatalogItem; idx: number }) {
  const cat = CATEGORY_META[item.category]
  const dup = activeChannelCount(item) >= 2
  const finalized = isDecisionFinalized(item)
  const zebra = idx % 2 === 1
  const bg = dup
    ? 'bg-amber-50/60 dark:bg-amber-900/10'
    : zebra
    ? 'bg-gray-50/60 dark:bg-gray-900/30'
    : 'bg-white dark:bg-gray-800'

  return (
    <tr
      id={item.id}
      className={`${bg} border-b border-gray-100 dark:border-gray-700 hover:bg-brand-50/30 dark:hover:bg-brand-900/10`}
      style={{ borderLeft: `4px solid ${dup ? '#f59e0b' : cat.color}` }}
    >
      {/* 이벤트 */}
      <Td className="align-top">
        <div className="flex items-start gap-1.5">
          <span className="text-base leading-none mt-0.5">{item.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1 flex-wrap">
              <span className="font-semibold text-[13px] text-gray-900 dark:text-gray-100 leading-tight">
                {item.name}
              </span>
              <span
                className="shrink-0 inline-block px-1 py-0.5 rounded text-[9.5px] font-medium leading-none"
                style={
                  finalized
                    ? { backgroundColor: '#dcfce7', color: '#15803d' }
                    : { backgroundColor: '#f3e8ff', color: '#a855f7' }
                }
                title={finalized ? '3채널 모두 결정 완료' : 'planned/unknown 남음 — 추가 검토 필요'}
              >
                {finalized ? '🔒 결정완료' : '🔍 검토중'}
              </span>
            </div>
            <div className="text-[11.5px] text-gray-500 dark:text-gray-400 italic mt-0.5 leading-snug">
              {item.oneLine}
            </div>
            {item.techType && (
              <code className="inline-block mt-1 text-[10.5px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">
                {item.techType}
              </code>
            )}
          </div>
        </div>
      </Td>

      {/* 카테고리 */}
      <Td className="align-top">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
      </Td>

      {/* 트리거 */}
      <Td className="align-top text-[12px] text-gray-700 dark:text-gray-300 leading-snug">{item.trigger}</Td>

      {/* 대상 */}
      <Td className="align-top text-[12px] leading-snug">
        <span className="font-medium text-gray-800 dark:text-gray-200">{item.audience}</span>
        {item.audienceDetail && (
          <span className="block text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">{item.audienceDetail}</span>
        )}
      </Td>

      {/* 알림 내용 (시뮬레이션) */}
      <Td className="align-top">
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-2 py-1.5">
          <div className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">{item.title}</div>
          <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug mt-0.5">{item.body}</div>
        </div>
      </Td>

      {/* 사용자 경험 + 이동 */}
      <Td className="align-top text-[12px] leading-snug">
        <div className="text-gray-700 dark:text-gray-300">{item.experience}</div>
        {item.link && (
          <code className="inline-block mt-1 text-[10.5px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded break-all">
            {item.link}
          </code>
        )}
      </Td>

      {/* 채널 3개 */}
      <ChannelCell channel={item.push} />
      <ChannelCell channel={item.inApp} />
      <ChannelCell channel={item.alimtalk} />

      {/* 권장 */}
      <Td className="align-top text-[12px] leading-snug text-gray-700 dark:text-gray-300">
        {item.recommend}
      </Td>

      {/* 관리자 참고 */}
      <Td className="align-top text-[11.5px] leading-snug text-gray-600 dark:text-gray-400">
        {item.adminNote}
      </Td>
    </tr>
  )
}

/* ─────────────── 채널 셀 ─────────────── */

function ChannelCell({ channel }: { channel: ChannelDetail }) {
  const meta = CHANNEL_STATUS_META[channel.status]
  return (
    <Td className="align-top text-center">
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap"
        style={{ backgroundColor: meta.bg, color: meta.color }}
      >
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </span>
      {channel.note && (
        <div className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug break-words">
          {channel.note}
        </div>
      )}
    </Td>
  )
}

/* ─────────────── helpers ─────────────── */

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 border-b border-gray-200 dark:border-gray-700 ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 ${className}`}>{children}</td>
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border font-medium"
      style={{ backgroundColor: bg, color, borderColor: color + '33' }}
    >
      {label}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ChannelStatusUsed = ChannelStatus
