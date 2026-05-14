import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CsrMgrPayload {
  csrnm: string;       // 닉네임
  state: string;       // IDLE / CONN / ABSE 등
  sortno: number;      // 연결순위
  dtmfno: string;      // 상담사번호 (member.dtmfno)
  telno: string;       // 실 전화번호 (숫자만, 하이픈 제거)
  dectm: number;       // 회원차감 단위시간(초)
  decamt: number;      // 070 단위금액
  preflag: 'P' | 'Y' | '';  // P=둘다 / Y=선불 / ''=후불
  chatdectm: number;   // 채팅차감 단위시간
  chatdecamt: number;  // 채팅차감 단위금액
}

export interface MembMgrPayload {
  membnm: string;  // 이름
  telno: string;   // 휴대폰 (숫자만)
  amt: number;     // 포인트 (잔액)
}

/**
 * 자동결제(BillKey) 등록/해제 시 엠투넷에 PUT memb-mgr/{cpid}/{mb_1}으로 보내는 payload.
 * sample/coin/coin_fill_auto_card_member_update.php 라인 28·53 동등.
 */
export interface AutoPayConfigPayload {
  membnm: string;
  telno: string;             // 하이픈 제거된 휴대폰
  autopaypin: string;        // PG에서 발급된 billkey
  autopayflag: 'Y' | 'N';
  autopayamt?: number;       // 활성 시 필수: 자동결제 결제 금액
  autopaycoinamt?: number;   // 활성 시 필수: 자동결제 발급 코인
  autopaypushurl?: string;   // 활성 시 필수: 결제 결과 push 받을 백엔드 URL
  // 자동충전 임계값 필드명은 매뉴얼에 명시되지 않음 — 운영팀 확인 후 추가
}

export interface M2netResponse {
  req_result: string;       // '00' = 성공
  csrid?: number | string;  // 상담사 ID
  membid?: number | string; // 회원 ID
  [k: string]: unknown;
}

@Injectable()
export class M2netService {
  private readonly logger = new Logger(M2netService.name);
  private readonly enabled: boolean;
  private readonly apiUrl: string;
  private readonly cpid: string;
  private readonly headerKey: string;

