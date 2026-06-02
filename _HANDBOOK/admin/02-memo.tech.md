# [AI 전용] 관리자 메모장 — 기술 상세

## DB

```
admin_memo
- id, member_id INT FK (PK) — 관리자별 1 row (UPSERT)
- content TEXT
- updated_at TIMESTAMPTZ
```

## API

- `GET /api/admin/memo` — 본인 메모
- `PUT /api/admin/memo` — 저장 (UPSERT)
- `POST /api/admin/memo/upload` — 이미지 업로드 (10MB 제한)

## 이미지 저장

- 디스크: `uploads/admin-memo/{adminId}/{timestamp}_{random}.{ext}`
- 허용 확장자: jpg, jpeg, png, gif, webp
- URL 형식: `/uploads/admin-memo/{adminId}/{filename}`

## 권한

`AdminAuthGuard` + adminId 매칭 (다른 관리자 메모 접근 불가)

## 핵심 코드 위치

- 컨트롤러: `api/src/admin/memo/memo.controller.ts`
- 서비스: `api/src/admin/memo/memo.service.ts`
- 페이지: `web/mng/src/pages/AdminMemo.tsx`
- 에디터: `web/mng/src/components/HtmlEditor.tsx` (Toast UI)
