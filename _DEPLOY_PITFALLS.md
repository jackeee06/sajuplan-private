# 배포 함정 모음 — 반드시 숙지

> 실제 사고가 발생한 패턴만 기록. 재발 방지용.

---

## ⚠️ 함정 1: dist vs dist2 (2026-06-03 발생)

### 상황
`vite build` 실행 시 Windows EBUSY 잠금 오류로 `dist` 폴더에 빌드 불가.  
→ `vite build --outDir dist2` 로 우회해서 `dist2`에 빌드.  
→ 그런데 `_patch_frontend.py`는 `dist` 폴더를 배포.  
→ 결과: 구버전이 그대로 서빙됨. 화면 변화 없음.

### 해결 (2026-06-03 적용)
`_patch_frontend.py`가 `dist2` 우선 탐색, 없으면 `dist` 사용하도록 수정.

### 확인 방법
배포 후 반드시:
```bash
grep -rl "새_코드_키워드" /data/wwwroot/sajuplan.com/assets/ | wc -l
```
→ 0이면 배포 실패. 다시 배포.

---

## ⚠️ 함정 2: sajuplan.com 배포 누락 (2026-06-03 발생)

### 상황
`_patch_frontend.py TARGETS_USER`에 `sajumoon.co.kr`만 있고 `sajuplan.com`이 없었음.  
→ sajumoon.co.kr에만 배포되고 실제 prod(`sajuplan.com`)에는 반영 안 됨.

### 해결 (2026-06-03 적용)
`TARGETS_USER`에 `sajuplan.com` 경로 추가:
```python
("prod-sajuplan", "104.64.128.103", "/data/wwwroot/sajuplan.com"),
```

### 핵심 사실
`sajumoon.co.kr`과 `sajuplan.com`은 **같은 서버(104.64.128.103)지만 별도 폴더**.  
→ 두 곳 모두 배포 필수.

---

## ⚠️ 함정 3: _patch_mng_bundle.py dist2 참조 (기존 주의)

관리자(mng) 배포 시 `_patch_mng_bundle.py`는 `dist2` 참조.  
새 빌드가 `dist`에 있으면 구버전 배포됨.

---

## 배포 후 체크리스트

- [ ] 서버에 새 코드 키워드 존재 확인 (`grep`)
- [ ] `sajuplan.com` 브라우저에서 Ctrl+Shift+R (강제 새로고침) 후 확인
- [ ] 앱 WebView 캐시 의심 시 → 앱 삭제 후 재설치 또는 브라우저로 확인
