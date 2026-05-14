import { useEffect, useState } from 'react'

/**
 * 입력값을 지정 ms 만큼 지연시켜 반환한다.
 * 검색 인풋 등에서 매 keystroke 마다 fetch 가 나가지 않도록 사용.
 *
 * 사용:
 *   const [keyword, setKeyword] = useState('')
 *   const debounced = useDebouncedValue(keyword, 350)
 *   useEffect(() => { fetch(debounced) }, [debounced])
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debounced
}
