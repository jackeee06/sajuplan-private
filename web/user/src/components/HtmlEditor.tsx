import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Editor } from '@toast-ui/react-editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import { API_BASE, FILE_BASE } from '../lib/runtime-env'

export interface HtmlEditorHandle {
  getHTML(): string
  setHTML(html: string): void
}

type UploadResponse =
  | { image_url: string; image_url_webp?: string | null }
  | { url: string; url_webp?: string | null }

interface Props {
  initialHtml?: string
  height?: string
  /**
   * 본문 인라인 이미지 업로드 엔드포인트 (API_BASE 기준 상대경로).
   * 응답은 { url } 또는 { image_url } 둘 다 허용.
   * 기본값은 사용자 신청 폼 업로드(/user/counselor-apply/upload?kind=profile) —
   * 비로그인에서도 호출 가능. multipart field 명은 'file'.
   */
  uploadEndpoint?: string
}

/**
 * 사용자 앱용 Toast UI Editor 래퍼 — 관리자(mng)의 HtmlEditor 와 동일한 UX.
 * 회원 본인 소개 / 상담사 신청 본문 등 HTML 입력에 사용.
 */
const HtmlEditor = forwardRef<HtmlEditorHandle, Props>(function HtmlEditor(
  {
    initialHtml = '',
    height = '320px',
    uploadEndpoint = '/user/counselor-apply/upload?kind=profile',
  },
  ref,
) {
  const editorRef = useRef<Editor>(null)

  useImperativeHandle(ref, () => ({
    getHTML: () => editorRef.current?.getInstance().getHTML() ?? '',
    setHTML: (html) => editorRef.current?.getInstance().setHTML(html),
  }))

  useEffect(() => {
    const inst = editorRef.current?.getInstance()
    if (inst && initialHtml && inst.getHTML() !== initialHtml) {
      inst.setHTML(initialHtml)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml])

  return (
    <Editor
      ref={editorRef}
      initialValue={initialHtml || ' '}
      previewStyle="vertical"
      height={height}
      initialEditType="wysiwyg"
      useCommandShortcut
      hideModeSwitch={false}
      toolbarItems={[
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task'],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
      ]}
      hooks={{
        addImageBlobHook: async (blob: Blob, callback: (url: string, text: string) => void) => {
          try {
            const fd = new FormData()
            fd.append('file', blob)
            const res = await fetch(`${API_BASE}${uploadEndpoint}`, {
              method: 'POST',
              credentials: 'include',
              body: fd,
            })
            if (!res.ok) throw new Error(`업로드 실패 (${res.status})`)
            const j = (await res.json()) as UploadResponse
            const raw = 'image_url' in j ? j.image_url : j.url
            const url = raw.startsWith('http') ? raw : `${FILE_BASE}${raw}`
            callback(url, '')
          } catch (e) {
            window.alert(e instanceof Error ? e.message : '이미지 업로드 실패')
          }
        },
      }}
    />
  )
})

export default HtmlEditor
