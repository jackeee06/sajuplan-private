import { useEffect, useState, Fragment } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Badge } from '../components/table'

interface Template {
  id: number
  template_code: string
  subject: string | null
  message: string
  primary_btn_name: string | null
  primary_btn_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 주제별 분류 — 관리자가 "왜 이 알림톡을 보내나"를 한눈에 보도록 묶는다. */
const CATEGORIES: { label: string; desc: string; codes: string[] }[] = [
  { label: '🔑 가입·계정', desc: '회원에게 — 가입 인증번호 / 아이디·비번 찾기', codes: ['register_num_v2', 'register_idpw_v2', 'register_idpw1'] },
  { label: '💳 결제·충전', desc: '회원에게 — 입금 확인 / 가상계좌 안내', codes: ['order_payment_ok_v2', 'order_bankinfo_v2'] },
  { label: '📞 상담 요청·진행', desc: '상담사·회원에게 — 전화/채팅 상담요청·개설·자동취소·상태', codes: ['counselor_request_v1', 'chat_request_to_counselor', 'chat_counseling_v2', 'chat_auto_cancelled_to_member', 'counselor_state_changed_v2', 'counselor_v2'] },
  { label: '⭐ 문의·후기', desc: '상담사·회원에게 — 문의 도착/답변, 후기 요청/도착', codes: ['qa_ask_v2', 'qa_answer_v2', 'review_req_v2', 'review_for_counselor_v2'] },
  { label: '💰 정산·선지급', desc: '상담사에게 — 수익금 정산 완료 / 선지급 접수·입금·반려', codes: ['settlement_complete', 'payout_request_received', 'payout_request_paid', 'payout_request_rejected'] },
  { label: '🎁 쿠폰·프로모션', desc: '회원·모집인에게 — 쿠폰 발급 / 서포터즈 승인', codes: ['coupon_req_v2', 'promoter_approved'] },
  { label: '🛡️ 운영자', desc: '관리자에게 — 시스템 이상감지·운영 알림', codes: ['ops_admin_alert_v2'] },
]

export default function AlimtalkTemplates() {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Template> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api<{ items: Template[] }>('/admin/notifications/alimtalk-templates')
      setItems(r.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    if (!edit) return
    if (!edit.template_code?.trim()) return setError('템플릿 코드를 입력하세요.')
    if (!edit.message?.trim()) return setError('메시지를 입력하세요.')
    try {
      if (edit.id) {
        await api(`/admin/notifications/alimtalk-templates/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) })
        setSuccess('수정 완료')
      } else {
        await api('/admin/notifications/alimtalk-templates', { method: 'POST', body: JSON.stringify(edit) })
        setSuccess('등록 완료')
      }
      setEdit(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const onDelete = async (t: Template) => {
    if (!confirm(`"${t.template_code}" 템플릿을 삭제하시겠습니까?`)) return
    await api(`/admin/notifications/alimtalk-templates/${t.id}`, { method: 'DELETE' })
    await load()
  }

  const renderRow = (t: Template) => (
    <Tr key={t.id} onClick={() => setEdit(t)}>
      <Td align="left" className="font-mono text-xs text-gray-600">{t.template_code}</Td>
      <Td align="left">{t.subject || <span className="text-gray-300">-</span>}</Td>
      <Td align="left" className="text-gray-600 max-w-[300px] truncate">{t.message}</Td>
      <Td align="left" className="text-xs text-gray-500">{t.primary_btn_name || <span className="text-gray-300">-</span>}</Td>
      <Td align="center">
        <Badge color={t.is_active ? 'emerald' : 'gray'}>{t.is_active ? '활성' : '비활성'}</Badge>
      </Td>
      <Td align="center">
        <button
          onClick={(e) => { e.stopPropagation(); void onDelete(t) }}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
          title="삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </Td>
    </Tr>
  )

  // 주제별 그룹 (해당 양식이 있는 분류만) + 미분류 기타
  const mappedCodes = new Set(CATEGORIES.flatMap((c) => c.codes))
  const groups = CATEGORIES
    .map((c) => ({ label: c.label, desc: c.desc, list: items.filter((t) => c.codes.includes(t.template_code)) }))
    .filter((g) => g.list.length > 0)
  const others = items.filter((t) => !mappedCodes.has(t.template_code))
  if (others.length) groups.push({ label: '📦 기타', desc: '미분류 — 위 주제에 없는 양식', list: others })

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">알림톡 템플릿</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">시스템이 상황마다 자동 발송하는 카카오 알림톡 본문 양식 (주제별)</p>
      </div>

      {/* 정책 안내 — "이게 뭐지?" 방지 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20 p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1 max-w-[860px]">
        <div className="font-semibold">📌 이 화면이 뭔가요?</div>
        <div>• 이 목록은 <b>시스템이 상황(이벤트)마다 자동으로 보내는 카카오톡 양식</b>입니다. 예: 가입하면 "인증번호", 후기 달리면 상담사에게 "후기 도착", 정산되면 "정산 완료" — 그 일이 생기면 해당 양식이 자동 발송됩니다.</div>
        <div>• 양식의 <b>등록·검수·승인은 카카오 비즈(BizM) 콘솔</b>에서 하고, 이 화면은 코드가 참조하는 <b>거울(목록)</b>입니다. <b className="text-rose-600 dark:text-rose-300">⚠️ 코드·버튼 타입을 함부로 바꾸면 발송이 막힐 수 있어요</b> (BizM 계약값).</div>
        <div>• 실제 <b>발송 결과</b>는 <a href="/mng/alert-logs" className="underline font-medium">알림톡 발송 이력</a> 메뉴에서 확인하세요.</div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <button
        onClick={() => setEdit({ template_code: '', message: '', is_active: true })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium w-fit"
      >
        <Plus className="w-4 h-4" /> 템플릿 추가
      </button>

      <TableShell>
        <THead>
          <Th align="left">코드</Th>
          <Th align="left">제목</Th>
          <Th align="left">메시지</Th>
          <Th align="left">버튼</Th>
          <Th align="center">활성</Th>
          <Th align="center">삭제</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={6} loading />
          ) : items.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            groups.map((g) => (
              <Fragment key={g.label}>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={6} className="px-2 py-1.5">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{g.label}</span>
                    <span className="text-[11px] text-gray-400 ml-2">— {g.desc}</span>
                  </td>
                </tr>
                {g.list.map((t) => renderRow(t))}
              </Fragment>
            ))
          )}
        </TBody>
      </TableShell>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEdit(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-xl w-[92%] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold">
              {edit.id ? '템플릿 수정' : '템플릿 추가'}
            </div>
            <div className="p-5 space-y-3">
              <Field label="템플릿 코드 *">
                <input type="text" value={edit.template_code ?? ''} onChange={(e) => setEdit({ ...edit, template_code: e.target.value })} className={inputCls} placeholder="예: SIGNUP_WELCOME" />
              </Field>
              <Field label="제목">
                <input type="text" value={edit.subject ?? ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} className={inputCls} />
              </Field>
              <Field label="메시지 *">
                <textarea rows={6} value={edit.message ?? ''} onChange={(e) => setEdit({ ...edit, message: e.target.value })} className={`${inputCls} font-mono text-xs`} placeholder="알림톡 본문 — #{변수} 형식 사용 가능" />
              </Field>
              <Field label="버튼명">
                <input type="text" value={edit.primary_btn_name ?? ''} onChange={(e) => setEdit({ ...edit, primary_btn_name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="버튼 URL">
                <input type="text" value={edit.primary_btn_url ?? ''} onChange={(e) => setEdit({ ...edit, primary_btn_url: e.target.value })} className={inputCls} placeholder="https://..." />
              </Field>
              <Field label="활성">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> 사용</label>
              </Field>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50">취소</button>
              <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 outline-none transition'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</label>
      {children}
    </div>
  )
}
