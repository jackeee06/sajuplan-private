# [AI 전용] 배너·팝업 — 기술 상세

## DB

```
banner
- id, image_url, link_url, valid_from, valid_until, is_active, order_no

popup_layer
- id, content (HTML), valid_from, valid_until, is_active
- display_rule — '매번' / '하루1회' / '7일1회'
```

## 컴포넌트

### 사용자 측 (회원 화면)
- 홈 배너 슬라이드
- `web/user/src/components/MaintenanceBanner.tsx` (점검)
- `FavoriteCounselorBanner.tsx` (단골)
- `CounselorIncomingBanner.tsx` (incoming)

### 운영자 측 (배너 등록)
- `/mng/banners`, `/mng/popup-layers`
- 코드: `api/src/admin/banners/banners.service.ts`, `popup-layers/popup-layers.service.ts`

## WebView 외부 URL

배너 클릭 → 외부 사이트 → `openExternalUrl()` 필요 (메모리 `[[webview-external-url]]`)

## localStorage 키 (팝업 노출 제한)

- `popup_seen_{popupId}_{YYYYMMDD}` — 하루 1회
- `popup_dont_show_{popupId}` — 영구 안 보기 (사용자 선택)

## 관련 메모리

- `[[webview-external-url]]`
