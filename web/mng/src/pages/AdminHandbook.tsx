import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Search, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'

/**
 * 운영 바이블 (Handbook) — 채팅·결제 등 핵심 정책을 관리자가 운영 중 즉시 참조하는 페이지.
 *
 * 자료 원천: 저장소의 _HANDBOOK/ md 파일들.
 * 백엔드: /api/admin/handbook/{index,item,search}
 *
 * 좌측: 카테고리 트리 + 항목 클릭
 * 우측: 선택된 항목의 마크다운 본문
 * 상단: 자연어 질문 검색창 (키워드 매칭 — Phase 1)
 */

interface HandbookItem {
  slug: string
  title: string
  tags: string[]
  available?: boolean
}

interface HandbookCategory {
  key: string
  title: string
  icon: string
  order: number
  items: HandbookItem[]
}

interface HandbookIndex {
  categories: HandbookCategory[]
}

interface SearchHit {
  slug: string
  title: string
  category: string
  score: number
  snippet: string
}

interface ItemDetail {
  slug: string
  title: string
  markdown: string
}

export default function AdminHandbook() {
  const [index, setIndex] = useState<HandbookIndex>({ categories: [] })
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<SearchHit[] | null>(null)

  // 인덱스 로딩
  useEffect(() => {
    api<HandbookIndex>('/admin/handbook/index')
      .then((data) => {
        setIndex(data)
        // 첫 "available" 항목 자동 선택 (콘텐츠 작성된 것만)
        for (const cat of data.categories) {
          const ready = cat.items.find((it) => it.available !== false)
          if (ready) {
            setSelectedSlug(ready.slug)
            return
          }
        }
      })
      .catch(() => {
        setIndex({ categories: [] })
      })
  }, [])

  // 본문 로딩
  useEffect(() => {
    if (!selectedSlug) {
      setItem(null)
      return
    }
    setLoading(true)
    api<ItemDetail>(`/admin/handbook/item?slug=${encodeURIComponent(selectedSlug)}`)
      .then(setItem)
      .catch(() => setItem(null))
      .finally(() => setLoading(false))
  }, [selectedSlug])

  const onSearch = async () => {
    const q = query.trim()
    if (!q) {
      setHits(null)
      return
    }
    setSearching(true)
    try {
      const res = await api<{ query: string; hits: SearchHit[] }>(
        `/admin/handbook/search?q=${encodeURIComponent(q)}&limit=8`,
      )
      setHits(res.hits)
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch()
  }

  // 클릭 시 검색 결과 닫고 해당 항목 표시
  const pickHit = (slug: string) => {
    setSelectedSlug(slug)
    setHits(null)
    setQuery('')
  }

  const totalItems = useMemo(
    () => index.categories.reduce((a, c) => a + c.items.length, 0),
    [index],
  )

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col">
      {/* 상단 헤더 + 검색 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <BookOpen className="w-5 h-5 text-pink-500" />
          <span className="font-semibold text-[15px]">운영 바이블</span>
          <span className="text-[12px] text-gray-400">· {totalItems}개 항목</span>
        </div>
        <div className="flex-1 max-w-[600px] ml-auto flex items-center gap-2 relative">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="무엇을 알고싶으세요? (예: 회원이 채팅 도중 다른 앱 갔어요)"
              className="w-full h-10 pl-9 pr-3 text-[14px] border border-gray-300 rounded-lg focus:outline-none focus:border-pink-400"
            />
          </div>
          <button
            type="button"
            onClick={onSearch}
            disabled={searching || !query.trim()}
            className="h-10 px-4 rounded-lg bg-pink-500 text-white text-[14px] font-medium disabled:opacity-50"
          >
            {searching ? '검색중...' : '검색'}
          </button>
          {hits !== null && (
            <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-[400px] overflow-y-auto">
              {hits.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-[13px]">
                  관련 항목을 못 찾았어요. 다른 단어로 시도해보세요.
                </div>
              ) : (
                <ul>
                  {hits.map((h) => (
                    <li
                      key={h.slug}
                      onClick={() => pickHit(h.slug)}
                      className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-pink-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {h.category}
                        </span>
                        <span className="font-medium text-[14px] text-gray-800">
                          {h.title}
                        </span>
                        <span className="ml-auto text-[11px] text-pink-500 font-semibold">
                          {h.score}점
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-gray-500 line-clamp-2">
                        {h.snippet}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 트리 */}
        <aside className="w-[260px] border-r border-gray-200 bg-gray-50 overflow-y-auto py-3">
          {index.categories.map((cat) => (
            <div key={cat.key} className="mb-3">
              <h3 className="px-4 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {cat.icon} {cat.title}
              </h3>
              <ul>
                {cat.items.map((it) => {
                  const active = it.slug === selectedSlug
                  const isAvailable = it.available !== false
                  return (
                    <li key={it.slug}>
                      <button
                        type="button"
                        onClick={() => setSelectedSlug(it.slug)}
                        disabled={!isAvailable}
                        className={
                          'w-full text-left px-4 py-2 text-[13px] flex items-center gap-1 ' +
                          (!isAvailable
                            ? 'text-gray-400 cursor-not-allowed'
                            : active
                            ? 'bg-pink-100 text-pink-700 font-medium border-l-2 border-pink-500'
                            : 'text-gray-700 hover:bg-gray-100')
                        }
                        title={!isAvailable ? '준비 중인 항목입니다' : undefined}
                      >
                        {active && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                        <span className="flex-1">{it.title}</span>
                        {!isAvailable && (
                          <span className="text-[10px] text-gray-400 ml-1">준비 중</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {index.categories.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-400 text-[12px]">
              콘텐츠 로딩 중...
            </div>
          )}
        </aside>

        {/* 우측 본문 */}
        <main className="flex-1 overflow-y-auto bg-white">
          {loading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : item ? (
            <article className="max-w-[900px] mx-auto px-8 py-6 handbook-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-[24px] font-bold text-gray-900 mt-2 mb-4 pb-3 border-b border-gray-200">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-[18px] font-bold text-gray-800 mt-6 mb-3">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-[15px] font-bold text-gray-800 mt-4 mb-2">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-[14px] leading-[1.7] text-gray-700 mb-3">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 mb-3 text-[14px] leading-[1.8] text-gray-700">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 mb-3 text-[14px] leading-[1.8] text-gray-700">
                      {children}
                    </ol>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full border-collapse text-[13px]">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-300 px-3 py-2 align-top">{children}</td>
                  ),
                  code: ({ children, className }) => {
                    const inline = !className
                    return inline ? (
                      <code className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[12.5px] font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className={className}>{children}</code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 my-3 overflow-x-auto text-[12.5px] leading-[1.6]">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-pink-400 bg-pink-50 pl-4 py-2 my-3 text-[14px] text-gray-700">
                      {children}
                    </blockquote>
                  ),
                  a: ({ children, href }) => {
                    // _HANDBOOK 내부 링크 (chat/01-prepaid-policy 형태) 는 페이지 내 이동
                    if (href && !href.startsWith('http') && !href.startsWith('/')) {
                      return (
                        <button
                          type="button"
                          onClick={() => setSelectedSlug(href)}
                          className="text-pink-600 underline hover:text-pink-800"
                        >
                          {children}
                        </button>
                      )
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-600 underline hover:text-pink-800"
                      >
                        {children}
                      </a>
                    )
                  },
                }}
              >
                {item.markdown}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="p-8 text-center text-gray-400">
              좌측에서 항목을 선택하거나 상단에서 질문을 입력해보세요.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
