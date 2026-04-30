import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/** 신규 mng의 사이드바 메뉴별 resource 키 (admin_permission.resource에 저장) */
export const ADMIN_RESOURCES = [
  'dashboard',
  'members.customers', 'members.counselors',
  'sales.consultations', 'sales.charge_amounts', 'sales.payments', 'sales.points', 'sales.settlements',
  'consultation.reviews', 'consultation.chat',
  'board.search_keywords', 'board.search_popular', 'board.faqs', 'board.posts_overview', 'board.reports',
  'notification.push', 'notification.alimtalk', 'notification.email',
  'misc.banners', 'misc.popup_layers', 'misc.saju_config',
  'misc.wish', 'misc.wish_event', 'misc.qa', 'misc.qa_counselor',
  'config.settings', 'config.permissions',
  'stats.visit', 'stats.revenue',
] as const;

@Injectable()
export class PermissionsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 관리자 목록 (member.role='admin' OR is_super=true) */
  async listAdmins() {
    const items = await this.sql`
      SELECT id, login_id, name, nickname, role, level, is_super, last_login_at, created_at
      FROM member
      WHERE role = 'admin' OR is_super = TRUE
      ORDER BY is_super DESC NULLS LAST, id ASC
    `;
    return { items, total: items.length };
  }

  /** 회원 → 관리자 등급 부여 / 해제 */
  async setAdminRole(memberId: number, isAdmin: boolean, isSuper: boolean) {
    const role = isAdmin ? 'admin' : 'user';
    await this.sql`UPDATE member SET role = ${role}, is_super = ${isSuper} WHERE id = ${memberId}`;
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

  /** 후보 — 관리자가 아니지만 검색하면 표시 (회원 검색) */
  async searchMember(q: string) {
    if (!q?.trim()) return { items: [] };
    const items = await this.sql`
      SELECT id, login_id, name, nickname, role
      FROM member
      WHERE login_id ILIKE ${'%' + q + '%'} OR name ILIKE ${'%' + q + '%'} OR nickname ILIKE ${'%' + q + '%'}
      ORDER BY id ASC
      LIMIT 20
    `;
    return { items };
  }
}
