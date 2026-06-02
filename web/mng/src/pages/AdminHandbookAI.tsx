import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bot, Send, Plus, Trash2, BookOpen, MessageSquare, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'

/**
 * 운영 바이블 AI — Phase 2-A.
 *
 * 자연어 질문 → Claude API 호출 → 답변 + 출처.
 * 멀티턴 대화 + 세션 저장.
 *
 * 좌측: 옛 대화 세션 목록 (본인만)
 * 우측: 현재 대화 (user/assistant turn 누적)
 * 하단: 질문 입력창
 */

interface Source {
  slug: string
  title: string
}

interface SqlExecution {
  sql: string
  row_count: number
  truncated: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  sql_executions?: SqlExecution[]
  created_at?: string
}

interface SessionListItem {
  id: number
  title: string
  updated_at: string
  message_count: number
}

interface AskResponse {
  session_id: number
  answer: string
  sources: Source[]
  sql_executions: SqlExecution[]
  tokens_in: number
  tokens_out: number
}

interface SessionDetail {
  id: number
  title: string
  messages: Message[]
}

interface ConfigStatus {
  api_key_masked: string | null
  model: string
  enabled: boolean
  updated_at: string | null
}

export default function AdminHandbookAI() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [config, setConfig] = useState<ConfigStatus | null>(null)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 설정 + 세션 목록 로딩
  useEffect(() => {
    api<ConfigStatus>('/admin/handbook/config').then(setConfig).catch(() => setConfig(null))
    void refreshSessions()
  }, [])

  // URL ?session=N 으로 세션 자동 로딩
  useEffect(() => {
    const sid = params.get('session')
    if (sid) {
      const n = parseInt(sid, 10)
      if (Number.isFinite(n) && n > 0) {
        loadSession(n)
      }
    }
  }, [params])

  // 메시지 추가 시 하단 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  const refreshSessions = async () => {
    try {
      const r = await api<{ sessions: SessionListItem[] }>('/admin/handbook/sessions?limit=30')
      setSessions(r.sessions)
    } catch {
      // ignore
    }
  }

  const loadSession = async (sid: number) => {
    try {
      const r = await api<SessionDetail>(`/admin/handbook/sessions/${sid}`)
      setCurrentSessionId(sid)
      setMessages(r.messages)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '세션 로딩 실패')
    }
  }

  const newSession = () => {
    setCurrentSessionId(null)
    setMessages([])
    setError(null)
    setParams({})
  }

  const deleteSession = async (sid: number) => {
    if (!confirm('이 대화를 삭제할까요? (복구 불가)')) return
    try {
      await api(`/admin/handbook/sessions/${sid}`, { method: 'DELETE' })
      if (currentSessionId === sid) newSession()
      void refreshSessions()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const ask = async () => {
    const q = input.trim()
    if (!q || asking) return

    if (!config?.enabled) {
      setError('운영 바이블 AI 비활성 상태. 슈퍼관리자가 환경설정에서 활성화 필요.')
      return
    }

    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    setAsking(true)
    try {
      const res = await api<AskResponse>('/admin/handbook/ask', {
        method: 'POST',
        body: JSON.stringify({ query: q, session_id: currentSessionId }),
        headers: { 'Content-Type': 'application/json' },
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, sources: res.sources, sql_executions: res.sql_executions }])
      setCurrentSessionId(res.session_id)
      void refreshSessions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 답변 실패')
      // 마지막 user 메시지는 남겨두고 assistant 만 안 추가
    } finally {
      setAsking(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask()
    }
  }

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col">
      {/* 상단 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
        <Bot className="w-5 h-5 text-pink-500" />
        <span className="font-semibold text-[15px] text-gray-800">운영 바이블 AI</span>
        <span className="text-[11px] text-gray-400">바이블에서 답을 못 찾으셨나요? 자연어로 질문하세요.</span>
        <button
          type="button"
          onClick={() => navigate('/handbook')}
          className="ml-auto px-3 h-8 rounded-lg border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 flex items-center gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> 항목 검색 페이지로
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 옛 세션 목록 */}
        <aside className="w-[260px] border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <button
              type="button"
              onClick={newSession}
              className="w-full flex items-center justify-center gap-2 px-3 h-9 rounded-lg bg-pink-500 text-white text-[13px] font-medium hover:bg-pink-600"
            >
              <Plus className="w-4 h-4" /> 새 대화
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <h3 className="px-4 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">옛 대화</h3>
            {sessions.length === 0 ? (
              <p className="px-4 py-3 text-[12px] text-gray-400">아직 대화 없음</p>
            ) : (
              <ul>
                {sessions.map((s) => {
                  const active = s.id === currentSessionId
                  return (
                    <li key={s.id} className="group">
                      <div
                        className={
                          'px-3 py-2 cursor-pointer flex items-start gap-1 ' +
                          (active ? 'bg-pink-100 border-l-2 border-pink-500' : 'hover:bg-gray-100')
                        }
                        onClick={() => loadSession(s.id)}
                      >
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] text-gray-800 line-clamp-2 break-words">{s.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(s.updated_at)} · {s.message_count}턴</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void deleteSession(s.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* 우측: 현재 대화 */}
        <main className="flex-1 flex flex-col bg-white">
          {/* 비활성 안내 */}
          {config && !config.enabled && (
            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 text-[13px] text-yellow-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                운영 바이블 AI 비활성 상태입니다. 슈퍼관리자가 <strong>환경설정 → 운영 바이블 AI</strong> 에서 Anthropic API 키 입력 + 활성화 해주세요.
              </span>
            </div>
          )}

          {/* 대화 영역 */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !asking ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-[600px]">
                  <Bot className="w-12 h-12 mx-auto text-pink-300 mb-3" />
                  <h2 className="text-[18px] font-semibold text-gray-700 mb-2">사건·사고 났을 때 물어보세요</h2>
                  <p className="text-[13px] text-gray-500 mb-4">
                    고객 클레임 · 환불 · 정산 분쟁 등을 <strong>운영 바이블 + 실제 DB</strong> 를 동시에 보고 시시비비 가려드립니다.
                  </p>
                  <div className="text-left bg-gray-50 rounded-lg p-4 text-[13px] text-gray-600">
                    <p className="font-medium mb-2">📌 이런 상황에 쓰세요</p>
                    <ul className="space-y-1.5 list-disc pl-5">
                      <li>"010-1234-5678 회원이 어제 충전했는데 코인 안 들어왔대요. 진짜인지 확인해줘"</li>
                      <li>"상담사 박OO 가 5월 정산 누락됐다고 항의해요. 실제 통화 시간이랑 정산액 비교해줘"</li>
                      <li>"회원이 채팅 5분 했는데 30,000코인 빠졌다고 항의. 정상 차감 맞아요?"</li>
                      <li>"회원 ID 1234, 환불 가능한가요? 결제일 + 사용내역 + 환불정책 비교해서 답 줘"</li>
                      <li>"회원이 카드 1번만 긁었는데 결제가 2건 됐다고 해요. 이중결제 맞나요? PG 기록 + 코인 적립 비교"</li>
                      <li>"010-2222-3333 회원이 친구 추천했는데 추천 보상 코인 안 들어왔대요. 추천 등록 + 친구 첫 결제 + 보상 지급 추적"</li>
                      <li>"상담사 김OO 가 자기는 부재중 안 눌렀다는데 시스템엔 부재중 처리. 마지막 활동 시각 + 푸시 응답 + 자동 부재중 발동 시점 비교"</li>
                      <li>"회원 A 의 단골 상담사 한 명이랑 하루에 5번 연속 4~5분만 채팅하고 끊네요. 정산 부풀리기 같은데 패턴 분석해줘"</li>
                      <li>"상담사 박OO 가 5월 15일에 단가 인상됐는데 적용은 5월 22일 통화부터 됐다고 항의. 등급 변경 시각 vs 단가 적용 시각 대조"</li>
                    </ul>
                    <p className="text-[11.5px] text-gray-400 mt-3 pt-3 border-t border-gray-200">
                      💡 단순 정책 질문 (정산일·환불기준 등) 은 사이드바 → 📖 <strong>운영 바이블</strong> 키워드 검색이 더 빠르고 무료입니다.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-[900px] mx-auto">
                {messages.map((m, idx) => (
                  <div key={idx} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={
                        'max-w-[80%] rounded-2xl px-4 py-3 ' +
                        (m.role === 'user'
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-100 text-gray-800')
                      }
                    >
                      {m.role === 'user' ? (
                        <p className="text-[14px] leading-[1.6] whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <article className="handbook-prose-mini text-[14px] leading-[1.7]">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => <h3 className="font-bold text-[15px] mt-2 mb-2">{children}</h3>,
                              h2: ({ children }) => <h4 className="font-bold text-[14px] mt-2 mb-1.5">{children}</h4>,
                              h3: ({ children }) => <h5 className="font-bold text-[13.5px] mt-1.5 mb-1">{children}</h5>,
                              p: ({ children }) => <p className="mb-2">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                              code: ({ children, className }) => {
                                const inline = !className
                                return inline ? (
                                  <code className="px-1 py-0.5 bg-white text-gray-700 rounded text-[12.5px] font-mono">
                                    {children}
                                  </code>
                                ) : (
                                  <code className={className}>{children}</code>
                                )
                              },
                              a: ({ children, href }) => {
                                if (href && !href.startsWith('http') && !href.startsWith('/')) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/handbook?slug=${href}`)}
                                      className="text-pink-600 underline hover:text-pink-800"
                                    >
                                      {children}
                                    </button>
                                  )
                                }
                                return <a href={href} className="text-pink-600 underline hover:text-pink-800">{children}</a>
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                          {m.sql_executions && m.sql_executions.length > 0 && (
                            <details className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <summary className="cursor-pointer px-3 py-2 text-[11.5px] text-gray-500 hover:bg-gray-50 select-none">
                                🔍 실행된 DB 조회 {m.sql_executions.length}건 보기
                              </summary>
                              <div className="px-3 py-2 space-y-2 bg-gray-50">
                                {m.sql_executions.map((sq, i) => (
                                  <div key={i} className="text-[11px]">
                                    <pre className="bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                                      {sq.sql}
                                    </pre>
                                    <p className="text-[10.5px] text-gray-500 mt-1">
                                      → {sq.row_count} 행{sq.truncated ? ' (LIMIT 100 적용, 추가 데이터 있을 수 있음)' : ''}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </article>
                      )}
                    </div>
                  </div>
                ))}
                {asking && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 text-[13px]">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        </div>
                        <span>답변 생성 중...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* 에러 표시 */}
          {error && (
            <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-[12.5px] text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
            </div>
          )}

          {/* 입력 영역 */}
          <div className="border-t border-gray-200 bg-white p-3">
            <div className="max-w-[900px] mx-auto flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="질문을 입력하세요. (Enter 전송, Shift+Enter 줄바꿈)"
                rows={2}
                disabled={asking || !config?.enabled}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-[14px] resize-none focus:outline-none focus:border-pink-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={ask}
                disabled={asking || !input.trim() || !config?.enabled}
                className="h-10 px-4 rounded-lg bg-pink-500 text-white font-medium text-[13px] flex items-center gap-1 disabled:opacity-50 hover:bg-pink-600"
              >
                <Send className="w-4 h-4" /> 전송
              </button>
            </div>
            {config?.enabled && (
              <p className="text-center text-[10.5px] text-gray-400 mt-1.5">
                AI 답변은 사주플랜 운영 바이블 기반. 정확성을 위해 출처 항목 함께 확인하세요.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `오늘 ${hh}:${mm}`
  }
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}
