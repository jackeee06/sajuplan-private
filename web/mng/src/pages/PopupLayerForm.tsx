import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { api } from '../lib/api'
import UploadedImage from '../components/UploadedImage'
import { FILE_BASE } from '../lib/runtime-env'

interface PopupLayer {
  id: number
  device: string
  starts_at: string
  ends_at: string
  disable_hours: number
  pos_left: number
  pos_top: number
  size_width: number
  size_height: number
  title: string
  content: string
  is_html: boolean
  image_url: string | null
  image_url_webp: string | null
  link_url: string | null
  is_active: boolean
}

const API_BASE = FILE_BASE

const empty = (): PopupLayer => {
  const now = new Date()
  const week = new Date(now.getTime() + 7 * 24 * 3600_000)
  return {
    id: 0,
    device: 'both',
    starts_at: toLocalInput(now),
    ends_at: toLocalInput(week),
    disable_hours: 24,
    pos_left: 10,
    pos_top: 10,
    size_width: 450,
    size_height: 500,
    title: '',
    content: '',
    is_html: true,
    image_url: null,
    image_url_webp: null,
    link_url: '',
    is_active: true,
  }
}

export default function PopupLayerForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [data, setData] = useState<PopupLayer | null>(isNew ? empty() : null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // 등록 전 선택한 파일은 메모리에 들고 있다가 등록 직후 업로드
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    api<PopupLayer>(`/admin/popup-layers/${id}`)
      .then((p) => setData({ ...p, starts_at: toLocalInput(p.starts_at), ends_at: toLocalInput(p.ends_at) }))
      .catch((e) => setError(e.message))
  }, [id, isNew])

  // 미리보기 URL 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    }
  }, [pendingPreview])

  const set = <K extends keyof PopupLayer>(k: K, v: PopupLayer[K]) =>
    setData((d) => (d ? { ...d, [k]: v } : d))

  const uploadImage = async (
    popupId: number,
    file: File,
  ): Promise<{ image_url: string | null; image_url_webp: string | null }> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_BASE}/api/admin/popup-layers/${popupId}/image`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.message ?? `이미지 업로드 실패 (${res.status})`)
    }
    const updated = (await res.json()) as PopupLayer
    return { image_url: updated.image_url, image_url_webp: updated.image_url_webp }
  }

  const onSave = async () => {
    if (!data) return
    if (!data.title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...data,
        starts_at: new Date(data.starts_at).toISOString(),
        ends_at: new Date(data.ends_at).toISOString(),
      }
      if (isNew) {
        const created = await api<PopupLayer>('/admin/popup-layers', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (pendingFile) {
          await uploadImage(created.id, pendingFile)
        }
        navigate('/popup-layers')
      } else {
        await api(`/admin/popup-layers/${data.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        if (pendingFile) {
          await uploadImage(data.id, pendingFile)
        }
        navigate('/popup-layers')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const onSelectFile = async (file: File) => {
    setError(null)
    // 신규(미저장)이거나, 기존 데이터에서 파일을 새로 골랐을 때 일단 미리보기로 메모리에 보관
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    const url = URL.createObjectURL(file)
    setPendingPreview(url)
    setPendingFile(file)

    // 이미 저장된 팝업이라면 즉시 업로드 (UX: 결과 빠르게 반영)
    if (data?.id) {
      setUploading(true)
      try {
        const { image_url, image_url_webp } = await uploadImage(data.id, file)
        set('image_url', image_url)
        set('image_url_webp', image_url_webp)
        // 즉시 반영됐으니 pending 해제
        URL.revokeObjectURL(url)
        setPendingPreview(null)
        setPendingFile(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : '업로드 실패')
      } finally {
        setUploading(false)
      }
    }
  }

  const removeImage = () => {
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview)
      setPendingPreview(null)
      setPendingFile(null)
    }
    set('image_url', null)
    set('image_url_webp', null)
  }

  if (!data) return <div className="p-6 text-sm text-gray-500">{error ?? '로딩...'}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/popup-layers')}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {isNew ? '팝업 추가' : `팝업 수정 #${data.id}`}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              초기화면에 자동 노출되는 팝업레이어 설정
            </p>
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
        >
          {saving ? '저장 중...' : isNew ? '등록' : '저장'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
        <Row label="제목" required>
          <input
            type="text"
            value={data.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputCls}
          />
        </Row>

        <Row label="활성">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-xs text-gray-500">{data.is_active ? '노출' : '중지'}</span>
          </label>
        </Row>

        <Row label="대상 기기">
          <select
            value={data.device}
            onChange={(e) => set('device', e.target.value)}
            className={inputCls}
          >
            <option value="both">PC + 모바일</option>
            <option value="pc">PC</option>
            <option value="mobile">모바일</option>
          </select>
        </Row>

        <Row label="시작일시" required>
          <input
            type="datetime-local"
            value={data.starts_at}
            onChange={(e) => set('starts_at', e.target.value)}
            className={inputCls}
          />
        </Row>

        <Row label="종료일시" required>
          <input
            type="datetime-local"
            value={data.ends_at}
            onChange={(e) => set('ends_at', e.target.value)}
            className={inputCls}
          />
        </Row>

        <Row label="다시 보지 않기 (시간)" hint='고객이 "오늘 그만보기" 선택 시 차단 시간'>
          <input
            type="number"
            value={data.disable_hours}
            onChange={(e) => set('disable_hours', Number(e.target.value))}
            className={inputCls + ' w-32'}
          />
        </Row>

        <Row label="위치/크기 (px)">
          <div className="grid grid-cols-4 gap-2">
            <NumInput label="left" value={data.pos_left} onChange={(v) => set('pos_left', v)} />
            <NumInput label="top" value={data.pos_top} onChange={(v) => set('pos_top', v)} />
            <NumInput label="width" value={data.size_width} onChange={(v) => set('size_width', v)} />
            <NumInput label="height" value={data.size_height} onChange={(v) => set('size_height', v)} />
          </div>
        </Row>

        <Row label="이미지" hint="JPG/PNG/GIF/WebP, 최대 5MB">
          <div className="flex items-start gap-4">
            {pendingPreview || data.image_url ? (
              <div className="relative">
                {pendingPreview ? (
                  <img
                    src={pendingPreview}
                    alt=""
                    className="w-32 h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <UploadedImage
                    src={data.image_url}
                    srcWebp={data.image_url_webp}
                    alt=""
                    className="w-32 h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                  />
                )}
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-1 -right-1 p-1 rounded-full bg-rose-500 text-white hover:bg-rose-600"
                  title="이미지 제거"
                >
                  <X className="w-3 h-3" />
                </button>
                {pendingFile && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-500 text-white">
                    저장 시 업로드
                  </span>
                )}
              </div>
            ) : (
              <div className="w-32 h-32 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400">
                <span className="text-xs">이미지 없음</span>
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <Upload className="w-4 h-4" />
              {uploading ? '업로드 중...' : '이미지 선택'}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onSelectFile(f)
                  e.target.value = '' // 같은 파일 재선택 가능
                }}
                className="hidden"
              />
            </label>
          </div>
        </Row>

        <Row label="클릭 이동 URL">
          <input
            type="text"
            value={data.link_url ?? ''}
            onChange={(e) => set('link_url', e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Row>

        <Row label="HTML 본문 사용">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.is_html}
              onChange={(e) => set('is_html', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-xs text-gray-500">{data.is_html ? 'HTML 그대로 노출' : '일반 텍스트'}</span>
          </label>
        </Row>

        <Row label="본문" hint="이미지 외 추가 본문이 필요할 때 사용">
          <textarea
            value={data.content}
            onChange={(e) => set('content', e.target.value)}
            rows={6}
            className={inputCls + ' font-mono text-xs'}
          />
        </Row>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6">
      <div className="pt-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      />
    </div>
  )
}

function toLocalInput(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
