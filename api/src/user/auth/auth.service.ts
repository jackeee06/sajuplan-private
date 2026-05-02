import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';
import { SmsService } from '../sms/sms.service';
import { MailerService } from '../../shared/mailer/mailer.service';

interface MemberRow {
  id: number;
  mb_id: string | null;
  password: string | null;
  name: string;
  nickname: string;
  email: string | null;
  role: string;
  level: number;
  point: number;
  social_provider: string | null;
  intercept_until: Date | null;
  left_at: Date | null;
}

export interface UserLoginResult {
  id: number;
  mb_id: string;
  name: string;
  nickname: string;
  email: string | null;
  role: string;
  level: number;
  point: number;
}

/**
 * 사용자(회원) 인증 서비스.
 * — 일반 로그인은 mb_id + password (bcrypt).
 * — 레거시 sha256 해시는 받지 않음(별도 마이그레이션에서 처리).
 * — 차단/탈퇴/소셜 전용 계정에 대한 처리는 sample/bbs/login_check.php 흐름을 따름.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly sms: SmsService,
    private readonly mailer: MailerService,
  ) {}

  async loginByLocal(
    mbId: string,
    password: string,
  ): Promise<UserLoginResult> {
    const rows = await this.sql<MemberRow[]>`
      SELECT id, mb_id, password, name, nickname, email,
             role, level, point, social_provider, intercept_until, left_at
        FROM member
       WHERE mb_id = ${mbId}
       LIMIT 1
    `;
    const mb = rows[0];

    // timing-attack 방지: 항상 bcrypt.compare를 한 번 실행
    const dummyHash =
      '$2b$12$abcdefghijklmnopqrstuuMo3p8jJq.gsv5gE0YvKlFh7TnTzGv3Hu';
    const hash = mb?.password ?? dummyHash;
    const ok = await this.verifyBcrypt(password, hash);

    if (!mb || !mb.password || !ok) {
      throw new UnauthorizedException(
        '가입된 회원아이디가 아니거나 비밀번호가 틀립니다.',
      );
    }

    this.assertNotBlocked(mb);

    await this.sql`UPDATE member SET last_login_at = now() WHERE id = ${mb.id}`;

    return this.toLoginResult(mb);
  }

  /**
   * member.id 로 직접 조회 (소셜 콜백에서 사용).
   * 차단/탈퇴 회원은 차단.
   */
  async findActiveById(id: number): Promise<UserLoginResult> {
    const rows = await this.sql<MemberRow[]>`
      SELECT id, mb_id, password, name, nickname, email,
             role, level, point, social_provider, intercept_until, left_at
        FROM member WHERE id = ${id} LIMIT 1
    `;
    const mb = rows[0];
    if (!mb) throw new UnauthorizedException('회원을 찾을 수 없습니다.');
    this.assertNotBlocked(mb);
    return this.toLoginResult(mb);
  }

  private assertNotBlocked(mb: MemberRow): void {
    if (mb.left_at && mb.left_at <= new Date()) {
      throw new ForbiddenException('탈퇴한 아이디이므로 접근하실 수 없습니다.');
    }
    if (mb.intercept_until && mb.intercept_until > new Date()) {
      throw new ForbiddenException(
        '회원님의 아이디는 접근이 금지되어 있습니다.',
      );
    }
  }

  private toLoginResult(mb: MemberRow): UserLoginResult {
    return {
      id: mb.id,
      mb_id: mb.mb_id ?? '',
      name: mb.name,
      nickname: mb.nickname,
      email: mb.email,
      role: mb.role,
      level: mb.level,
      point: mb.point,
    };
  }

  private async verifyBcrypt(plain: string, hash: string): Promise<boolean> {
    if (
      hash.startsWith('$2a$') ||
      hash.startsWith('$2b$') ||
      hash.startsWith('$2y$')
    ) {
      return bcrypt.compare(plain, hash);
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // 가입 / 중복확인 (로컬)
  // ─────────────────────────────────────────────

  /** mb_id 중복 확인 — true=사용가능 */
  async isMbIdAvailable(mbId: string): Promise<boolean> {
    const rows = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM member WHERE mb_id = ${mbId}
      ) AS exists
    `;
    return !rows[0].exists;
  }

  /**
   * 금지 아이디 검사 — security.prohibit_id (콤마 구분).
   * sample reserve_mb_id() 동등.
   */
  async assertMbIdNotProhibited(mbId: string): Promise<void> {
    const rows = await this.sql<{ value: string | null }[]>`
      SELECT value FROM setting
       WHERE namespace = 'security' AND key = 'prohibit_id' LIMIT 1
    `;
    const list = (rows[0]?.value ?? '')
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(mbId.toLowerCase())) {
      throw new BadRequestException(
        '이미 예약된 단어로 사용할 수 없는 아이디입니다.',
      );
    }
  }

  /**
   * 금지 이메일 도메인 검사 — security.prohibit_email (콤마 구분).
   * sample prohibit_mb_email() 동등.
   */
  async assertEmailNotProhibited(email: string | null | undefined): Promise<void> {
    if (!email) return;
    const at = email.lastIndexOf('@');
    if (at < 0) return;
    const domain = email.slice(at + 1).trim().toLowerCase();
    if (!domain) return;
    const rows = await this.sql<{ value: string | null }[]>`
      SELECT value FROM setting
       WHERE namespace = 'security' AND key = 'prohibit_email' LIMIT 1
    `;
    const list = (rows[0]?.value ?? '')
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(domain)) {
      throw new BadRequestException(
        `${domain} 메일은 사용할 수 없습니다.`,
      );
    }
  }

  /**
   * 휴대폰번호 중복 검사 — 회원(role='user') 가입 가능한지 확인.
   *
   * 정책:
   *  - 같은 role 안에서만 중복 검사 (상담사·관리자와 회원은 별개로 가입 허용)
   *  - 일반/카카오/네이버 가입 경로 무관 — 모두 같은 'user' role 이므로 한 번만 가입
   *  - 탈퇴(left_at) 회원 제외
   *
   * sample 정책: phone 중복은 application 로직.
   */
  async assertPhoneAvailable(rawPhone: string | null | undefined): Promise<void> {
    if (!rawPhone) return;
    const phone = String(rawPhone).replace(/[^0-9]/g, '');
    if (!phone) return;
    const rows = await this.sql<
      { id: number; mb_id: string | null; social_provider: string | null }[]
    >`
      SELECT id, mb_id, social_provider FROM member
       WHERE phone = ${phone}
         AND role = 'user'
         AND left_at IS NULL
       LIMIT 1
    `;
    if (rows.length) {
      const ex = rows[0];
      const provider =
        ex.social_provider === 'kakao'
          ? '(카카오 가입)'
          : ex.social_provider === 'naver'
            ? '(네이버 가입)'
            : ex.mb_id
              ? '(일반 가입)'
              : '';
      throw new ConflictException(
        `이미 가입된 휴대폰번호입니다. ${provider}`.trim(),
      );
    }
  }

  /** nickname 중복 확인 — true=사용가능 */
  async isNicknameAvailable(nickname: string): Promise<boolean> {
    const rows = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM member WHERE nickname = ${nickname}
      ) AS exists
    `;
    return !rows[0].exists;
  }

  /**
   * 로컬 회원가입 — mb_id + bcrypt(password) + 폼 데이터.
   * — uq_member_mb_id UNIQUE 제약: 동시성 충돌 시 ConflictException.
   * — name/nickname NOT NULL.
   */
  async createLocalMember(form: {
    mb_id: string;
    password: string;
    name: string;
    nickname: string;
    email: string | null;
    phone: string | null;
    birth_date: string | null;
    birth_time: string | null;
    gender: 'M' | 'F' | null;
    calendar_type: 'SOLAR' | 'LUNAR' | null;
    zip: string | null;
    addr1: string | null;
    addr2: string | null;
    acquisition_source: string | null;
  }): Promise<{ id: number }> {
    // 금지 아이디·이메일 검사 (어드민 security 설정)
    await this.assertMbIdNotProhibited(form.mb_id);
    await this.assertEmailNotProhibited(form.email);

    if (!(await this.isMbIdAvailable(form.mb_id))) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    // 같은 휴대폰번호로 다른 경로(카카오/네이버/일반) 가입 차단
    await this.assertPhoneAvailable(form.phone);

    const passwordHash = await bcrypt.hash(form.password, 12);
    const name = form.name.slice(0, 50);
    const nickname = form.nickname.slice(0, 20);

    let insertedId: number;
    try {
      const inserted = await this.sql<{ id: number }[]>`
        INSERT INTO member (
          mb_id, password,
          name, nickname, email, phone,
          birth_date, birth_time, gender, calendar_type,
          zip, addr1, addr2,
          acquisition_source,
          signup_source, last_login_at
        ) VALUES (
          ${form.mb_id}, ${passwordHash},
          ${name}, ${nickname}, ${form.email}, ${form.phone},
          ${form.birth_date}, ${form.birth_time}, ${form.gender}, ${form.calendar_type},
          ${form.zip}, ${form.addr1}, ${form.addr2},
          ${form.acquisition_source},
          ${'local'}, now()
        )
        RETURNING id
      `;
      insertedId = inserted[0].id;
    } catch (e) {
      // postgres unique_violation = 23505
      const code = (e as { code?: string }).code;
      if (code === '23505') {
        throw new ConflictException('이미 사용 중인 아이디입니다.');
      }
      throw e;
    }

    // m2net (AG9/PassCall) 외부 회원 등록 — 실패 시 회원 롤백
    await this.registerWithM2net(insertedId);

    // 회원가입 쿠폰 발급 — m2net 등록 후 (실패 시 회원 자체가 롤백되어 쿠폰도 의미 없음)
    try {
      await this.issueSignupCoupon(insertedId);
    } catch (e) {
      this.logger.error(
        `[signup-coupon] 발급 실패(회원가입은 진행) member_id=${insertedId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return { id: insertedId };
  }

  /**
   * m2net (AG9/PassCall) 외부 회원 등록 + member.csrid 저장.
   * sample register_form_update.php 의 send_mjson('memb-mgr') 흐름 동등.
   *  - 성공: 발급된 membid (6자리 zero-pad) → member.csrid 에 저장
   *  - 실패: 회원 row 삭제 + BadRequestException (sample alert(resultmessage,'/') 동등)
   *
   * 로컬·소셜 가입 모두에서 호출.
   */
  async registerWithM2net(memberId: number): Promise<void> {
    if (!this.m2net.isEnabled()) {
      this.logger.warn(`[signup] m2net 비활성 — member_id=${memberId} 외부 등록 skip`);
      return;
    }

    const rows = await this.sql<{ name: string; phone: string | null }[]>`
      SELECT name, phone FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const m = rows[0];
    if (!m) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }

    const r = await this.m2net.registerMember({
      membnm: m.name,
      telno: (m.phone ?? '').replace(/[^0-9]/g, ''),
      amt: 0,
    });
    if (r.ok && r.membid) {
      await this.sql`UPDATE member SET csrid = ${r.membid} WHERE id = ${memberId}`;
      this.logger.log(`[signup] m2net 등록 성공 member_id=${memberId} csrid=${r.membid}`);
      return;
    }

    // 실패 — 회원 row 삭제 후 알림 메시지 그대로 throw
    await this.sql`DELETE FROM member WHERE id = ${memberId}`;
    const msg =
      (r.raw && typeof r.raw === 'object' && 'resultmessage' in r.raw
        ? String((r.raw as { resultmessage?: unknown }).resultmessage ?? '')
        : '') ||
      r.error ||
      'm2net 회원 등록에 실패했습니다. 잠시 후 다시 시도해주세요.';
    this.logger.error(
      `[signup] m2net 등록 실패 → 회원 롤백 (id=${memberId}): ${msg}`,
    );
    throw new BadRequestException(msg);
  }

  /**
   * 회원가입 쿠폰 발급 (sample set_join_member_coupon() 동등)
   * — coupon_zone 에서 '회원가입 쿠폰' 정책 조회 → coupon 테이블에 row INSERT
   * — 정책이 없으면 silent skip (운영팀이 어드민에서 정책 활성 시 자동 동작)
   * — 같은 회원 + 같은 zone 중복 발급 방지
   */
  async issueSignupCoupon(memberId: number): Promise<void> {
    const zones = await this.sql<
      {
        cz_id: number | null;
        subject: string;
        cz_type: number;
        cp_method: number;
        cp_target: string | null;
        cz_point: number;
        cp_type: boolean;
        cz_period: number;
      }[]
    >`
      SELECT cz_id, subject, cz_type, cp_method, cp_target,
             cz_point, cp_type, cz_period
        FROM coupon_zone
       WHERE (subject ILIKE '%회원가입%' OR cz_id = 39)
         AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1
    `;
    if (!zones.length) {
      this.logger.log(`[signup-coupon] 정책 미등록 → 발급 skip (member_id=${memberId})`);
      return;
    }
    const z = zones[0];

    // 중복 발급 방지
    const dup = await this.sql<{ id: number }[]>`
      SELECT id FROM coupon
       WHERE member_id = ${memberId} AND zone_id = ${z.cz_id}
       LIMIT 1
    `;
    if (dup.length) {
      this.logger.log(`[signup-coupon] 이미 발급됨 (member_id=${memberId})`);
      return;
    }

    // 회원 mb_id 도 같이 채움 — 추적/조회 편의 + sample 호환
    const memRows = await this.sql<{ mb_id: string | null }[]>`
      SELECT mb_id FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const memberMbId = memRows[0]?.mb_id ?? null;

    const cpId = `JOIN${memberId}-${Date.now().toString(36).toUpperCase()}`;
    const startsAt = new Date();
    const endsAt =
      z.cz_period > 0
        ? new Date(Date.now() + z.cz_period * 86_400_000)
        : null;

    // 라이브 컬럼명: cp_id (마이그 0004 정의의 cpid 와 다름 — DB 실측값 기준으로 통일)
    await this.sql`
      INSERT INTO coupon (
        cp_id, zone_id, member_id, mb_id, title, method, target,
        starts_at, ends_at, discount_value, discount_type,
        zone_type, is_visible
      ) VALUES (
        ${cpId}, ${z.cz_id}, ${memberId}, ${memberMbId}, ${z.subject}, ${z.cp_method}, ${z.cp_target ?? ''},
        ${startsAt}, ${endsAt}, ${z.cz_point}, ${z.cp_type ? 1 : 0},
        ${z.cz_type}, true
      )
    `;
    this.logger.log(
      `[signup-coupon] 발급 완료 member_id=${memberId} mb_id=${memberMbId} cp_id=${cpId} ${z.cz_point}원`,
    );
  }

  /**
   * 휴대폰 비밀번호 찾기 — 인증 완료된 폰번호로 회원 조회 → 임시비밀번호 발급 → 알림톡 발송.
   * sample/bbs/password_lost.php 흐름.
   * 호출 전 SmsService.assertVerified() 로 인증 완료 검증해야 함.
   */
  async findPasswordByPhone(rawPhone: string): Promise<void> {
    const phone = String(rawPhone).replace(/[^0-9]/g, '');
    const rows = await this.sql<
      {
        id: number;
        mb_id: string | null;
        name: string;
        social_provider: string | null;
      }[]
    >`
      SELECT id, mb_id, name, social_provider FROM member
       WHERE phone = ${phone}
         AND role = 'user'
         AND left_at IS NULL
       ORDER BY id DESC LIMIT 1
    `;
    const m = rows[0];
    if (!m || !m.mb_id) {
      throw new BadRequestException(
        '해당 휴대폰번호로 가입된 회원이 없습니다.',
      );
    }
    // 소셜 가입자는 비밀번호가 없음 — 소셜 로그인만 사용 가능
    if (m.social_provider) {
      const label = m.social_provider === 'kakao' ? '카카오' : '네이버';
      throw new BadRequestException(
        `${label}로 가입된 계정입니다. ${label} 로그인을 이용해주세요.`,
      );
    }

    const tempPw = this.generateTempPassword();
    const hash = await bcrypt.hash(tempPw, 12);
    await this.sql`UPDATE member SET password = ${hash} WHERE id = ${m.id}`;

    const ok = await this.sms.sendFindPwAlimtalk({
      phone,
      name: m.name,
      mbId: m.mb_id,
      tempPw,
    });
    if (!ok) {
      this.logger.warn(
        `[find-pw/phone] 알림톡 발송 실패 (회원 비밀번호는 변경됨) member_id=${m.id}`,
      );
    }
    this.logger.log(`[find-pw/phone] member_id=${m.id} mb_id=${m.mb_id} 임시비밀번호 발급`);
  }

  /**
   * 이메일 비밀번호 찾기 — 이메일로 회원 조회 → 임시비밀번호 발급 → 메일 발송 (TODO 메일러).
   * 메일러 미구현 상태에선 콘솔 로깅으로 폴백.
   */
  async findPasswordByEmail(email: string): Promise<void> {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) {
      throw new BadRequestException('이메일 형식이 올바르지 않습니다.');
    }
    const rows = await this.sql<
      {
        id: number;
        mb_id: string | null;
        name: string;
        email: string | null;
        social_provider: string | null;
      }[]
    >`
      SELECT id, mb_id, name, email, social_provider FROM member
       WHERE (email = ${e} OR social_email = ${e})
         AND role = 'user'
         AND left_at IS NULL
       ORDER BY id DESC LIMIT 1
    `;
    const m = rows[0];
    if (!m || !m.mb_id) {
      throw new BadRequestException(
        '해당 이메일로 가입된 회원이 없습니다.',
      );
    }
    if (m.social_provider) {
      const label = m.social_provider === 'kakao' ? '카카오' : '네이버';
      throw new BadRequestException(
        `${label}로 가입된 계정입니다. ${label} 로그인을 이용해주세요.`,
      );
    }

    const tempPw = this.generateTempPassword();
    const hash = await bcrypt.hash(tempPw, 12);
    await this.sql`UPDATE member SET password = ${hash} WHERE id = ${m.id}`;

    // 네이버 SMTP 메일 발송 (sample/bbs/password_lost.php 흐름 동등)
    const html = this.renderFindPwEmail({
      name: m.name,
      mbId: m.mb_id,
      tempPw,
    });
    const sent = await this.mailer.send({
      to: m.email!,
      subject: '[사주문] 임시비밀번호 안내',
      html,
      text: `안녕하세요. 사주문입니다.\n\n이름: ${m.name}\n회원아이디: ${m.mb_id}\n임시비밀번호: ${tempPw}\n\n임시비밀번호로 로그인하신 후 비밀번호를 변경해 주시기 바랍니다.`,
    });
    if (!sent) {
      this.logger.warn(
        `[find-pw/email] 메일 발송 실패 (회원 비밀번호는 변경됨) member_id=${m.id}`,
      );
    }
    this.logger.log(
      `[find-pw/email] member_id=${m.id} mb_id=${m.mb_id} 임시비밀번호 발급`,
    );
  }

  /** 비밀번호 찾기 메일 HTML — 사주문 톤앤매너 (간결) */
  private renderFindPwEmail(p: {
    name: string;
    mbId: string;
    tempPw: string;
  }): string {
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1E2939;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;padding:32px 28px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#8259F5;">사주문 회원정보 찾기 안내</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      안녕하세요, <strong>${p.name}</strong>님.<br/>
      회원정보 찾기 요청에 따라 아래와 같이 안내드립니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;color:#6A7282;font-size:14px;width:140px;">회원아이디</td>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;font-size:15px;font-weight:600;">${p.mbId}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6A7282;font-size:14px;">임시비밀번호</td>
        <td style="padding:10px 0;font-size:15px;font-weight:700;color:#8259F5;font-family:monospace;">${p.tempPw}</td>
      </tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#4A5565;margin:16px 0 0;">
      임시비밀번호로 로그인하신 후 <strong>반드시 비밀번호를 변경</strong>해 주시기 바랍니다.
    </p>
    <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;"/>
    <p style="font-size:12px;color:#99A1AF;margin:0;">
      본 메일은 발신 전용입니다. 문의는 사주문 고객센터를 이용해주세요.
    </p>
  </div>
</body>
</html>`;
  }

  /** 임시비밀번호 생성 — 영문대소문/숫자 8자, 헷갈리는 문자 제외 */
  private generateTempPassword(): string {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const buf = randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHABET[buf[i] % ALPHABET.length];
    return s;
  }
}
