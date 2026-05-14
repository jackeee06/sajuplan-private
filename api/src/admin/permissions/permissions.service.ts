import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface CreateAdminInput {
  mb_id: string;
  password: string;
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  is_super?: boolean;
}

/** 신규 mng의 사이드바 메뉴별 resource 키 (admin_permission.resource에 저장) */
export const ADMIN_RESOURCES = [
  'dashboard',
  'members.customers', 'members.counselors',
  'sales.consultations', 'sales.charge_amounts', 'sales.payments', 'sales.points', 'sales.settlements',
  'consultation.reviews', 'consultation.chat',
  'board.search_keywords', 'board.search_popular', 'board.faqs', 'board.notices', 'board.events', 'board.posts_overview', 'board.reports',
  'notification.push', 'notification.alimtalk', 'notification.email',
  'misc.banners', 'misc.popup_layers', 'misc.saju_config',
  'misc.wish', 'misc.wish_event', 'misc.qa', 'misc.qa_counselor',
  'config.settings', 'config.permissions',
  'stats.visit', 'stats.revenue',
] as const;

@Injectable()
export class PermissionsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 관리자 목록 (활성 admin 계정만 — 좌탈 제외) */
  async listAdmins() {
    const items = await this.sql`
      SELECT id, mb_id, name, nickname, role, level, is_super, last_login_at, created_at
      FROM member
      WHERE (role = 'admin' OR is_super = TRUE)
        AND left_at IS NULL
      ORDER BY is_super DESC NULLS LAST, id ASC
    `;
    return { items, total: items.length };
  }

  /**
   * 신규 관리자 계정 생성.
   * 정책: 기존 회원의 role/level 을 변경하지 않는다 — 별도 member row 를 새로 만든다.
   *      mb_id 는 전체 member 테이블에서 유일해야 한다 (uq_member_mb_id).
   */
  async createAdmin(input: CreateAdminInput): Promise<{ id: number }> {
    const mbId = input.mb_id?.trim();
    if (!mbId) throw new BadRequestException('아이디는 필수입니다.');
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(mbId)) {
      throw new BadRequestException('아이디는 3~30자의 영문/숫자/_/- 만 사용할 수 있습니다.');
    }
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('비밀번호는 6자 이상이어야 합니다.');
    }
    if (!input.name?.trim()) throw new BadRequestException('이름은 필수입니다.');

    const exists = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE mb_id = ${mbId} LIMIT 1`;
    if (exists.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const hash = await bcrypt.hash(input.password, 10);
    const phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;
    const nickname = input.nickname?.trim() || input.name.trim();

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member (mb_id, password, name, nickname, email, phone, role, level, is_super)
      VALUES (
        ${mbId}, ${hash}, ${input.name.trim()}, ${nickname},
        ${input.email?.trim() || null}, ${phone},
        'admin', 10, ${!!input.is_super}
      )
      RETURNING id
    `;
    return { id: inserted[0].id };
  }

  /**
   * 슈퍼 관리자 토글 — 이미 admin 인 계정에 한해서만 허용.
   * 기존 일반 회원의 role/level 을 변경하지 않는다.
   */
  async setSuperFlag(memberId: number, isSuper: boolean) {
    const rows = await this.sql<{ role: string }[]>`SELECT role FROM member WHERE id = ${memberId} LIMIT 1`;
    if (rows.length === 0) throw new NotFoundException('관리자 계정을 찾을 수 없습니다.');
    if (rows[0].role !== 'admin') throw new BadRequestException('관리자 계정에서만 변경할 수 있습니다.');
    await this.sql`UPDATE member SET is_super = ${isSuper} WHERE id = ${memberId}`;
    return { ok: true };
  }

  /**
   * 관리자 계정 비활성화.
   * 정책: role/level/is_super 는 그대로 두고 left_at 만 기록한다 (히스토리 보존).
   *      이 호출은 admin 인 계정에서만 호출되어야 한다.
   */
  async deactivateAdmin(memberId: number) {
    const rows = await this.sql<{ role: string }[]>`SELECT role FROM member WHERE id = ${memberId} LIMIT 1`;
    if (rows.length === 0) throw new NotFoundException('관리자 계정을 찾을 수 없습니다.');
    if (rows[0].role !== 'admin') throw new BadRequestException('관리자 계정만 비활성화할 수 있습니다.');
    await this.sql`UPDATE member SET left_at = now(), is_super = FALSE WHERE id = ${memberId}`;
    return { ok: true };
  }

  /** 권한 매트릭스 — 한 관리자의 모든 resource 권한 */
  async getPermissions(memberId: number) {
    const rows = await this.sql<{ resource: string; can_read: boolean; can_write: boolean; can_delete: boolean }[]>`
      SELECT resource, can_read, can_write, can_delete FROM admin_permission WHERE member_id = ${memberId}
    `;
    const map = new Map<string, { can_read: boolean; can_write: boolean; can_delete: boolean }>();
    for (const r of rows) map.set(r.resource, { can_read: r.can_read, can_write: r.can_write, can_delete: r.can_delete });

    const matrix = ADMIN_RESOURCES.map((resource) => {
      const p = map.get(resource);
      return { resource, can_read: !!p?.can_read, can_write: !!p?.can_write, can_delete: !!p?.can_delete };
    });
    return { items: matrix };
  }

  /** 권한 매트릭스 일괄 저장 */
  async savePermissions(memberId: number, items: { resource: string; can_read: boolean; can_write: boolean; can_delete: boolean }[], grantedById: number) {
    if (!Array.isArray(items)) throw new BadRequestException('items 배열을 전달하세요.');
    return await this.sql.begin(async (tx) => {
      for (const it of items) {
        if (!ADMIN_RESOURCES.includes(it.resource as typeof ADMIN_RESOURCES[number])) continue;
        const cleared = !it.can_read && !it.can_write && !it.can_delete;
        if (cleared) {
          await tx`DELETE FROM admin_permission WHERE member_id = ${memberId} AND resource = ${it.resource}`;
        } else {
          await tx`
            INSERT INTO admin_permission (member_id, resource, can_read, can_write, can_delete, granted_by_id, granted_at)
            VALUES (${memberId}, ${it.resource}, ${it.can_read}, ${it.can_write}, ${it.can_delete}, ${grantedById}, now())
            ON CONFLICT (member_id, resource) DO UPDATE
              SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write, can_delete = EXCLUDED.can_delete,
                  granted_by_id = EXCLUDED.granted_by_id, granted_at = now()
          `;
        }
      }
      return { ok: true };
    });
  }

}