  constructor(private readonly config: ConfigService) {
    // M2NET_* 키는 .env (운영) → .env.defaults (sample 라이브 fallback) 순으로 자동 로드됨
    this.apiUrl = config.get<string>('M2NET_API_URL') ?? '';
    this.cpid = config.get<string>('M2NET_CPID') ?? '';
    this.headerKey = config.get<string>('M2NET_HEADER_KEY') ?? '';
    this.enabled = Boolean(this.apiUrl && this.cpid && this.headerKey);
    this.logger.log(
      `[M2netService] enabled=${this.enabled} apiUrl=${this.apiUrl} cpid=${this.cpid}`,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** 상담사 등록 — 성공 시 csrid (+ m2net 이 자동 발급한 dtmfno) 반환 */
  async registerCounselor(payload: CsrMgrPayload): Promise<{ ok: boolean; csrid?: string; dtmfno?: string; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성 (env 미설정)' };
    }
    try {
      const url = `${this.apiUrl}/csr-mgr/${this.cpid}`;
      const res = await this.post(url, payload);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        const msg = (res as Record<string, unknown>).resultmessage;
        return {
          ok: false,
          raw: res,
          error: `m2net req_result=${res.req_result}${msg ? ` (${String(msg)})` : ''}`,
        };
      }
      const csrid = res.csrid ? String(res.csrid).padStart(5, '0') : undefined;
      // m2net 가 dtmfno 를 응답에 포함하면 그 값을 저장 → admin 폼에서 자동 보정.
      // sample 라이브 응답 형태가 다양해 키 이름 폴백 확인.
      const dtmfnoRaw =
        res.dtmfno ??
        (res as Record<string, unknown>).dtmfno_csr ??
        (res as Record<string, unknown>).csr_dtmfno;
      const dtmfno =
        typeof dtmfnoRaw === 'string' || typeof dtmfnoRaw === 'number'
          ? String(dtmfnoRaw)
          : undefined;
      return { ok: true, csrid, dtmfno, raw: res };
    } catch (e) {
      this.logger.error(`m2net csr-mgr 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 채팅방 생성 — chat-mgr csrchat
   * sample/chat_test/get_chat_token.php::chat_create_room() 동등.
   *
   *   POST {chatUrl}/chat-mgr/{cpid}
   *   body: { cmd: 'csrchat', membid, csrid }
   *   resp: { req_result, resultmessage, roomid, membtoken, csrtoken, csrid, membid }
   *
   * roomid 는 m2net 이 발급하는 wss 식별자. membtoken/csrtoken 은 양쪽이
   * `wss://passcall.co.kr:28729/wscp/{token}` 으로 접속할 때 사용.
   * 매뉴얼 §4.5 기준. URL 포트는 25205 가 아닌 채팅 전용 포트(20102) 를 사용한다.
   */
  async createChatRoom(params: {
    membid: string;
    csrid: string;
  }): Promise<{ ok: boolean; roomid?: string; membtoken?: string; csrtoken?: string; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성' };
    }
    if (!params.membid || !params.csrid) {
      return { ok: false, raw: null, error: 'membid/csrid 필수' };
    }
    const chatUrl = (this.config.get<string>('M2NET_CHAT_URL') ?? 'http://passcall.co.kr:20102').replace(/\/$/, '');
    const chatKey = this.config.get<string>('M2NET_CHAT_KEY') ?? this.headerKey;
    try {
      const url = `${chatUrl}/chat-mgr/${this.cpid}`;
      const res = await this.postWithKey(
        url,
        { cmd: 'csrchat', membid: String(params.membid), csrid: String(params.csrid) },
        chatKey,
      );
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      return {
        ok: true,
        roomid: typeof res.roomid === 'string' ? res.roomid : undefined,
        membtoken: typeof res.membtoken === 'string' ? res.membtoken : undefined,
        csrtoken: typeof res.csrtoken === 'string' ? res.csrtoken : undefined,
        raw: res,
      };
    } catch (e) {
      this.logger.error(`m2net chat-mgr csrchat 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 채팅 메시지 히스토리 조회 — chat-log getlist
   * sample/chat_test/get_chat_token.php::get_chatting_list() 동등.
   *
   *   POST {chatUrl}/chat-log
   *   body: { cmd: 'getlist', membid, csrid }
   *   resp: { list: [{ membid, msg, instm, idtp: 'csr'|... }] }
   *
   * m2net 이 자체 보존하는 메시지 로그를 조회한다. 자체 백업(`chat_message` 테이블)
   * 누락 시 보조 또는 관리자 백필 용도로 사용.
   */
  async getChatLog(params: {
    membid: string;
    csrid: string;
  }): Promise<{ ok: boolean; list?: Array<{ membid: string; msg: string; instm: string; idtp: string }>; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) return { ok: false, raw: null, error: 'M2NET 비활성' };
    if (!params.membid || !params.csrid) return { ok: false, raw: null, error: 'membid/csrid 필수' };
    const chatUrl = (this.config.get<string>('M2NET_CHAT_URL') ?? 'http://passcall.co.kr:20102').replace(/\/$/, '');
    const chatKey = this.config.get<string>('M2NET_CHAT_KEY') ?? this.headerKey;
    try {
      const url = `${chatUrl}/chat-log`;
      const res = await this.postWithKey(
        url,
        { cmd: 'getlist', membid: String(params.membid), csrid: String(params.csrid) },
        chatKey,
      );
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result && res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      const maybeList = (res as unknown as { list?: unknown }).list;
      const list = Array.isArray(maybeList)
        ? (maybeList.filter((it) => it && typeof it === 'object') as Array<{
            membid: string;
            msg: string;
            instm: string;
            idtp: string;
          }>)
        : [];
      return { ok: true, list, raw: res };
    } catch (e) {
      this.logger.error(`m2net chat-log getlist 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 상담사 풀 레코드 수정 — PUT csr-mgr/{csrid}
   * 레거시 sample/adm/member_form_update.php 의 send_mjson('csr-mgr', $data, 'PUT', $mrow['mb_1'])
   * 동등. 매뉴얼 §3.3: 등록 시의 모든 필드(csrnm/state/sortno/dtmfno/telno/dectm/decamt/preflag/
   * chatdectm/chatdecamt) 에 대해 수정 가능. 부분 필드만 보내도 OK.
   *
   * 단가/sortno/preflag/state 등 변경 시 반드시 호출 — 안 하면 m2net 측이 옛 값으로 동작.
   */
  async updateCounselorFull(
    csrid: string,
    payload: Partial<CsrMgrPayload>,
  ): Promise<{ ok: boolean; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성' };
    }
    if (!csrid) {
      return { ok: false, raw: null, error: 'csrid 없음' };
    }
    try {
      const url = `${this.apiUrl}/csr-mgr/${csrid}`;
      this.logger.log(`[updateCounselorFull] PUT ${url} body=${JSON.stringify(payload)}`);
      const res = await this.put(url, payload);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        const msg = (res as Record<string, unknown>).resultmessage;
        this.logger.warn(`[updateCounselorFull] FAIL req_result=${res.req_result} msg=${String(msg ?? '')} body=${JSON.stringify(payload)}`);
        return {
          ok: false,
          raw: res,
          error: `m2net req_result=${res.req_result}${msg ? ` (${String(msg)})` : ''}`,
        };
      }
      return { ok: true, raw: res };
    } catch (e) {
      this.logger.error(`m2net csr-mgr PUT 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 상담사 상태 변경 — chat-mgr csrstat
   * 레거시 set_crs_status_chg() 와 동일. csr-mgr 는 풀 레코드 등록/수정용이고,
   * 채팅 서버(AG9) 의 즉시 상태 반영은 chat-mgr/csrstat 로 별도 호출해야 함.
   * env: M2NET_CHAT_URL (기본 http://passcall.co.kr:20102), M2NET_CHAT_KEY (없으면 HEADER_KEY 재사용)
   */
  async updateCounselorState(csrid: string, state: string): Promise<{ ok: boolean; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성' };
    }
    if (!csrid) {
      return { ok: false, raw: null, error: 'csrid 없음' };
    }
    const chatUrl = (this.config.get<string>('M2NET_CHAT_URL') ?? 'http://passcall.co.kr:20102').replace(/\/$/, '');
    const chatKey = this.config.get<string>('M2NET_CHAT_KEY') ?? this.headerKey;
    try {
      const url = `${chatUrl}/chat-mgr/${this.cpid}`;
      const res = await this.postWithKey(url, { cmd: 'csrstat', csrid: String(csrid), state }, chatKey);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      return { ok: true, raw: res };
    } catch (e) {
      this.logger.error(`m2net chat-mgr csrstat 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /** 일반 회원 등록 — 성공 시 membid 반환 */
  async registerMember(payload: MembMgrPayload): Promise<{ ok: boolean; membid?: string; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성' };
    }
    try {
      const url = `${this.apiUrl}/memb-mgr/${this.cpid}`;
      const res = await this.post(url, payload);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      const membid = res.membid ? String(res.membid).padStart(6, '0') : undefined;
      return { ok: true, membid, raw: res };
    } catch (e) {
      this.logger.error(`m2net memb-mgr 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 일반 회원 정보 갱신 — PUT /memb-mgr/{membid}.
   *  sample/lib/common.lib.php send_mjson("memb-mgr", $data, 'PUT', $mb_1) 와 동등.
   *  - URL path: 발급된 membid (POST 응답으로 받았던 값)
   *  - body: 변경할 필드만 ({ telno } / { membnm, amt } 등). amt 는 +N/-N 델타.
   *  - PUT 은 신규 membid 를 반환하지 않음 (URL 의 것이 그대로 유지).
   */
  async updateMember(
    membid: string,
    payload: Partial<MembMgrPayload>,
  ): Promise<{ ok: boolean; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성' };
    }
    if (!membid) {
      return { ok: false, raw: null, error: 'membid 없음' };
    }
    try {
      const url = `${this.apiUrl}/memb-mgr/${membid}`;
      const res = await this.put(url, payload);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      return { ok: true, raw: res };
    } catch (e) {
      this.logger.error(`m2net memb-mgr PUT 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 회원 조회 — GET memb-mgr/{cpid} 매뉴얼 §3.4.
   * Java/Node 등이 GET body 를 못 보내는 환경 대비해 매뉴얼이 추천하는 url-suffix 방식 우선.
   * 응답: { list: [{amt, membid, membnm, telno, pin}, ...], req_result }
   */
  async getMemberByMembid(
    membid: string,
  ): Promise<{ ok: boolean; amt?: number; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) return { ok: false, raw: null, error: 'M2NET 비활성' };
    if (!membid) return { ok: false, raw: null, error: 'membid 없음' };
    try {
      // m2net 표준: 회원 membid 는 6자리 zero-pad. DB 에 짧게 저장된 경우(예: "1234")
      // 그대로 보내면 m2net 측 매칭 실패 → 잔액 미반환 → 차감 계산 실패.
      const padded = String(membid).padStart(6, '0');
      // url-suffix 형식: GET .../memb-mgrp/{cpid}/{json}
      const jsonStr = JSON.stringify({ list: [{ membid: padded }] });
      const url = `${this.apiUrl}/memb-mgrp/${this.cpid}/${encodeURIComponent(jsonStr)}`;
      const res = await this.get(url);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      const list = (res as Record<string, unknown>).list;
      const first = Array.isArray(list) && list.length > 0 ? (list[0] as Record<string, unknown>) : null;
      const amt = first && typeof first.amt !== 'undefined' ? Number(first.amt) : undefined;
      return { ok: true, amt, raw: res };
    } catch (e) {
      this.logger.error(`m2net memb-mgrp GET 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 회원 코인 잔액 충전/차감 — 매뉴얼 §3.6 `PUT memb-mgr/{membid}/fill`.
   *
   *   # 충전 : +3000원
   *   curl -X PUT -d '{"amt":3000}' http://passcall.co.kr:25205/memb-mgr/000001/fill
   *   # 차감 : -200원
   *   curl -X PUT -d '{"amt":-200}' http://passcall.co.kr:25205/memb-mgr/000001/fill
   *
   * 매뉴얼 §3.4 의 `PUT memb-mgr/{membid}` (fill 없음) 는 잔액을 **덮어쓰는(overwrite)** 동작.
   * 충전·차감(상대값) 의도라면 반드시 `/fill` 경로를 사용해야 한다 — sample 의
   * `send_mjson1("memb-mgr", $data, 'PUT', $mb_1)` 은 매뉴얼 §3.4 (overwrite) 라
   * 결제 취소 등 음수 차감 시 잔액이 음수가 되어 0 클램프 → 전 회원 잔액 손실 사고가
   * 발생할 수 있다. 신규에서는 매뉴얼 정답대로 `/fill` 사용.
   *
   * amt > 0 = 적립, amt < 0 = 회수. 호출자는 결과를 payment.m2net_status 컬럼에 저장.
   */
  async addMemberCoin(
    mb_1: string,
    amt: number,
  ): Promise<{ ok: boolean; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) return { ok: false, raw: null, error: 'M2NET 비활성' };
    if (!mb_1) return { ok: false, raw: null, error: 'mb_1 없음' };
    try {
      // m2net 표준: 회원 membid 는 6자리 zero-pad.
      // DB 에 짧게 저장된 경우 fill 경로 매칭이 실패해 잔액 동기화가 안 된다.
      const padded = String(mb_1).padStart(6, '0');
      const url = `${this.apiUrl}/memb-mgr/${padded}/fill`;
      const res = await this.put(url, { amt });
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      return { ok: true, raw: res };
    } catch (e) {
      this.logger.error(`m2net addMemberCoin 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 자동결제(BillKey) 정보 등록·해제 — sample/coin/coin_fill_auto_card_member_update.php 라인 28·53 동등.
   *
   *   payload: {
   *     membnm, telno, autopaypin (=billkey), autopayflag: 'Y'|'N',
   *     autopayamt?, autopaycoinamt?, autopaypushurl?
   *   }
   *   PUT {apiUrl}/memb-mgr/{mb_1}
   *
   * 활성화(Y) 시 amount/coinamt/pushurl 모두 필수. 해제(N) 시는 autopaypin·flag만 필수.
   */
  async updateAutoPayConfig(
    mb_1: string,
    payload: AutoPayConfigPayload,
  ): Promise<{ ok: boolean; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) return { ok: false, raw: null, error: 'M2NET 비활성' };
    if (!mb_1) return { ok: false, raw: null, error: 'mb_1 없음' };
    if (payload.autopayflag === 'Y') {
      if (!payload.autopayamt || !payload.autopaycoinamt || !payload.autopaypushurl) {
        return {
          ok: false,
          raw: null,
          error: '자동결제 활성화 시 autopayamt/autopaycoinamt/autopaypushurl 필수',
        };
      }
    }
    try {
      const url = `${this.apiUrl}/memb-mgr/${mb_1}`;
      const res = await this.put(url, payload);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      return { ok: true, raw: res };
    } catch (e) {
      this.logger.error(`m2net updateAutoPayConfig 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  /**
   * 전화상담 시작 — etc-mgr/CPID/drconn (Direct Connect 예약).
   *  sample/bbs/ajax.call_reserve.php 의 send_m2n_rev_call() 동등.
   *  - PUT body: { telno: 회원_휴대폰(숫자만), csrid: 상담사_csrid }
   *  - URL 포트는 25205 — apiUrl 의 포트를 25205 로 교체해서 호출.
   */
  async reserveDirectConnect(params: {
    callerPhone: string;
    counselorCsrid: string;
  }): Promise<{ ok: boolean; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성' };
    }
    if (!params.counselorCsrid) {
      return { ok: false, raw: null, error: 'csrid 없음' };
    }
    if (!params.callerPhone) {
      return { ok: false, raw: null, error: '발신 전화번호 없음' };
    }
    try {
      // sample 은 :25205 포트 사용 — apiUrl 의 포트를 교체
      const drconnUrl = (this.config.get<string>('M2NET_DRCONN_URL') ?? this.apiUrl.replace(/:\d+/, ':25205')).replace(/\/$/, '');
      const url = `${drconnUrl}/etc-mgr/${this.cpid}/drconn`;
      // csrid 는 m2net 표준이 5자리 zero-pad. csrstat/chat-mgr 호출과도 일치시킨다.
      // DB에 짧게 저장된 케이스(예: "203")가 그대로 가면 m2net 측 단말 매칭이 안 돼 콜이 안 울린다.
      const csrid = String(params.counselorCsrid).padStart(5, '0');
      const telno = params.callerPhone.replace(/\D/g, '');
      const body = { telno, csrid };
      this.logger.log(`[drconn] PUT ${url} body=${JSON.stringify(body)}`);
      const res = await this.put(url, body);
      this.logger.log(`[drconn] res=${JSON.stringify(res)}`);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      return { ok: true, raw: res };
    } catch (e) {
      this.logger.error(`m2net drconn 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, raw: null, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  private async post(url: string, body: unknown): Promise<M2netResponse | null> {
    return this.postWithKey(url, body, this.headerKey);
  }

  /** GET — 매뉴얼이 권장하는 url-suffix(json) 방식 호출에 사용. body 없음. */
  private async get(url: string): Promise<M2netResponse | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: this.headerKey },
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!text) return null;
      try { return JSON.parse(text) as M2netResponse; } catch { return null; }
    } finally {
      clearTimeout(timer);
    }
  }

  /** PUT 호출 (etc-mgr/drconn 같이 update semantics 인 엔드포인트용) */
  private async put(url: string, body: unknown): Promise<M2netResponse | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: this.headerKey },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!text) return null;
      try { return JSON.parse(text) as M2netResponse; } catch { return null; }
    } finally {
      clearTimeout(timer);
    }
  }

  private async postWithKey(url: string, body: unknown, authKey: string): Promise<M2netResponse | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authKey,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text) as M2netResponse;
      } catch {
        this.logger.warn(`m2net 응답이 JSON 아님: ${text.slice(0, 200)}`);
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
