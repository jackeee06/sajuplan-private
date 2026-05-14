/**
 * AG9 (passcall.co.kr:32837) 결제 PG 타입 정의
 * — (주)엠투넷상담서비스-결제(pay)-v1.6 매뉴얼 기준
 */

/** 일반결제 form 파라미터 빌더 입력 */
export interface BuildPayFormInput {
  method: 'CARD' | 'VBANK' | 'PAYCO' | 'KAKAO' | 'NAVER' | 'APPLE' | 'TOSS' | 'SSPAY';
  amount: number;       // VAT 포함 결제 금액
  coinamt: number;      // 충전될 포인트
  oid: string;          // 주문번호
  membid: string;       // member.mb_1
  telno: string;        // 하이픈 제거된 휴대폰
  membnm: string;       // 회원명
  item: string;         // 상품명 (예: '상담')
  isMobile: boolean;
}

/** 일반결제 form 파라미터 빌더 출력 — 클라이언트가 이대로 form submit 하면 PG로 이동 */
export interface BuildPayFormOutput {
  url: string;                       // submit 대상 URL
  params: Record<string, string>;    // hidden input value들
}

/** 자동결제 등록 입력 (서버에서 AES 암호화 후 전달) */
export interface AutoPayRegisterInput {
  oid: string;
  // 평문 (서비스 내부에서 암호화)
  cardno: string;        // 카드번호 16자리
  expMonth: string;      // 카드 만료월 MM
  expYear: string;       // 카드 만료년 YY
  socno: string;         // 주민번호 앞 6자리
  pass: string;          // 카드 비밀번호 앞 2자리
  membnm: string;        // 회원명
  membid: string;        // member.mb_1
  telno: string;         // 하이픈 제거된 휴대폰
  item: string;          // 보통 '상담료'
  amount: number;        // 자동결제 시 결제할 원화 금액
  coinamt: number;       // 자동결제 시 발급할 코인
  pushurl: string;       // 결제 결과 push 받을 백엔드 URL
}

export interface AutoPayRegisterResult {
  ok: boolean;
  billkey?: string;
  raw?: unknown;
  error?: string;
}

export interface AutoPayRequestResult {
  ok: boolean;
  tid?: string;
  raw?: unknown;
  error?: string;
}

export interface CancelPayResult {
  ok: boolean;
  reqResult?: string;     // '00' = 성공
  resultMessage?: string;
  raw?: unknown;
  error?: string;
}

/** PG가 returnurl로 push하는 결제 결과 (sample coin_pay_ok_v2.php $_REQUEST) */
export interface PgCallbackPayload {
  oid: string;
  tid: string;
  cpid: string;
  membid: string;
  amount: string | number;
  coinamt: string | number;
  paytype: string;        // GNRC_PC_PACA / GNRC_PC_PAKM 등
  req_result: string;     // '0000' = 성공
  resultmsg: string;
  telno?: string;
  membnm?: string;
  // 가상계좌 발급 시
  bankcd?: string;
  banknm?: string;
  vrno?: string;
  // 가상계좌 입금 통지 시
  deposit_nm?: string;
  deposit_tm?: string;
  // 자동결제 push에만 등장
  reason?: string;        // AUTO_PAY_CARD_IN_CONNECT / NOT_CONNECT
  [k: string]: unknown;
}
