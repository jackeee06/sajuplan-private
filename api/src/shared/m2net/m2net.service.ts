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

  /** 상담사 등록 — 성공 시 csrid 반환, 실패 시 null */
  async registerCounselor(payload: CsrMgrPayload): Promise<{ ok: boolean; csrid?: string; raw: M2netResponse | null; error?: string }> {
    if (!this.enabled) {
      return { ok: false, raw: null, error: 'M2NET 비활성 (env 미설정)' };
    }
    try {
      const url = `${this.apiUrl}/csr-mgr/${this.cpid}`;
      const res = await this.post(url, payload);
      if (!res) return { ok: false, raw: null, error: '응답 없음' };
      if (res.req_result !== '00') {
        return { ok: false, raw: res, error: `m2net req_result=${res.req_result}` };
      }
      const csrid = res.csrid ? String(res.csrid).padStart(5, '0') : undefined;
      return { ok: true, csrid, raw: res };
    } catch (e) {
      this.logger.error(`m2net csr-mgr 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
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

  private async post(url: string, body: unknown): Promise<M2netResponse | null> {
    return this.postWithKey(url, body, this.headerKey);
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
