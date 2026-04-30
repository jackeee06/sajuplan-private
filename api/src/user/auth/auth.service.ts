import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';

interface MemberRow {
  id: number;
  login_id: string | null;
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
  login_id: string;
  name: string;
  nickname: string;
  email: string | null;
  role: string;
  level: number;
  point: number;
}

/**
 * 사용자(회원) 인증 서비스.
 * — 일반 로그인은 login_id + password (bcrypt).
 * — 레거시 sha256 해시는 받지 않음(별도 마이그레이션에서 처리).
 * — 차단/탈퇴/소셜 전용 계정에 대한 처리는 sample/bbs/login_check.php 흐름을 따름.
 */
@Injectable()
export class AuthService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async loginByLocal(
    loginId: string,
    password: string,
  ): Promise<UserLoginResult> {
    const rows = await this.sql<MemberRow[]>`
      SELECT id, login_id, password, name, nickname, email,
             role, level, point, social_provider, intercept_until, left_at
        FROM member
       WHERE login_id = ${loginId}
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
      SELECT id, login_id, password, name, nickname, email,
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
      login_id: mb.login_id ?? '',
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

  /** login_id 중복 확인 — true=사용가능 */
  async isLoginIdAvailable(loginId: string): Promise<boolean> {
    const rows = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM member WHERE login_id = ${loginId}
      ) AS exists
    `;
    return !rows[0].exists;
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
   * 로컬 회원가입 — login_id + bcrypt(password) + 폼 데이터.
   * — uq_member_login_id UNIQUE 제약: 동시성 충돌 시 ConflictException.
   * — name/nickname NOT NULL.
   */
  async createLocalMember(form: {
    login_id: string;
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
    if (!(await this.isLoginIdAvailable(form.login_id))) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    const passwordHash = await bcrypt.hash(form.password, 12);
    const name = form.name.slice(0, 50);
    const nickname = form.nickname.slice(0, 30);

    try {
      const inserted = await this.sql<{ id: number }[]>`
        INSERT INTO member (
          login_id, password,
          name, nickname, email, phone,
          birth_date, birth_time, gender, calendar_type,
          zip, addr1, addr2,
          acquisition_source,
          signup_source, last_login_at
        ) VALUES (
          ${form.login_id}, ${passwordHash},
          ${name}, ${nickname}, ${form.email}, ${form.phone},
          ${form.birth_date}, ${form.birth_time}, ${form.gender}, ${form.calendar_type},
          ${form.zip}, ${form.addr1}, ${form.addr2},
          ${form.acquisition_source},
          ${'local'}, now()
        )
        RETURNING id
      `;
      return { id: inserted[0].id };
    } catch (e) {
      // postgres unique_violation = 23505
      const code = (e as { code?: string }).code;
      if (code === '23505') {
        throw new ConflictException('이미 사용 중인 아이디입니다.');
      }
      throw e;
    }
  }
}
