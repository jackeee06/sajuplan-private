import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 휴대폰 인증번호 발송/검증 — 회원가입에서 사용.
 *
 * 발송 우선순위 (sample/bbs/ajax_send.php 흐름과 동일):
 *   1) 카카오 알림톡 (bizm) — sample 의 wz_alimtalk_bizm 클래스 호환
 *   2) 알리고 SMS — bizm 미설정 또는 발송 실패 시 폴백
 *   3) 콘솔 로깅 — 둘 다 미설정 시 (개발 모드)
 *
 * 환경변수:
 *   BIZM_USER_ID, BIZM_PROFILE_KEY, BIZM_TPL_SIGNUP_AUTH  → 알림톡
 *   ALIGO_USER_ID, ALIGO_KEY, ALIGO_SENDER               → 알리고 SMS 폴백
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // bizm 알림톡
  private readonly bizmUserId: string;
  private readonly bizmProfileKey: string;
  private readonly bizmTplSignupAuth: string;
  private readonly bizmTplFindPw: string;
  private readonly bizmEnabled: boolean;

  // 알리고 SMS 폴백
  private readonly aligoUserId: string;
  private readonly aligoKey: string;
  private readonly aligoSender: string;
  private readonly aligoEnabled: boolean;

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly config: ConfigService,
  ) {
    // BIZM_* 키는 .env (운영) → .env.defaults (sample 라이브 fallback) 순으로 자동 로드됨
    this.bizmUserId = config.get<string>('BIZM_USER_ID') ?? '';
    this.bizmProfileKey = config.get<string>('BIZM_PROFILE_KEY') ?? '';
    this.bizmTplSignupAuth = config.get<string>('BIZM_TPL_SIGNUP_AUTH') ?? '';
    this.bizmTplFindPw = config.get<string>('BIZM_TPL_FIND_PW') ?? 'register_idpw1';
    this.bizmEnabled =
      !!this.bizmUserId && !!this.bizmProfileKey && !!this.bizmTplSignupAuth;

    this.aligoUserId = config.get<string>('ALIGO_USER_ID') ?? '';
    this.aligoKey = config.get<string>('ALIGO_KEY') ?? '';
    this.aligoSender = config.get<string>('ALIGO_SENDER') ?? '';
    this.aligoEnabled =
      !!this.aligoUserId && !!this.aligoKey && !!this.aligoSender;

    this.logger.log(
      `[SmsService] bizm=${this.bizmEnabled ? 'ON' : 'OFF'} (userId=${this.bizmUserId}, tpl=${this.bizmTplSignupAuth}) aligo=${this.aligoEnabled ? 'ON' : 'OFF'}`,
    );
  }

  /** 인증번호 발송 — 5분 내 같은 번호 5회 제한 */
  async send(rawPhone: string): Promise<void> {
    const phone = this.normalize(rawPhone);
    if (!/^01[0-9]{8,9}$/.test(phone)) {
      throw new BadRequestException('휴대폰번호를 올바르게 입력해 주십시오.');
    }

    // 5분 내 발송 횟수 제한
    const cnt = await this.sql<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt FROM sms_auth
       WHERE phone = ${phone}
         AND created_at > now() - interval '5 minutes'
    `;
    if (cnt[0].cnt >= 5) {
      throw new BadRequestException(
        '인증번호 발송 횟수를 초과했습니다. 5분 후 다시 시도해주세요.',
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await this.sql`
      INSERT INTO sms_auth (phone, auth_code, expires_at)
      VALUES (${phone}, ${code}, now() + interval '5 minutes')
    `;

    // 알림톡 → SMS → 콘솔 순으로 시도
    let sent = false;
    if (this.bizmEnabled) {
      sent = await this.sendViaBizm(phone, code);
    }
    if (!sent && this.aligoEnabled) {
      sent = await this.sendViaAligo(phone, code);
    }
    if (!sent) {
      this.logger.log(`[AUTH-CODE DEV] phone=${phone} code=${code}`);
    }
  }

  /**
   * 인증번호 검증 — 5분 내 발급되고 아직 소비되지 않은 코드와 일치하면 통과.
   * 같은 (phone, code) 행을 atomic 하게 is_verified=true 로 마킹하여 1회성 처리.
   * 동시 요청 / 재전송 / 재시도 모두 race 없이 처음 한 번만 통과.
   */
  async verify(rawPhone: string, code: string): Promise<void> {
    const phone = this.normalize(rawPhone);
    const c = (code || '').trim();
    if (!phone || !c) {
      throw new BadRequestException('인증번호 입력값이 올바르지 않습니다.');
    }
    // UPDATE … RETURNING 으로 한 번에 마킹+검증. 가장 최근 미소비 행 1개만 소비.
    const rows = await this.sql<{ id: number }[]>`
      UPDATE sms_auth
         SET is_verified = TRUE
       WHERE id = (
         SELECT id FROM sms_auth
          WHERE phone = ${phone}
            AND auth_code = ${c}
            AND expires_at > now()
            AND is_verified = FALSE
          ORDER BY id DESC LIMIT 1
       )
      RETURNING id
    `;
    if (!rows.length) {
      throw new BadRequestException('인증번호가 일치하지 않거나 만료되었습니다.');
    }
  }

  /** 회원가입 시 휴대폰 인증 검증 (sample register_form_update.php 흐름) */
  async assertVerified(rawPhone: string, code: string): Promise<void> {
    return this.verify(rawPhone, code);
  }

  /**
   * 최근(기본 10분 이내) 인증된 휴대폰인지 확인. 코드 재입력 없이 최근 verify 여부만 검사.
   * verify() 는 1회성 소비형이므로 상담사 신청처럼 인증→폼제출 두 단계 사이에 사용.
   */
  async isVerifiedRecently(rawPhone: string, withinMinutes = 10): Promise<boolean> {
    const phone = this.normalize(rawPhone);
    if (!phone) return false;
    const rows = await this.sql<{ id: number }[]>`
      SELECT id FROM sms_auth
       WHERE phone = ${phone}
         AND is_verified = TRUE
         AND created_at > now() - (${withinMinutes} || ' minutes')::interval
       ORDER BY id DESC
       LIMIT 1
    `;
    return rows.length > 0;
  }

  /**
   * 범용 알림톡 발송 — alimtalk_template 에서 template_code 로 본문을 가져와
   * vars 의 키를 #{key} 로 치환 후 BizM v2 sender API 호출.
   *
   * 비즈엠은 템플릿 본문이 1글자라도 다르면 거부 → 친구톡 → SMS 강등됨.
   * 그래서 본문은 DB(alimtalk_template) 등록값 그대로 가져오고, 변수만 치환한다.
   *
   * 사용처: 결제완료/입금확인 등 — sample 의 alimtalk_outbox + cron 패턴을 직접 발송으로 대체.
   */
  async sendAlimtalkByCode(
    templateCode: string,
    rawPhone: string,
    vars: Record<string, string | number>,
    smsTitle?: string,
  ): Promise<{ ok: boolean; reason?: string; raw?: string }> {
    const phone = this.normalize(rawPhone);
    if (!phone) return { ok: false, reason: 'phone_invalid' };

    const rows = await this.sql<{
      template_code: string;
      message: string;
      primary_btn_name: string | null;
      primary_btn_url: string | null;
    }[]>`
      SELECT template_code, message, primary_btn_name, primary_btn_url
        FROM alimtalk_template
       WHERE template_code = ${templateCode} AND is_active = true
       LIMIT 1
    `;
    const tpl = rows[0];
    if (!tpl) {
      this.logger.error(`알림톡 템플릿 미등록: template_code=${templateCode}`);
      return { ok: false, reason: 'template_not_found' };
    }

    const substitute = (s: string): string => {
      let out = s;
      for (const [k, v] of Object.entries(vars)) {
        out = out.replace(new RegExp(`#\\{${k}\\}`, 'g'), String(v ?? ''));
      }
      return out;
    };
    const msg = substitute(tpl.message);
    // BizM 콘솔에 등록된 버튼 — 누락 시 K108 NoMatchedTemplateButtonException 거부됨.
    // primary_btn_url 의 #{url} 같은 변수도 vars 로 치환.
    const btnUrl = tpl.primary_btn_url ? substitute(tpl.primary_btn_url) : '';
    const btnName = tpl.primary_btn_name ?? '';

    if (!this.bizmEnabled) {
      this.logger.log(
        `[ALIMTALK DEV] tpl=${templateCode} phone=${phone} msg=${msg.slice(0, 100)}...`,
      );
      return { ok: true, reason: 'dev_mode' };
    }

    const url = 'https://alimtalk-api.bizmsg.kr/v2/sender/send';
    const phn = phone.startsWith('82') ? phone : `82${phone.replace(/^0/, '')}`;
    const payload: Record<string, unknown> = {
      message_type: 'at',
      phn,
      profile: this.bizmProfileKey,
      tmplId: tpl.template_code,
      msg,
      // SMS 폴백 발신번호가 BizM 에 등록 안 된 경우 M107 DeniedSenderNumber 로 전체 거부됨.
      // aligoSender 가 콘솔 등록 번호와 다르면 SMS 폴백 자체를 빼는 게 안전.
      // smsKind 등 SMS 필드는 발신번호가 검증 통과될 때만 추가.
    };
    if (this.aligoSender) {
      payload.smsKind = 'L';
      payload.msgSms = msg;
      payload.smsSender = this.aligoSender;
      payload.smsLmsTit = smsTitle || '사주문 알림';
    }
    // 버튼 — BizM v2 표준: button1 = { name, type, url_mobile, url_pc }
    if (btnName && btnUrl) {
      payload.button1 = {
        name: btnName,
        type: 'WL', // 웹링크
        url_mobile: btnUrl,
        url_pc: btnUrl,
      };
    }
    const body = [payload];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-type': 'application/json', userId: this.bizmUserId },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: Array<{ code?: string; message?: string }> = [];
      try {
        parsed = JSON.parse(text);
      } catch {
        this.logger.error(`bizm 응답 파싱 실패 tpl=${templateCode}: ${text.slice(0, 400)}`);
        return { ok: false, reason: 'parse_error', raw: text.slice(0, 400) };
      }
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const ok = String(first?.code) === 'success' || String(first?.message) === 'K000';
      if (!ok) {
        this.logger.error(
          `bizm 거부 tpl=${templateCode} phone=${phone} body=${text.slice(0, 400)}`,
        );
        return { ok: false, reason: 'bizm_rejected', raw: text.slice(0, 400) };
      }
      this.logger.log(`[BIZM ok] tpl=${templateCode} phone=${phone}`);
      return { ok: true, raw: text.slice(0, 400) };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.error(`bizm 발송 예외 tpl=${templateCode}: ${reason}`);
      return { ok: false, reason: 'network_error', raw: reason };
    }
  }

  /**
   * 임시비밀번호 알림톡 발송 — 비밀번호 찾기에서 호출.
   * sample/lib/wz_alimtalk_bizm 의 register_idpw1 템플릿 사용.
   * #{이름} #{회원아이디} #{임시비밀번호} 치환.
   */
  async sendFindPwAlimtalk(params: {
    phone: string;
    name: string;
    mbId: string;
    tempPw: string;
  }): Promise<boolean> {
    const phone = this.normalize(params.phone);
    if (!phone) return false;

    const rows = await this.sql<{ template_code: string; message: string }[]>`
      SELECT template_code, message FROM alimtalk_template
       WHERE template_code = ${this.bizmTplFindPw} AND is_active = true
       LIMIT 1
    `;
    const tpl = rows[0];
    if (!tpl) {
      this.logger.error(
        `bizm find-pw 템플릿 미등록: template_code=${this.bizmTplFindPw}`,
      );
      return false;
    }

    const msg = tpl.message
      .replace(/#\{이름\}/g, params.name)
      .replace(/#\{회원아이디\}/g, params.mbId)
      .replace(/#\{임시비밀번호\}/g, params.tempPw);

    if (!this.bizmEnabled) {
      this.logger.log(
        `[FIND-PW DEV] phone=${phone} name=${params.name} mb_id=${params.mbId} temp_pw=${params.tempPw}`,
      );
      return true;
    }

    const url = 'https://alimtalk-api.bizmsg.kr/v2/sender/send';
    const phn = phone.startsWith('82') ? phone : `82${phone.replace(/^0/, '')}`;
    const body = [
      {
        message_type: 'at',
        phn,
        profile: this.bizmProfileKey,
        tmplId: tpl.template_code,
        msg,
        smsKind: 'L',
        msgSms: msg,
        smsSender: this.aligoSender || phn,
        smsLmsTit: '사주문 비밀번호 찾기',
      },
    ];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-type': 'application/json', userId: this.bizmUserId },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const parsed = JSON.parse(text) as Array<{ code?: string; message?: string }>;
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const ok = String(first?.code) === 'success' || String(first?.message) === 'K000';
      if (!ok) {
        this.logger.error(`bizm find-pw 거부: ${text.slice(0, 400)}`);
        return false;
      }
      this.logger.log(`[BIZM find-pw ok] phone=${phone} mb_id=${params.mbId} body=${text.slice(0, 200)}`);
      return true;
    } catch (e) {
      this.logger.error(
        `bizm find-pw 발송 예외: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  private normalize(raw: string): string {
    return (raw || '').replace(/[^0-9]/g, '');
  }

  /**
   * 카카오 비즈엠 알림톡 발송.
   * sample/plugin/wz_alimtalk_bizm/bizmsg.class.php 와 동일 v2 API.
   *
   * 본문은 DB(alimtalk_template) 에 등록된 승인 템플릿을 그대로 사용한다.
   * 비즈엠은 본문이 1글자라도 다르면 알림톡 거부 → 친구톡 폴백 → SMS 폴백 순으로 강등됨.
   * 그래서 코드에 본문을 하드코딩하지 않고 DB 에서 가져온다.
   */
  private async sendViaBizm(phone: string, code: string): Promise<boolean> {
    // 1) DB 에서 템플릿 본문 조회 (sample bizmsg.class.php set_msg() 와 동등)
    const rows = await this.sql<{ template_code: string; message: string }[]>`
      SELECT template_code, message FROM alimtalk_template
       WHERE template_code = ${this.bizmTplSignupAuth} AND is_active = true
       LIMIT 1
    `;
    const tpl = rows[0];
    if (!tpl) {
      this.logger.error(
        `bizm 알림톡 템플릿 미등록: template_code=${this.bizmTplSignupAuth} (alimtalk_template 테이블 확인)`,
      );
      return false;
    }

    // 2) 변수 치환 — sample 의 #{인증번호} 처럼 등록된 변수만 치환
    const msg = tpl.message.replace(/#\{인증번호\}/g, code);

    // 3) 비즈엠 v2 sender API 호출
    const url = 'https://alimtalk-api.bizmsg.kr/v2/sender/send';
    const phn = phone.startsWith('82') ? phone : `82${phone.replace(/^0/, '')}`;
    const body = [
      {
        message_type: 'at',
        phn,
        profile: this.bizmProfileKey,
        tmplId: tpl.template_code,
        msg,
        smsKind: 'L',
        msgSms: msg,
        smsSender: this.aligoSender || phn,
        smsLmsTit: '사주문 인증번호',
      },
    ];
    this.logger.log(
      `[BIZM call] phone=${phone} tpl=${tpl.template_code} userId=${this.bizmUserId} profile=${this.bizmProfileKey.slice(0, 8)}...`,
    );

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
          userId: this.bizmUserId,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.error(
          `bizm HTTP ${res.status}: ${text.slice(0, 400)}`,
        );
        return false;
      }

      // 응답 본문의 code 검사 — bizm v2 는 200 OK 이어도 거부 시 code 가 7000 이 아님
      // 응답 형식: [{"code":"7000","message":"...","msgid":"..."}]
      let parsed: Array<{ code?: string; message?: string }> = [];
      try {
        parsed = JSON.parse(text);
      } catch {
        this.logger.error(`bizm 응답 파싱 실패: ${text.slice(0, 400)}`);
        return false;
      }
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const code0 = String(first?.code ?? '');
      const msg0 = String(first?.message ?? '');
      // 비즈엠 v2 성공 응답: code="success", message="K000"
      const ok = code0 === 'success' || msg0 === 'K000';
      if (!ok) {
        this.logger.error(
          `bizm 거부 code=${code0} message="${msg0}" body=${text.slice(0, 400)}`,
        );
        return false;
      }

      this.logger.log(
        `[BIZM ok] phone=${phone} tpl=${tpl.template_code} code=${code0} msg=${msg0}`,
      );
      return true;
    } catch (e) {
      this.logger.error(
        `bizm 알림톡 발송 예외: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  /**
   * 운영자 알림용 generic SMS 발송 (OpsAlert BizM 실패 시 폴백).
   *   - 메시지 길이가 90 byte 초과면 LMS (장문), 이하면 SMS
   *   - 알리고 미설정 시 false
   */
  async sendAdminSms(phone: string, message: string): Promise<boolean> {
    if (!this.aligoEnabled) {
      this.logger.warn(`[sendAdminSms] aligo 미설정 — skip phone=${phone}`);
      return false;
    }
    const normalized = this.normalize(phone);
    if (!/^01[0-9]{8,9}$/.test(normalized)) return false;
    // 한글은 UTF-8 3byte. 안전하게 LMS 강제 (장문). 본문은 1000자 cap.
    const body = message.slice(0, 1000);
    const url = 'https://apis.aligo.in/send/';
    const params = new URLSearchParams({
      user_id: this.aligoUserId,
      key: this.aligoKey,
      sender: this.aligoSender.replace(/[^0-9]/g, ''),
      receiver: normalized,
      msg: body,
      title: '[사주문 운영]',
      msg_type: 'LMS',
      testmode_yn: 'N',
    });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.error(`[sendAdminSms] HTTP ${res.status}: ${text.slice(0, 200)}`);
        return false;
      }
      this.logger.log(`[sendAdminSms ok] phone=${normalized} → ${text.slice(0, 200)}`);
      return true;
    } catch (e) {
      this.logger.error(
        `[sendAdminSms] 발송 예외: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  /** 알리고 SMS 폴백 발송 */
  private async sendViaAligo(phone: string, code: string): Promise<boolean> {
    const url = 'https://apis.aligo.in/send/';
    const params = new URLSearchParams({
      user_id: this.aligoUserId,
      key: this.aligoKey,
      sender: this.aligoSender.replace(/[^0-9]/g, ''),
      receiver: phone,
      msg: `[사주문] 인증번호 [${code}] 를 입력해주세요.`,
      msg_type: 'SMS',
      testmode_yn: 'N',
    });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.error(`알리고 SMS 실패 (HTTP ${res.status}): ${text.slice(0, 200)}`);
        return false;
      }
      this.logger.log(`[ALIGO send] phone=${phone} → ${text.slice(0, 200)}`);
      return true;
    } catch (e) {
      this.logger.error(
        `알리고 SMS 발송 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
