import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, Save, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * 운영 바이블 AI 설정 (Anthropic API 키 등) — 슈퍼관리자 전용.
 */

interface ConfigStatus {
  api_key_masked: string | null
  model: string
  max_tokens: number
  enabled: boolean
  updated_at: string | null
}

export default function AdminHandbookConfig() {
  const navigate = useNavigate()
  const { admin } = useAuth()
  const [config, setConfig] = useState<ConfigStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [maxTokens, setMaxTokens] = useState(1000)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 슈퍼 가드
  if (!admin?.is_super) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
        <h2 className="text-[18px] font-semibold text-gray-700 mb-2">접근 권한 없음</h2>
        <p className="text-[13px] text-gray-500 mb-4">이 페이지는 슈퍼관리자 전용입니다.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-4 h-9 rounded-lg bg-pink-500 text-white text-[13px]"
        >
          대시보드로
        </button>
      </div>
    )
  }

  useEffect(() => {
    api<ConfigStatus>('/admin/handbook/config')
      .then((c) => {
        setConfig(c)
        setModel(c.model)
        setMaxTokens(c.max_tokens)
        setEnabled(c.enabled)
      })
      .catch(() => setConfig(null))
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const body: Record<string, unknown> = { model, max_tokens: maxTokens, enabled }
      if (apiKey.trim()) body.api_key = apiKey.trim()
      await api('/admin/handbook/config', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      setMessage({ type: 'success', text: '저장 완료. AI 답변에 즉시 적용됩니다.' })
      setApiKey('')
      const c = await api<ConfigStatus>('/admin/handbook/config')
      setConfig(c)
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '저장 실패' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-gray-50">
      <div className="max-w-[800px] mx-auto p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 text-[12.5px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 뒤로
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="w-5 h-5 text-pink-500" />
            <h1 className="text-[18px] font-semibold text-gray-800">운영 바이블 AI 설정</h1>
            <span className="text-[11px] px-2 py-0.5 bg-pink-100 text-pink-700 rounded">슈퍼 전용</span>
          </div>
          <p className="text-[13px] text-gray-500 mb-6">
            Anthropic Claude API 를 사용해 운영 바이블 자연어 답변을 제공합니다.
            API 키는 안전하게 저장되며 마스킹 표시됩니다.
          </p>

          {message && (
            <div
              className={
                'mb-4 p-3 rounded-lg text-[13px] flex items-center gap-2 ' +
                (message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200')
              }
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* 현재 설정 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-[12px] text-gray-500 mb-2">현재 상태</p>
            <ul className="space-y-1.5 text-[13.5px]">
              <li>
                <span className="text-gray-500">API 키:</span>{' '}
                <span className="font-mono text-gray-800">
                  {config?.api_key_masked ?? <em className="text-red-500 not-italic">미설정</em>}
                </span>
              </li>
              <li>
                <span className="text-gray-500">모델:</span>{' '}
                <span className="text-gray-800">{config?.model ?? '-'}</span>
              </li>
              <li>
                <span className="text-gray-500">활성화:</span>{' '}
                <span className={config?.enabled ? 'text-green-700 font-medium' : 'text-gray-500'}>
                  {config?.enabled ? '✅ ON' : '⭕ OFF'}
                </span>
              </li>
              {config?.updated_at && (
                <li>
                  <span className="text-gray-500">마지막 수정:</span>{' '}
                  <span className="text-gray-700 text-[12px]">{config.updated_at}</span>
                </li>
              )}
            </ul>
          </div>

          {/* API 키 입력 */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
              Anthropic API 키
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.api_key_masked ? '새 키로 교체할 때만 입력 (비워두면 옛 키 유지)' : 'sk-ant-api03-...'}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg text-[13.5px] font-mono focus:outline-none focus:border-pink-400"
            />
            <p className="text-[11.5px] text-gray-400 mt-1">
              아래 가이드를 따라 발급하세요. 키는 <span className="font-mono">sk-ant-</span> 로 시작합니다.
            </p>

            {/* 키 발급 가이드 박스 — 처음 받는 사람도 그대로 따라 할 수 있게 */}
            <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[13px] font-semibold text-amber-900 mb-2">
                📘 처음 받는 분께 — Anthropic API 키 발급 방법
              </p>

              <p className="text-[12.5px] text-gray-700 leading-[1.7] mb-3">
                Anthropic 은 Claude(클로드) AI 를 만든 회사예요. 사주플랜의 운영 바이블 AI 는 이 회사의 API 를 사용합니다.
                <br />
                <strong>최소 5달러(약 7,000원)</strong> 만 충전하면 사주플랜 운영자 1명이 <strong>약 5~10개월</strong> 사용 가능합니다.
                <br />
                매월 자동결제 X. 한 번 충전한 금액만큼만 차감되는 <strong>선불 방식</strong>이에요.
              </p>

              <ol className="text-[12.5px] text-gray-800 leading-[1.8] list-decimal pl-5 space-y-1.5">
                <li>
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 underline font-medium"
                  >
                    console.anthropic.com
                  </a>
                  {' '}접속 → 우측 상단 <strong>Sign Up</strong> → Google 계정 또는 이메일로 가입.
                </li>
                <li>
                  로그인 후 좌측 메뉴 <strong>Settings → Billing</strong> 클릭.
                </li>
                <li>
                  <strong>Add payment method</strong> 클릭 → 카드 정보 등록.
                  <div className="text-[11.5px] text-amber-700 mt-0.5">
                    ※ 비자/마스터 한국 카드 가능. 거부되면 다른 카드 또는 카드사 해외결제 풀기 필요.
                  </div>
                </li>
                <li>
                  <strong>Buy credits</strong> 클릭 → 최소 <strong>$5</strong> 입력 → 결제. (한 번만 결제, 자동결제 X)
                </li>
                <li>
                  (옵션, <strong>강력 추천</strong>) <strong>Settings → Limits</strong> → <strong>Monthly spend limit</strong> 에 <strong>$5</strong> 입력 + Save.
                  <div className="text-[11.5px] text-amber-700 mt-0.5">
                    → 월 5달러 초과 사용 자동 차단. 예상치 못한 비용 폭주 방지.
                  </div>
                </li>
                <li>
                  좌측 메뉴 <strong>Settings → API keys</strong> → 우측 상단 <strong>Create Key</strong> 클릭.
                </li>
                <li>
                  Name 칸에 <span className="font-mono bg-white px-1 rounded">sajuplan</span> 입력 → <strong>Create Key</strong>.
                </li>
                <li>
                  생성된 <span className="font-mono bg-white px-1 rounded">sk-ant-api03-...</span> 로 시작하는 키 <strong>복사</strong>.
                  <div className="text-[11.5px] text-red-600 mt-0.5">
                    ⚠️ 키는 <strong>한 번만</strong> 보입니다. 창 닫기 전에 반드시 복사하세요. 잃어버리면 새로 만들어야 함.
                  </div>
                </li>
                <li>
                  <strong>이 페이지 위쪽 입력란</strong> 에 붙여넣기 → 아래 <strong>활성화 토글 ✅</strong> → <strong>저장</strong> 버튼 클릭.
                </li>
              </ol>

              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-[12px] font-semibold text-amber-900 mb-1">💡 자주 묻는 질문</p>
                <ul className="text-[11.5px] text-gray-700 leading-[1.7] space-y-1 list-disc pl-4">
                  <li><strong>꼭 5달러여야 하나요?</strong> — 최소 충전액이 $5 입니다. 더 적은 금액은 안 됨.</li>
                  <li><strong>한국 카드 안 되면?</strong> — 카드사 고객센터에 "해외결제 허용" 요청. 또는 다른 카드 시도.</li>
                  <li><strong>5달러로 얼마나 쓸 수 있나요?</strong> — 운영자 1명 일 10~20번 질문 기준 약 5~10개월.</li>
                  <li><strong>금액 다 떨어지면?</strong> — Settings → Billing 에서 다시 $5 충전. 자동결제 설정도 가능.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 모델 선택 */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg text-[13.5px] focus:outline-none focus:border-pink-400"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (권장, 균형)</option>
              <option value="claude-opus-4-7">Claude Opus 4.7 (최고 품질, 비싸)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (빠르고 저렴)</option>
            </select>
            <p className="text-[11.5px] text-gray-400 mt-1">
              Sonnet 권장. Haiku 는 더 저렴하지만 답변 품질 약간 낮음.
            </p>
          </div>

          {/* Max tokens */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
              답변 최대 토큰 (max_tokens)
            </label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 1000)}
              min={200}
              max={4000}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg text-[13.5px] focus:outline-none focus:border-pink-400"
            />
            <p className="text-[11.5px] text-gray-400 mt-1">
              1000 토큰 ≈ 한글 500-700자. 길게 답변하려면 늘리되 비용 ↑.
            </p>
          </div>

          {/* 활성화 토글 */}
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-5 h-5 accent-pink-500"
              />
              <div>
                <p className="text-[14px] font-medium text-gray-800">운영 바이블 AI 활성화</p>
                <p className="text-[12px] text-gray-500">
                  관리자가 사이드바 → 운영 바이블 AI 페이지에서 자연어 질문 사용 가능
                </p>
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full h-11 rounded-lg bg-pink-500 text-white font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-pink-600"
          >
            <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
          </button>

          <p className="text-[11.5px] text-gray-400 text-center mt-4">
            API 키는 사주플랜 데이터베이스에 안전하게 저장됩니다. 외부 노출 없음.
          </p>
        </div>
      </div>
    </div>
  )
}
