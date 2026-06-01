import { useAuth } from '../lib/auth'
import { Navigate } from 'react-router-dom'

export default function InfraInfo() {
  const { admin } = useAuth()
  if (!admin?.is_super) return <Navigate to="/dashboard" replace />

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🔒 인프라 잠금 정보</h1>
        <p className="text-sm text-gray-500 mt-1">슈퍼관리자 전용 — 변경 불가 항목과 미래 전환 체크리스트. 작업 전 반드시 확인.</p>
      </div>

      {/* 서버 경로 */}
      <section className="rounded-lg border-2 border-rose-300 border-l-[6px] bg-rose-50/40 p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-rose-800">🔴 절대 변경 금지 — 서버 경로</div>
          <div className="text-xs text-rose-600 mt-0.5">코드에서 이 경로를 바꾸면 nginx + 배포 스크립트가 전부 깨집니다.</div>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-rose-100 text-rose-900">
              <th className="text-left px-3 py-2 rounded-l font-semibold">용도</th>
              <th className="text-left px-3 py-2 font-semibold">실제 서버 경로</th>
              <th className="text-left px-3 py-2 rounded-r font-semibold">이유</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100">
            {[
              ['API 코드', '/data/wwwroot/api.sajumoon.co.kr', 'nginx vhost · deploy.sh 기준 경로'],
              ['사용자/어드민 프론트', '/data/wwwroot/sajumoon.co.kr', 'nginx vhost · deploy.sh 기준 경로'],
              ['DB 백업', '/data/backup/db/', 'cron 스크립트 하드코딩'],
              ['업로드 파일', '/data/wwwroot/api.sajumoon.co.kr/uploads/', '파일 서빙 경로'],
            ].map(([용도, 경로, 이유]) => (
              <tr key={경로} className="hover:bg-rose-50">
                <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">{용도}</td>
                <td className="px-3 py-2 font-mono text-rose-700 break-all">{경로}</td>
                <td className="px-3 py-2 text-gray-500">{이유}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 도메인 */}
      <section className="rounded-lg border-2 border-rose-300 border-l-[6px] bg-rose-50/40 p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-rose-800">🔴 절대 변경 금지 — 도메인</div>
          <div className="text-xs text-rose-600 mt-0.5">
            <strong>주의:</strong> 코드 내 <code className="bg-rose-100 px-1 rounded">api.sajumoon.co.kr</code>는 표시 이름이 아닌 실제 서버 경로. 절대 삭제·변경 금지.
          </div>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-rose-100 text-rose-900">
              <th className="text-left px-3 py-2 rounded-l font-semibold">도메인</th>
              <th className="text-left px-3 py-2 font-semibold">용도</th>
              <th className="text-left px-3 py-2 rounded-r font-semibold">변경 시 영향</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100">
            {[
              ['sajuplan.com', '사용자 프론트 (PROD 메인)', '실 사용자 접속 불가'],
              ['api.sajuplan.com', 'API (PROD)', '결제·채팅·인증 전부 중단'],
              ['sajumoon.co.kr', '사용자 프론트 (legacy)', '기존 북마크 사용자 차단'],
              ['api.sajumoon.co.kr', 'API (서버 경로 기준 도메인)', 'nginx + deploy 스크립트 기준'],
            ].map(([도메인, 용도, 영향]) => (
              <tr key={도메인} className="hover:bg-rose-50">
                <td className="px-3 py-2 font-mono text-rose-700 whitespace-nowrap">{도메인}</td>
                <td className="px-3 py-2 text-gray-700">{용도}</td>
                <td className="px-3 py-2 text-gray-500">{영향}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 외부 서비스 */}
      <section className="rounded-lg border-2 border-rose-300 border-l-[6px] bg-rose-50/40 p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-rose-800">🔴 절대 변경 금지 — 외부 서비스 등록 URL</div>
          <div className="text-xs text-rose-600 mt-0.5">변경 시 해당 서비스 전체 중단. 외부 업체 재등록 필요.</div>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-rose-100 text-rose-900">
              <th className="text-left px-3 py-2 rounded-l font-semibold">서비스</th>
              <th className="text-left px-3 py-2 font-semibold">등록된 항목</th>
              <th className="text-left px-3 py-2 rounded-r font-semibold">변경 시 영향</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100">
            {[
              ['m2net (결제/통화 PG)', 'api.sajuplan.com 콜백 URL', '결제·통화 push 전부 실패'],
              ['BizM (알림톡)', '발신프로필 도메인', '알림톡 발송 중단'],
              ['카카오 OAuth', 'redirect URI 화이트리스트', '카카오 로그인 불가'],
              ['Google rclone', '/root/.config/rclone/rclone.conf', 'Google Drive 백업 중단'],
            ].map(([서비스, 등록, 영향]) => (
              <tr key={서비스} className="hover:bg-rose-50">
                <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">{서비스}</td>
                <td className="px-3 py-2 font-mono text-rose-700 break-all">{등록}</td>
                <td className="px-3 py-2 text-gray-500">{영향}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 변경 가능 항목 */}
      <section className="rounded-lg border-2 border-amber-300 border-l-[6px] bg-amber-50/30 p-4 space-y-3">
        <div className="text-sm font-bold text-amber-900">🟡 변경 가능 (주의 필요)</div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-100 text-amber-900">
              <th className="text-left px-3 py-2 rounded-l font-semibold">항목</th>
              <th className="text-left px-3 py-2 rounded-r font-semibold">조건</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {[
              ['GitHub repo 이름 (sajumoon → sajuplan)', 'remote URL 업데이트 필요'],
              ['로컬 작업폴더명 (sajumoon → sajuplan)', 'VSCode 재시작 필요'],
              ['어드민 UI 라벨 내 sajumoon 텍스트', '기능 영향 없음, 표시만'],
            ].map(([항목, 조건]) => (
              <tr key={항목} className="hover:bg-amber-50">
                <td className="px-3 py-2 text-gray-700">{항목}</td>
                <td className="px-3 py-2 text-gray-500">{조건}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 미래 전환 체크리스트 */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-gray-700">📋 미래 인프라 전환 체크리스트</div>
          <div className="text-xs text-gray-500 mt-0.5">정식 운영 후 m2net 협의 완료 시 검토. 현재는 보류.</div>
        </div>
        <ul className="text-xs text-gray-600 space-y-1.5">
          {[
            'nginx vhost 재설정 (sajumoon.co.kr → sajuplan.com 통합)',
            'DNS A 레코드 확인',
            'SSL 인증서 재발급 (Let\'s Encrypt)',
            'm2net 가맹점 콜백 URL 변경',
            '카카오·네이버 OAuth redirect URI 변경',
            'BizM 발신프로필 도메인 변경',
            'runtime-env.ts MAP 수정 + 재빌드',
            'tools/_*.py 경로 문자열 일괄 수정',
            '_setup_db_backup.py ENV_FILE 경로 수정',
            'rclone.conf 갱신',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border border-gray-300 bg-white inline-block" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="text-[11px] text-gray-400 pt-1">작성: 2026-06-02 | 다음 검토: 정식 운영 + m2net 협의 완료 후</div>
      </section>
    </div>
  )
}
