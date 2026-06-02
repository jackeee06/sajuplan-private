# [AI 전용] 환경설정 / 약관 — 기술 상세

## DB

```
app_setting (또는 settings)
- key VARCHAR (PK)
- value TEXT
- updated_by INT FK admin
- updated_at TIMESTAMPTZ

contents (또는 app_content)
- id, type VARCHAR — 'service-terms' / 'privacy-policy' / etc.
- body TEXT
- version INT
- effective_from TIMESTAMPTZ
```

## 핵심 코드 위치

- 환경설정: `api/src/admin/settings/settings.service.ts`
- 컨텐츠: `api/src/admin/contents/contents.service.ts`

## 변경 시 영향

- 환경설정: 시스템 즉시 반영 (대부분). 일부는 pm2 reload 필요
- 약관: 사용자 화면 즉시 반영. 옛 버전은 별도 보존 (이력 추적)

## 함정

- 외부 API 키 삭제 → 외부 서비스 모두 사고
- 약관 변경 후 자동 재동의 없음 → 법적 위험
- 환경설정 값 형식 오류 (JSON 깨짐 등)

## 관련 메모리

- 환경설정 별도 박제 메모리 없음 (각 항목 의미는 코드 또는 settings DB 확인)
