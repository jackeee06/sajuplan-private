/**
 * 이메일 도메인 자동 채움 칩.
 *
 * 사용처: 회원가입·회원정보 수정·비밀번호 찾기·상담사 신청 등 이메일 입력란이 있는 모든 폼.
 * 사용자가 로컬 부분(예: "abc")만 입력 후 칩 클릭 → "abc@naver.com" 자동 완성.
 * @가 이미 있으면 도메인만 교체.
 */
interface Props {
  value: string
  onChange: (next: string) => void
  /** 표시할 도메인 목록 — 미지정 시 한국 주요 5개 */
  domains?: string[]
}

const DEFAULT_DOMAINS = ['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'nate.com']

export default function EmailDomainChips({ value, onChange, domains = DEFAULT_DOMAINS }: Props) {
  const fillDomain = (d: string) => {
    const atIdx = value.indexOf('@')
    const local = atIdx >= 0 ? value.slice(0, atIdx) : value
    onChange(`${local}@${d}`)
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {domains.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => fillDomain(d)}
          className="px-2.5 py-1 rounded-full bg-[#F9FAFB] border border-[#F3F4F6] text-[12px] text-[#6A7282] hover:bg-[#fdf2f8] hover:border-[#f472b6] hover:text-[#ec4899] transition"
        >
          @{d}
        </button>
      ))}
    </div>
  )
}
