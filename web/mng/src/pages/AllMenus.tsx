import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Users, CreditCard, Headphones, FileText, Bell, BarChart3, Shield,
  MoreHorizontal, Settings as SettingsIcon, Ticket, Search, Star, X,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
// [2026-07-10] 화면 텍스트 자동 인덱스 — 각 페이지 코드에서 화면 한글 단어를 빌드 시 자동 추출(scripts/gen-search-index.mjs).
//   화면에 보이는 단어는 aliases 에 손으로 안 넣어도 자동 검색됨. 새 기능 추가해도 다음 빌드에 자동 반영.
import menuSearchIndex from '../generated/menuSearchIndex.json'
const SCREEN_INDEX = menuSearchIndex as Record<string, string[]>

/** _HANDBOOK/index.json (GET /admin/handbook/index) — 전체메뉴 용어 자동 동기화 소스 */
interface HbItem { slug: string; title: string; tags: string[] }
interface HbIndex { categories: { items: HbItem[] }[] }

/**
 * 전체 메뉴 — 관리자 페이지의 모든 기능을 한 화면에 나열한 인덱스.
 *
 *  - 평소: 메인 페이지 링크만 깔끔하게 노출
 *  - 검색어 입력 시: 매칭된 메인 메뉴 + 매칭된 sub-feature (탭/섹션) 평탄화 노출
 *    예) "등급단가" → "기본환경설정 > 등급/단가 > 단가 정책" 위치 즉시 파악
 *  - 즐겨찾기 (localStorage): 자주 쓰는 메뉴 상단 고정
 *
 * 메뉴 데이터는 Sidebar.tsx 와 동기화 필요 — 라우트 추가 시 양쪽 모두 업데이트.
 * subFeatures 는 각 페이지의 탭/섹션/필터 라벨을 모은 것. 클릭 시 메인 페이지로 이동
 * (자동 탭 활성화는 각 페이지에 hash/query 핸들러를 붙여야 가능 — 추후 점진 적용).
 */

type SubFeature = string | { label: string; tab?: string }

function subLabel(s: SubFeature): string {
  return typeof s === 'string' ? s : s.label
}
function subTab(s: SubFeature): string | undefined {
  return typeof s === 'string' ? undefined : s.tab
}

interface MenuItem {
  label: string
  path: string
  star?: boolean
  subFeatures?: SubFeature[]
  /** 검색용 별칭 (한글 동의어·약칭·관련 키워드). 예: 소셜로그인 → ['카톡 키', '카카오 API'] */
  aliases?: string[]
  /** true 면 슈퍼관리자(is_super=true)에게만 노출. 일반 admin 검색/리스트에 안 잡힘. */
  superOnly?: boolean
}

interface MenuGroup {
  title: string
  icon: typeof Users
  items: MenuItem[]
}

