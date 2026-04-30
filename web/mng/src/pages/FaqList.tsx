import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/faqmasterlist.php (카테고리) + faqlist.php (항목) 통합.
 *
 * 카테고리 (faq_category)
 *   - title (제목), display_order, is_active
 * 항목 (faq)
 *   - category_id, question, answer, display_order, is_active
 */

interface Category {
  id: number
  title: string
  head_html: string | null
  tail_html: string | null
  display_order: number
  is_active: boolean
  faq_count: number
  created_at: string
}

interface Faq {
  id: number
  category_id: number | null
  category_title: string | null
  question: string
  answer: string | null
  display_order: number
  view_count: number
  is_active: boolean
  created_at: string
}

export default function FaqList() {
  const [cats, setCats] = useState<Category[]>([])
  const [faqsByCat, setFaqsByCat] = useState<Record<number, Faq[]>>({})
  const [openCat, setOpenCat] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 카테고리 추가/수정 모달
  const [catModal, setCatModal] = useState<Partial<Category> | null>(null)
  // FAQ 추가/수정 모달 (categoryId만 필수, id 없으면 신규)
  const [faqModal, setFaqModal] = useState<{ categoryId: number; id?: number; question?: string; answer?: string; display_order?: number; is_active?: boolean } | null>(null)

  const loadCats = async () => {
    setLoading(true); setError(null)
    try {
      const r = await api<{ items: Category[] }>('/admin/faqs/categories')
      setCats(r.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '카테고리 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const loadFaqs = async (categoryId: number) => {
    try {
      const r = await api<{ items: Faq[] }>(`/admin/faqs?category_id=${categoryId}`)
      setFaqsByCat((m) => ({ ...m, [categoryId]: r.items }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FAQ 로드 실패')
    }
  }

  useEffect(() => { void loadCats() }, [])

  const toggleCat = async (id: number) => {
    const next = !openCat[id]
    setOpenCat((m) => ({ ...m, [id]: next }))
    if (next && !faqsByCat[id]) await loadFaqs(id)
  }

  const onSaveCat = async () => {
    if (!catModal) return
    if (!catModal.title?.trim()) return setError('제목을 입력하세요.')
    try {
      if (catModal.id) {
        await api(`/admin/faqs/categories/${catModal.id}`, { method: 'PATCH', body: JSON.stringify(catModal) })
        setSuccess('카테고리 수정 완료')
      } else {
        await api('/admin/faqs/categories', { method: 'POST', body: JSON.stringify(catModal) })
        setSuccess('카테고리 등록 완료')
      }
      setCatModal(null)
      await loadCats()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const onDeleteCat = async (c: Category) => {
    if (!confirm(`"${c.title}" 카테고리를 삭제하시겠습니까? (포함된 FAQ도 모두 삭제됨)`)) return
    try {
      await api(`/admin/faqs/categories/${c.id}`, { method: 'DELETE' })
      setSuccess('카테고리 삭제 완료')
      await loadCats()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const onSaveFaq = async () => {
    if (!faqModal) return
    if (!faqModal.question?.trim()) return setError('질문을 입력하세요.')
    try {
      const payload = {
        category_id: faqModal.categoryId,
        question: faqModal.question,
        answer: faqModal.answer ?? '',
        display_order: faqModal.display_order ?? 0,
        is_active: faqModal.is_active ?? true,
      }
      if (faqModal.id) {
        await api(`/admin/faqs/${faqModal.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setSuccess('FAQ 수정 완료')
      } else {
        await api('/admin/faqs', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('FAQ 등록 완료')
      }
      setFaqModal(null)
      await loadFaqs(faqModal.categoryId)
      await loadCats()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const onDeleteFaq = async (f: Faq) => {
    if (!confirm(`"${f.question}" FAQ를 삭제하시겠습니까?`)) return
    try {
      await api(`/admin/faqs/${f.id}`, { method: 'DELETE' })
      setSuccess('FAQ 삭제 완료')
      if (f.category_id) await loadFaqs(f.category_id)
      await loadCats()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">FAQ 관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">자주하시는 질문 카테고리 + 상세 항목</p>
        </div>
        <button onClick={() => setCatModal({ title: '', display_order: 0, is_active: true })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="w-4 h-4" /> FAQ 카테고리 추가
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>}

      {loading ? (
        <div className="p-6 text-sm text-gray-500">로딩...</div>
      ) : cats.length === 0 ? (
        <div className="p-6 text-sm text-gray-400 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          카테고리가 없습니다. 우측 상단 "FAQ 카테고리 추가" 버튼으로 시작하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {cats.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-brand-600 text-white">
                <button onClick={() => toggleCat(c.id)} className="flex items-center gap-2 flex-1 text-left">
                  {openCat[c.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-semibold text-sm">{c.title}</span>
                  <span className="text-xs opacity-80">({c.faq_count}건)</span>
                  {!c.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">비노출</span>}
                </button>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setFaqModal({ categoryId: c.id, question: '', answer: '', display_order: 0, is_active: true })} className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25">
                    + 항목
                  </button>
                  <button onClick={() => setCatModal(c)} className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25">수정</button>
                  <button onClick={() => onDeleteCat(c)} className="text-xs px-2 py-1 rounded bg-rose-500/80 hover:bg-rose-500">삭제</button>
                </div>
              </div>
              {openCat[c.id] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 text-[11px] text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium w-12">번호</th>
                        <th className="px-4 py-2 text-left font-medium">질문</th>
                        <th className="px-4 py-2 text-left font-medium w-16">순서</th>
                        <th className="px-4 py-2 text-left font-medium w-16">노출</th>
                        <th className="px-4 py-2 text-right font-medium whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(faqsByCat[c.id] ?? []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">자료가 없습니다.</td></tr>
                      ) : (
                        faqsByCat[c.id].map((f, i) => (
                          <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-2 text-xs text-gray-500">{i + 1}</td>
                            <td className="px-4 py-2 max-w-[600px] truncate">{f.question}</td>
                            <td className="px-4 py-2 text-xs text-gray-500">{f.display_order}</td>
                            <td className="px-4 py-2">
                              {f.is_active ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">노출</span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">비노출</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <button onClick={() => setFaqModal({ categoryId: c.id, ...f })} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 mr-1">
                                <Pencil className="w-3.5 h-3.5" /> 수정
                              </button>
                              <button onClick={() => onDeleteFaq(f)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-rose-200 text-rose-700 hover:bg-rose-50">
                                <Trash2 className="w-3.5 h-3.5" /> 삭제
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 카테고리 모달 */}
      {catModal && (
        <Modal title={catModal.id ? 'FAQ 카테고리 수정' : 'FAQ 카테고리 추가'} onClose={() => setCatModal(null)} onSave={onSaveCat}>
          <Field label="제목 *">
            <input type="text" value={catModal.title ?? ''} onChange={(e) => setCatModal({ ...catModal, title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="순서">
            <input type="number" value={catModal.display_order ?? 0} onChange={(e) => setCatModal({ ...catModal, display_order: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="노출">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={catModal.is_active ?? true} onChange={(e) => setCatModal({ ...catModal, is_active: e.target.checked })} /> 사용자에게 노출</label>
          </Field>
        </Modal>
      )}

      {/* FAQ 항목 모달 */}
      {faqModal && (
        <Modal title={faqModal.id ? 'FAQ 항목 수정' : 'FAQ 항목 추가'} onClose={() => setFaqModal(null)} onSave={onSaveFaq}>
          <Field label="질문 *">
            <input type="text" value={faqModal.question ?? ''} onChange={(e) => setFaqModal({ ...faqModal, question: e.target.value })} className={inputCls} />
          </Field>
          <Field label="답변">
            <textarea rows={8} value={faqModal.answer ?? ''} onChange={(e) => setFaqModal({ ...faqModal, answer: e.target.value })} className={`${inputCls} font-mono text-xs`} />
          </Field>
          <Field label="순서">
            <input type="number" value={faqModal.display_order ?? 0} onChange={(e) => setFaqModal({ ...faqModal, display_order: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="노출">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={faqModal.is_active ?? true} onChange={(e) => setFaqModal({ ...faqModal, is_active: e.target.checked })} /> 사용자에게 노출</label>
          </Field>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-xl w-[92%] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold">{title}</div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
          <button onClick={onSave} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white">저장</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'
