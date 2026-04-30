# 사주문 (Sajumoon)

사주 상담 서비스 플랫폼.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 웹 프론트 | Next.js |
| 백엔드 API | Nest.js |
| DB | PostgreSQL |
| 모바일 | React Native (WebView 래퍼) |

모바일 앱은 웹뷰로 Next.js 화면을 렌더링하는 하이브리드 구조.

## 디렉토리 구조

```
sajumoon/
├── docs/            # 설계 문서, 프로토타입
│   └── sajumoon/    # Figma Make 기반 UI 프로토타입 (Vite + React)
├── web/             # (예정) Next.js 웹 앱
├── api/             # (예정) Nest.js 백엔드
└── mobile/          # (예정) React Native 앱
```

## 프로토타입

`docs/sajumoon/` 은 Figma Make 로 생성된 UI 프로토타입입니다. 실제 제품 코드가 아니며 화면 흐름·레이아웃 레퍼런스 용도입니다.

### 실행

```bash
cd docs/sajumoon
pnpm install
pnpm dev            # 개발 서버
pnpm build          # 단일 HTML 파일 빌드 (dist/index.html)
```

빌드 결과 `dist/index.html` 은 외부 리소스 없이 단독 실행되며 브라우저로 더블클릭해서 열 수 있습니다. 고객 전달용으로 사용됩니다.

## 화면 구성 (프로토타입 기준)

- `/login` — 로그인
- `/` — 홈 (상담사 목록)
- `/counselor/:id` — 상담사 상세

라우팅은 HashRouter 기반 (`file://` 호환).
