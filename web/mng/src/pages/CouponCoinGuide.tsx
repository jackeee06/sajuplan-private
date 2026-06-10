import { Coins } from 'lucide-react'

/**
 * 쿠폰 & 무료코인 정책 가이드 — _COUPON_COIN_POLICY.md 기준 (2026-06-07 확정)
 * 핵심 원칙: 같은 이벤트에 쿠폰 + 코인 중복 지급 금지.
 */
export default function CouponCoinGuide() {
  return (
    <div className="w-full min-w-0 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <Coins className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">쿠폰 & 무료코인 정책</h1>
        <span className="text-xs text-gray-500">— 2026-06-07 확정</span>
      </div>

      {/* 핵심 원칙 */}
      <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-4">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">⚠️ 핵심 원칙</p>
        <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
          <strong>쿠폰과 코인은 같은 이벤트에 동시에 주지 않는다.</strong><br />
          각 이벤트는 쿠폰 또는 즉시코인 중 하나만 사용한다.
        </p>
      </div>

      {/* 즉시 코인 지급 */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            💚 즉시 코인 지급 (쿠폰함 미노출 — 바로 free_balance 적립)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300 w-32">이벤트</th>
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">지급 방식</th>
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300 w-40">금액 설정</th>
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { event: '회원가입', method: 'creditRegisterPoint()', setting: 'setting.member.register_point', note: '가입 즉시 지급. 0이면 미지급' },
                { event: '로그인', method: 'creditLoginPointOnce()', setting: 'setting.member.login_point', note: '하루 1회 한정. 0이면 미지급' },
                { event: '출석 매일', method: '출석 서비스', setting: 'setting.attendance.user.day1', note: '로그인 시 자동 체크인' },
                { event: '출석 5/10/15/20일 보너스', method: '출석 서비스', setting: 'setting.attendance.user.day5/10/15/20_bonus', note: '연속 일수 달성 시 추가' },
                { event: '출석 30일 달성', method: '출석 서비스', setting: 'setting.attendance.user.day30_coupon_amount', note: '현재 코인으로 지급 (쿠폰 전환 예정)' },
                { event: '후기 작성', method: '후기 서비스', setting: '관리자 설정값', note: '사진 포함 시 추가 지급' },
                { event: '베스트 후기 선정', method: '후기 서비스', setting: '10,000코인 고정', note: '관리자가 베스트 지정 시 1회 지급' },
              ].map((row) => (
                <tr key={row.event} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">{row.event}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 font-mono text-xs">{row.method}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{row.setting}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 쿠폰 경유 지급 */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-violet-50 dark:bg-violet-950/30 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-violet-700 dark:text-violet-300">
            🎫 쿠폰 경유 지급 (쿠폰함에 들어감 — 회원이 직접 "사용" 클릭 시 코인 전환)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300 w-40">종류</th>
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">발급 방법</th>
                <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">코드입력 쿠폰</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 text-xs">쿠폰존관리(cz_type=3) 등록 → 회원이 코드 직접 입력</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">코드 입력 즉시 사용 처리 + 코인 지급. 현재 미운영</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">관리자 수동 발급</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 text-xs">쿠폰존관리에서 특정 회원에게 직접 발급</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">이름을 사용자 친화적으로 작성 필수 (내부 용어 금지)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 폐지 항목 */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            🚫 폐지된 쿠폰 (2026-06-07)
          </h2>
        </div>
        <div className="px-4 py-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
          <p><span className="font-medium line-through text-gray-400">회원가입 쿠폰 (issueSignupCoupon)</span></p>
          <p className="text-xs text-gray-500">폐지 사유: register_point(즉시 코인)와 이중지급 위험 → 코인 직접지급으로 통일</p>
          <p className="text-xs text-gray-500">처리: 쿠폰존 비활성화, 미사용 쿠폰 17건 숨김, 코드 호출 제거 (2026-06-07)</p>
        </div>
      </section>

      {/* 운영 주의사항 */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-2">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">📌 관리자 수동 발급 시 주의사항</p>
        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
          <li>쿠폰 이름은 반드시 사용자 화면에 보이는 이름으로 작성 (예: "서비스 혜택 코인", "운영팀 지급")</li>
          <li>내부 개발 용어 사용 금지 (예: "자동sync검증쿠폰" ← 이런 거 금지)</li>
          <li>발급 전 해당 회원에게 이미 지급된 코인/쿠폰이 없는지 확인</li>
          <li>발급 후 회원이 "사용" 버튼을 눌러야 코인으로 전환됨 (자동 전환 아님)</li>
        </ul>
      </section>

      {/* 쿠폰함 화면 설명 */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">📱 회원 쿠폰 화면 설명</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
            <p className="font-medium text-gray-700 dark:text-gray-200">쿠폰함 탭</p>
            <p className="text-xs text-gray-500 mt-0.5">사용 가능한 쿠폰 목록. 관리자 수동 발급 또는 코드입력 쿠폰만 나타남.</p>
          </div>
          <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
            <p className="font-medium text-gray-700 dark:text-gray-200">사용내역 탭</p>
            <p className="text-xs text-gray-500 mt-0.5">사용 완료된 쿠폰 히스토리. 즉시 코인(출석/후기/회원가입)은 여기 나타나지 않음.</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">출석·후기·로그인·회원가입 보상은 즉시 코인이라 쿠폰함에 절대 나타나지 않습니다.</p>
      </section>
    </div>
  )
}
