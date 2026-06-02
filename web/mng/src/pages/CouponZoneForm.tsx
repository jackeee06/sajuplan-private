import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search, X, Plus } from 'lucide-react'
import { api } from '../lib/api'

interface Payload {
  subject: string
  cz_type: number
  cp_method: number
  cp_target: string
  cz_point: number | ''
  cp_type: boolean
  cp_id: string
  cz_period: number | ''
  cz_start: string
  cz_end: string
  is_active: boolean
}

interface MemberRow {
  id: number
  member_id: number
  name: string
  mb_id: string | null
  phone: string | null
}

interface CustomerSearchRow {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  phone: string | null
}

const CZ_TYPE_OPTIONS = [
  { value: 0, label: '다운로드 쿠폰' },
  { value: 2, label: '포인트추가쿠폰' },
  { value: 3, label: '코드입력쿠폰' },
]

// 적용대상은 포인트(cp_method=4) 고정 — 정책상 다른 옵션은 노출하지 않는다.
const FIXED_CP_METHOD = 4
const FIXED_CP_METHOD_LABEL = '포인트'

const empty = (): Payload => ({
  subject: '', cz_type: 0, cp_method: FIXED_CP_METHOD, cp_target: '',
  cz_point: '', cp_type: false, cp_id: '', cz_period: 30,
  cz_start: '', cz_end: '', is_active: true,
})