const GROUPS: MenuGroup[] = [
  {
    title: '회원현황',
    icon: Users,
    items: [
      { label: '고객 리스트', path: '/members/customers',
        aliases: ['회원', '유저', '사용자', '닉네임', '휴대폰', '전화번호', '이메일', '차단', '블랙', '탈퇴', '활동 회원',
          '무료코인', '코인내역', '포인트조정', '수동지급', '코인지급', '코인차감', '포인트이력', '출석이력', '회원조회', '회원번호', '고객번호', '가입경로', '유입경로', '소셜로그인', '카카오가입', '네이버가입', 'VIP회원', '휴면회원', '이탈위험', '잔액보유', '결제건수', '우편번호', '주소검색', '생년월일', '연령', '권한', '최근접속일', '탈퇴일시', '차단만료일시', '손님', '멤버', '멤버십', '가입자', '회원DB', '고객DB', '정지회원', '신규가입자', '회원정보', '프로필', '잔액조회', '단골', '회원관리', '유저관리', '고객관리', '소비자', 'm2net_membid', '회원리스트', 'CS대상자', '신고당한회원', '먹튀회원'],
        subFeatures: ['전체', '활동 회원', '차단 회원', '탈퇴 회원', '포인트 조정', '출석 이력'] },
      { label: '상담사 리스트', path: '/members/counselors',
        aliases: ['강사', '선생님', '상담원', '해시태그', '태그', '프로필', '한줄소개', '헤드라인', '닉네임', '단가', '분야', '사주', '타로', '신점', '심리', '사진', '이미지',
          '뱃지', '전속파트너', '전속', '채팅단가', '전화단가', '예비파트너', '파트너', '상담사조회', '상담사검색',
          '차단', '블랙', '회원차단', '차단관리', '차단해제', '블랙리스트', '부적절회원', '상담사번호', '공개번호', '연결번호', 'dtmfno', 'csrid', 'telno', 'm2net', '엠투넷', '로열티', '정산비율', '우선순위', '연결순위', '급상승', '이벤트상담사', '메인상위노출', '선불여부', '계좌정보', '예금주', '은행명', '계좌번호', '약력', '전문분야', '매출TOP', '지금가능', '쌤', '역술인', '역술가', '점쟁이', '도사', '무당', '타로마스터', '카운셀러', '전문가', '어드바이저', '상담사관리', '상담사DB', '승인상담사', '활동상담사', '탈퇴상담사', '온라인상태', '접속상태', '잠수상담사', '먹튀상담사', '부업상담사', '겸업상담사'],
        subFeatures: ['상태: 상담가능', '상태: 상담중', '상태: 부재', '분야: 타로', '분야: 신점', '분야: 사주', '분야: 심리', '전속파트너 뱃지', '해시태그 설정',
          '차단 관리 (상담사 상세 하단)'] },
      { label: '상담사 신청 내역', path: '/members/counselor-apply',
        aliases: ['지원', '신청', '가입 신청', '승인', '심사', '신청서', '대기', '반려', '상담사등록', '상담사신청', '신규상담사', '검토중', '대체됨', '상담사지원', '상담사문의', '기타문의', '예명', '지역', '첨부파일', '와이드사진', '계약서', '회원연동', '비회원', '계정복구', '중복신청', '입점', '입점신청', '채용', '채용관리', '상담사모집', '모집', '지원자', '지원서', '온보딩', '상담사되기', '프리랜서등록', '파트너등록', '신청내역', '승인대기목록', '서류심사', '거절', '재신청'] },
      { label: '모집인 관리 (서포터즈)', path: '/promoters',
        aliases: ['모집인', '서포터즈', '삐끼', '영업맨', '회원모집', '회원모집보상', '추천코드', '전화뒷자리', '자가신청', '승인', '반려', '기대수익', '회원추천', '마케팅', '길거리모집', '귀속', '사후입력', '보상요율', '정산배치', '총적립', '원천징수', '실지급액', '정산대기', '정산됨', '미정산', '무효', '주민번호', 'RRN', '계좌정보', '은행명', '계좌번호', '예금주', '모집인원', '영업사원', '홍보대사', '앰버서더', '리퍼럴', 'referral', '바이럴', '바이럴마케팅', '소개비', '소개수당', '유치', '회원유치', '파트너', '제휴', '대리점', '지사', '영업지점', '수당관리', '정산대상자', '회원영업'],
        subFeatures: ['모집인 등록', '자가신청 승인/반려', '상태: 승인대기·활성·반려', '기대수익·적립 내역', '정산 (지급완료 마킹)'] },
      { label: '출석 관리', path: '/attendance', star: true,
        aliases: ['출석', '체크인', '출석체크', '보너스 포인트', '일일 출석',
          '연속출석', '연속보너스', '30일쿠폰', '5일보너스', '10일보너스', '15일보너스', '20일보너스',
          '출석보상', '출석코인', '출석이력', '무료코인출석', '출석정책', '출석한도', '회원별이력', '안전장치', '쿠폰발급', '누적출석자', '누적지급액', '기본코인', '보너스코인', '연속일수', '출석체크ON', '출석체크OFF', '출첵', '근태', '근태관리', '출근', '출근관리', '활동일수', '접속일수', '로그인이력', '접속이력', '데일리체크인', '개근', '스트릭', 'streak', '앱접속', '로그인체크', '출석리워드', '매일접속'],
        subFeatures: [
          { label: '정책 설정', tab: '정책' },
          { label: '통계', tab: '통계' },
          { label: '회원별 이력', tab: '회원별 이력' },
          '회원/상담사 토글',
          '연속 보너스 (5·10·15·20일)',
          '30일 달성 쿠폰 (10,000코인, 14일 만료)',
          '일일 총 한도 설정',
          'IP 일일 제한',
          '최소 가입일 조건',
        ] },
      { label: '등급 관리', path: '/grade', star: true,
        aliases: ['등급', '단가', '정산률', '승급', '강등',
          '예비파트너', '파트너1', '파트너2', '파트너3', '파트너4', '파트너5', 'preliminary', 'partner',
          '임계값', '누적상담시간', '재산정', '자동강등', '강등단계', '월1일락', '등급분포', '등급이력', '즉시승급', '크론재산정', '강제등급변경', '강제단가변경', '실시간승급', '당월목표시간', 'D-day', '정산률변경', '단가옵션', '정책변경이력', '레벨', '레벨관리', '티어', 'tier', '등급표', '등급설정', '수수료율', '배분율', '지급율', '마진율', '요율', '상담사등급', 'VIP등급', '골드실버', '랭킹', '회원등급', '멤버십등급', '등급별혜택', '급수'],
        subFeatures: [
          '등급별 분포',
          '단가·정산률 변경',
          '재산정 D-day (매월 1일)',
          '최근 등급 변동',
          '정책 변경 이력',
          '예비 / 파트너1~5 등급',
          '임계값 (누적 상담 시간 기준)',
          '강등 최대 단계 설정',
          '월 1일 단가 변경 락',
        ] },
    ],
  },
  {
    title: '매출현황',
    icon: CreditCard,
    items: [
      { label: '사용(상담) 내역', path: '/consultations',
        aliases: ['통화', '상담 내역', '전화 내역', '채팅상담', '전화상담', '060', '070', '상담기록', '통화기록', '상담시간', '상담이력',
          '차단', '블랙', '회원차단', '차단등록', '회원ID', '회원이름', '상담사ID', '상담사닉네임', '선불', '후불', '유료', '무료', '진행시간', '사용포인트', 'm2net차감', '상담사수익금', '영업이익', '상담분야', '휴대폰번호', '엑셀다운로드', '채팅내역', '차단해제', '사용내역', '이용내역', '거래내역', '상담로그', '룸리스트', '채팅방목록', '과금내역', '차감내역', '코인사용내역', '이용현황', 'CS확인용', '유료전화', '통화이력', '상담내역조회', '콜기록', '상담사별매출'],
        subFeatures: ['전체목록', '060 전화', '070 전화', '채팅', '상담 상세', '상담 건별 회원 차단 (행 우측 [차단] 버튼)'] },
      { label: '환불 이력', path: '/refunds', star: true,
        aliases: ['취소', '환급', '환불 신청', '환불 요청', '리펀드', '결제취소', '코인환불', '환불처리', '반려', '대기', '승인', '처리자', '환불사유', '환불상태', '환불금액', '요청자', '결정자', '환불이력없음', '반환', '돌려줌', '클레임', '컴플레인', '민원환불', '부분환불', '전액환불', '자동환불', '환불승인', '환불거절', '오과금환불', '결제취소내역', '취소내역', '리펀드처리', '취소처리', '환불관리'],
        subFeatures: ['회원 아이디 검색', '상태별 필터', '환불 승인/거절'] },
      { label: '고객보호비용 내역', path: '/short-call-refunds', star: true,
        aliases: ['매몰비용', '30초 미만', '짧은 통화', '환원', '자동 환원', '단기 통화', '고객보호', '자동환불', '짧은통화보상', '청구서', '청구서대조', '회수불가비용', '발생일시', '이용시간', '매몰금액', '단가', '구분', '정책시행일', '회계정합성', '단시간환불', '즉시종료환불', '초단시간', '먹튀방지', '먹튀', '3분미만', '불량상담', '상담사귀책', '보호비용', '소비자보호', '고객보상', '안심보장', '안전장치', '페널티', '강제환불', '이상거래환불'],
        subFeatures: ['이번달 합계', '발생일 필터', '회원 매핑', 'callid·csrid·membid'] },
      { label: '운영 KPI', path: '/ops-kpi', star: true,
        aliases: ['지표', '실적', '성과', '매출 지표', 'health-check', '불변식', '이상감지', '헬스체크', '건강체크', '자동감지', '22개점검', 'KPI', '핵심지표', '총매출', '환불률', '평균통화시간', '상담사매출순위', '예비파트너', '파트너등급', 'TOP20', '전화건수', '채팅건수', '대시보드', '통계요약', '운영현황', '종합현황', '모니터링', '운영모니터링', '지표관리', '위반내역', '룰체크', '자동점검', '이상거래탐지', '전체현황판', '성과지표', '운영대시보드', '알람'],
        subFeatures: ['최근 7일', '최근 30일', '최근 90일', 'KPI 카드', '상담사 순위', 'health-check 22개 불변식'] },
      { label: '충전금액 설정', path: '/charge-amounts',
        aliases: ['코인 충전', '충전 금액', '결제 옵션', '패키지', 'VVIP', 'VIP', '보너스퍼센트', '충전상품', '보너스적립',
          '30만원패키지', '20만원패키지', '10만원패키지', '5만원패키지', '3만원패키지', '상품명', '결제금액', 'VAT별도', '지급포인트', '문구', '노출', '행추가', '저장', '충전단가', '코인패키지', '코인상품', '충전권종', '충전옵션', '충전금액관리', '결제금액설정', '상품설정', '가격설정', '코인가격', '코인단가', '충전금액표', '이벤트충전', '보너스코인', '추가지급코인', '충전혜택', '프로모션충전'],
        subFeatures: ['상품명·금액·보너스% 설정', '총 지급 포인트 설정', '문구 설정', '노출 ON/OFF'] },
      { label: '결제 내역', path: '/payments',
        aliases: ['주문', '구매', '카드 결제', '가상계좌', '자동충전', '사주플랜페이', '빌링키', 'AG9', 'PG', '결제완료', '결제취소', '결제방법', '결과', '입금완료', '취소완료', '정상처리', '입금전', '사용자코드', '일반전화', '잔액이상', '주문번호', '카드직접', '카드자동', '환불가능금액', '전액환불', '환불누계', '결제기록', '결제로그', '결제이력', 'PG내역', 'PG로그', '카드내역', '승인내역', '승인로그', '매출전표', '거래로그', '충전내역', '충전기록', '코인충전내역', '결제확인', '입금확인', '자동결제내역', '정기결제', '구독결제', '실패내역', '결제실패', '미승인', 'm2net내역'],
        subFeatures: ['전체목록', '카드', '가상계좌', '자동충전', '카드취소'] },
      { label: '코인·수익금 원장', path: '/points/history',
        aliases: ['포인트', '코인', '잔액', '잔액 조정', '지급', '차감', '증감',
          '무료코인', '유료코인', '후기코인', '베스트후기코인', '출석보상코인',
          '수동지급', '이벤트보상', '관리자지급', '코인이력', '적립내역', '코인지급이력', '원본장부', '처리자', '만료일', '증감액', '정정', '유효기간', '소비', '수익', '추천배지', '회원아이디검색', '포인트내역', '포인트이력', '포인트원장', '잔액내역', '잔액변동', '코인원장', '코인로그', '수익금내역', '수익금로그', '정산근거', '원장', '거래장부', '입출금내역', 'free_balance', 'paid_balance', 'earning_balance', '무료코인내역', '유료코인내역', '적립사용이력'],
        subFeatures: ['코인·수익금 통합원장', '개별회원 잔액 증감', '무료 코인 이력', '후기 작성 보상', '출석 보상', '베스트 후기 선정 10,000코인', '관리자 수동 지급'] },
      { label: '정산 이력', path: '/settlements',
        aliases: ['정산', '원천세', '월정산', '월별 정산', '실수령', '실지급', '3.3%', '선지급차감',
          '정산예상', '정산하기', '무효화', '미정산', 'earning', '수익금정산',
          // (옛 용어 — 검색 호환용. 정산단순화로 실제 화면에선 제거됨)
          '부가세', 'VAT', '회선비', '공급가', '이월음수', '추천수당', '정산현황', '정산미리보기', '계산됨', '지급완료', '계좌미등록', '정산완료알리기', '대상상담사', '정산예상합계', '실지급합계', '해당월', '월급', '급여', '상담비지급', '지급내역', '정산금액', '정산관리', '세금계산', '지급확정', '정산확정', '정산완료', '정산일자', '상담사급여', '수익금정산배치', '배치정산', '정산리포트', '지급명세서', '정산승인'],
        subFeatures: ['총건수', '정산예상금액(미정산 earning 합)', '미정산 선지급 차감', '원천세 3.3%', '실지급액', '정산하기/무효화 버튼', '※자동 cron 비활성(정산단순화 전환중)'] },
      { label: '선지급 관리', path: '/payouts', star: true,
        aliases: ['선지급', '가불', '미리 지급', '수수료', '원천세',
          '수수료5%', '가용잔액70%', '일1회한도', '원천징수3.3%', '조기정산', '즉시입금', '입금신청', '은행이체', '정산전입금', '신청금', '신청시각', '계좌정보', '반려사유', '반려처리', '송금완료처리', '24시간미처리', '처리대기', '오늘지급', '이번달누적', '대기CSV', '조기출금', '미리받기', '선정산', '선인출', '긴급출금', '빠른정산', '선지급승인', '선지급신청내역', '즉시출금', '조기지급', '통장입금', '계좌이체', '출금신청', '출금관리', '선지급수수료', '선지급한도', '실시간정산'],
        subFeatures: [
          '처리 대기',
          '오늘 지급',
          '이번달 누적',
          '24h+ 미처리',
          { label: '대기 CSV 다운로드', tab: 'pending' },
          '선지급 운영 정책',
          '수수료 5% + 원천세 3.3% 차감',
          '가용 잔액 70% 한도',
          '일 1회 신청 제한',
        ] },
      { label: '추천수익금', path: '/referrals', star: true,
        aliases: ['추천인', '추천코드', 'CSR코드', '인센티브', 'referral', '수당',
          '추천자', '피추천자', '추천수익', '추천관계', '6개월', '2%', '1%', '매월지급', '추천보상', '추천시스템', '추천정책', '인센티브요율', '적용기간', 'B매출', '개월차', '비활성사유', '새추천등록', '실시간적립', '예상지급', 'earning_balance', '추천수당', '초대보상', '초대코인', '친구초대', '바이럴리워드', '리퍼럴수익', '소개수당', '소개비', '모집수당', '모집인정산', '상담사추천', '추천인관리', '3개월정산', '리퍼럴프로그램', '추천링크', '초대링크'],
        subFeatures: ['활성 관계', '이번 달 지급대상', '지급 완료', '미지급', '월별 필터', '상태별 필터',
          '정책 설정 (요율·기간)', '새 추천 관계 등록', '개별 지급 처리',
          '1~3개월: 매출 2% / 4~6개월: 매출 1%'] },
    ],
  },
  {
    title: '쿠폰',
    icon: Ticket,
    items: [
      { label: '쿠폰존 관리', path: '/coupon-zones',
        aliases: ['쿠폰', '코드쿠폰', '다운로드쿠폰', '쿠폰발급', '가입쿠폰', '이벤트쿠폰',
          '쿠폰캠페인', '할인코드', '프로모코드', '무료코인쿠폰', '쿠폰정책', '쿠폰존', '쿠폰추가', '쿠폰등록', '쿠폰번호', '코드입력쿠폰', '포인트추가쿠폰', '발급대상회원', '회원검색', '쿠폰코드', '유효기간', '사용기간', '다운로드수', '쿠폰삭제', '쿠폰목록', '쿠폰이름', '할인권', '할인코드', '쿠폰코드', '프로모션', '프로모코드', '프로모', '쿠폰발급', '쿠폰생성', '쿠폰캠페인', '이벤트쿠폰', '할인쿠폰', '쿠폰구역', '발급존', '쿠폰타겟팅', '대상쿠폰', '상품권', '기프트권', '쿠폰뿌리기', '쿠폰배포', '발급조건', '할인율설정', '쿠폰만들기'],
        subFeatures: ['다운로드 쿠폰 (직접 발급)', '코드입력 쿠폰 (SNS 배포)', '회원가입 자동 쿠폰', '만료일 설정', '발급 이력 확인'] },
      { label: '🪙 쿠폰·코인 정책 가이드', path: '/coupon-coin-guide',
        aliases: ['쿠폰코인', '무료코인정책', '코인정책', '쿠폰가이드', '코인가이드', '이중지급', '가입코인', '출석코인', '후기코인', '즉시지급', '로그인코인', '연속출석보너스', '베스트후기코인', '중복지급', '쿠폰함', '사용내역', '수동발급', '폐지쿠폰', '10000코인', '쿠폰함탭', '코인정책', '코인가이드', '코인규정', '쿠폰규정', '쿠폰정책', '정책문서', '정책안내', '이용약관', '코인충전정책', '코인사용정책', '쿠폰사용법', '쿠폰안내', '코인안내', '코인룰', '쿠폰룰', '정책설명서', '코인가이드라인', '정책페이지', '코인교환비율', '코인환급정책', '코인적립정책', '쿠폰지급기준'],
        subFeatures: ['즉시 코인 vs 쿠폰 구분', '회원가입 코인', '출석 코인', '후기 코인', '이중지급 금지 정책'] },
    ],
  },
  {
    title: '상담·문의 관리',
    icon: Headphones,
    items: [
      { label: '상담후기 관리', path: '/posts/review',
        aliases: ['후기', '리뷰', '베스트후기', '베스트선정', '10000코인', '후기보상', '사진후기', '후기관리', '후기삭제', '후기코인', '시딩후기', '시딩', '후기수정', '별점', '평점', '좋아요', '싫어요', '후기정책', '상담사답변', '작성조건', '후기목록', '리뷰관리', '리뷰', '평점', '별점', '평가', '소감', '상담평가', '상담소감', '고객후기', '이용후기', '상담사평가', '리뷰목록', '리뷰리스트', '상담리뷰', '별점관리', '평점관리', '후기게시판', '리뷰게시판', '찐후기', '가짜후기', '초기후기', '후기승인', '후기심사', '후기검수', '리뷰조회'],
        subFeatures: ['베스트 후기 선정 (10,000코인 즉시 지급)', '후기 숨김/복원', '사진 후기 구분', '신고 후기 처리'] },
      { label: '후기 신고 관리', path: '/review-reports',
        aliases: ['신고', '허위후기', '악성후기', '신고처리', '후기신고', '불량후기', '숨김처리', '반려처리', '욕설비방', '광고스팸', '개인정보노출', '처리메모', '신고사유', '자동숨김', '후기복원', '신고내역', '검토완료', '리뷰신고', '신고내역', '신고목록', '신고접수', '후기제보', '제보', '클레임', '블라인드처리', '후기블라인드', '후기삭제요청', '부적절후기', '악성후기', '리뷰신고관리', '후기클레임', '신고처리', '신고심사', '후기검토', '후기고발', '리뷰블라인드', '허위후기신고', '욕설후기', '스팸후기'],
        subFeatures: ['신고 3회 자동 숨김', '신고 수동 처리', '신고 사유 확인'] },
      { label: '채팅내역 리스트', path: '/chat-history',
        aliases: ['채팅', '채팅룸', '대화내용', '채팅로그', '채팅내역', '채팅기록', '채팅방', '채팅조회', '룸ID', '룸토큰', '메시지수', '선결제채팅', '채팅상세', '대화상세', '메시지내역', '채팅룸검색', '대화기록', '상담기록', '채팅로그', '톡내역', '채팅이력', '대화내역', '메시지기록', '채팅내용', '상담내용', '채팅검색', '대화로그', '메시지로그', '채팅다시보기', '상담채팅', '채팅모니터링', '채팅조회', '대화조회', '상담대화', '채팅히스토리', '톡기록', '채팅룸조회'],
        subFeatures: ['채팅룸 ID 검색', '회원별 채팅 이력', '상담사별 채팅 이력'] },
    ],
  },
  {
    title: '게시판관리',
    icon: FileText,
    items: [
      { label: '인기검색어 관리', path: '/search-keywords',
        aliases: ['핀고정', '고정검색어', '트렌딩', '검색어순위', '자동완성', '검색추천', '인기어', '핀', '인기검색', '검색어관리', '검색로그', '검색기록', '검색이력', '검색어로그', '검색IP', '결과수', '회원검색어', '검색로그', '검색기록', '검색이력', '검색어분석', '검색통계', '검색데이터', '검색어리스트', '검색어수집', '유저검색어', '검색쿼리', '검색어관리', '검색행동', '검색어DB', '검색히스토리', '검색용어', '검색어원본', '검색어원장', '고객검색어'],
        subFeatures: ['핀 고정 (최상단 고정)', '수동 검색어 등록', '순위 관리', '노출 ON/OFF'] },
      { label: '인기검색어 순위', path: '/search-popular',
        aliases: ['검색순위', '랭킹', '인기순위', '검색통계', '검색량', '실시간순위', '핀고정', '핀', '고정검색어', '검색어고정', '집계기간', '검색어순위', 'TOP검색어', '순위관리', '인기어', '핫키워드', '트렌드검색어', '실시간검색어', '급상승검색어', '검색순위', '랭킹검색어', '트렌드', '화제검색어', '인기키워드', '최다검색어', '검색어TOP', '검색어랭킹', '인기검색순위', '트렌딩', '인기토픽', '많이찾는검색어', '핫이슈검색어'],
        subFeatures: ['실시간 검색순위', '기간별 통계'] },
      { label: 'FAQ 관리', path: '/faqs',
        aliases: ['자주묻는질문', '도움말', 'FAQ', '질문답변', '고객FAQ', '공통FAQ', 'FAQ카테고리', 'FAQ항목', '질문', '답변', '카테고리관리', '자주하는질문', '노출순서', '자주묻는질문', '큐앤에이', '질문답변', '자주하는질문', '도움말', '헬프', '고객센터질문', '문의답변모음', '답변모음', '자동응답', '질의응답', '헬프센터', '안내사항', '궁금한점', '질문모음', 'FAQ등록', 'FAQ작성'],
        subFeatures: ['FAQ 등록/수정/삭제', '카테고리 분류', '노출 순서'] },
      { label: '공지사항 관리', path: '/notices',
        aliases: ['공지', '알림', '안내', '시스템공지', '서비스공지', '공지등록', '공지사항', '상단고정', '공지작성', '공지수정', '공지URL', '임시저장', '푸시연동', '고정공지', '공지', '안내', '공고', '알림사항', '안내사항', '공지글', 'announcement', '서비스공지', '시스템공지', '점검공지', '안내문', '뉴스', '소식', '업데이트안내', '서비스안내'],
        subFeatures: ['공지 등록/수정/삭제', '노출 기간 설정'] },
      { label: '이벤트 관리', path: '/events',
        aliases: ['이벤트', '행사', '프로모션', '캠페인', '이벤트페이지', '이벤트등록', '이벤트썸네일', '진행기간', '이벤트상태', '진행중', '예정이벤트', '이벤트수정', '이벤트이미지', 'event', '행사', '프로모션', '이벤트페이지', '기획전', '특가', '프로모', '캠페인', '시즌이벤트', '할인행사', '경품이벤트', '이벤트페이지관리', '이벤트글', '이벤트기획', '프로모기획', '행사관리'],
        subFeatures: ['이벤트 등록/수정/삭제', '이벤트 기간 설정', '이미지 업로드'] },
      { label: '게시판 신고 관리', path: '/post-reports',
        aliases: ['신고', '신고처리', '불량게시물', '게시판신고', '악성댓글', '신고게시물', '상담사문의신고', '숨김복원', '반려', '처리됨', '신고자', '대상회원', '신고사유', '문의숨김', '게시글신고', '글신고', '댓글신고', '신고게시판', '커뮤니티신고', '부적절게시글', '게시물신고', '신고글목록', '커뮤니티제보', '게시판제보', '악성글신고', '스팸신고', '제보내역', '고발내역'],
        subFeatures: ['신고 목록', '신고 처리 (숨김/복원)', '신고 사유'] },
      { label: '글·댓글 현황', path: '/posts-overview',
        aliases: ['게시물', '댓글', '활동현황', '글현황', '게시판현황', '작성현황', '게시글수', '댓글수', '최근작성', '게시판통계', '글수', '게시판별', '게시글현황', '댓글현황', '게시물통계', '커뮤니티현황', '글목록', '댓글목록', '전체게시글', '게시물관리', '글쓰기현황', '활동현황', '게시판대시보드', '콘텐츠현황', '작성현황', '게시글리스트', '댓글리스트', '게시판요약', '전체현황'],
        subFeatures: ['게시판별 글 수', '최근 작성 현황'] },
    ],
  },
  {
    title: '알림',
    icon: Bell,
    items: [
      { label: '📤 알림 보내기(수동)', path: '/push-notifications', star: true,
        aliases: ['알림 보내기', '알림보내기', '인앱', '인앱 알림', '종모양', '푸시', '앱 알림', '앱 푸시', '푸시 발송', 'FCM 발송', '푸시전송', '앱알림발송', '채널 선택', '수동 발송', '전체공지', '일반회원', '개별회원', '회원검색', '회원검색발송', '대상선택', '알림작성', '발송대상', '공지발송', '이동주소', '링크첨부', '제목작성', '푸시', '푸시발송', '푸시보내기', '푸시쏘기', 'FCM', '에프씨엠', '앱푸시', '알림발송', '알림쏘기', '새알림', '메시지발송', '공지발송', '개별발송', '타겟발송', 'notification', '딥링크발송', 'event_url', '회원알림', '상담사알림', '이벤트발송', '긴급공지'],
        subFeatures: ['인앱·푸시 채널 선택 발송', '대상 구분(전체/회원/상담사/개별)', '푸시는 인앱 자동 동반'] },
      { label: '🔔 알림 이력', path: '/notification-history', star: true,
        aliases: ['알림 이력', '알림이력', '인앱 이력', '푸시 이력', '보낸 이력', 'notification_log', '종모양 이력', '채널 필터', '발송 기록', '읽음', '안읽음', '알림삭제', '내역비우기', '알림상세', '발송자', '수신자', '제목검색', '본문검색', '아이디검색', '카테고리필터', '분류필터', '알림이력', '알림내역', '발송내역', '발송이력', '발송기록', '푸시이력', '푸시내역', '푸시로그', '알림로그', 'history', 'log', '보낸알림', '알림결과', '발송현황', '수신여부', '읽음여부', '열람율', '알림검색', '과거알림', '발송조회'],
        subFeatures: ['인앱·푸시 보낸 기록', '채널 필터(인앱/푸시)', '카테고리·검색', '내역 비우기'] },
      { label: '💬 알림톡 발송(수동)', path: '/alimtalk-bulk', star: true,
        aliases: ['카톡', '카카오톡', '문자', '메시지', 'SMS', '비즈엠', '알림톡발송', '수동 발송', '일괄 발송', '카카오알림톡', 'BizM발송', '템플릿선택', '빈칸채우기', '미리보기', '변수채우기', '회원전원', '상담사전원', '전화번호붙여넣기', '테스트발송', '예상비용', '발송비용', '발송작업', '발송잠금', '알림톡', '카카오알림톡', '카톡알림', '비즈엠', 'BizM', 'bizm', '대량발송', '대량알림톡', '단체발송', '단체문자', '문자발송', 'SMS', '카톡보내기', '카톡쏘기', '알림톡쏘기', '알림톡보내기', '일괄발송', '벌크발송', 'bulk', '카카오톡발송', '회원전체발송', '상담사전체발송', '타겟알림톡'],
        subFeatures: [
          { label: '발송', tab: '발송' },
          { label: '이력', tab: '이력' },
        ] },
      { label: '📋 알림톡 발송 이력', path: '/alert-logs', star: true,
        aliases: ['알림톡 발송 이력', '알림톡 이력', '카카오알림톡 이력', '발송 이력', '알림 기록', '시스템 점검', 'health-check', '헬스체크', '일일요약', '점검결과', '발송기록', '안심', '무해', 'alimtalk_log', '실패만보기', '발송성공', '발송실패', '수신번호', '시스템점검상세', '테스트추정', '정산완료', '후기도착', '가입인증번호', '비밀번호찾기', '가상계좌안내', '선지급접수', '알림톡이력', '알림톡내역', '알림톡로그', '알림톡결과', '카톡발송이력', '카톡로그', 'BizM로그', '비즈엠이력', '실패내역', '실패로그', '발송성공률', '헬스체크', '위반내역', '발송상태', '수신확인', '알림톡통계', '오류로그'],
        subFeatures: ['알림톡 발송 이력 전체 조회', '시스템 점검 상세 (C-1/C-8/C-17)', '테스트 추정 판별', '실패만 보기 필터'] },
      { label: '📖 알림 전체 가이드', path: '/alert-guide', star: true,
        aliases: ['알림 전체 가이드', '알림 가이드', '다양한 알림형태', '알림 형태', '전체 알림', '알림 매트릭스', '알림 정책', '알림 정리', '채널', '푸시 인앱 알림톡', '결정', '중복', '카탈로그', '온보딩', '신입 관리자', '알림채널', '알림결정', '상태칩', '사용중', '미사용', '확인필요', '결정기준', '이벤트별채널', '권장채널', '중복위험', '채널통합표', '알림이벤트목록', '트리거확인', '알림가이드', '알림매뉴얼', '알림설명서', '알림안내', '채널가이드', '알림채널', '알림정책', '알림카탈로그', 'alertCatalog', '알림종류', '알림목록', '알림전체보기', '알림맵', '알림매핑', '이벤트알림목록', '알림규칙', '채널정책'],
        subFeatures: [
          '38개 이벤트 × 3채널 매트릭스',
          '결정완료/검토중 표시',
          '중복 위험 행 강조',
          '읽는 법 안내',
        ] },
      { label: '📱 푸시 가이드(참고)', path: '/push-guide',
        aliases: ['푸시 가이드', '푸시 카탈로그', '푸시 종류', 'FCM 종류', 'push catalog', '푸시목록', '알림종류', '참고', '카테고리필터', '상태별보기', '발송완료', '발송예정', '안씀', '언제발송', '누구에게발송', '이동경로', '구현위치', 'FCM카탈로그', '푸시가이드', '푸시매뉴얼', '푸시설명서', '푸시안내', 'FCM가이드', '푸시정책', '푸시종류', '푸시목록', '딥링크가이드', '앱푸시안내', '푸시규칙'],
        subFeatures: ['30+ 푸시 종류', '카테고리별 그리드', '상태 칩 (완료/예정/안함)'] },
      { label: '🧾 알림톡 템플릿(자동)', path: '/alimtalk-templates',
        aliases: ['템플릿', '카톡 양식', '메시지 양식', '비즈엠', 'BizM', 'v1', 'v2', '카톡 본문', '알림톡양식', '템플릿목록', '자동', '템플릿코드', '템플릿추가', '템플릿수정', '템플릿삭제', '버튼명', '버튼URL', '활성비활성', '변수삽입', '자동발송양식', '가입계정템플릿', '정산선지급템플릿', '쿠폰프로모션템플릿', '알림톡템플릿', '카톡템플릿', '비즈엠템플릿', 'BizM템플릿', '템플릿관리', '템플릿목록', '템플릿등록', '문구관리', '문구템플릿', '메시지템플릿', '승인템플릿', '템플릿승인', '카카오템플릿', '알림톡문구', '발신문구', '템플릿신청'] },
    ],
  },
  {
    title: '통계',
    icon: BarChart3,
    items: [
      { label: '통계', path: '/stats',
        aliases: ['방문자', '매출통계', '방문통계', '일별', '월별', '트래픽', 'DAU', 'MAU', '매출추이', '방문추이', '통계조회', '회원수', '상담사수', '오늘결제', '오늘방문', '이번달결제', '이번달방문', '상담매출', '결제매출', '매출합계', '기간별통계', 'KPI', 'dashboard', 'statistics', '리포트', 'report', '지표', '매출통계', '매출분석', '방문자통계', '방문자수', '트래픽', 'traffic', '가입자통계', '회원통계', '결제통계', '일별통계', '월별통계', '현황판', '운영현황', '사업현황', '데이터분석', '통합통계', '오늘실적', '실적'],
        subFeatures: ['일별 방문자', '일별 매출', '월별 매출', '일별 추이 기간'] },
    ],
  },
  {
    title: '권한관리',
    icon: Shield,
    items: [
      { label: '관리자 계정', path: '/admin-users',
        aliases: ['어드민', '권한', '하위 관리자', '운영자', '관리자등록', '관리자추가', '슈퍼관리자', '일반관리자', '관리자비활성화', '슈퍼부여', '슈퍼해제', '권한매트릭스', '최근로그인', '관리자목록', '관리자계정생성', 'SUPER', '관리자등급', '계정생성', '관리자', '어드민', 'admin', '운영자', '운영자계정', '계정관리', '계정목록', '슈퍼관리자', '최고관리자', '수퍼', 'super', '슈퍼권한', '권한부여', '권한설정', '관리자등록', '관리자추가', '로그인계정', '백오피스계정', '스태프', 'staff', '운영진'],
        subFeatures: ['관리자 등록/삭제', '슈퍼/일반 구분', '권한 매트릭스'] },
    ],
  },
  {
    title: '콘텐츠/노출',
    icon: FileText,
    items: [
      { label: '🖼 상단 배너', path: '/banners',
        aliases: ['배너', '광고', '메인 배너', '배너등록', '배너이미지', '상단배너', '홈배너', '노출콘텐츠', '콘텐츠', '배너위치', '회원가입완료배너', '메인상단배너', '메인중앙배너', '배너순서', '배너노출기간', '배너조회수', '배너추가', '이미지업로드', '진행중배너', '종료된배너', '배너', '띠배너', '띠광고', '현수막', '배너광고', '배너관리', '홈배너', '메인배너', '상단광고', '프로모션배너', '홍보배너', '노출배너', '광고관리', '슬라이드배너', '캐러셀', '이벤트배너', '콘텐츠노출', '노출관리'],
        subFeatures: ['메인 배너 등록/수정', '배너 활성/비활성', '링크 연결', '노출 기간'] },
      { label: '🪧 팝업 모달', path: '/popup-layers',
        aliases: ['팝업', '레이어', '공지 팝업', '팝업등록', '팝업관리', '팝업모달', '오늘하루안봄', '노출콘텐츠', '콘텐츠', '팝업대상', '회원만팝업', '상담사만팝업', '팝업기기', '팝업위치크기', '팝업이미지', '팝업링크', '팝업본문', '예약팝업', '종료된팝업', '다시보지않기', '팝업추가', '팝업', '레이어팝업', '레이어', '모달', 'modal', '팝업창', '팝업관리', '팝업광고', '홈팝업', '진입팝업', '앱팝업', '오늘하루안보기', '하루안보기', '공지팝업', '이벤트팝업', '프로모션팝업', '웰컴팝업', '팝업설정'] },
    ],
  },
  {
    title: '기타',
    icon: MoreHorizontal,
    items: [
      { label: '고객센터 문의(회원)', path: '/posts/qa',
        aliases: ['상담문의', '1:1 문의', '고객 문의', '문의 게시판', '고객센터', '회원문의', '고객문의처리', '카카오문의', '답변작성', '답변완료', '답변대기', 'CS답변', '이용안내', '비밀글', '문의답변', '운영자답변', 'QA', '문의내역', '하루10건', '물어보기', '질문', '상담요청', '헬프데스크', '헬프', '고객지원', '고객상담', '민원', '클레임', 'CS게시판', 'CS문의', '문의글', '문의답글', '티켓', '티켓문의', '미답변문의', '문의폭주', '일일문의제한', '답장', '회신', '답변달기', '문의확인', '사용자문의', '이용자문의', '고객의소리', 'VOC'] },
      { label: '1:1문의(상담사)', path: '/posts/qa_counselor',
        aliases: ['상담사문의', '상담사 1:1', '상담사 문의', '상담사QA', '답변완료', '답변대기', '비밀글', '상담사답변', '신고', '자동숨김', '숨김', '열람', '5개제한', '상담사질문', '강사문의', '선생님문의', '파트너문의', '상담사민원', '상담사CS', '상담사티켓', '상담사헬프', '상담사건의사항', '상담사질의', '강사질문', '운영진문의', '매니저문의', '파트너QA', '상담사물어보기', '상담사헬프데스크'] },
      { label: '상담사 고객센터 문의', path: '/counselor-inquiries',
        aliases: ['상담사 고객센터', '상담사 운영문의', '상담사 문의하기', '운영팀 문의', '정산문의', '이용안내 문의', '답변대기', '답변완료', '서비스상품', '분류', '사진첨부', '첨부파일', '운영팀답변', '문의하기', '상태필터', 'CS', '상담사헬프데스크', '강사운영문의', '파트너운영문의', '정산관련문의', '수익금문의', '지급문의', '계좌문의', '상담사고충', '상담사민원', '상담사티켓', '상담사문의폼', '상담사질문하기', '운영지원문의', '상담사CS센터', '문의카테고리', '강사고객센터'] },
    ],
  },
  {
    title: '환경설정',
    icon: SettingsIcon,
    items: [
      { label: '기본환경설정', path: '/settings',
        aliases: [
          '카톡 키', '카카오 키', '네이버 키', '소셜 키', 'API 키',
          '회사 정보', '사업자번호', '대표', '주소',
          '회원가입 포인트', '추천인 포인트',
          '스팸', '차단', '금지', 'IP',
          '세금', '원천', '수수료',
          '점검', '점검 안내', '점검 배너', '서비스 점검', 'maintenance',
          '후기포인트설정', '출석보상설정', '가입포인트', '로그인포인트',
          '자동충전설정', '사주플랜페이설정', '쿠폰설정', '무료코인설정',
          '등급단가설정', '정산률설정', '선지급설정', '사이트제목', '애널리틱스', '관리자메일', '카카오채널', '이메일인증', '가입등급', '닉네임수정', '탈퇴유예', 'IP차단', 'IP허용', '금지아이디', '통신판매업', '팩스', '대표전화', '운영시간', '저작권', '재산정일자', '강등단계', '신규가입단가', '알림톡템플릿코드', '수신자', '상담사스타일', '셋팅', '세팅', '설정', '환경', 'config', '옵션', '시스템설정', '전역설정', '사이트설정', '서비스설정', '기본설정', '초기설정', '컨피그', '관리자설정', '정책설정', '마스터설정', '통합설정', '운영설정', '앱설정', '웹설정', '세팅화면', '옵션관리', '파라미터', '환경변수'],
        subFeatures: [
          { label: '🔧 점검 안내 배너', tab: 'general' },
          { label: '배너 활성 ON/OFF', tab: 'general' },
          '사이트',
          { label: '회원가입 설정', tab: 'general' },
          { label: '후기 포인트 (일반 500코인 / 사진 +500코인)', tab: 'general' },
          { label: '가입포인트·로그인포인트 (출시 예정)', tab: 'general' },
          { label: '소셜로그인 (카카오/네이버)', tab: 'general' },
          { label: '보안 (IP 차단/금지 ID)', tab: 'general' },
          { label: '푸터(회사정보)', tab: 'general' },
          { label: '등급/단가 (예비~파트너5)', tab: 'grade' },
          { label: '단가 옵션 (등급별 선택지)', tab: 'grade' },
          { label: '정산률 (등급별 %)', tab: 'grade' },
          { label: '임계값 (승급 기준 상담시간)', tab: 'grade' },
          { label: '월 1일 락 (단가 변경 잠금)', tab: 'grade' },
          { label: '재산정 일자/시각', tab: 'grade' },
          { label: '강등 최대 단계', tab: 'grade' },
          { label: '선지급 정책 안내문', tab: 'payout' },
          { label: '선지급 수수료율 (현재 5%)', tab: 'payout' },
          { label: '선지급 원천세율 (현재 3.3%)', tab: 'payout' },
          { label: '운영알림', tab: 'ops' },
          { label: '운영자 알림 활성', tab: 'ops' },
          { label: '수신자 목록', tab: 'ops' },
          { label: '약관/처리방침', tab: 'legal' },
          { label: '상담사 스타일 선택지', tab: 'counselor' },
        ] },
      { label: '내용 관리 (약관/처리방침)', path: '/contents',
        aliases: ['약관', '처리방침', '이용약관', '개인정보', '서비스이용약관', '개인정보처리방침', '약관관리', '법적문서', 'HTML', 'TEXT', '노출', '비노출', 'slug', '정적페이지', '내용추가', '페이지관리', '콘텐츠관리', '모바일본문', '회사소개', '약관', '개인정보처리방침', '정책문서', 'terms', 'privacy', 'policy', '프라이버시', '개인정보정책', '법무문서', '컴플라이언스', '규정', '이용규정', '서비스규정', '정적콘텐츠', 'CMS', '페이지에디터', '본문관리', '텍스트페이지', '회사소개페이지', '이용안내페이지', '문서편집', '콘텐츠에디터', '약관문서'] },
    ],
  },
  {
    title: '대시보드',
    icon: BarChart3,
    items: [
      { label: '대시보드', path: '/dashboard',
        aliases: ['홈', '메인', '요약', '현황', '오늘현황', 'KPI', '오늘매출', '어제매출', '이번달매출', '진행중상담', '활성상담사', '신규회원', '신규상담사', '출석상담사', '포인트부채', '고객보호비용', '알림큐', '상담사상태', '매출추이', '가입추이', 'TOP5', '이탈위험', '미답변후기', '최근가입', '최근포인트', 'dashboard', '현황판', '홈화면', '관리자홈', '메인화면', '종합현황', '한눈에보기', '요약화면', '첫화면', '통합현황', '오늘의상황', '실시간현황', '전체요약', '운영현황', '메인대시보드', '관제화면', '모니터링화면', '첫페이지', '종합요약'],
        subFeatures: ['14일 매출 추이', '상담사 상태', '14일 방문자 추이', 'TOP5 상담사', 'TOP5 고객', '최근 가입', '최근 게시물', '최근 포인트'] },
    ],
  },
  {
    title: '운영 도구',
    icon: Wrench,
    items: [
      { label: '메모장', path: '/memo',
        aliases: ['노트', '기록', '필기', '비망록', '메모', '운영메모', '관리자메모', '자동저장', '이미지업로드', '드래그앤드롭', '에디터', 'HTML에디터', '캔버스', '개인메모', '노트', 'note', '메모앱', '메모리스트', '관리자노트', '업무메모', '인수인계', '인수인계메모', '스크래치패드', '낙서장', '워드패드', '텍스트에디터', '자유메모', '공유메모', '협업메모', '체크리스트메모', '할일메모', '임시저장문서', '잡기장'] },
      { label: '💰 영업이익 시뮬레이터', path: '/profit-simulator', star: true, superOnly: true,
        aliases: ['수익', '재무', '이익', '시뮬레이션', '시뮬', '손익', '마진', 'BEP', '손익분기', '매출시뮬', 'm2net비용', '통신사율', '상담마진', '규모확장', '목표로드맵', '사주나루', '벤치마크', '경쟁사', 'LTV', '광고ROI', 'CAC', '영업이익률', '회사몫', '등급별매출', '계산기', 'simulator', '모의계산', '예측', '재무예측', '사업계획', '사업성분석', '수익성분석', '손익계산기', '가정계산', '매출예측', '순익계산', '이익률계산', '경영시뮬레이션', '재무모델', '재무시뮬레이터', 'ROI계산', '투자수익률', '사업타당성', '손익시뮬'] },
      { label: '📖 운영 바이블', path: '/handbook', star: true,
        aliases: ['바이블', 'handbook', '운영매뉴얼', '정책문서', '운영가이드', '매뉴얼', '가이드', '정책검색', '운영정책', '카테고리', '문서검색', '자연어검색', '핸드북', '항목검색', '위키', 'wiki', '설명서', '도움말', 'help', '매뉴얼북', '업무매뉴얼', '온보딩자료', '신입가이드', '룰북', '규정집', 'SOP', '운영규정집', '지식베이스', '문서모음', '정책모음', 'FAQ집', '참고문서', '레퍼런스'],
        subFeatures: ['채팅 운영 정책', '결제·정산 정책', '회원 운영', '상담사 운영', '알림 정책', '추천수익금·쿠폰 정책', '시스템·인프라'] },
      { label: '🤖 운영 바이블 AI', path: '/handbook-ai', star: true,
        aliases: ['AI질문', 'AI검색', '자연어검색', 'Claude', 'AI운영', '운영AI', '바이블AI', '정책질문', '자연어질문', 'AI답변', '스마트검색', '세션', '대화기록', '새대화', 'SQL조회', '출처', '클레임', '분쟁', 'DB조회', '챗봇', '멀티턴', '챗봇검색', 'AI채팅', '인공지능검색', '질문하기AI', 'GPT', '어시스턴트', 'AI어시스턴트', '챗GPT', '대화형검색', 'AI질의응답', '스마트어시스턴트', 'AI헬퍼', '정책챗봇', '물어보기AI', '상담AI', 'AI도우미', '대화AI', '자동응답AI', '지능형검색'],
        subFeatures: ['자연어 질문 (예: "추천인 수수료 얼마야?")', '정책·데이터 통합 답변', 'SQL 조회 연계', '신입 관리자 온보딩'] },
      { label: '🔒 인프라 잠금 정보', path: '/infra-info', superOnly: true,
        aliases: ['인프라', '서버경로', '잠금', '변경불가', '죽은폴더', 'nginx', '배포경로', '서버설정', '고정경로', '타임존', '시간대', 'KST', '서버시간', '한국시간', '시차', '도메인', 'DB백업', '업로드경로', 'm2netURL', 'BizM도메인', '카카오OAuth', 'rclone', 'GitHub', '체크리스트', '외부서비스', 'SSL인증서', '전환계획', '서버', 'infra', '시스템', '배포', '접속정보', '계정정보', '비밀번호', '보안정보', '서버정보', '인프라정보', '시스템정보', '배포경로안내', '서버접속정보', 'SSH정보', '서버IP', '도메인정보', '인증서정보', '백업정보', '변경금지목록', '주의사항', '크리티컬정보'],
        subFeatures: ['변경 금지 경로 목록', '외부 서비스 등록 URL', '죽은 폴더 주의사항', '서버 타임존 (KST 고정)'] },
      { label: '🤖 AI 설정 (슈퍼)', path: '/handbook-config', superOnly: true,
        aliases: ['AI설정', 'AI키', 'API키', 'Claude설정', 'max_tokens', '모델설정', '바이블AI설정', 'Anthropic', 'AI활성화', 'Sonnet', 'Opus', 'Haiku', '토큰', '크레딧', '키발급', 'API키발급', '모델선택', '챗봇설정', 'AI환경설정', 'AI옵션', 'AI모델선택', 'LLM설정', '인공지능설정', 'GPT설정', '클로드설정', 'API키관리', '키관리', '인증키', '시크릿키', '모델파라미터', '토큰수설정', 'AI기능설정', 'AI활성토글', 'AI키등록'],
        subFeatures: ['API 키 입력', '모델 선택 (Sonnet/Haiku)', 'max_tokens 조정', '활성화 토글'] },
      { label: '🖥️ 엠투넷 콘솔 대조 (외부·Claude가 봄)', path: '/handbook?slug=system/15-m2net-console', star: true,
        aliases: ['엠투넷', 'm2net', 'passcall', 'PassCall', 'AG9', '엠투넷콘솔', '콘솔', '외부콘솔', '통화상세내역', '통화상세', '상담상세내역', '회원원부', '상담사원부', '충전이력', '차감이력', '결제내역', '일별상담현황', '일별선불현황', '일별후불현황', '월별선불현황', '월별후불현황', '상담사실적관리', '예약원부', '예약취소이력', '상담연결실패이력', '상담사수정이력', 'VIP관리', '블랙리스트', '가상계좌입금내역', '과금대조', '실시간과금', 'm2net대조', '엠투넷대조', '실과금', '과금확인', '매출대조', '잔액대조', '코인대조', 'Claude대조', '자동대조', '엠투넷로그인', '엠투넷화면', '엠투넷접속', '엠투넷데이터', '실통화시간', '선불여부', '읽기전용', 'm2net콘솔', 'passcall콘솔'],
        subFeatures: ['통화상세내역 (실통화시간·선불여부)', '회원원부 (엠투넷 잔액 대조)', '충전·차감이력', '결제내역·일별/월별 현황', '예약원부·상담연결실패이력', 'Claude가 자동으로 대조 — 직접 접속 불필요'] },
    ],
  },
]

