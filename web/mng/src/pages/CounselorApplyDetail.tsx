import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, FileText, X } from 'lucide-react'
import { api } from '../lib/api'
import { FILE_BASE } from '../lib/runtime-env'

/**
 * 상담사 신청 상세 — 사용자 가입 페이지에서 들어온 신청 1건을 펼쳐 보여준다.
 *   - 사진(프로필·와이드) / 사업자·계약서 미리보기
 *   - status 변경 (검토중 → 승인/반려/취소)
 *   - 실제 상담사 등록(승인 후 member·post_counselor 자동 생성)은 다음 단계 작업.
 */

interface ApplyDetail {
  id: number
  status: string
  category: string | null
  title: string
  content: string | null
  applicant_phone: string | null
  applicant_email: string | null
  is_secret: boolean
  view_count: number
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  member_role: string | null
  real_name: string | null
  pen_name: string | null
  field: string | null
  region: string | null
  has_profile_photo: boolean
  has_wide_photo: boolean
  contract_count: number
  extras: Record<string, unknown>
  created_at: string
  updated_at: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: '검토중',
  accepted: '승인',
  rejected: '반려',
  cancelled: '취소',
  superseded: '무효 (재신청됨)',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-gray-100 text-gray-600',
  superseded: 'bg-slate-100 text-slate-600',
}

interface ContractFile {
  url: string
  original_name: string
  size: number
}

