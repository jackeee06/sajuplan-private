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
import { PushService } from '../../shared/push/push.service';

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
  push_all: boolean;
  social_provider: string | null;
  intercept_until: Date | null;
  left_at: Date | null;
  profile_stored_name?: string | null;
  profile_stored_name_webp?: string | null;
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
  /** 푸시알림 전체 수신 동의 — 앱 설정 토글로 변경 */
  push_all: boolean;
  /** 프로필 사진 URL — 미등록 시 null */
  profile_image: string | null;
  /** 프로필 사진 WebP — 있으면 picture/source 우선 사용 */
  profile_image_webp: string | null;
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
    private readonly push: PushService,
  ) {}

  async loginByLocal(
    mbId: string,
    password: string,
  ): Promise<UserLoginResult> {
    const rows = await this.sql<MemberRow[]>`
      SELECT m.id, m.mb_id, m.password, m.name, m.nickname, m.email,
             m.role, m.level, m.point, m.push_all, m.social_provider, m.intercept_until, m.left_at,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp
        FROM member m
       WHERE m.mb_id = ${mbId}
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
      SELECT m.id, m.mb_id, m.password, m.name, m.nickname, m.email,
             m.role, m.level, m.point, m.push_all, m.social_provider, m.intercept_until, m.left_at,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp
        FROM member m WHERE m.id = ${id} LIMIT 1
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

  /**
   * 회원 잔액(point) 을 m2net 측 amt 로 덮어쓰기 동기화.
   * 매뉴얼 §3.4: PUT memb-mgr/{membid} body { amt } → 잔액 overwrite.
   *
   * 일반 회원(role='user') 만 대상. 상담사는 별도 동기화 로직 사용.
   * 호출 시점:
   *  - 로그인 직후
   *  - 메인페이지 진입 (앱 켤 때마다)
   *
   * 결과: { ok, sajumoonPoint, error? }. m2net 미등록·환경변수 미설정도 ok=false.
   */
  async syncM2netBalanceForMember(
    memberId: number,
  ): Promise<{ ok: boolean; sajumoonPoint: number; m2netMembid: string | null; error?: string }> {
    const rows = await this.sql<{
      id: number;
      role: string;
      point: number;
      csrid: string | null;
      name: string;
      phone: string | null;
    }[]>`
      SELECT id, role, point, csrid, name, phone FROM member WHERE id = ${memberId} AND left_at IS NULL LIMIT 1
    `;
    const me = rows[0];
    if (!me) return { ok: false, sajumoonPoint: 0, m2netMembid: null, error: '회원 없음' };
    // 상담사는 본 동기화 대상 아님 — 상담사 잔액은 정산용이라 별도 흐름.
    if (me.role !== 'user') {
      return { ok: false, sajumoonPoint: me.point, m2netMembid: me.csrid, error: '회원 대상 아님' };
    }
    if (!me.csrid) {
      return { ok: false, sajumoonPoint: me.point, m2netMembid: null, error: 'm2net 미등록 (csrid 없음)' };
    }
    if (!this.m2net.isEnabled()) {
      return { ok: false, sajumoonPoint: me.point, m2netMembid: me.csrid, error: 'M2NET 비활성' };
    }
    // 1) m2net 측 현재 잔액 조회 → 사주문 잔액과 차이만큼 fill 로 보정.
    //    PUT memb-mgr (overwrite) 방식은 m2net 의 충전·차감 push 와 race 가 날 수 있고
    //    절대값 set 시 0 클램프 등 사이드이펙트가 있어 매뉴얼 §3.6 delta 방식이 더 안전.
    const fetched = await this.m2net.getMemberByMembid(me.csrid);
    if (fetched.ok && typeof fetched.amt === 'number') {
      const delta = me.point - fetched.amt;
      if (delta === 0) {
        return { ok: true, sajumoonPoint: me.point, m2netMembid: me.csrid };
      }
      const fillRes = await this.m2net.addMemberCoin(me.csrid, delta);
      if (!fillRes.ok) {
        this.logger.warn(
          `[syncM2netBalance] fill 실패 member=${memberId} csrid=${me.csrid} delta=${delta}: ${fillRes.error}`,
        );
        // fallback to overwrite — 그래도 안 되면 에러.
        const r = await this.m2net.updateMember(me.csrid, { amt: me.point });
        if (!r.ok) {
          return {
            ok: false,
            sajumoonPoint: me.point,
            m2netMembid: me.csrid,
            error: r.error ?? '알 수 없음',
          };
        }
      } else {
        this.logger.log(
          `[syncM2netBalance] member=${memberId} csrid=${me.csrid} m2net=${fetched.amt} → ${me.point} (delta=${delta})`,
        );
      }
      return { ok: true, sajumoonPoint: me.point, m2netMembid: me.csrid };
    }
    // GET 실패 (m2net 미등록 또는 라우트 차이) → 매뉴얼 §3.4 overwrite 로 폴백.
    const r = await this.m2net.updateMember(me.csrid, { amt: me.point });
    if (!r.ok) {
      this.logger.warn(
        `[syncM2netBalance] overwrite 폴백 실패 member=${memberId} csrid=${me.csrid} point=${me.point}: ${r.error}`,
      );
      return {
        ok: false,
        sajumoonPoint: me.point,
        m2netMembid: me.csrid,
        error: r.error ?? '알 수 없음',
      };
    }
    return { ok: true, sajumoonPoint: me.point, m2netMembid: me.csrid };
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
      push_all: mb.push_all,
      profile_image: mb.profile_stored_name ? `/uploads/member/${mb.profile_stored_name}` : null,
      profile_image_webp: mb.profile_stored_name_webp ? `/uploads/member/${mb.profile_stored_name_webp}` : null,
    };
  }

  /** 앱 설정 — 푸시알림 전체 수신 토글 저장. 다른 push 토픽 별도 컬럼은 추후 분리. */
  async updatePushAll(memberId: number, on: boolean): Promise<{ push_all: boolean }> {
    await this.sql`UPDATE member SET push_all = ${on} WHERE id = ${memberId}`;
    return { push_all: on };
  }

  // ─────────────────────────────────────────────
  // 푸시 토큰 / 토픽 (모바일 앱 전용)
  // ─────────────────────────────────────────────

  /**
   * 모바일 앱 디바이스 토큰 등록 / 갱신.
   * 앱 부팅 시 (비로그인 상태에서도) 호출. 같은 토큰 row 가 이미 있으면
   * 갱신, 없으면 INSERT. memberId 는 로그인된 경우만 매핑되고, 비로그인
   * 부팅 단계에선 NULL 로 들어가 있다가 로그인 후 다시 호출되면 채워진다.
   */
  async upsertPushToken(params: {
    token: string;
    platform: 'android' | 'ios';
    memberId?: number | null;
    mbId?: string | null;
    devicePhone?: string | null;
    /** sample 의 gubun: 1=android, 2=ios — 기존 라이브 호환 위한 컬럼 */
    gubun?: number;
  }): Promise<{ ok: true }> {
    const token = params.token.trim();
    if (!token) return { ok: true };
    const gubun = params.gubun ?? (params.platform === 'ios' ? 2 : 1);

    // 같은 token 으로 등록된 row 가 있으면 거기에 member_id / mb_id / 갱신.
    // 없으면 새로 insert. token 자체는 unique 가 아니지만 (디바이스 재설치
    // 시 달라짐) 같은 디바이스에서 갱신 호출이 잦으므로 기존 row 가 있으면
    // 그걸 살린다.
    const updated = await this.sql<{ id: number }[]>`
      UPDATE member_push_token
         SET member_id    = COALESCE(${params.memberId ?? null}, member_id),
             mb_id        = COALESCE(${params.mbId ?? null}, mb_id),
             device_phone = COALESCE(${params.devicePhone ?? null}, device_phone),
             platform     = ${params.platform},
             gubun        = ${gubun},
             is_active    = true,
             updated_at   = now()
       WHERE token = ${token}
       RETURNING id
    `;
    if (updated.length === 0) {
      await this.sql`
        INSERT INTO member_push_token
          (member_id, mb_id, platform, token, device_phone, gubun, is_active)
        VALUES
          (${params.memberId ?? null}, ${params.mbId ?? null},
           ${params.platform}, ${token}, ${params.devicePhone ?? null},
           ${gubun}, true)
      `;
    }
    return { ok: true };
  }

  /**
   * 로그인된 회원이 자신의 token 을 가진 모든 row 의 member_id 를 채워준다.
   * 앱이 비로그인 상태에서 토큰을 먼저 등록한 후 로그인했을 때 사용.
   */
  async bindPushTokenToMember(memberId: number, token: string): Promise<void> {
    if (!token) return;
    await this.sql`
      UPDATE member_push_token
         SET member_id = ${memberId}, is_active = true, updated_at = now()
       WHERE token = ${token}
    `;
  }

  /**
   * 토큰 비활성화 — 로그아웃 / 앱 삭제 / FCM unregistered 응답 시.
   */
  async deactivatePushToken(token: string): Promise<void> {
    if (!token) return;
    await this.sql`
      UPDATE member_push_token
         SET is_active = false, updated_at = now()
       WHERE token = ${token}
    `;
  }

  /**
   * FCM 토픽 일괄 구독/해제.
   * sample 의 platform.js push_topic_update 와 같은 책임 — unsubscribe 먼저,
   * subscribe 다음. 한 토큰만 받으므로 디바이스가 두 채널에 동시에 들어가
   * 있는 잔재를 정리한다 ('chl_2'/'chl_5' 토글 시).
   */
  async updatePushTopics(params: {
    token: string;
    subscribe?: string[];
    unsubscribe?: string[];
  }): Promise<{ ok: boolean; subscribed: string[]; unsubscribed: string[] }> {
    const token = params.token?.trim();
    if (!token) {
      return { ok: false, subscribed: [], unsubscribed: [] };
    }
    const sub = (params.subscribe ?? []).filter(Boolean);
    const unsub = (params.unsubscribe ?? []).filter(Boolean);

    // 해제 먼저 (sample 의 setTimeout 500ms 시퀀스와 동일 의도).
    for (const topic of unsub) {
      await this.push.unsubscribeFromTopic([token], topic);
    }
    for (const topic of sub) {
      await this.push.subscribeToTopic([token], topic);
    }
    return { ok: true, subscribed: sub, unsubscribed: unsub };
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
        id: number;
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
      SELECT id, cz_id, subject, cz_type, cp_method, cp_target,
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

    // 중복 발급 방지 — zone_id 는 coupon_zone.id (BIGSERIAL PK) 를 저장. (redeem() 와 동일 규칙)
    const dup = await this.sql<{ id: number }[]>`
      SELECT id FROM coupon
       WHERE member_id = ${memberId} AND zone_id = ${z.id}
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
    // zone_id 는 coupon_zone.id (BIGSERIAL PK) — redeem()/list()/use() 의 JOIN 규칙과 일치시킴.
    await this.sql`
      INSERT INTO coupon (
        cp_id, zone_id, member_id, mb_id, title, method, target,
        starts_at, ends_at, discount_value, discount_type,
        zone_type, is_visible
      ) VALUES (
        ${cpId}, ${z.id}, ${memberId}, ${memberMbId}, ${z.subject}, ${z.cp_method}, ${z.cp_target ?? ''},
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

  // ─────────────────────────────────────────────
  // 회원 정보 수정 (마이페이지 > 회원 정보 수정)
  // ─────────────────────────────────────────────

  /** 마이페이지용 풀 프로필 조회 — 수정 폼에 prefill 용 */
  async getMeProfile(memberId: number): Promise<MeProfile> {
    type Row = {
      id: number;
      mb_id: string | null;
      name: string;
      nickname: string;
      email: string | null;
      phone: string | null;
      gender: string | null;
      birth_date: Date | null;
      birth_time: string | null;
      calendar_type: string | null;
      zip: string | null;
      addr1: string | null;
      addr2: string | null;
      acquisition_source: string | null;
      social_provider: string | null;
      ev_flags: Record<string, unknown> | null;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
    };
    const rows = await this.sql<Row[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.email, m.phone, m.gender,
             m.birth_date, m.birth_time, m.calendar_type,
             m.zip, m.addr1, m.addr2, m.acquisition_source,
             m.social_provider, m.ev_flags,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp
        FROM member m WHERE m.id = ${memberId} LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new UnauthorizedException('회원을 찾을 수 없습니다.');
    return {
      id: r.id,
      mb_id: r.mb_id,
      name: r.name,
      nickname: r.nickname,
      email: r.email,
      phone: r.phone,
      gender: r.gender as 'M' | 'F' | null,
      birth_date: formatDateOnly(r.birth_date),
      birth_time: r.birth_time,
      calendar_type: r.calendar_type as 'SOLAR' | 'LUNAR' | null,
      zip: r.zip,
      addr1: r.addr1,
      addr2: r.addr2,
      acquisition_source: r.acquisition_source,
      social_provider: r.social_provider,
      agree_email: !!(r.ev_flags && (r.ev_flags as Record<string, unknown>).agree_email),
      agree_sms: !!(r.ev_flags && (r.ev_flags as Record<string, unknown>).agree_sms),
      profile_image: r.profile_stored_name ? `/uploads/member/${r.profile_stored_name}` : null,
      profile_image_webp: r.profile_stored_name_webp ? `/uploads/member/${r.profile_stored_name_webp}` : null,
    };
  }

  /** 회원 본인 프로필 사진 등록/교체 — 단일 슬롯 (kind='profile') */
  async upsertProfileImage(
    memberId: number,
    file: {
      originalname: string;
      filename: string;
      size: number;
      mimetype: string;
      stored_name_webp: string | null;
    },
  ): Promise<{ profile_image: string; profile_image_webp: string | null }> {
    // 단일 슬롯 — 기존 프로필 row 모두 삭제 후 새로 INSERT
    const removed = await this.sql<{ stored_name: string; stored_name_webp: string | null }[]>`
      DELETE FROM member_file
       WHERE member_id = ${memberId} AND kind = 'profile'
       RETURNING stored_name, stored_name_webp
    `;
    const next = await this.sql<{ next_no: number }[]>`
      SELECT COALESCE(MAX(no), -1) + 1 AS next_no FROM member_file WHERE member_id = ${memberId}
    `;
    await this.sql`
      INSERT INTO member_file (
        member_id, no, kind, source_name, stored_name, stored_name_webp, filesize, file_type
      ) VALUES (
        ${memberId}, ${next[0].next_no}, 'profile',
        ${file.originalname}, ${file.filename}, ${file.stored_name_webp},
        ${file.size}, 1
      )
    `;
    return {
      profile_image: `/uploads/member/${file.filename}`,
      profile_image_webp: file.stored_name_webp ? `/uploads/member/${file.stored_name_webp}` : null,
      // 기존 파일명은 controller 에 별도로 반환할 수 없으니 리턴값에서 제외 — controller 가 unlink 책임
      ...(removed.length > 0 ? {} : {}),
    };
  }

  /** 회원 본인 프로필 사진 삭제 (storage unlink 는 controller 책임) */
  async removeProfileImage(memberId: number): Promise<{ stored_name: string; stored_name_webp: string | null }[]> {
    const removed = await this.sql<{ stored_name: string; stored_name_webp: string | null }[]>`
      DELETE FROM member_file
       WHERE member_id = ${memberId} AND kind = 'profile'
       RETURNING stored_name, stored_name_webp
    `;
    return removed;
  }

  /** 프로필 교체 시 기존 파일 정리용 — 새로 등록되기 전 row 들을 반환 */
  async getCurrentProfileFiles(memberId: number): Promise<{ stored_name: string; stored_name_webp: string | null }[]> {
    return this.sql<{ stored_name: string; stored_name_webp: string | null }[]>`
      SELECT stored_name, stored_name_webp FROM member_file
       WHERE member_id = ${memberId} AND kind = 'profile'
    `;
  }

  /**
   * 회원 정보 수정.
   *  - 휴대폰 변경 시 phone_code(SMS 인증번호) 필수 검증.
   *  - 닉네임 변경 시 다른 회원과 중복 불가.
   */
  async updateMeProfile(
    memberId: number,
    body: UpdateMeBody,
  ): Promise<MeProfile> {
    const cur = await this.getMeProfile(memberId);

    // 상담사 가드: nickname 은 카드/리스트 노출명·후기 식별자라 본인이 임의로 바꾸지 못한다.
    // 프론트의 readOnly 처리를 우회한 직접 호출(curl 등)을 막기 위한 서버측 방어.
    // 운영자가 admin 측에서 직접 변경하는 경로(/api/admin/members)는 별도로 유지된다.
    const roleRows = await this.sql<{ role: string }[]>`
      SELECT role FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (roleRows[0]?.role === 'counselor' && body.nickname !== undefined) {
      delete (body as { nickname?: string }).nickname;
    }

    // 닉네임 변경 시 중복 확인
    if (body.nickname && body.nickname !== cur.nickname) {
      const dup = await this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM member
         WHERE nickname = ${body.nickname} AND id <> ${memberId}
      `;
      if (Number(dup[0]?.count ?? 0) > 0) {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
    }

    // 휴대폰 변경 시 SMS 인증 + DB/m2net 중복 체크 + m2net 동기화
    let newPhone = cur.phone;
    const phoneInputNormalized = body.phone ? this.normalizePhone(body.phone) : null;
    const phoneActuallyChanged =
      phoneInputNormalized != null && phoneInputNormalized !== cur.phone;

    if (phoneActuallyChanged) {
      if (!body.phone_code) {
        throw new BadRequestException('휴대폰 인증번호가 필요합니다.');
      }
      // assertVerified 는 1회성 — 검증 직후 sms_auth.is_verified=true 로 마킹 (재사용 차단)
      await this.sms.assertVerified(body.phone!, body.phone_code);
      newPhone = phoneInputNormalized;
      // (1) DB 중복 — 다른 회원이 이미 쓰는 번호면 차단
      const dup = await this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM member
         WHERE phone = ${newPhone} AND id <> ${memberId} AND left_at IS NULL
      `;
      if (Number(dup[0]?.count ?? 0) > 0) {
        throw new ConflictException('이미 사용 중인 휴대폰 번호입니다.');
      }

      // (2) m2net 동기화 — role 무관 항상 시도. m2net 측 데이터가 우리 DB 와 어긋나면
      //   결제·상담·정산 흐름이 깨지므로 "휴대폰 변경 = m2net 동기화" 는 필수.
      //
      //   role='user'  + csrid 보유  : PUT  /memb-mgr/{membid} { telno } (잔액 amt 보존)
      //   role='user'  + csrid 없음  : POST /memb-mgr/{cpid}   {membnm,telno,amt:0} → 받은 membid 저장
      //   role='counselor' + csrid   : POST /csr-mgr/{cpid}    {풀 레코드}  (csr-mgr 풀 레코드 갱신)
      //                                 csr-mgr 의 telno 는 "상담사 통화 연결번호"(member.telno)
      //                                 이며 본인 휴대폰(member.phone) 과 다름. 그래도 m2net 측
      //                                 회원 레코드 telno 동기화를 위해 csr-mgr 풀 push 한 번 수행.
      //   role='counselor' + csrid 없음: 정상 흐름이 아님 → 경고 로그만 남기고 진행
      //
      //   동기화 실패 시 ConflictException 으로 변경 자체를 거절 (DB 도 미변경).
      const meRows = await this.sql<{
        id: number;
        name: string;
        nickname: string;
        role: string;
        csrid: string | null;
        dtmfno: string | null;
        telno: string | null;
        counselor_priority: number | null;
        call_unit_seconds: number | null;
        call_070_unit_cost: number | null;
        chat_unit_seconds: number | null;
        chat_unit_cost: number | null;
        preflag: 'P' | 'Y' | null;
        state: string;
      }[]>`
        SELECT id, name, nickname, role, csrid,
               dtmfno, telno, counselor_priority,
               call_unit_seconds, call_070_unit_cost,
               chat_unit_seconds, chat_unit_cost,
               preflag, state
          FROM member WHERE id = ${memberId} LIMIT 1
      `;
      const me = meRows[0];
      const newTelnoDigits = newPhone.replace(/\D/g, '');
      const m2netEnabled = this.m2net.isEnabled();

      if (m2netEnabled && me?.role === 'user' && me?.csrid) {
        // 일반회원 — PUT memb-mgr 으로 telno 만 갱신 (잔액 amt 보존)
        const r = await this.m2net.updateMember(me.csrid, { telno: newTelnoDigits });
        if (!r.ok) {
          const msg = this.extractM2netMessage(r.raw, r.error);
          throw new ConflictException(msg);
        }
        this.logger.log(
          `[updateProfile] m2net memb-mgr PUT 성공 member_id=${memberId} membid=${me.csrid} new_phone=${newPhone}`,
        );
      } else if (m2netEnabled && me?.role === 'user' && !me?.csrid) {
        // 일반회원 m2net 미등록 — 지연 등록 (POST). 받은 membid 를 csrid 컬럼에 저장.
        const r = await this.m2net.registerMember({
          membnm: me.name,
          telno: newTelnoDigits,
          amt: 0,
        });
        if (!r.ok) {
          const msg = this.extractM2netMessage(r.raw, r.error);
          throw new ConflictException(msg);
        }
        if (r.membid) {
          await this.sql`UPDATE member SET csrid = ${r.membid} WHERE id = ${memberId}`;
        }
        this.logger.log(
          `[updateProfile] m2net memb-mgr POST 지연등록 성공 member_id=${memberId} new_membid=${r.membid ?? '(none)'}`,
        );
      } else if (m2netEnabled && me?.role === 'counselor' && me?.csrid) {
        // 상담사 — csr-mgr 풀 레코드 push (단방향 갱신, m2net 응답은 성공/실패만 봄).
        // member.phone 을 단일 진실(single source of truth)로 두고 csr-mgr 의 telno
        // 까지 같은 값으로 보낸다. 휴대폰 변경 = 콜 라우팅 번호도 새 번호로 갱신.
        // (sample 의 mb_3 분리 컬럼 member.telno 는 더 이상 push 소스로 쓰지 않음)
        const r = await this.m2net.registerCounselor({
          csrnm: me.nickname,
          state: me.state || 'IDLE',
          sortno: me.counselor_priority ?? 1,
          dtmfno: me.dtmfno ?? '',
          telno: newTelnoDigits,
          dectm: me.call_unit_seconds ?? 30,
          decamt: me.call_070_unit_cost ?? 0,
          preflag: (me.preflag ?? 'P') as 'P' | 'Y' | '',
          chatdectm: me.chat_unit_seconds ?? 30,
          chatdecamt: me.chat_unit_cost ?? 0,
        });
        if (!r.ok) {
          const msg = this.extractM2netMessage(r.raw, r.error);
          throw new ConflictException(msg);
        }
        this.logger.log(
          `[updateProfile] m2net csr-mgr 동기화 성공 member_id=${memberId} csrid=${me.csrid} new_phone=${newPhone}`,
        );
      } else if (me?.role === 'counselor' && !me?.csrid) {
        // 상담사가 m2net 미등록 — 어드민에서 상담사 등록을 먼저 해야 하는 비정상 상태.
        // 본인 휴대폰 변경은 차단하지 않되 운영 알림용 경고 로그.
        this.logger.warn(
          `[updateProfile] 상담사가 m2net csrid 없음 (어드민 상담사 등록 누락?) member_id=${memberId}`,
        );
      } else if (!m2netEnabled) {
        // 로컬 개발 등 m2net 비활성 환경 — 동기화 자체를 시도하지 않음.
        this.logger.log(`[updateProfile] m2net 비활성 — 동기화 skip member_id=${memberId}`);
      }
    }

    // 성별 정규화 — 한글 '남자/여자' 도 받음
    const gender =
      body.gender === 'M' || body.gender === '남자' ? 'M'
      : body.gender === 'F' || body.gender === '여자' ? 'F'
      : cur.gender;

    const calendarType =
      body.calendar_type === 'SOLAR' || body.calendar_type === '양력' ? 'SOLAR'
      : body.calendar_type === 'LUNAR' || body.calendar_type === '음력' ? 'LUNAR'
      : cur.calendar_type;

    // 생년월일 — 'YYYY-MM-DD' 또는 'YYYYMMDD' 허용. 빈 문자열은 NULL.
    const birthDate = body.birth_date == null
      ? cur.birth_date
      : body.birth_date.trim() === '' ? null
      : this.normalizeBirth(body.birth_date);

    // ev_flags 갱신
    const newEvFlags = {
      agree_email: body.agree_email ?? cur.agree_email,
      agree_sms: body.agree_sms ?? cur.agree_sms,
    };

    await this.sql`
      UPDATE member SET
        nickname           = COALESCE(${body.nickname ?? null}, nickname),
        email              = ${body.email ?? cur.email},
        phone              = ${newPhone},
        gender             = ${gender},
        birth_date         = ${birthDate}::date,
        calendar_type      = ${calendarType},
        zip                = ${body.zip ?? cur.zip},
        addr1              = ${body.addr1 ?? cur.addr1},
        addr2              = ${body.addr2 ?? cur.addr2},
        acquisition_source = ${body.acquisition_source ?? cur.acquisition_source},
        ev_flags           = ${this.sql.json(newEvFlags) as unknown as string}::jsonb,
        updated_at         = now()
       WHERE id = ${memberId}
    `;

    return this.getMeProfile(memberId);
  }

  /** 비밀번호 변경 — 현재 비밀번호 검증 후 새 비밀번호로 교체. */
  async changePassword(memberId: number, currentPw: string, newPw: string): Promise<void> {
    if (!newPw || newPw.length < 6) {
      throw new BadRequestException('비밀번호는 6자 이상이어야 합니다.');
    }
    const rows = await this.sql<{ password: string | null }[]>`
      SELECT password FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const cur = rows[0]?.password;
    if (!cur) {
      // 소셜 전용 계정은 비밀번호가 없음 — 변경 불가
      throw new BadRequestException('비밀번호가 설정되지 않은 계정입니다. 비밀번호 찾기로 새로 설정해주세요.');
    }
    const ok = await this.verifyBcrypt(currentPw, cur);
    if (!ok) throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');

    const hash = await bcrypt.hash(newPw, 12);
    await this.sql`UPDATE member SET password = ${hash}, updated_at = now() WHERE id = ${memberId}`;
  }

  /** 회원탈퇴 — left_at 마킹 (실제 삭제는 안 함). */
  async withdrawMe(memberId: number): Promise<void> {
    await this.sql`
      UPDATE member SET left_at = now(), updated_at = now() WHERE id = ${memberId}
    `;
  }

  /** m2net 응답에서 사용자에게 보여줄 에러 메시지 추출 */
  private extractM2netMessage(raw: unknown, fallback?: string): string {
    if (raw && typeof raw === 'object' && 'resultmessage' in raw) {
      const m = String((raw as { resultmessage?: unknown }).resultmessage ?? '');
      if (m) return m;
    }
    return fallback || '외부 시스템 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }

  /** 휴대폰 번호 정규화 — 010-1234-5678 / 01012345678 모두 010-1234-5678 형태로 통일 */
  private normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }

  /** 'YYYYMMDD' 또는 'YYYY-MM-DD' → 'YYYY-MM-DD' */
  private normalizeBirth(raw: string): string {
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
    throw new BadRequestException('생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD 또는 YYYYMMDD)');
  }
}

export interface MeProfile {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  gender: 'M' | 'F' | null;
  /** YYYY-MM-DD */
  birth_date: string | null;
  birth_time: string | null;
  calendar_type: 'SOLAR' | 'LUNAR' | null;
  zip: string | null;
  addr1: string | null;
  addr2: string | null;
  acquisition_source: string | null;
  social_provider: string | null;
  agree_email: boolean;
  agree_sms: boolean;
  /** 프로필 사진 URL (uploads/member/...). 미등록 시 null */
  profile_image: string | null;
  /** 프로필 사진 WebP 변환본 — 있으면 picture/source 로 우선 사용 */
  profile_image_webp: string | null;
}

export interface UpdateMeBody {
  nickname?: string;
  email?: string | null;
  phone?: string;
  /** 휴대폰 변경 시 필수 — sms_auth 5분 내 매칭 검증 */
  phone_code?: string;
  gender?: 'M' | 'F' | '남자' | '여자';
  birth_date?: string | null;
  birth_time?: string | null;
  calendar_type?: 'SOLAR' | 'LUNAR' | '양력' | '음력';
  zip?: string;
  addr1?: string;
  addr2?: string;
  acquisition_source?: string;
  agree_email?: boolean;
  agree_sms?: boolean;
}

/**
 * postgres DATE / TIMESTAMPTZ 응답을 'YYYY-MM-DD' 로 안전 포매팅.
 *  - postgres.js 가 DATE 를 string ('YYYY-MM-DD') 으로 줄 수도, Date 객체로 줄 수도 있음.
 *  - Date 인 경우 서버 timezone 영향을 받지 않도록 UTC 컴포넌트로 포매팅 (postgres DATE 는 UTC 자정으로 파싱됨).
 */
function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    return m ? m[1] : null;
  }
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}
