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
const APP_VERSION = 'v3'

function cacheBustPlugin(): Plugin {
  return {
    name: 'cache-bust',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /(<(?:script|link)[^>]+(?:src|href)=["'])([^"'?]+)(["'])/g,
        (match, prefix, url, suffix) => {
          // 외부 CDN (jsdelivr / kakaocdn 등) URL 에는 ?v=… 붙이지 않는다.
          // 붙이면 origin 매칭 깨져 preconnect/preload 가 무력화되고,
          // 외부 캐시 효율도 떨어진다. 우리 정적 파일(/assets/…)만 cache-bust.
          if (/^https?:\/\//.test(url) || url.startsWith('//')) return match
          return `${prefix}${url}?v=${APP_VERSION}${suffix}`
        },
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
  build: {
    // 페이지별 lazy chunk 가 작아져 inline 처리 권장 임계도 함께 낮춰 둠.
    // 기본 4KB 면 작은 진입 페이지가 base64 로 박혀 청크 효과를 깎을 수 있음.
    assetsInlineLimit: 2048,
    // chunk 경고 임계 (vite 기본 500KB) — react-vendor / editor 분리 후엔 어느 청크도 400KB 안 넘어야 함.
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 런타임은 모든 페이지가 공유 → 별도 long-cache 청크.
          'react-vendor': ['react', 'react-dom'],
          // 라우터도 모든 페이지 공통.
          router: ['react-router-dom'],
          // Toast UI 에디터는 MemberEdit / CounselorApplyNew 두 곳만 사용 (~500KB+).
          // 별도 청크로 분리하여 메인 진입 시엔 다운로드 X.
          editor: ['@toast-ui/editor', '@toast-ui/react-editor'],
        },
      },
    },
  },
})
