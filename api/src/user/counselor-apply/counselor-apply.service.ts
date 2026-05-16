import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';

const MB_ID_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

/**
 * 사용자 — 상담사 신청 (post_apply 테이블).
 *
 *  - 본인이 작성한 신청글 내역만 조회 가능 (member_id = requester).
 *  - 공지(category='notice') 는 모두 조회 가능.
 *  - is_secret 글은 본인만 본문 조회 가능 (목록에선 제목/메타만 노출).
 *  - status: pending(검토중) / accepted(승인) / rejected(반려) / cancelled(취소).
 */
@Injectable()
export class UserCounselorApplyService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  // ─────────────────────────────────────────────
  // 목록 (내 신청 내역 + 전체 공지)
  // ─────────────────────────────────────────────

  async list(params: {
    memberId?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    items: Array<{
      id: number;
      title: string;
      category: string | null;
      status: string;
      is_secret: boolean;
      is_mine: boolean;
      mine_only_lock: boolean;
      author_nickname: string | null;
      created_at: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 10));
    const offset = (page - 1) * limit;
    const memberId = params.memberId ?? null;

    type Row = {
      id: number;
      title: string;
      category: string | null;
      status: string;
      is_secret: boolean;
      member_id: number | null;
      nickname: string | null;
      created_at: Date;
      total: string;
    };

    // 공지(category='notice') 는 모두에게 보임 — 비로그인이어도.
    // 그 외 일반 신청은 본인 것만 노출 (member_id = requester).
    // 비로그인이면 공지만 노출.
    const rows = await this.sql<Row[]>`
      SELECT a.id, a.title, a.category, a.status, a.is_secret, a.member_id,
             m.nickname,
             a.created_at,
             COUNT(*) OVER ()::text AS total
        FROM post_apply a
        LEFT JOIN member m ON m.id = a.member_id
       WHERE (
         a.category = 'notice'
         OR a.member_id = ${memberId}
       )
       ORDER BY (a.category = 'notice') DESC, a.created_at DESC, a.id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    const items = rows.map((r) => {
      const isMine = memberId != null && r.member_id === memberId;
      const isNotice = r.category === 'notice';
      // 일반 글은 비공개 처리 — 단, 본인 글이면 보임. 공지는 항상 공개.
      const lock = !isNotice && r.is_secret && !isMine;
      return {
        id: Number(r.id),
        title: r.title,
        category: r.category,
        status: r.status,
        is_secret: r.is_secret,
        is_mine: isMine,
        // UI 가 자물쇠를 잠그는 기준 — 본인 것 외 비밀글은 잠금
        mine_only_lock: lock,
        author_nickname: r.nickname,
        created_at: r.created_at.toISOString(),
      };
    });

    return { items, total, page, limit };
  }

  // ─────────────────────────────────────────────
  // 상세 — 본인 글만 (공지는 누구나)
  // ─────────────────────────────────────────────

  async detail(id: number, memberId?: number) {
    type Row = {
      id: number;
      member_id: number | null;
      mb_id: string | null;
      title: string;
      content: string | null;
      category: string | null;
      status: string;
      applicant_phone: string | null;
      applicant_email: string | null;
      is_secret: boolean;
      view_count: number;
      extras: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
      nickname: string | null;
    };

    const rows = await this.sql<Row[]>`
      SELECT a.id, a.member_id, a.mb_id, a.title, a.content, a.category, a.status,
             a.applicant_phone, a.applicant_email, a.is_secret, a.view_count,
             a.extras, a.created_at, a.updated_at, m.nickname
        FROM post_apply a
        LEFT JOIN member m ON m.id = a.member_id
       WHERE a.id = ${id}
       LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('해당 글을 찾을 수 없습니다.');

    const isNotice = r.category === 'notice';
    const isMine = memberId != null && r.member_id === memberId;
    if (!isNotice && !isMine) {
      throw new ForbiddenException('본인이 작성한 신청글만 열람할 수 있습니다.');
    }

    // view_count 증가 (본인이어도 카운트 — sample 그누보드와 동일 단순화)
    await this.sql`UPDATE post_apply SET view_count = view_count + 1 WHERE id = ${id}`;

    return {
      id: Number(r.id),
      title: r.title,
      content: r.content,
      category: r.category,
      status: r.status,
      applicant_phone: r.applicant_phone,
      applicant_email: r.applicant_email,
      is_secret: r.is_secret,
      view_count: r.view_count + 1,
      extras: r.extras ?? {},
      author_nickname: r.nickname,
      is_mine: isMine,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // 작성 — 로그인 회원만, 본인 명의로 1건씩
  // ─────────────────────────────────────────────

  async create(params: {
    /** 로그인 회원이면 member.id, 비회원이면 null */
    memberId: number | null;
    /** 로그인 회원이면 member.mb_id, 비회원이면 null */
    mbId: string | null;
    /**
     * 신청 종류 (2026-05-16) — 'application' 만 상담사 지원서(계정·사진·분야 등 풀폼),
     * 'inquiry' / 'other' 는 간단 문의 폼 (제목·본문·연락처만).
     * 기본 'application' — 기존 호출 호환.
     */
    apply_type?: 'application' | 'inquiry' | 'other';
    title: string;
    content?: string;
    applicant_phone?: string;
    applicant_email?: string;
    is_secret?: boolean;
    extras?: Record<string, unknown>;
    /** 상담사 가입용 ID — 'application' 일 때만 필수. inquiry/other 는 무시. */
    account_mb_id?: string;
    /** 상담사 가입용 PW (평문) — 'application' 일 때만 필수. */
    account_password?: string;
  }): Promise<{ id: number }> {
    const title = params.title.trim();
    if (!title) throw new BadRequestException('제목을 입력해주세요.');

    const applyType = params.apply_type ?? 'application';
    const isApplication = applyType === 'application';
    const phone = (params.applicant_phone ?? '').replace(/[^0-9]/g, '');

    let extras: Record<string, unknown> = { ...(params.extras ?? {}) };

    if (isApplication) {
      // ── 상담사 지원서 (풀폼) — 기존 동작 ──
      if (!phone) throw new BadRequestException('휴대폰 번호를 입력해주세요.');

      // 상담사 가입 ID/PW — 필수.
      const accountMbId = (params.account_mb_id ?? '').trim();
      const accountPassword = params.account_password ?? '';
      if (!accountMbId) throw new BadRequestException('아이디를 입력해주세요.');
      if (!MB_ID_PATTERN.test(accountMbId)) {
        throw new BadRequestException('아이디는 영문/숫자/언더스코어 4~20자여야 합니다.');
      }
      if (!accountPassword || accountPassword.length < 6) {
        throw new BadRequestException('비밀번호는 6자 이상이어야 합니다.');
      }

      // ── 휴대폰 중복 정책 (상담사 지원 한정 — 일반 회원과 겹치는 건 OK)
      //   accepted: 이미 상담사로 가입된 사람 → 차단
      //   pending : 검토중 신청이 있으면 → 자동으로 'superseded' 처리하고 새 신청 접수
      //   rejected/cancelled/superseded: 그냥 허용
      const acceptedExisting = await this.sql<{ id: number }[]>`
        SELECT id FROM post_apply
         WHERE applicant_phone = ${phone}
           AND status = 'accepted'
           AND category = 'application'
         LIMIT 1
      `;
      if (acceptedExisting.length > 0) {
        throw new ConflictException(
          '이미 같은 휴대폰으로 상담사 가입이 완료되어 있습니다. 로그인 후 이용해주세요.',
        );
      }
      // 기존 pending 지원만 superseded 처리 — 문의는 별개라 안 건드림.
      await this.sql`
        UPDATE post_apply
           SET status = 'superseded', updated_at = now()
         WHERE applicant_phone = ${phone}
           AND status = 'pending'
           AND category = 'application'
      `;

      // 아이디 중복 — member 테이블 + 진행중 신청서 양쪽.
      const avail = await this.checkMbIdAvailable(accountMbId);
      if (!avail.available) {
        throw new ConflictException(`아이디 "${accountMbId}" 는 사용할 수 없습니다.`);
      }

      // 평문 PW 는 절대 저장 안 함 — 여기서 즉시 해시.
      const passwordHash = await bcrypt.hash(accountPassword, 10);

      // extras 에 mb_id / password_hash 를 박아 넣고 저장 — 승인 시 그대로 사용.
      extras.mb_id = accountMbId;
      extras.password_hash = passwordHash;
    } else {
      // ── 간단 문의 (inquiry/other) ──
      //   - 본문 필수, 연락처(전화/이메일) 중 하나 이상 필수
      //   - 계정 ID/PW 검증 안 함 (가입 없음)
      const content = (params.content ?? '').trim();
      if (!content) throw new BadRequestException('문의 내용을 입력해주세요.');
      if (!phone && !(params.applicant_email ?? '').trim()) {
        throw new BadRequestException('연락처(전화번호 또는 이메일) 중 하나를 입력해주세요.');
      }
    }

    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO post_apply (
        member_id, mb_id, title, content, category,
        applicant_phone, applicant_email, status, is_secret, extras
      ) VALUES (
        ${params.memberId},
        ${params.mbId},
        ${title},
        ${params.content ?? null},
        ${applyType},
        ${phone || null},
        ${params.applicant_email ?? null},
        'pending',
        ${params.is_secret ?? true},
        ${this.sql.json(extras as never)}
      )
      RETURNING id
    `;
    return { id: Number(rows[0].id) };
  }

  /**
   * 아이디 사용 가능 여부 — 상담사 신청 폼 onBlur 시 호출.
   * 1) member.mb_id 와 겹치면 안 됨 (회원/상담사 공용 컬럼)
   * 2) post_apply.extras->>'mb_id' 가 pending/accepted 상태로 겹쳐도 안 됨
   * 형식 위반(영숫자 4~20자)도 사용 불가로 응답해서 프론트가 즉시 안내.
   */
  async checkMbIdAvailable(rawMbId: string): Promise<{ available: boolean; reason?: string }> {
    const mbId = (rawMbId ?? '').trim();
    if (!mbId) return { available: false, reason: '아이디를 입력해주세요.' };
    if (!MB_ID_PATTERN.test(mbId)) {
      return { available: false, reason: '영문/숫자/언더스코어 4~20자' };
    }
    const inMember = await this.sql<{ id: number }[]>`
      SELECT id FROM member WHERE mb_id = ${mbId} LIMIT 1
    `;
    if (inMember.length > 0) {
      return { available: false, reason: '이미 사용 중인 아이디입니다.' };
    }
    const inApply = await this.sql<{ id: number }[]>`
      SELECT id FROM post_apply
       WHERE extras->>'mb_id' = ${mbId}
         AND status IN ('pending', 'accepted')
       LIMIT 1
    `;
    if (inApply.length > 0) {
      return { available: false, reason: '이미 신청 중인 아이디입니다.' };
    }
    return { available: true };
  }

  /**
   * 휴대폰 중복 체크 — 폼 입력 단계에서 실시간 안내용.
   *  duplicate=true 일 때만 폼이 차단된다.
   *    - accepted : 이미 가입된 상담사 → 차단 (duplicate=true)
   *    - pending  : 검토중 신청 있음 → 차단 안 함, 안내만 (duplicate=false, hasPending=true)
   *                 create() 단계에서 자동으로 superseded 처리됨.
   *    - 그 외     : 영향 없음.
   */
  async checkPhoneDuplicate(rawPhone: string): Promise<{
    duplicate: boolean;
    status: 'accepted' | 'pending' | 'none';
  }> {
    const phone = (rawPhone ?? '').replace(/[^0-9]/g, '');
    if (!phone) return { duplicate: false, status: 'none' };

    const accepted = await this.sql<{ id: number }[]>`
      SELECT id FROM post_apply
       WHERE applicant_phone = ${phone}
         AND status = 'accepted'
       LIMIT 1
    `;
    if (accepted.length > 0) return { duplicate: true, status: 'accepted' };

    const pending = await this.sql<{ id: number }[]>`
      SELECT id FROM post_apply
       WHERE applicant_phone = ${phone}
         AND status = 'pending'
       LIMIT 1
    `;
    if (pending.length > 0) return { duplicate: false, status: 'pending' };

    return { duplicate: false, status: 'none' };
  }

  // ─────────────────────────────────────────────
  // 취소 — 본인 글, status=pending 만
  // ─────────────────────────────────────────────

  async cancel(id: number, memberId: number): Promise<{ ok: true }> {
    const rows = await this.sql<{ status: string; member_id: number | null }[]>`
      SELECT status, member_id FROM post_apply WHERE id = ${id} LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('해당 글을 찾을 수 없습니다.');
    if (r.member_id !== memberId) {
      throw new ForbiddenException('본인 신청글만 취소할 수 있습니다.');
    }
    if (r.status !== 'pending') {
      throw new ForbiddenException('검토 중 상태에서만 취소할 수 있습니다.');
    }
    await this.sql`
      UPDATE post_apply
         SET status = 'cancelled', updated_at = now()
       WHERE id = ${id}
    `;
    return { ok: true };
  }
}