/**
 * 메뉴 → 운영 바이블(_HANDBOOK) 문서 매핑 (deep-link).
 * slug 는 _HANDBOOK/index.json 기준. 항목 위에 마우스 올리면 📖 로 해당 정책 문서 바로가기.
 * 새 기능/문서 추가 시 여기 한 줄만 추가하면 메뉴↔바이블이 연결된다.
 */
const HANDBOOK_MAP: Record<string, string> = {
  '/members/customers': 'admin/04-member-ops',
  '/members/counselors': 'admin/04-member-ops',
  '/members/counselor-apply': 'counselor/01-apply',
  '/promoters': 'promoter/01-overview',
  '/attendance': 'member/03-attendance',
  '/grade': 'counselor/02-grade-pricing',
  '/consultations': 'payment/01-m2net-relation',
  '/chat-history': 'chat/03-exit-handling',
  '/refunds': 'payment/04-refund',
  '/short-call-refunds': 'payment/04-refund',
  '/payments': 'payment/02-charge-flow',
  '/charge-amounts': 'payment/02-charge-flow',
  '/points/history': 'payment/03-coin-system',
  '/settlements': 'payment/05-settlement',
  '/payouts': 'payment/06-payout',
  '/referrals': 'promotion/02-referral',
  '/coupon-zones': 'promotion/01-coupon',
  '/coupon-coin-guide': 'payment/08-coupon-coin-policy',
  '/posts/review': 'user/05-review',
  '/posts/qa': 'user/06-qna',
  '/posts/qa_counselor': 'user/06-qna',
  '/counselor-inquiries': 'counselor/07-inquiry',
  '/posts-overview': 'board/01-overview',
  '/post-reports': 'board/01-overview',
  '/review-reports': 'user/05-review',
  '/search-popular': 'user/02-counselor-browse',
  '/stats': 'stats/01-ops-kpi',
  '/settings': 'admin/06-settings-contents',
  '/banners': 'admin/05-banners-popups',
  '/popup-layers': 'admin/05-banners-popups',
  '/contents': 'admin/06-settings-contents',
  '/notices': 'board/01-overview',
  '/events': 'board/01-overview',
  '/faqs': 'board/01-overview',
  '/alimtalk-templates': 'alert/02-bizm-templates',
  '/alimtalk-bulk': 'alert/05-bulk-alimtalk',
  '/push-notifications': 'alert/01-channels',
  '/notification-history': 'alert/06-inapp-notifications',
  '/push-guide': 'alert/03-fcm-push',
  '/alert-guide': 'alert/01-channels',
  '/alert-logs': 'alert/08-alert-logs',
  '/admin-users': 'admin/01-permissions',
  '/profit-simulator': 'admin/03-profit-simulator',
  '/memo': 'admin/02-memo',
  '/ops-kpi': 'stats/01-ops-kpi',
  '/dashboard': 'system/00-overview',
  '/infra-info': 'system/01-domains',
  '/handbook-config': 'system/07-handbook-ai',
  '/handbook-ai': 'system/07-handbook-ai',
  '/search-keywords': 'user/02-counselor-browse',
}

