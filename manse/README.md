# 사주 만세력 — 독립 제품 (monorepo)

> 사주플랜 무료 만세력. **사주플랜과 코드가 섞이지 않는 독립 제품**(단방향 의존).
> 전체 제품 스펙: [`../_MANSE_SPEC.md`](../_MANSE_SPEC.md)

## 패키지

| 패키지 | 역할 | 상태 |
|---|---|---|
| [`packages/engine`](packages/engine) | 계산 엔진 (순수 함수, 왕관 보석) | ✅ 골격 완성 · 🔴 일주 앵커 핀 대기 |
| [`packages/api`](packages/api) | 엔진 감싼 독립 HTTP 서비스 (API 키) | ✅ MVP |
| `packages/web` | 적응형 프론트 (전문가/쉬운 화면, PC+모바일) | ⏳ 예정 |

## 의존성 방향 (절대)

```
사주플랜 ──(소비)──▶ 만세력 API ──▶ 엔진
       ❌ 만세력은 사주플랜을 모른다 (회원·코인·결제 의존 0)
```

## 개발

```bash
cd manse
npm install            # 워크스페이스 전체
npm run build          # 엔진 + API 빌드
npm test               # 엔진 정확도 검증
npm run api:start      # 만세력 API 기동 (기본 :8787)
```

## API 빠른 사용

```bash
curl -X POST http://localhost:8787/v1/manse \
  -H "content-type: application/json" \
  -d '{"birth":"1990-06-15T07:20","gender":"M","longitude":127.0}'
```
