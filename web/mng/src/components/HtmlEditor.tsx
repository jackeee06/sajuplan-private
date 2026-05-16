import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Editor } from '@toast-ui/react-editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import { API_BASE, FILE_BASE } from '../lib/runtime-env'

export interface HtmlEditorHandle {
  /** 현재 본문 HTML 가져오기 */
  getHTML(): string
  /** HTML 본문 설정 (외부에서 reset/load 시 사용) */
  setHTML(html: string): void
}

interface Props {
  /** 초기 HTML — 마운트 후 외부 변경은 setHTML 으로 명시적으로 반영 */
  initialHtml?: string
  height?: string
  /**
   * 본문 인라인 이미지 업로드용 엔드포인트.
   *  - multipart/form-data, field name = 'file'
   *  - 응답 { image_url: '/uploads/...', image_url_webp?: '/uploads/...' }
   *  생략 시 /admin/events/upload 사용 (event 폼 기본값).
   */
  uploadEndpoint?: string
}

/**
 * Toast UI Editor 래퍼 (마크다운 + WYSIWYG).
 *
 * - `initialEditType: 'wysiwyg'` 으로 어드민 기본 모드는 위지윅 (마크다운 탭 전환 가능).
 * - 본문 이미지: 툴바 이미지 버튼 → addImageBlobHook 으로 백엔드 업로드 →
 *   에디터에 절대 URL 로 삽입 (사용자/어드민 양쪽에서 같은 호스트로 노출됨).
 * - 외부에서 ref.getHTML() 로 저장 시 본문 HTML 만 추출 (마크다운 모드여도 HTML 반환).
 */
const HtmlEditor = forwardRef<HtmlEditorHandle, Props>(function HtmlEditor(
  { initialHtml = '', height = '480px', uploadEndpoint = '/admin/events/upload' },
  ref,
) {
  const editorRef = useRef<Editor>(null)

  useImperativeHandle(ref, () => ({
    getHTML: () => editorRef.current?.getInstance().getHTML() ?? '',
    setHTML: (html) => editorRef.current?.getInstance().setHTML(html),
  }))

  // initialValue 는 마운트 시점만 반영됨 — 비동기로 fetch 한 데이터를 나중에 채울 땐
  // 외부에서 ref.setHTML 로 호출해야 한다.
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
      hideModeSwitch={true}
      toolbarItems={[
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task'],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
      ]}
      hooks={{
        addImageBlobHook: async (blob, callback) => {
          try {
            const fd = new FormData()
            fd.append('file', blob)
            const res = await fetch(`${API_BASE}${uploadEndpoint}`, {
              method: 'POST',
              credentials: 'include',
              body: fd,
            })
            if (!res.ok) throw new Error(`업로드 실패 (${res.status})`)
            const j = (await res.json()) as { image_url: string }
            const url = j.image_url.startsWith('http')
              ? j.image_url
              : `${FILE_BASE}${j.image_url}`
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
