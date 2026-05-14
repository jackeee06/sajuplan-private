import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * ★ 새 빌드를 webview에 강제 반영하려면 이 상수를 bump 하세요.
 *
 *   APP_VERSION = 'v1' → 'v2' → 'v3' ...
 *
 * 동작 원리:
 *   - 빌드된 index.html의 <script src> / <link href>에 ?v={APP_VERSION} 붙임.
 *   - 같은 버전이면 webview가 캐시 사용(빠름). 버전 bump 하면 URL이 달라져 새로 받음.
 *
 * timestamp 대신 고정값을 쓰는 이유:
 *   매 배포마다 timestamp가 바뀌면 webview/CDN 캐시가 매번 무효화되어 느려짐.
 *   고정값으로 두면 평소엔 캐시 효율, 코드 큰 변경 시 수동으로 올려 강제 갱신.
 */
const APP_VERSION = 'v2'

function cacheBustPlugin(): Plugin {
  return {
    name: 'cache-bust',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /(<(?:script|link)[^>]+(?:src|href)=["'])([^"'?]+)(["'])/g,
        `$1$2?v=${APP_VERSION}$3`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cacheBustPlugin()],
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  // 로컬에서 API 를 띄우지 않는다 — dev 서버에도 프록시를 두지 않는다.
  // API 호출은 항상 절대 URL(https://api.sajumoon.kr / .co.kr) 로 나간다 (src/lib/runtime-env.ts).
  server: {
    port: 5174,
  },
})
