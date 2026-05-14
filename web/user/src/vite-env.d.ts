/// <reference types="vite/client" />

// vite.config.ts의 define으로 주입되는 앱 버전 (webview 캐시 진단·무력화용).
// 새 빌드 강제 반영하려면 vite.config.ts의 APP_VERSION 상수를 bump.
declare const __APP_VERSION__: string
