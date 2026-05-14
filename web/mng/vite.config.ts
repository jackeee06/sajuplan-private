import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 로컬에서 API 를 띄우지 않는다 — dev 서버에도 프록시를 두지 않는다.
// API 호출은 항상 절대 URL(https://api.sajumoon.kr / .co.kr) 로 나간다 (src/lib/runtime-env.ts).
export default defineConfig({
  plugins: [react()],
  base: '/mng/',
  server: {
    port: 5173,
  },
})