const FAV_KEY = 'mng_favorite_menus'

function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeFavs(paths: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(paths))
  } catch {
    // localStorage quota/disabled — 무시
  }
}

/**
 * sub-feature 라벨에서 페이지 텍스트 매칭용 짧은 키워드 추출.
 *   - "상태: 상담가능" → "상담가능"  (":" 뒤 값)
 *   - "기본환경 (사이트/회원가입/...)" → "기본환경"  ("(" 앞 제목)
 *   - 그 외 → 라벨 그대로
 */
function toKeyword(label: string): string {
  const trimmed = label.trim()
  if (trimmed.includes(':')) {
    const after = trimmed.split(':').slice(-1)[0].trim()
    if (after) return after
  }
  if (trimmed.includes('(')) {
    const before = trimmed.split('(')[0].trim()
    if (before) return before
  }
  return trimmed
}

function matchItem(item: MenuItem, groupTitle: string, q: string): { matched: boolean; subHits: SubFeature[] } {
  if (!q) return { matched: true, subHits: [] }
  const inLabel = item.label.toLowerCase().includes(q)
  const inGroup = groupTitle.toLowerCase().includes(q)
  const inAlias = (item.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  const subHits = (item.subFeatures ?? []).filter((s) => subLabel(s).toLowerCase().includes(q))
  // 화면 텍스트 자동 인덱스 매칭 — 그 페이지 코드에서 추출된 실제 화면 단어에 q 가 포함되면 매칭.
  const inScreen = (item.path && SCREEN_INDEX[item.path] ? SCREEN_INDEX[item.path] : []).some((w) => w.toLowerCase().includes(q))
  return { matched: inLabel || inGroup || inAlias || inScreen || subHits.length > 0, subHits }
}

export default function AllMenus() {
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super
  // 검색어를 URL ?q=... 에 저장 — 사이드바 '전체 메뉴' 재클릭 시 자동 초기화
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const setQuery = (v: string) => {
    if (v) setSearchParams({ q: v }, { replace: true })
    else setSearchParams({}, { replace: true })
  }
  const [favs, setFavs] = useState<string[]>(() => readFavs())

  // [2026-06-13] _HANDBOOK/index.json 자동 동기화 — 바이블에 등록된 모든 용어(tags)를
  //   전체메뉴 검색에 자동 포함. 바이블에 tag 추가하면 여기 손 안 대도 검색됨(누락 0).
  const [hbItems, setHbItems] = useState<HbItem[]>([])
  useEffect(() => {
    api<HbIndex>('/admin/handbook/index')
      .then((r) => setHbItems(r.categories.flatMap((c) => c.items)))
      .catch(() => setHbItems([]))
  }, [])

  // HANDBOOK_MAP(path→slug) 역방향: slug → 연결된 메뉴 path[]
  const slugToPaths = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const [path, slug] of Object.entries(HANDBOOK_MAP)) {
      const arr = m.get(slug) ?? []
      arr.push(path)
      m.set(slug, arr)
    }
    return m
  }, [])

  useEffect(() => {
    writeFavs(favs)
  }, [favs])

  const toggleFav = (path: string) => {
    setFavs((cur) => (cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path]))
  }

  const indexByPath = useMemo(() => {
    const m = new Map<string, { label: string; groupTitle: string }>()
    for (const g of GROUPS) for (const it of g.items) {
      m.set(it.path, { label: it.label, groupTitle: g.title })
    }
    return m
  }, [])

  const q = query.trim().toLowerCase()
  const isSearching = q.length > 0

  // 필터링 + 각 아이템에 subHits 부착. superOnly 메뉴는 슈퍼관리자에게만.
  const filteredGroups = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      items: g.items
        .filter((it) => !it.superOnly || isSuper)
        .map((it) => {
          const r = matchItem(it, g.title, q)
          return r.matched ? { ...it, _subHits: r.subHits } : null
        })
        .filter((x): x is MenuItem & { _subHits: string[] } => x != null),
    })).filter((g) => g.items.length > 0)
  }, [q, isSuper])

  const totalSubHits = useMemo(() => {
    if (!isSearching) return 0
    return filteredGroups.reduce((s, g) => s + g.items.reduce((a, it) => a + (it as MenuItem & { _subHits: string[] })._subHits.length, 0), 0)
  }, [filteredGroups, isSearching])

  // 바이블 용어(tags) 매칭 — 검색 시 q 와 매칭되는 _HANDBOOK 문서들. (메뉴에 직접 안 적힌 용어도 여기서 잡힘)
  const hbMatches = useMemo(() => {
    if (!isSearching) return [] as { slug: string; title: string; tagHits: string[] }[]
    const out: { slug: string; title: string; tagHits: string[] }[] = []
    for (const it of hbItems) {
      const tagHits = it.tags.filter((t) => t.toLowerCase().includes(q))
      const titleHit = it.title.toLowerCase().includes(q)
      if (tagHits.length || titleHit) out.push({ slug: it.slug, title: it.title, tagHits })
    }
    return out
  }, [q, isSearching, hbItems])

  const favItems = favs
    .map((path) => {
      const info = indexByPath.get(path)
      return info ? { path, ...info } : null
    })
    .filter((x): x is { path: string; label: string; groupTitle: string } => x != null)

  return (
    <div className="space-y-3 max-w-[1400px]">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">전체 메뉴</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          모든 관리자 기능을 한눈에. 페이지 내부 탭/섹션까지 펼쳐서 노출. 검색으로 위치 즉시 확인 가능.
        </p>
      </div>

      {/* 검색 박스 */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 단가, 통계, 정산률, 환불, 알림수신자..."
          className="w-full h-9 pl-9 pr-9 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="검색어 지우기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 검색 결과 요약 */}
      {isSearching && (
        <div className="text-xs text-gray-500">
          검색 결과: 메뉴 {filteredGroups.reduce((s, g) => s + g.items.length, 0)}개
          {totalSubHits > 0 && ` · 페이지 내부 항목 ${totalSubHits}개`}
          {hbMatches.length > 0 && ` · 📖 바이블 용어 ${hbMatches.length}개`}
        </div>
      )}

      {/* 즐겨찾기 (검색어 없을 때만) */}
      {!isSearching && favItems.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> 즐겨찾기
          </h2>
          <div className="flex flex-wrap gap-2">
            {favItems.map((it) => (
              <Link
                key={it.path}
                to={it.path}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded border border-violet-200 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:border-violet-800 dark:hover:bg-violet-900/30 text-sm text-violet-700 dark:text-violet-300"
              >
                <span>{it.label}</span>
                <span className="text-[10px] text-gray-400">{it.groupTitle}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleFav(it.path)
                  }}
                  className="ml-1 text-amber-400 hover:text-amber-500"
                  aria-label="즐겨찾기 해제"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                </button>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 격자 + 카드별 정확한 row-span 으로 빈 공간 흡수 (콘텐츠 길이 기반 픽셀 계산) */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 grid-flow-dense"
        style={{ gridAutoRows: '8px' }}
      >
        {filteredGroups.map((g) => {
          const Icon = g.icon
          // 콘텐츠 길이 → 카드 픽셀 높이 추정 → row-span 계산
          // padding(20) + header(36) + 각 메인 라벨(28px) + 각 sub 라벨(20px) + 카드 간 sub 사이 여유(8)
          const subsCount = g.items.reduce((s, it) => s + ((it as MenuItem & { _subHits?: string[] })._subHits?.length ?? it.subFeatures?.length ?? 0), 0)
          const itemsCount = g.items.length
          // 검색 시 subHits 기준, 평소엔 전체 subFeatures
          const subsForCalc = isSearching
            ? g.items.reduce((s, it) => s + ((it as MenuItem & { _subHits: string[] })._subHits.length), 0)
            : subsCount
          const subFinal = isSearching ? subsForCalc : g.items.reduce((s, it) => s + (it.subFeatures?.length ?? 0), 0)
          const heightPx = 20 + 36 + itemsCount * 28 + subFinal * 20 + 8
          const rowSpan = Math.max(1, Math.ceil((heightPx + 8) / (8 + 8)))
          return (
            <section
              key={g.title}
              style={{ gridRow: `span ${rowSpan}` }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2.5"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <Icon className="w-4 h-4 text-violet-600" />
                {g.title}
                <span className="text-[10px] text-gray-400 ml-auto">{g.items.length}</span>
              </h2>
              <ul className="flex flex-col">
                {g.items.map((it) => {
                  const subHits = (it as MenuItem & { _subHits: string[] })._subHits ?? []
                  const isFav = favs.includes(it.path)
                  return (
                    <li key={it.path} className="group">
                      <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20">
                        <Link to={it.path} className="flex-1 text-sm text-gray-700 dark:text-gray-200 hover:text-violet-700 dark:hover:text-violet-300">
                          {it.star && <span className="text-amber-500 mr-1">⭐</span>}
                          <span dangerouslySetInnerHTML={{ __html: highlight(it.label, q) }} />
                        </Link>
                        {HANDBOOK_MAP[it.path] && (
                          <Link
                            to={`/handbook?slug=${HANDBOOK_MAP[it.path]}`}
                            title="운영 바이블에서 이 기능의 정책·구조 보기"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-violet-400 hover:text-violet-600 mr-1 shrink-0"
                          >
                            📖
                          </Link>
                        )}
                        <button
                          onClick={() => toggleFav(it.path)}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity ${isFav ? 'opacity-100' : ''}`}
                          aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isFav ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-amber-400'
                            }`}
                          />
                        </button>
                      </div>

                      {/* 페이지 내부 탭/섹션 — 평소에도 항상 노출 (검색 시 매칭 강조) */}
                      {(it.subFeatures?.length ?? 0) > 0 && (
                        <ul className="ml-5 mt-0.5 mb-1 border-l border-violet-100 dark:border-violet-900/40 pl-2 space-y-0.5">
                          {(isSearching ? subHits : it.subFeatures!).map((s) => {
                            const lab = subLabel(s)
                            const tab = subTab(s)
                            const kw = toKeyword(lab)
                            const params = new URLSearchParams()
                            params.set('hl', kw)
                            if (tab) params.set('tab', tab)
                            const to = `${it.path}?${params.toString()}`
                            return (
                              <li key={lab}>
                                <Link
                                  to={to}
                                  className="block text-[11px] text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-300"
                                >
                                  <span className="text-violet-300 mr-1">›</span>
                                  <span dangerouslySetInnerHTML={{ __html: highlight(lab, q) }} />
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      {/* 📖 운영 바이블 용어 매칭 — 메뉴 라벨/별칭에 없어도 바이블 tag 로 잡아 위치 안내 (자동 동기화) */}
      {isSearching && hbMatches.length > 0 && (
        <section className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
            📖 운영 바이블 용어 <span className="text-[11px] text-gray-400">({hbMatches.length})</span>
          </h2>
          <div className="space-y-2">
            {hbMatches.map((it) => {
              const paths = slugToPaths.get(it.slug) ?? []
              return (
                <div key={it.slug} className="text-xs rounded border border-gray-100 dark:border-gray-700 px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-100">{it.title}</span>
                    {it.tagHits.length > 0 && (
                      <span className="text-[11px] text-gray-400">
                        용어: <span dangerouslySetInnerHTML={{ __html: it.tagHits.map((t) => highlight(t, q)).join(', ') }} />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {paths.length > 0 ? (
                      paths.map((p) => {
                        const info = indexByPath.get(p)
                        return info ? (
                          <Link key={p} to={p} className="text-violet-600 dark:text-violet-300 hover:underline">
                            → {info.label} <span className="text-gray-400">({info.groupTitle})</span>
                          </Link>
                        ) : null
                      })
                    ) : (
                      <span className="text-gray-400">연결 메뉴 없음 (정책 문서)</span>
                    )}
                    <Link to={`/handbook?slug=${it.slug}`} className="text-violet-400 hover:underline ml-auto">
                      📖 바이블 보기
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {filteredGroups.length === 0 && hbMatches.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">
          "{query}" 검색 결과 없음. 다른 단어로 시도해 보세요.
        </div>
      )}

      {/* ── 무료 코인 지급 정책 안내 ── */}
      {!isSearching && <FreeCoinPolicyGuide />}

      {/* ── 쿠폰 정책 안내 ── */}
      {!isSearching && <CouponPolicyGuide />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 무료 코인 지급 정책 안내 컴포넌트
// ─────────────────────────────────────────────────────────
function FreeCoinPolicyGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-violet-200 bg-violet-50 dark:bg-violet-900/10 dark:border-violet-800/40 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
          🎁 무료 코인 지급 정책 — 관리자 필독
        </span>
        <span className="text-violet-600 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm text-gray-700 dark:text-gray-300 border-t border-violet-200 dark:border-violet-800/40 pt-4">

          {/* 전체 목록 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">무료 코인 지급 경로 전체 (현재 설정값)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-violet-100 dark:bg-violet-900/30">
                    <th className="text-left px-3 py-2 font-semibold text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-700">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-700">경로</th>
                    <th className="text-right px-3 py-2 font-semibold text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-700">현재 금액</th>
                    <th className="text-left px-3 py-2 font-semibold text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-700">자동 여부</th>
                    <th className="text-left px-3 py-2 font-semibold text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-700">설정 위치</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { no: 1, label: '출석 일일 기본 (회원)', amount: '100 코인/일', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 2, label: '출석 일일 기본 (상담사)', amount: '50 코인/일', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 3, label: '출석 연속 5일 보너스 (회원)', amount: '+200 코인', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 4, label: '출석 연속 10일 보너스 (회원)', amount: '+300 코인', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 5, label: '출석 연속 15일 보너스 (회원)', amount: '+400 코인', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 6, label: '출석 연속 20일 보너스 (회원)', amount: '+500 코인', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 7, label: '출석 30일 달성 쿠폰 (회원)', amount: '10,000 코인 쿠폰 (14일 만료)', auto: '자동', setting: '출석 관리 → 정책' },
                    { no: 8, label: '회원가입 쿠폰', amount: '쿠폰존 설정값', auto: '가입 시 자동', setting: '쿠폰존 관리' },
                    { no: 9, label: '보유 쿠폰 사용', amount: '쿠폰존 설정값', auto: '회원 직접', setting: '쿠폰존 관리' },
                    { no: 10, label: '쿠폰 코드 입력', amount: '쿠폰존 설정값', auto: '회원 직접', setting: '쿠폰존 관리' },
                    { no: 11, label: '일반 후기 작성', amount: '500 코인', auto: '자동', setting: '환경설정 → 후기 포인트' },
                    { no: 12, label: '사진 포함 후기 작성', amount: '1,000 코인 (기본 500 + 사진 500)', auto: '자동', setting: '환경설정 → 후기 포인트' },
                    { no: 13, label: '관리자 베스트 후기 선정', amount: '10,000 코인 고정 (해제 시 회수 없음)', auto: '관리자 수동', setting: '상담후기 관리' },
                    { no: 14, label: '관리자 수동 지급', amount: '자유 설정', auto: '관리자 수동', setting: '고객 리스트 → 포인트 조정' },
                    { no: 15, label: '회원가입 포인트 ⏳', amount: '미구현 (곧 출시 예정)', auto: '—', setting: '환경설정 → 회원' },
                    { no: 16, label: '로그인 포인트 ⏳', amount: '미구현 (곧 출시 예정)', auto: '—', setting: '환경설정 → 회원' },
                  ].map((row) => (
                    <tr key={row.no} className={`border border-violet-100 dark:border-violet-800/30 ${row.label.includes('⏳') ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-1.5 text-gray-400">{row.no}</td>
                      <td className="px-3 py-1.5 font-medium">{row.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-violet-700 dark:text-violet-300">{row.amount}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.auto}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.setting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 출석 보상 상세 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">1. 출석 보상 — 경우의 수</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-violet-700 dark:text-violet-300 mb-2">회원 출석 보상</p>
                <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• 매일 출석: <strong className="text-gray-800 dark:text-gray-200">+100 코인</strong></li>
                  <li>• 연속 5일: <strong className="text-gray-800 dark:text-gray-200">+200 추가</strong> (당일 총 300)</li>
                  <li>• 연속 10일: <strong className="text-gray-800 dark:text-gray-200">+300 추가</strong> (당일 총 400)</li>
                  <li>• 연속 15일: <strong className="text-gray-800 dark:text-gray-200">+400 추가</strong> (당일 총 500)</li>
                  <li>• 연속 20일: <strong className="text-gray-800 dark:text-gray-200">+500 추가</strong> (당일 총 600)</li>
                  <li>• 30일 달성: <strong className="text-gray-800 dark:text-gray-200">10,000코인 쿠폰</strong> (14일 만료)</li>
                  <li className="text-amber-600 pt-1">⚠ 조건: 가입 후 3일 이상 경과, 하루 1회, 자정 KST 기준 리셋</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-violet-700 dark:text-violet-300 mb-2">상담사 출석 보상 (회원의 절반)</p>
                <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• 매일 출석: <strong className="text-gray-800 dark:text-gray-200">+50 코인</strong></li>
                  <li>• 연속 5일: <strong className="text-gray-800 dark:text-gray-200">+100 추가</strong></li>
                  <li>• 연속 10일: <strong className="text-gray-800 dark:text-gray-200">+150 추가</strong></li>
                  <li>• 연속 15일: <strong className="text-gray-800 dark:text-gray-200">+200 추가</strong></li>
                  <li>• 연속 20일: <strong className="text-gray-800 dark:text-gray-200">+250 추가</strong></li>
                  <li>• 30일 달성: <strong className="text-gray-800 dark:text-gray-200">없음</strong> (상담사 제외)</li>
                  <li className="text-amber-600 pt-1">⚠ 출석을 건너뛰면 연속일 초기화</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 후기 보상 상세 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">2. 후기 작성 보상 — 경우의 수</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 일반 후기 작성: <strong>500 코인</strong></p>
              <p>• 사진 포함 후기: <strong>1,000 코인</strong> (기본 500 + 사진 보너스 500)</p>
              <p>• 최소 사용 코인 조건: <strong>없음</strong> (금액 무관하게 상담 후 후기 작성하면 지급)</p>
              <p>• 상담 1회당 1회만 작성 가능</p>
              <p className="text-amber-600">⚠ 환경설정 → 후기 포인트 섹션에서 payout_enabled=0 으로 설정하면 전체 중단</p>
            </div>
          </section>

          {/* 베스트 후기 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">3. 베스트 후기 선정 — 주의사항</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 관리자가 후기를 베스트로 선정하면 작성자에게 <strong>10,000 코인 즉시 지급</strong></p>
              <p>• 금액은 코드에 고정 (변경 불가)</p>
              <p className="text-rose-600">⚠ 베스트 해제해도 지급된 코인 <strong>회수 불가</strong>. 신중하게 선정할 것.</p>
            </div>
          </section>

          {/* 관리자 수동 지급 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">4. 관리자 수동 지급 — 사용법</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>경로: <strong>회원현황 → 고객 리스트 → 회원 상세 → 포인트 조정 버튼</strong></p>
              <p>• 양수 입력 = 지급, 음수 입력 = 차감</p>
              <p>• 사유 입력 필수 (감사 로그에 기록됨, 이후 추적 가능)</p>
              <p>• 무료 코인(free)과 결제 코인(paid) 중 선택 가능</p>
              <p className="text-amber-600">⚠ 이벤트 보상, 오류 보정 등 비정기 지급 시 사유를 명확히 입력할 것</p>
            </div>
          </section>

          {/* 예정 기능 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">5. 출시 예정 기능 ⏳</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• <strong>회원가입 포인트</strong>: 가입 완료 시 자동 코인 직접 지급. 설정 화면은 준비됨 (환경설정 → 회원 섹션).</p>
              <p>• <strong>로그인 포인트</strong>: 로그인할 때마다 코인 지급. 설정 화면은 준비됨 (환경설정 → 회원 섹션).</p>
              <p className="text-gray-400">현재는 설정만 있고 실제 지급 코드가 미구현 상태. 출시 후 이 안내 업데이트 예정.</p>
            </div>
          </section>

        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 쿠폰 정책 안내 컴포넌트
// ─────────────────────────────────────────────────────────
function CouponPolicyGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/40 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <Ticket className="w-4 h-4" />
          쿠폰 정책 안내 — 관리자 필독
        </span>
        <span className="text-amber-600 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm text-gray-700 dark:text-gray-300 border-t border-amber-200 dark:border-amber-800/40 pt-4">

          {/* 1. 쿠폰 종류 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">1. 쿠폰 종류</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-violet-700 dark:text-violet-300 mb-1">다운로드 쿠폰</p>
                <p className="text-xs text-gray-500 leading-relaxed">코드 없이 관리자가 특정 회원에게 직접 발급하는 방식. 회원가입 쿠폰이 이 방식입니다. 회원이 마이페이지에서 "사용" 버튼을 눌러야 코인으로 전환됩니다.</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-violet-700 dark:text-violet-300 mb-1">코드입력 쿠폰</p>
                <p className="text-xs text-gray-500 leading-relaxed">SNS 이벤트, 제휴, 프로모션에서 쿠폰 코드를 배포하고 회원이 직접 입력하는 방식. 코드 형식: XXXX-XXXX-XXXX-XXXX (자동 생성).</p>
              </div>
            </div>
          </section>

          {/* 2. 회원가입 쿠폰 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">2. 회원가입 쿠폰 (자동 발급)</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 신규 회원 가입 완료 시 <strong>자동으로</strong> 쿠폰을 지급합니다. 관리자 조작 불필요.</p>
              <p>• <strong>현재 설정: 5,000코인 / 유효기간 7일</strong> — 변경하려면 쿠폰존 관리에서 "회원가입 쿠폰" 행을 클릭해 수정.</p>
              <p>• 가입 후 알림톡(coupon_signup_v1)으로 회원에게 자동 발송됩니다.</p>
              <p>• 중복 발급 방지: 같은 회원에게 2번 발급되지 않습니다.</p>
              <p className="text-amber-600">⚠ 발급 건수는 쿠폰존 목록의 "다운로드" 숫자로 확인하세요.</p>
            </div>
          </section>

          {/* 3. 쿠폰 사용 흐름 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">3. 쿠폰 → 코인 전환 흐름</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed">
              <div className="flex flex-wrap items-center gap-2 text-center">
                {['가입/코드 입력', '→', '마이페이지 쿠폰 목록에 표시', '→', '"사용" 버튼 클릭', '→', '코인 즉시 충전'].map((s) => (
                  <span key={s} className={s === '→' ? 'text-gray-400' : 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-2 py-1 rounded'}>
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-amber-600">⚠ 쿠폰을 받아도 "사용" 버튼을 누르지 않으면 코인이 충전되지 않습니다. 유효기간이 지나면 자동 소멸.</p>
            </div>
          </section>

          {/* 4. 쿠폰존(캠페인) 관리 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">4. 쿠폰존(캠페인) 만들기</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 쿠폰존 관리 페이지 → <strong>새 쿠폰존 추가</strong> 버튼.</p>
              <p>• 쿠폰 이름(캠페인명) / 지급 코인 / 유효기간(일수) / 사용 기간 설정.</p>
              <p>• 코드입력 쿠폰: 코드가 자동 생성됩니다. 이 코드를 SNS에 배포하면 입력한 사람에게 지급.</p>
              <p>• 다운로드 쿠폰: 발급할 회원을 직접 선택 → 저장하면 즉시 발급.</p>
              <p className="text-amber-600">⚠ 쿠폰존을 삭제하면 해당 캠페인으로 발급된 쿠폰 이력도 사라집니다. 신중하게.</p>
            </div>
          </section>

          {/* 5. 알림톡 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">5. 알림톡 현황</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• <strong>coupon_signup_v1</strong> (회원가입 쿠폰 안내) — BizM 검수 신청 완료. 승인 후 자동 발송.</p>
              <p>• <strong>coupon_req_v2</strong> (일반 쿠폰 발급 안내) — BizM 반려 상태. 추후 별도 템플릿으로 재신청 예정.</p>
              <p className="text-amber-600">⚠ 알림톡이 승인 전이면 쿠폰을 줘도 회원이 모를 수 있습니다. BizM 포털에서 승인 상태를 주기적으로 확인하세요.</p>
            </div>
          </section>

          {/* 6. 통계 확인 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">6. 발급/사용 통계 확인</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 쿠폰존 목록: 쿠폰존별 <strong>발급 수(다운로드)</strong> 확인.</p>
              <p>• 쿠폰존 클릭 → 발급 대상 회원 목록 확인 가능.</p>
              <p>• 전체 쿠폰 발급/사용 이력: 쿠폰 목록 메뉴에서 회원별로 검색.</p>
            </div>
          </section>

        </div>
      )}
    </div>
  )
}

/** 매칭된 부분 <mark> 강조. q 가 비어 있으면 escape 만 한 결과 반환. */
function highlight(text: string, q: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!q) return esc(text)
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return esc(text)
  return esc(text.slice(0, idx)) + '<mark class="bg-amber-100 dark:bg-amber-900/40 text-inherit px-0.5 rounded">' + esc(text.slice(idx, idx + q.length)) + '</mark>' + esc(text.slice(idx + q.length))
}
