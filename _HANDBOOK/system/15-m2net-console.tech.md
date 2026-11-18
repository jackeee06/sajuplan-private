# 엠투넷 콘솔 자동 접근 (기술)

> 사장님용 개요: [15-m2net-console.md](15-m2net-console.md). 이 문서는 Claude/개발자가 엠투넷 AG9 웹콘솔에 직접 로그인·화면캡쳐·판독하는 방법.

## 개요

엠투넷 데이터 확인 경로는 **두 가지**다. 상황에 맞게 병행한다.

1. **API 조회** — `api/src/shared/m2net/m2net.service.ts`. 회원 잔액(`getMemberByMembid`)·채팅로그(`getChatLog`)·상담사 상태 등. 서버 인증키 사용, 항상 가용(단 m2net 무응답 시 실패).
2. **웹콘솔 화면 캡쳐** — 이 문서. API에 없는 화면(통화상세내역·충전/차감이력·기간별 현황 등)을 Playwright로 열어 캡쳐 → `Read`로 판독.

## 접속 정보

- URL: `https://passcall.co.kr:32831/index` — **⚠️ https 필수.** http로 붙으면 `Client sent an HTTP request to an HTTPS server`로 거부.
- 로그인 폼: `input[name="userid"]` / `input[name="passwordit"]`, form `loginCheckForm` POST → 성공 시 `/PKGE/RunTime/coreframe`로 이동(프레임 수 1→5+).
- 자격증명: 루트 `.env.local`의 `M2NET_CONSOLE_URL` / `M2NET_CONSOLE_ID` / `M2NET_CONSOLE_PW`. **git 제외됨(.gitignore)**, SSHPASS와 같은 자리. 문서·코드·커밋에 절대 노출 금지.
- CP명: `사주플랜(오리진하우스)`.

## 도구 사용법

`e2e/m2net-console.mjs` (Playwright, e2e에 설치돼있음):

```bash
node e2e/m2net-console.mjs 출력파일.png "메뉴명"
# 예) node e2e/m2net-console.mjs shot.png "통화상세내역"
```

동작: 로그인 → 좌측 `mkmenu` 프레임에서 메뉴명 **부분일치** 링크를 **JS클릭**(`el.click()`으로 `onclick=reverseClick(n)` 발동 — 트리가 접혀 안 보여도 됨) → 콘텐츠 로드 대기 → `fullPage` 캡쳐. 산출 `_m2net_*.png`는 gitignore(회원데이터 보호). 그 뒤 `Read`로 이미지 판독.

## 메뉴 지도 (2026-07-10 자동추출, href)

문자발송관리 제외 = 나머지 전부 사용(사장님 확인).

| 그룹 | 메뉴 | href (`/CPTL/...`) |
|---|---|---|
| 상담-결과관리 | 상담상세내역 | `LogMan/CsrLogB/index.jsp` |
| | 통화상세내역 | `LogMan/TelLogB/index.jsp` |
| | 일별상담현황 | `MktSup/CsrStts3/index.jsp` |
| | 일별선불현황 | `MktSup/PreStts/index.jsp` |
| | 일별후불현황 | `MktSup/PostStts/index.jsp` |
| | 월별선불현황 | `MktSup/PreMonth/index.jsp` |
| | 월별후불현황 | `MktSup/PostMonth/index.jsp` |
| | 상담사실적관리 | `MktSup/CsrStts2/index.jsp` |
| 상담-원부관리 | 상담사원부 | `MstMan/CsrMst/index.jsp` |
| | 회원원부 | `MstMan/MembMst/index.jsp` |
| 상담-기타관리 | 결제내역 | `Etc/PayLog/index.jsp` |
| | 충전이력 | `Etc/FillLog/index.jsp` |
| | 차감이력 | `Etc/DecrLog/index.jsp` |
| | VIP관리 | `Etc/Vip/index.jsp` |
| | 블랙리스트 | `Etc/Black/index.jsp` |
| | 가상계좌입금내역 | `Etc/VrBank/Hist/index.jsp` |
| | 예약원부 | `Resv/ResvMst/index.jsp` |
| | 예약취소이력 | `Resv/ResvMst/Hist/index.jsp` |
| | 상담연결실패이력 | `Etc/TryConnFail/index.jsp` |
| | 상담사수정이력 | `MstMan/Hist/CsrMst/index.jsp` |
| CP관리자관리 | CP정보확인및수정 | `MstMan/CpMst/CpUpd/index.jsp` |

## 안전 원칙 (읽기 전용)

스크립트는 로그인·이동·캡쳐만 한다. **코인지급/상태변경 등 돈 바꾸는 클릭은 의도적으로 넣지 않음.** 돈 변경은 반드시 정식 API 경로 + 사장님 확인 후. 이 원칙을 깨는 자동화 추가 금지.

## 한계·확장

- 기본 조회 = **오늘 날짜·전체**. 특정 회원(전화번호)·기간 조회는 각 화면 검색폼을 채워야 함. 예: 통화상세내역 = `검색1: 전화번호(회원)` + `일자별조회조건` date input 2개 + `검색` 버튼. 필요 화면이 정해지면 스크립트에 화면별 파라미터(전화번호/시작일/종료일) 인자를 추가한다.
- 실증(2026-07-10): 통화상세내역에서 상담사ID·통화시간(초)·선불여부·시작/종료시각 실데이터 판독 성공.

## 언제 자동으로 대조하나 (행동 원칙)

돈·과금·상담연결·정산·충전·차감·매출 KPI를 분석할 때는 **사장님 요청 없이도** 엠투넷을 대조하는 것이 기본. 예: 상담사 적립 이상 → 통화상세내역의 실통화시간·선불여부 대조; 회원 잔액 클레임 → 회원원부·충전/차감이력 대조; 매출 KPI 이상 → 일별/월별 현황 대조. 관련: [payment/01-m2net-relation](../payment/01-m2net-relation.tech.md), 외부벤더 [system/06-external-vendors](06-external-vendors.md).