export default function CounselorApplyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ApplyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [updatingTo, setUpdatingTo] = useState<string | null>(null)
  // 승인/반려 모달
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [approveBusy, setApproveBusy] = useState(false)
  const [rejectBusy, setRejectBusy] = useState(false)
  const [approveResult, setApproveResult] = useState<{
    member_id: number
    mb_id: string
    csrid: string | null
    m2net: { ok: boolean; error?: string }
  } | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api<ApplyDetail>(`/admin/counselor-apply/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false))
  }, [id])

  const changeStatus = async (next: string) => {
    if (!id || !data) return
    if (!window.confirm(`상태를 "${STATUS_LABEL[next] ?? next}" (으)로 변경하시겠습니까?`)) return
    setUpdatingTo(next)
    setError(null)
    setSuccess(null)
    try {
      await api(`/admin/counselor-apply/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      setData({ ...data, status: next })
      setSuccess(`상태가 "${STATUS_LABEL[next] ?? next}" (으)로 변경되었습니다.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경 실패')
    } finally {
      setUpdatingTo(null)
    }
  }

  const doApprove = async () => {
    if (!id || !data) return
    setApproveBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const r = await api<{
        ok: true
        member_id: number
        mb_id: string
        csrid: string | null
        m2net: { ok: boolean; error?: string }
      }>(`/admin/counselor-apply/${id}/approve`, { method: 'POST' })
      setApproveResult({
        member_id: r.member_id,
        mb_id: r.mb_id,
        csrid: r.csrid,
        m2net: r.m2net,
      })
      setData({ ...data, status: 'accepted' })
      setApproveOpen(false)
    } catch (e) {
      // 에러 메시지를 페이지 상단에 보여주기 위해 모달은 자동으로 닫음
      // (모달이 열려있으면 페이지 에러 박스가 가려서 사용자가 같은 버튼을 계속 누르게 됨)
      setApproveOpen(false)
      setError(e instanceof Error ? e.message : '승인 실패')
    } finally {
      setApproveBusy(false)
    }
  }

  const doReject = async () => {
    if (!id || !data) return
    if (!rejectReason.trim()) {
      setError('반려 사유를 입력해주세요.')
      return
    }
    setRejectBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await api(`/admin/counselor-apply/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      setData({ ...data, status: 'rejected' })
      setSuccess(`반려되었습니다. (사유: ${rejectReason.trim()})`)
      setRejectOpen(false)
      setRejectReason('')
    } catch (e) {
      setRejectOpen(false)
      setError(e instanceof Error ? e.message : '반려 실패')
    } finally {
      setRejectBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩 중…</div>
  if (error && !data) return <div className="p-6 text-sm text-rose-600">{error}</div>
  if (!data) return null

  const extras = data.extras
  const profileUrl = (extras.profile_photo_url as string | undefined) ?? null
  const profileUrlWebp = (extras.profile_photo_url_webp as string | undefined) ?? null
  const wideUrl = (extras.wide_photo_url as string | undefined) ?? null
  const wideUrlWebp = (extras.wide_photo_url_webp as string | undefined) ?? null
  const contracts = Array.isArray(extras.contract_files)
    ? (extras.contract_files as ContractFile[])
    : []
  const specialties = Array.isArray(extras.specialties)
    ? (extras.specialties as string[])
    : []
  const intro = (extras.intro as string | undefined) ?? data.content ?? ''
  const birth = (extras.birth as string | undefined) ?? null
  const applicantStatus = (extras.status as string | undefined) ?? null
  const applyMbId = (extras.mb_id as string | undefined) ?? null
  const hasPasswordHash = Boolean(extras.password_hash)

  return (
    <div className="space-y-2 max-w-[1000px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/members/counselor-apply')}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              상담사 신청 상세 #{data.id}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              신청일시 {formatDate(data.created_at)} · 조회 {data.view_count}회
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              STATUS_BADGE[data.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {STATUS_LABEL[data.status] ?? data.status}
          </span>
        </div>

        {/* 상태별 액션 버튼 — 상식 프로세스:
            pending (이미 상담사) : 버튼 숨김 — 취소처리만 노출
            pending     : 승인/반려/취소처리 (적극 처리)
            rejected/cancelled : "검토중으로" 복구만 (재검토용)
            accepted    : 변경 불가 (이미 계정/M2NET 생성됨)
            superseded  : 변경 불가 (더 최신 신청이 있음) */}
        <div className="flex items-center gap-2">
          {data.status === 'pending' && data.member_role === 'counselor' && (
            <button
              type="button"
              onClick={() => changeStatus('cancelled')}
              disabled={updatingTo !== null}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {updatingTo === 'cancelled' ? '변경 중…' : '취소처리 (중복 신청)'}
            </button>
          )}
          {data.status === 'pending' && data.member_role !== 'counselor' && (
            <>
              <button
                type="button"
                onClick={() => setApproveOpen(true)}
                disabled={updatingTo !== null || approveBusy}
                className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                승인
              </button>
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={updatingTo !== null || rejectBusy}
                className="px-3 py-1.5 text-xs rounded-md bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50"
              >
                반려
              </button>
              <button
                type="button"
                onClick={() => changeStatus('cancelled')}
                disabled={updatingTo !== null}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                {updatingTo === 'cancelled' ? '변경 중…' : '취소처리'}
              </button>
            </>
          )}
          {(data.status === 'rejected' || data.status === 'cancelled') && (
            <button
              type="button"
              onClick={() => changeStatus('pending')}
              disabled={updatingTo !== null}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {updatingTo === 'pending' ? '변경 중…' : '검토중으로 되돌리기'}
            </button>
          )}
        </div>
      </div>

      {/* 상태별 상단 안내 박스 — 어떤 상태에서 어떤 행동이 가능한지 한 줄로 */}
      {data.status === 'pending' && data.member_role === 'counselor' && (
        <div className="px-3 py-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-700 text-[12px] text-rose-800 dark:text-rose-300">
          🚫 <strong>이미 상담사로 등록된 회원의 중복 신청입니다.</strong>{' '}
          연동된 회원(<span className="font-mono font-semibold">{data.member_mb_id}</span>)이 이미{' '}
          {data.member_id ? (
            <Link to={`/members/counselors/${data.member_id}`} className="underline font-semibold text-rose-900 dark:text-rose-100">
              상담사 계정
            </Link>
          ) : (
            <strong>상담사 계정</strong>
          )}
          을 보유하고 있어 승인·반려 처리를 할 수 없습니다.
          {' '}<strong>취소처리</strong>로 이 신청을 닫아주세요.
        </div>
      )}
      {data.status === 'pending' && data.member_role !== 'counselor' && (
        <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-800 dark:text-amber-300">
          💡 승인 시 기본 단가 <strong>1,000원</strong>이 자동 설정됩니다.
          필요 시 승인 후 <strong>회원 상세 페이지</strong>에서 수정할 수 있습니다.
        </div>
      )}
      {data.status === 'superseded' && (
        <div className="px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 text-[12px] text-slate-700 dark:text-slate-300">
          🛈 <strong>이 신청서는 무효입니다.</strong>{' '}
          신청자가 같은 휴대폰 번호({data.applicant_phone ?? '-'})로 신청서를 한 번 더 냈기 때문에, 이 신청서로는 더 이상 승인·반려를 할 수 없습니다.
          {' '}처리해야 할 진짜 신청서는 같은 번호로 새로 들어온 신청서입니다 —{' '}
          <Link to="/members/counselor-apply" className="underline text-slate-900 dark:text-slate-100">신청 목록</Link>에서 같은 휴대폰 번호의 다른 신청서를 찾아 열어주세요.
        </div>
      )}
      {data.status === 'accepted' && (
        <div className="px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[12px] text-emerald-800 dark:text-emerald-300">
          ✓ <strong>이미 승인되어 상담사로 등록된 신청서</strong>입니다. 단가나 회원 정보를 고치려면{' '}
          {data.member_id ? (
            <Link to={`/members/counselors/${data.member_id}`} className="underline text-emerald-900 dark:text-emerald-100">상담사 회원 관리</Link>
          ) : (
            <strong>상담사 회원 관리</strong>
          )}
          에서 처리하세요.
        </div>
      )}
      {data.status === 'cancelled' && (
        <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-900/40 border border-gray-300 dark:border-gray-700 text-[12px] text-gray-700 dark:text-gray-300">
          🛈 <strong>취소된 신청서</strong>입니다. 다시 검토하시려면 위쪽 [검토중으로 되돌리기] 버튼을 눌러주세요.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm">
          {success}
        </div>
      )}

      {/* 승인 결과 패널 — 승인 직후 1회 노출. 새로고침 시 사라짐. */}
      {approveResult && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              ✓ 승인 완료 — 상담사 계정이 생성되었습니다
            </div>
            <button
              type="button"
              onClick={() => setApproveResult(null)}
              className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
            <div>
              <span className="font-medium">상담사 ID:</span>{' '}
              <span className="font-mono">{approveResult.mb_id}</span>
              <span className="text-emerald-600 dark:text-emerald-400 ml-2">
                (신청자가 입력한 비밀번호로 로그인 가능)
              </span>
            </div>
            <div>
              <span className="font-medium">엠투넷 연동:</span>{' '}
              {approveResult.m2net.ok ? (
                <span className="text-emerald-800 dark:text-emerald-200">
                  성공 (csrid: <span className="font-mono">{approveResult.csrid ?? '-'}</span>)
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">
                  실패 — {approveResult.m2net.error ?? '알 수 없음'}
                  <Link
                    to={`/members/counselors/${approveResult.member_id}`}
                    className="ml-2 underline"
                  >
                    상담사 수정 페이지에서 재연동
                  </Link>
                </span>
              )}
            </div>
            <Link
              to={`/members/counselors/${approveResult.member_id}`}
              className="inline-block mt-1 text-emerald-800 dark:text-emerald-200 underline font-medium"
            >
              상담사 상세로 이동 →
            </Link>
          </div>
        </div>
      )}

      {/* 반려 사유 — status=rejected 일 때 노출 */}
      {data.status === 'rejected' && extras.rejection_reason && (
        <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-300">
          <span className="font-semibold">반려 사유: </span>
          {String(extras.rejection_reason)}
        </div>
      )}

      {/* 1) 신청자 정보 */}
      <Section title="신청자 정보">
        <Row label="제목">{data.title}</Row>
        <Row label="신청구분">{applicantStatus ?? '-'}</Row>
        <Row label="아이디">
          {applyMbId ? (
            <span className="font-mono text-xs">{applyMbId}</span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </Row>
        <Row label="비밀번호">
          {hasPasswordHash ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-xs tracking-widest">••••••••</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                설정됨 (암호화 저장)
              </span>
            </span>
          ) : (
            <span className="text-rose-500 text-xs">미설정</span>
          )}
        </Row>
        <Row label="예명">{data.pen_name ?? '-'}</Row>
        <Row label="실명">{data.real_name ?? '-'}</Row>
        <Row label="생년월일">{birth ?? '-'}</Row>
        <Row label="지역">{data.region ?? '-'}</Row>
        <Row label="휴대폰">
          <span className="font-mono text-xs">{data.applicant_phone ?? '-'}</span>
        </Row>
        <Row label="이메일">{data.applicant_email ?? '-'}</Row>
        <Row label="회원 연동">
          {data.member_id ? (
            <Link
              to={`/members/customers/${data.member_id}`}
              className="text-brand-600 hover:underline inline-flex items-center gap-1"
            >
              {data.member_mb_id ?? data.member_name ?? `#${data.member_id}`}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <span className="text-gray-400">비회원</span>
          )}
        </Row>
      </Section>

      {/* 2) 상담 정보 */}
      <Section title="상담 정보">
        <Row label="상담분야">{data.field ?? '-'}</Row>
        <Row label="전문 상담분야" fullWidth>
          {specialties.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs dark:bg-brand-900/30 dark:text-brand-300"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </Row>
        <Row label="본인 소개" fullWidth>
          {intro ? (
            <div
              className="apply-intro text-sm text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </Row>
      </Section>

      {/* 3) 첨부 사진 */}
      <Section title="첨부 사진">
        <Row label="프로필 사진" fullWidth>
          {profileUrl ? (
            <a
              href={FILE_BASE + profileUrl}
              target="_blank"
              rel="noreferrer"
              title="원본 보기 (새 탭)"
              className="inline-block"
            >
              <picture>
                {profileUrlWebp && <source srcSet={FILE_BASE + profileUrlWebp} type="image/webp" />}
                <img
                  src={FILE_BASE + profileUrl}
                  alt="프로필"
                  style={{ width: 200, height: 200, objectFit: 'cover' }}
                  className="border border-gray-200 dark:border-gray-700 rounded"
                />
              </picture>
            </a>
          ) : (
            <span className="text-gray-400 text-sm">등록 안됨</span>
          )}
        </Row>
        <Row label="와이드 사진" fullWidth>
          {wideUrl ? (
            <a
              href={FILE_BASE + wideUrl}
              target="_blank"
              rel="noreferrer"
              title="원본 보기 (새 탭)"
              className="inline-block"
            >
              <picture>
                {wideUrlWebp && <source srcSet={FILE_BASE + wideUrlWebp} type="image/webp" />}
                <img
                  src={FILE_BASE + wideUrl}
                  alt="와이드"
                  style={{ width: 390, height: 192, objectFit: 'cover' }}
                  className="border border-gray-200 dark:border-gray-700 rounded"
                />
              </picture>
            </a>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
              승인 후 별도 등록 — 메인 배너용 마케팅 자료 (신청 단계 미수집 항목)
            </span>
          )}
        </Row>
      </Section>

      {/* 4) 사업자 / 계약 관련 파일 */}
      <Section title="사업자 / 계약 관련 파일">
        <Row label={`첨부 (${contracts.length}건)`} fullWidth>
          {contracts.length === 0 ? (
            <span className="text-gray-400 text-sm">첨부 없음</span>
          ) : (
            <ul className="space-y-2">
              {contracts.map((f, i) => {
                const isImage = /\.(jpe?g|png|gif|webp)$/i.test(f.original_name)
                const isPdf = /\.pdf$/i.test(f.original_name)
                return (
                  <li
                    key={`${f.url}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 rounded border border-gray-200 dark:border-gray-700"
                  >
                    {isImage ? (
                      <a href={FILE_BASE + f.url} target="_blank" rel="noreferrer">
                        <img
                          src={FILE_BASE + f.url}
                          alt={f.original_name}
                          className="w-16 h-16 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-80"
                        />
                      </a>
                    ) : (
                      <span className="w-16 h-16 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-[11px] font-mono text-gray-500">
                        {isPdf ? 'PDF' : 'FILE'}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <a
                        href={FILE_BASE + f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand-600 hover:underline truncate inline-flex items-center gap-1"
                        title={f.original_name}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{f.original_name}</span>
                      </a>
                      <div className="text-[11px] text-gray-400">{formatBytes(f.size)}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Row>
      </Section>

      {/* 승인 확인 모달 */}
      {approveOpen && (
        <Modal onClose={() => !approveBusy && setApproveOpen(false)}>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
            상담사로 승인하시겠습니까?
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
            승인 시 신청서의 ID/PW로 상담사 계정이 자동 생성되고 엠투넷 연동이 시도됩니다.
            신청자가 즉시 상담사 로그인을 사용할 수 있습니다.
          </p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-5 pl-4 list-disc">
            <li>상담사 ID: <span className="font-mono">{String(extras.mb_id ?? '-')}</span></li>
            <li>예명 (nickname): {data.pen_name ?? '-'}</li>
            <li>실명: {data.real_name ?? '-'}</li>
            <li>분야: {data.field ?? '-'}</li>
            <li>첨부 사진/계약서가 상담사 폴더로 자동 이관됩니다.</li>
          </ul>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setApproveOpen(false)}
              disabled={approveBusy}
              className="px-4 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={doApprove}
              disabled={approveBusy}
              className="px-4 py-2 text-sm rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
            >
              {approveBusy ? '승인 처리 중…' : '승인하기'}
            </button>
          </div>
        </Modal>
      )}

      {/* 반려 사유 입력 모달 */}
      {rejectOpen && (
        <Modal onClose={() => !rejectBusy && setRejectOpen(false)}>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
            반려 사유를 입력해주세요
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            사유는 신청 기록에 저장되어 관리자만 확인할 수 있습니다. (신청자에게 자동 발송되지 않음)
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="예: 사진 재제출 필요 / 자격 부적합 / 정보 불일치 …"
            rows={4}
            className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false)
                setRejectReason('')
              }}
              disabled={rejectBusy}
              className="px-4 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={doReject}
              disabled={rejectBusy || !rejectReason.trim()}
              className="px-4 py-2 text-sm rounded-md bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50"
            >
              {rejectBusy ? '반려 처리 중…' : '반려하기'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>
      <div className="px-4 grid grid-cols-1 lg:grid-cols-2 gap-x-8">{children}</div>
    </div>
  )
}

function Row({
  label,
  children,
  fullWidth,
}: {
  label: string
  children: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[100px_1fr] gap-2 md:gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
        fullWidth ? 'lg:col-span-2' : ''
      }`}
    >
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
      </div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
}
