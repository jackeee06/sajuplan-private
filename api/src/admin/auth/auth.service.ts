import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';

interface AdminMemberRow {
  id: number;
  mb_id: string | null;
  password: string | null;
  name: string;
  nickname: string;
  role: string;
  level: number;
  is_super: boolean | null;
}

export interface AdminLoginResult {
  id: number;
  mb_id: string;
  name: string;
  nickname: string;
  role: 'admin';
  level: number;
  is_super: boolean;
}

@Injectable()
export class AdminAuthService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async login(mbId: string, password: string): Promise<AdminLoginResult> {
    const rows = await this.sql<AdminMemberRow[]>`
      SELECT id, mb_id, password, name, nickname, role, level, is_super
        FROM member
       WHERE mb_id = ${mbId}
         AND role = 'admin'
         AND left_at IS NULL
       LIMIT 1
    `;

    const admin = rows[0];
    // 동일 메시지/타이밍을 유지하기 위해 항상 bcrypt.compare를 한 번 실행
    const dummyHash =
      '$2b$12$abcdefghijklmnopqrstuuMo3p8jJq.gsv5gE0YvKlFh7TnTzGv3Hu';
    const hash = admin?.password ?? dummyHash;
    const ok = await this.verifyPassword(password, hash);

    if (!admin || !admin.password || !ok) {
      throw new UnauthorizedException(
        '로그인 ID 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    await this.sql`UPDATE member SET last_login_at = now() WHERE id = ${admin.id}`;

    return {
      id: admin.id,
      mb_id: admin.mb_id ?? '',
      name: admin.name,
      nickname: admin.nickname,
      role: 'admin',
      level: admin.level,
      is_super: !!admin.is_super,
    };
  }

  /**
   * bcrypt만 허용. 레거시 sha256:iter:salt:hash는 별도 마이그레이션에서 처리.
   */
  private async verifyPassword(plain: string, hash: string): Promise<boolean> {
    if (
      hash.startsWith('$2a$') ||
      hash.startsWith('$2b$') ||
      hash.startsWith('$2y$')
    ) {
      return bcrypt.compare(plain, hash);
    }
    return false;
  }
}
