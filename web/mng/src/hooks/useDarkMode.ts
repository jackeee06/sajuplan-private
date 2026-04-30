import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(
    () => localStorage.getItem('darkMode') === '1',
  )

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('darkMode', '1')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('darkMode', '0')
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark((v) => !v) }
}