export default function CouponZoneForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<Payload>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // 발급 대상 회원
  const [members, setMembers] = useState<MemberRow[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const supportsMembers = data.cz_type === 0 || data.cz_type === 3

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    Promise.all([
      api<Record<string, unknown>>(`/admin/coupon-zones/${id}`),
      api<MemberRow[]>(`/admin/coupon-zones/${id}/members`).catch(() => [] as MemberRow[]),
    ])
      .then(([r, m]) => {
        setData({
          subject: String(r.subject ?? ''),
          cz_type: Number(r.cz_type ?? 0),
          cp_method: FIXED_CP_METHOD,
          cp_target: String(r.cp_target ?? ''),
          cz_point: Number(r.cz_point ?? 0),
          cp_type: !!r.cp_type,
          cp_id: String(r.cp_id ?? ''),
          cz_period: Number(r.cz_period ?? 30),
          cz_start: r.cz_start ? toLocal(String(r.cz_start)) : '',
          cz_end: r.cz_end ? toLocal(String(r.cz_end)) : '',
          is_active: !!r.is_active,
        })
        setMembers(Array.isArray(m) ? m : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = <K extends keyof Payload>(k: K, v: Payload[K]) => setData((d) => ({ ...d, [k]: v }))

  const removeMember = (memberId: number) =>
    setMembers((arr) => arr.filter((m) => m.member_id !== memberId))

  const addMembers = (rows: CustomerSearchRow[]) => {
    setMembers((arr) => {
      const seen = new Set(arr.map((m) => m.member_id))
      const next = [...arr]
      for (const r of rows) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        next.push({ id: 0, member_id: r.id, name: r.name, mb_id: r.mb_id, phone: r.phone })
      }
      return next
    })
  }

  const onSubmit = async () => {
    setError(null); setSuccess(null)
    if (!data.subject.trim()) return setError('쿠폰이름은 필수입니다.')
    // 코드입력쿠폰(cz_type=3): 발급 즉시 회원에게 쿠폰번호를 알림톡으로 보내야 하므로
    // 회원 선택 없이 등록할 수 없다.
    if (data.cz_type === 3 && members.length === 0) {
      return setError('코드입력쿠폰은 발급 대상 회원을 최소 1명 이상 선택해야 합니다.')
    }

    setSaving(true)
    try {
      const payload = {
        ...data,
        cp_method: FIXED_CP_METHOD,
        cz_point: typeof data.cz_point === 'number' ? data.cz_point : 0,
        cz_period: typeof data.cz_period === 'number' ? data.cz_period : 0,
        cp_target: data.cp_target || null,
        cp_id: data.cp_id || null,
        cz_start: data.cz_start ? new Date(data.cz_start).toISOString() : null,
        cz_end: data.cz_end ? new Date(data.cz_end).toISOString() : null,
        // 회원 매핑은 다운로드/코드입력 쿠폰일 때만 보낸다. 다른 종류면 undefined → 백엔드 무시.
        member_ids: supportsMembers ? members.map((m) => m.member_id) : undefined,
      }
      if (isNew) {
        const r = await api<{ id: number }>('/admin/coupon-zones', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('등록 완료')
        navigate(`/coupon-zones/${r.id}`, { replace: true })
      } else {
        await api(`/admin/coupon-zones/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setSuccess('수정 완료')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/coupon-zones')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{isNew ? '쿠폰존 추가' : `쿠폰존 수정 #${id}`}</h1>
        </div>
        <button onClick={onSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <Row label="쿠폰이름" required>
          <input type="text" value={data.subject} onChange={(e) => set('subject', e.target.value)} className={inputCls} />
        </Row>
        <Row label="쿠폰종류" hint={!isNew ? '등록 후에는 쿠폰종류를 변경할 수 없습니다.' : undefined}>
          <select value={data.cz_type} onChange={(e) => set('cz_type', Number(e.target.value))} disabled={!isNew} className={inputCls}>
            {CZ_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </Row>
        <Row label="적용대상">
          <input type="text" value={FIXED_CP_METHOD_LABEL} readOnly disabled className={inputCls} />
        </Row>
        <Row label="포인트/할인 금액">
          <div className="flex gap-2">
            <input type="text" inputMode="numeric" value={data.cz_point} onChange={(e) => set('cz_point', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={inputCls} />
            <select value={data.cp_type ? '1' : '0'} onChange={(e) => set('cp_type', e.target.value === '1')} className={`max-w-[100px] ${inputCls}`}>
              <option value="0">원</option>
              <option value="1">%</option>
            </select>
          </div>
        </Row>
        {data.cz_type === 3 && (
          <Row label="쿠폰번호" hint={isNew ? '저장 시 자동 생성됩니다 (XXXX-XXXX-XXXX-XXXX 형식, 16자)' : '자동 생성된 코드 — 변경 불가'}>
            <input type="text" value={isNew ? '' : data.cp_id} placeholder={isNew ? '자동 생성' : ''} readOnly disabled className={`${inputCls} font-mono tracking-wider`} />
          </Row>
        )}
        <Row label="다운로드 후 사용가능 기간 (일)">
          <input type="text" inputMode="numeric" value={data.cz_period} onChange={(e) => set('cz_period', e.target.value === '' ? '' : Number(e.target.value.replace(/[^0-9]/g, '')))} className={inputCls} />
        </Row>
        <Row label="사용 시작">
          <input type="datetime-local" value={data.cz_start} onChange={(e) => set('cz_start', e.target.value)} className={inputCls} />
        </Row>
        <Row label="사용 종료">
          <input type="datetime-local" value={data.cz_end} onChange={(e) => set('cz_end', e.target.value)} className={inputCls} />
        </Row>
        <Row label="노출">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={data.is_active} onChange={(e) => set('is_active', e.target.checked)} /> 사용자에게 노출</label>
        </Row>

        {supportsMembers && (
          <Row label="발급 대상 회원" hint="다운로드/코드입력 쿠폰: 비워두면 모든 회원 대상, 선택 시 해당 회원에게만 발급됩니다.">
            <MemberPicker
              members={members}
              onRemove={removeMember}
              onOpenPicker={() => setPickerOpen(true)}
            />
          </Row>
        )}
      </div>

      {pickerOpen && (
        <MemberSearchModal
          excludeIds={new Set(members.map((m) => m.member_id))}
          onClose={() => setPickerOpen(false)}
          onPick={(rows) => { addMembers(rows); setPickerOpen(false) }}
        />
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-gray-50'

function Row({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4">
      <div className="pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}{required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function MemberPicker({ members, onRemove, onOpenPicker }: {
  members: MemberRow[]
  onRemove: (id: number) => void
  onOpenPicker: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpenPicker} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
          <Plus className="w-4 h-4" /> 회원 검색
        </button>
        <span className="text-xs text-gray-500">선택된 회원: {members.length}명</span>
      </div>
      {members.length > 0 && (
        <ul className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-800 max-h-[260px] overflow-y-auto">
          {members.map((m) => (
            <li key={m.member_id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{m.name}</div>
                <div className="text-xs text-gray-500 truncate">{m.mb_id ?? '—'}{m.phone ? ` · ${m.phone}` : ''}</div>
              </div>
              <button type="button" onClick={() => onRemove(m.member_id)} className="p-1 rounded hover:bg-rose-50 text-rose-500" aria-label="제거">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface CustomerSearchResp {
  items: CustomerSearchRow[]
  total: number
}

function MemberSearchModal({ excludeIds, onClose, onPick }: {
  excludeIds: Set<number>
  onClose: () => void
  onPick: (rows: CustomerSearchRow[]) => void
}) {
  const [q, setQ] = useState('')
  const [pending, setPending] = useState('')
  const [items, setItems] = useState<CustomerSearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const load = (term: string) => {
    setLoading(true); setErr(null)
    const params = new URLSearchParams()
    if (term) params.set('q', term)
    params.set('limit', '30')
    params.set('page', '1')
    api<CustomerSearchResp>(`/admin/members/customers?${params.toString()}`)
      .then((r) => setItems(r.items ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('') }, [])

  const toggle = (id: number) => setPicked((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const visible = useMemo(() => items.filter((it) => !excludeIds.has(it.id)), [items, excludeIds])

  const confirm = () => {
    const rows = visible.filter((r) => picked.has(r.id))
    onPick(rows)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">회원 검색</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={pending} onChange={(e) => setPending(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setQ(pending); load(pending) } }}
              placeholder="이름 / 아이디 / 닉네임 / 휴대폰"
              className={`pl-8 ${inputCls}`}
            />
          </div>
          <button type="button" onClick={() => { setQ(pending); load(pending) }} className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">검색</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-sm text-gray-500">조회 중...</div>}
          {err && <div className="p-3 m-4 rounded bg-rose-50 text-rose-700 text-sm">{err}</div>}
          {!loading && visible.length === 0 && <div className="p-6 text-sm text-gray-500 text-center">검색 결과가 없습니다.</div>}
          {!loading && visible.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/40 text-gray-600 sticky top-0">
                <tr>
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">아이디</th>
                  <th className="px-3 py-2 text-left">휴대폰</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer" onClick={() => toggle(r.id)}>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.mb_id ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500">{picked.size}명 선택됨{q ? ` · "${q}" 검색` : ''}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
            <button type="button" onClick={confirm} disabled={picked.size === 0} className="px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">선택 추가</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function toLocal(s: string): string {
  const dt = new Date(s); if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
