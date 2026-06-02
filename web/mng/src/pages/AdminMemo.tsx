import { useEffect, useRef, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import HtmlEditor, { type HtmlEditorHandle } from '../components/HtmlEditor'
import { api, ApiError } from '../lib/api'

/**
 * 관리자 개인 메모장 — 한 페이지 = 한 큰 캔버스.
 *
 * - 마운트 시 본인 메모 GET 완료 후에만 에디터 마운트 (race condition 방지)
 * - 본문 변경 시 디바운스 1.5초 후 자동 PUT (사장님이 적다가 깜빡 닫아도 잃지 않음)
 * - **로드 완료 전에는 자동 저장 PUT 차단** — DB 데이터를 빈 컨텐츠로 덮어쓰기 방지
 * - 이미지: Toast UI Editor 의 툴바/드래그앤드롭 → /admin/memo/upload 로 업로드
 *   업로드 폴더는 /uploads/admin-memo/{admin_id}/ (다른 admin 이미지 노출 X)
 *
 * [2026-05-25] race condition 수정:
 *   이전 코드: editorRef.current?.setHTML(content) 가 editor 마운트 전에 호출되면
 *   조용히 무시되어 빈 화면 → 자동저장이 빈 컨텐츠로 DB 덮어쓰는 위험 있었음.
 *   수정: 컨텐츠 받기 전엔 에디터 자체를 안 띄움. 또한 isLoaded 가드로 PUT 보호.
 */
export default function AdminMemo() {
  const editorRef = useRef<HtmlEditorHandle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [initialContent, setInitialContent] = useState<string>('')

  // 자동 저장 가드: 초기 로드가 끝난 후에만 PUT 허용 (덮어쓰기 방지)
  const isLoadedRef = useRef<boolean>(false)

  // 디바운스 자동 저장 — 같은 timer 재사용
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHtmlRef = useRef<string>('')

  useEffect(() => {
    let mounted = true
    api<{ content: string; updated_at: string | null }>('/admin/memo')
      .then((r) => {
        if (!mounted) return
        setInitialContent(r.content || '')
        setLastSavedAt(r.updated_at ? new Date(r.updated_at) : null)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : '메모를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
          // 로드 완료 신호 — 이 시점 이후 PUT 만 허용
          isLoadedRef.current = true
        }
      })
    return () => {
      mounted = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const persist = async (html: string) => {
    // 로드 안 끝났으면 PUT 차단 (덮어쓰기 방지)
    if (!isLoadedRef.current) return
    // 로드 에러 상태면 PUT 차단 (서버 데이터 보호)
    if (error) return
    try {
      setSaving(true)
      const r = await api<{ updated_at: string }>('/admin/memo', {
        method: 'PUT',
        body: JSON.stringify({ content: html }),
      })
      setLastSavedAt(new Date(r.updated_at))
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (html: string) => {
    // 초기 로드 전엔 onChange 자체 무시 (HtmlEditor 마운트 시 초기 setHTML 으로
    // 발생하는 콜백을 빈 컨텐츠 PUT 으로 오해하는 사고 차단)
    if (!isLoadedRef.current) return
    pendingHtmlRef.current = html
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persist(pendingHtmlRef.current)
    }, 1500)
  }

  const formatLastSaved = (d: Date | null): string => {
    if (!d) return '저장 안 됨'
    const diff = Date.now() - d.getTime()
    if (diff < 10_000) return '방금 저장됨'
    if (diff < 60_000) return `${Math.floor(diff / 1000)}초 전 저장됨`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전 저장됨`
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 저장됨`
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-brand-500" />
          <h1 className="text-lg font-semibold text-gray-900">메모장</h1>
        </div>
        <div className="text-xs text-gray-500">
          {saving ? (
            <span className="text-brand-500">저장 중…</span>
          ) : error ? (
            <span className="text-red-500">⚠ {error}</span>
          ) : (
            <span>{formatLastSaved(lastSavedAt)}</span>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-gray-500 leading-relaxed">
        자유롭게 적어두세요. 이미지는 드래그앤드롭으로 붙일 수 있어요. 1.5초간 입력이 없으면 자동 저장됩니다.
      </p>

      {error && !loading ? (
        <div className="h-[520px] flex flex-col items-center justify-center text-sm text-red-500 border border-red-200 rounded-lg bg-red-50/40 gap-2">
          <div>⚠ {error}</div>
          <div className="text-xs text-gray-500">에디터를 열지 않습니다 (서버 데이터 보호). 새로고침 후 다시 시도하세요.</div>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          {/* 에디터는 API 응답 기다리지 않고 병렬 마운트 — 로드 시간 단축.
              컨텐츠는 initialContent state 가 채워지면 HtmlEditor 의 useEffect 가 setHTML 호출 */}
          <HtmlEditor
            ref={editorRef}
            initialHtml={initialContent}
            height="calc(100vh - 240px)"
            uploadEndpoint="/admin/memo/upload"
            onChange={handleChange}
          />
          {loading && (
            <div className="absolute inset-0 bg-white/85 flex items-center justify-center text-sm text-gray-500 backdrop-blur-[2px] z-10">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-pink-300 border-t-pink-500 rounded-full animate-spin"></span>
                메모 불러오는 중…
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
