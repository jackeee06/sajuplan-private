import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicNotificationItem {
  id: number;
  title: string;
  content: string;
  link_url: string | null;
  category: string | null;
  read: boolean;
  created_at: string;
}

/**
 * 사용자 알림 내역 — `notification_log` 기반.
 *
 * 노출 규칙 (sample/sub/push_list.php 충실 이식):
 *  - 일반회원(role=user)  : 본인 mb_id 또는 (전체공지/일반회원 카테고리)
 *  - 상담사(role=counselor): 본인 mb_id 또는 (전체공지/상담사 카테고리)
 *  - 본 사용자에게 직접 발송된 row(member_id 일치)는 항상 노출.
 *  - 최근 6개월(created_at >= now() - 6 months)
 *
 * 어드민 sendPush 가 이미 대상 member 마다 1 row 씩 INSERT 하므로
 * 1차 매칭은 `member_id = current` 만으로 충분하다 (legacy id='all' 모델은 사용 X).
 *
 * 읽음 처리: `viewed_by` JSONB 배열에 mb_id 누적 (sample 의 longtext is_view → JSONB 정규화).
 */
@Injectable()
export class UserNotificationsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 알림 리스트 조회.
   *  - memberId === null (비로그인): `전체공지` 브로드캐스트만 노출, read=false 고정.
   *  - 로그인: 본인 개별 + 역할별 브로드캐스트.
   */
  async list(memberId: number | null): Promise<{ items: PublicNotificationItem[] }> {
    let myMbId = '';
    let cats: string[] = ['전체공지'];

    if (memberId !== null) {
      const me = await this.sql<{ mb_id: string | null; role: string }[]>`
        SELECT mb_id, role FROM member WHERE id = ${memberId} LIMIT 1
      `;
      if (me.length === 0) return { items: [] };
      myMbId = me[0].mb_id ?? '';
      const role = me[0].role;
      cats =
        role === 'user' ? ['전체공지', '일반회원']
        : role === 'counselor' ? ['전체공지', '상담사']
        : ['전체공지'];
    }

    const rows = memberId !== null
      ? await this.sql<
          {
            id: number;
            title: string;
            content: string;
            link_url: string | null;
            category: string | null;
            viewed_by: string[] | null;
            created_at: Date | null;
          }[]
        >`
          SELECT id, title, content, link_url, category, viewed_by, created_at
            FROM notification_log
           WHERE created_at >= now() - interval '6 months'
             AND (
               member_id = ${memberId}
               OR (member_id IS NULL AND mb_id = 'all' AND category = ANY(${this.sql.array(cats)}::text[]))
             )
           ORDER BY created_at DESC NULLS LAST, id DESC
           LIMIT 200
        `
      : await this.sql<
          {
            id: number;
            title: string;
            content: string;
            link_url: string | null;
            category: string | null;
            viewed_by: string[] | null;
            created_at: Date | null;
          }[]
        >`
          SELECT id, title, content, link_url, category, viewed_by, created_at
            FROM notification_log
           WHERE created_at >= now() - interval '6 months'
             AND member_id IS NULL AND mb_id = 'all'
             AND category = '전체공지'
           ORDER BY created_at DESC NULLS LAST, id DESC
           LIMIT 200
        `;

    const items: PublicNotificationItem[] = rows.map((r) => {
      const viewers = Array.isArray(r.viewed_by) ? r.viewed_by : [];
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        link_url: r.link_url,
        category: r.category,
        read: !!myMbId && viewers.includes(myMbId),
        created_at: r.created_at ? r.created_at.toISOString() : '',
      };
    });

    return { items };
  }

  /**
   * 단건 읽음 처리 — viewed_by 에 본인 mb_id 추가 (이미 있으면 noop).
   *  본인 개별 알림(member_id=me) 또는 본인 역할이 보는 브로드캐스트만 허용.
   */
  async markRead(memberId: number, id: number): Promise<{ ok: true }> {
    const my = await this.sql<{ mb_id: string | null; role: string }[]>`
      SELECT mb_id, role FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (my.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');
    const mbId = my[0].mb_id ?? '';
    if (!mbId) return { ok: true };
    const cats =
      my[0].role === 'user' ? ['전체공지', '일반회원']
      : my[0].role === 'counselor' ? ['전체공지', '상담사']
      : ['전체공지'];

    const exists = await this.sql<{ id: number }[]>`
      SELECT id FROM notification_log
       WHERE id = ${id}
         AND (
           member_id = ${memberId}
           OR (member_id IS NULL AND mb_id = 'all' AND category = ANY(${this.sql.array(cats)}::text[]))
         )
       LIMIT 1
    `;
    if (exists.length === 0) throw new NotFoundException('알림을 찾을 수 없습니다.');

    await this.sql`
      UPDATE notification_log
         SET viewed_by = CASE
               WHEN viewed_by ? ${mbId} THEN viewed_by
               ELSE COALESCE(viewed_by, '[]'::jsonb) || to_jsonb(${mbId}::text)
             END
       WHERE id = ${id}
    `;
    return { ok: true };
  }

  /** 전체 읽음 — 최근 6개월 노출되는 본인 알림 모두에 mb_id 추가. */
  async markAllRead(memberId: number): Promise<{ ok: true; updated: number }> {
    const my = await this.sql<{ mb_id: string | null; role: string }[]>`
      SELECT mb_id, role FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (my.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');
    const mbId = my[0].mb_id ?? '';
    if (!mbId) return { ok: true, updated: 0 };
    const cats =
      my[0].role === 'user' ? ['전체공지', '일반회원']
      : my[0].role === 'counselor' ? ['전체공지', '상담사']
      : ['전체공지'];

    const r = await this.sql`
      UPDATE notification_log
         SET viewed_by = COALESCE(viewed_by, '[]'::jsonb) || to_jsonb(${mbId}::text)
       WHERE created_at >= now() - interval '6 months'
         AND (
           member_id = ${memberId}
           OR (member_id IS NULL AND mb_id = 'all' AND category = ANY(${this.sql.array(cats)}::text[]))
         )
         AND NOT (COALESCE(viewed_by, '[]'::jsonb) ? ${mbId})
    `;
    return { ok: true, updated: r.count ?? 0 };
  }
}
