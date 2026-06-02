import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { api } from '../lib/api'

/**
 * sample/adm/saju_config.php (메뉴 350800 "사주메인관리") 정확 매핑.
 *
 *   sample 필드:
 *     cf_con_num  → 최근일주일 상담건수 보정 (실건수 + 입력값이 메인에 표시)
 *     cf_now_add  → 현재 접속중인 상담사 숫자 보정
 *     cf_1        → 라이브 숫자 보정
 *
 *   신규 매핑: setting namespace='saju'
 *     con_num / now_add / live_num
 */

type SettingsByNs = Record<string, Record<string, string>>

interface FieldDef {
  key: string
  label: string
  hint?: string
}

const FIELDS: FieldDef[] = [
  { key: 'con_num', label: '최근일주일 상담건수', hint: '실건수 + 입력값이 메인에 표시됩니다.' },
  { key: 'now_add', label: '현재 접속중인 상담사 숫자', hint: '실건수 + 입력값이 메인에 표시됩니다.' },
  { key: 'live_num', label: '라이브 숫자', hint: '메인에 표시되는 보정값.' },
]

export default function SajuConfig() {
  const [data, setData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<{ data: SettingsByNs }>('/admin/settings')
      .then((res) => setData(res.data['saju'] ?? {}))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }))

  const onSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ saju: data }) })
      setSavedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩...</div>

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">사주메인관리</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">메인 항목 숫자 보정값 (실건수 + 입력값으로 표시)</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-gray-400">{savedAt.toLocaleTimeString('ko-KR')} 저장됨</span>}
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
            <Save className="w-4 h-4" />{saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {FIELDS.map((f) => (
              <tr key={f.key}>
                <th className="text-left align-top px-4 py-3 w-56 font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50">
                  <label htmlFor={f.key}>{f.label}</label>
                  {f.hint && <div className="text-[11px] text-gray-400 mt-0.5 font-normal">{f.hint}</div>}
                </th>
                <td className="px-4 py-3">
                  <input
                    id={f.key} type="number"
                    value={data[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="max-w-[200px] px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
