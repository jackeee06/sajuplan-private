import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SQL, type Sql } from '../../shared/db/db.module';
import { MembersService } from '../members/members.service';
import { OpsAlertService } from '../../shared/ops-alert/ops-alert.service';

/**
 * 관리자 — 상담사 신청 (post_apply 테이블) 조회/관리.
 *
 *  사용자 측은 user/counselor-apply.service.ts 가 담당. 여기는 관리자 전용:
 *   - 모든 신청 조회 (status, 검색어, 페이지네이션)
 *   - 상세 (extras 풀어서 응답)
 *   - status 변경 (pending → accepted / rejected, 다음 단계 작업)
 */

export type ApplyStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  /** 같은 휴대폰으로 새 신청이 들어와 자동 대체됨 — 사용자가 정보를 고쳐 다시 낸 케이스 */
  | 'superseded';

export interface AdminCounselorApplyListItem {
  id: number;
  status: ApplyStatus | string;
  category: string | null;
  title: string;
  applicant_phone: string | null;
  applicant_email: string | null;
  member_id: number | null;
  member_mb_id: string | null;
  member_name: string | null;
  real_name: string | null;
  pen_name: string | null;
  field: string | null;
  region: string | null;
  has_profile_photo: boolean;
  has_wide_photo: boolean;
  contract_count: number;
  created_at: string;
}

export interface AdminCounselorApplyDetail extends AdminCounselorApplyListItem {
  content: string | null;
  is_secret: boolean;
  view_count: number;
  /** extras JSONB 전체 — 프론트가 사진/계약서/생년월일/전문분야 등을 꺼내씀 */
  extras: Record<string, unknown>;
  updated_at: string;
}

export interface ApproveResult {
  ok: true;
  member_id: number;
  mb_id: string;
  csrid: string | null;
  m2net: { ok: boolean; error?: string };
}

const APPLY_UPLOAD_DIR = join(process.cwd(), 'uploads', 'counselor-apply');
const MEMBER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'member');

@Injectable()
export class AdminCounselorApplyService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly members: MembersService,
    private readonly opsAlert: OpsAlertService,
  ) {}

  async list(params: {
    status?: string;
    /** 신청 종류 (2026-05-16): 'application' | 'inquiry' | 'other' | 'all' */
    category?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: AdminCounselorApplyListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 20)));
    const offset = (page - 1) * limit;

    // 공지(category='notice')는 신청이 아니므로 목록에서 제외.
    // status 가 명시되면 해당 status 만, 'all'/미지정이면 전체 (pending 우선).
    const filters: ReturnType<Sql>[] = [
      this.sql`(a.category IS DISTINCT FROM 'notice')`,
    ];
    if (params.status && params.status !== 'all') {
      filters.push(this.sql`a.status = ${params.status}`);
    }
    // 2026-05-16: 카테고리 필터 — application(지원) / inquiry(상담사 문의) / other(기타 문의)
    // 레거시 행 호환: category 가 null 이거나 'general' 인 옛 행은 'application' 로 간주.
    if (params.category && params.category !== 'all') {
      if (params.category === 'application') {
        filters.push(this.sql`(a.category IS NULL OR a.category IN ('application','general'))`);
      } else {
        filters.push(this.sql`a.category = ${params.category}`);
      }
    }
    if (params.q) {
      // 휴대폰/이메일/예명/실명/제목 부분검색
      const like = `%${params.q.trim()}%`;
      filters.push(this.sql`(
        a.applicant_phone ILIKE ${like}
        OR a.applicant_email ILIKE ${like}
        OR a.title ILIKE ${like}
        OR a.extras->>'pen_name' ILIKE ${like}
        OR a.extras->>'real_name' ILIKE ${like}
      )`);
    }

    const where = filters.reduce(
      (acc, c, i) =>
        i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`,
      this.sql``,
    );

    type Row = {
      id: number;
      status: string;
      category: string | null;
      title: string;
      applicant_phone: string | null;
      applicant_email: string | null;
      member_id: number | null;
      member_mb_id: string | null;
      member_name: string | null;
      real_name: string | null;
      pen_name: string | null;
      field: string | null;
      region: string | null;
      has_profile_photo: boolean;
      has_wide_photo: boolean;
      contract_count: number;
      created_at: Date;
      total: string;
    };

    const rows = await this.sql<Row[]>`
      SELECT
        a.id, a.status, a.category, a.title,
        a.applicant_phone, a.applicant_email,
        a.member_id, m.mb_id AS member_mb_id, m.name AS member_name,
        a.extras->>'real_name' AS real_name,
        a.extras->>'pen_name'  AS pen_name,
        a.extras->>'field'     AS field,
        a.extras->>'region'    AS region,
        (a.extras ? 'profile_photo_url' AND (a.extras->>'profile_photo_url') <> '')::boolean AS has_profile_photo,
        (a.extras ? 'wide_photo_url'    AND (a.extras->>'wide_photo_url')    <> '')::boolean AS has_wide_photo,
        COALESCE(jsonb_array_length(a.extras->'contract_files'), 0) AS contract_count,
        a.created_at,
        COUNT(*) OVER ()::text AS total
      FROM post_apply a
      LEFT JOIN member m ON m.id = a.member_id
      ${where}
      ORDER BY
        CASE a.status WHEN 'pending' THEN 0 ELSE 1 END,
        a.created_at DESC, a.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    return {
      items: rows.map((r) => ({
        id: Number(r.id),
        status: r.status,
        category: r.category,
        title: r.title,
        applicant_phone: r.applicant_phone,
        applicant_email: r.applicant_email,
        member_id: r.member_id ? Number(r.member_id) : null,
        member_mb_id: r.member_mb_id,
        member_name: r.member_name,
        real_name: r.real_name,
        pen_name: r.pen_name,
        field: r.field,
        region: r.region,
        has_profile_photo: Boolean(r.has_profile_photo),
        has_wide_photo: Boolean(r.has_wide_photo),
        contract_count: Number(r.contract_count ?? 0),
        created_at: r.created_at.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async detail(id: number): Promise<AdminCounselorApplyDetail> {
    type Row = {
      id: number;
      status: string;
      category: string | null;
      title: string;
      content: string | null;
      applicant_phone: string | null;
      applicant_email: string | null;
      is_secret: boolean;
      view_count: number;
      member_id: number | null;
      member_mb_id: string | null;
      member_name: string | null;
      extras: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    };

    const rows = await this.sql<Row[]>`
      SELECT
        a.id, a.status, a.category, a.title, a.content,
        a.applicant_phone, a.applicant_email, a.is_secret, a.view_count,
        a.member_id, m.mb_id AS member_mb_id, m.name AS member_name,
        a.extras, a.created_at, a.updated_at
      FROM post_apply a
      LEFT JOIN member m ON m.id = a.member_id
      WHERE a.id = ${id}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('해당 신청을 찾을 수 없습니다.');

    // 레거시 행 호환 — 과거 버그로 extras 가 JSON 문자열로 저장된 경우 한번 파싱.
    const extras = normalizeExtras(r.extras);
    const contracts = Array.isArray(extras.contract_files)
      ? (extras.contract_files as unknown[])
      : [];

    return {
      id: Number(r.id),
      status: r.status,
      category: r.category,
      title: r.title,
      content: r.content,
      applicant_phone: r.applicant_phone,
      applicant_email: r.applicant_email,
      is_secret: r.is_secret,
      view_count: r.view_count,
      member_id: r.member_id ? Number(r.member_id) : null,
      member_mb_id: r.member_mb_id,
      member_name: r.member_name,
      real_name: (extras.real_name as string | undefined) ?? null,
      pen_name: (extras.pen_name as string | undefined) ?? null,
      field: (extras.field as string | undefined) ?? null,
      region: (extras.region as string | undefined) ?? null,
      has_profile_photo: Boolean(extras.profile_photo_url),
      has_wide_photo: Boolean(extras.wide_photo_url),
      contract_count: contracts.length,
      extras,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    };
  }

  /**
   * 단순 상태 변경 — pending/cancelled 토글 등 간단한 케이스 전용.
   * 승인(accepted) 은 approve(), 반려(rejected) 는 reject() 를 사용하세요.
   *
   * 정책: 이미 accepted (승인 → 상담사 계정 생성됨) 인 신청은 어떤 상태로도 변경 불가.
   *       상담사 계정·M2NET 연동·파일 이관 등 부수효과를 되돌릴 수 없기 때문에,
   *       잘못 승인됐다면 상담사 리스트에서 직접 회원을 비활성/삭제 처리해야 함.
   */
  async updateStatus(id: number, status: ApplyStatus): Promise<{ ok: true }> {
    const allowed: ApplyStatus[] = ['pending', 'accepted', 'rejected', 'cancelled', 'superseded'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`잘못된 상태값: ${status}`);
    }
    const cur = await this.sql<{ status: string }[]>`
      SELECT status FROM post_apply WHERE id = ${id} LIMIT 1
    `;
    if (cur.length === 0) throw new NotFoundException('해당 신청을 찾을 수 없습니다.');
    if (cur[0].status === 'accepted') {
      throw new ConflictException(
        '이미 승인 완료된 신청은 상태를 변경할 수 없습니다. 상담사 회원 관리에서 직접 처리해주세요.',
      );
    }
    await this.sql`
      UPDATE post_apply
         SET status = ${status}, updated_at = now()
       WHERE id = ${id}
    `;
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // 반려 — 사유 입력받아 extras 에 보존, status='rejected'
  // ─────────────────────────────────────────────
  async reject(id: number, reason: string): Promise<{ ok: true }> {
    const trimmed = (reason ?? '').trim();
    if (!trimmed) throw new BadRequestException('반려 사유를 입력해주세요.');

    const rows = await this.sql<{ extras: unknown; status: string }[]>`
      SELECT extras, status FROM post_apply WHERE id = ${id} LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('해당 신청을 찾을 수 없습니다.');
    if (r.status === 'accepted') {
      throw new ConflictException(
        '이미 승인 완료된 신청은 반려할 수 없습니다. 상담사 회원 관리에서 직접 처리해주세요.',
      );
    }

    const extras = normalizeExtras(r.extras);
    extras.rejection_reason = trimmed;
    extras.rejected_at = new Date().toISOString();

    await this.sql`
      UPDATE post_apply
         SET status = 'rejected',
             extras = ${this.sql.json(extras as never)},
             updated_at = now()
       WHERE id = ${id}
    `;
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // 승인 — 1클릭 완전자동
  //   1) 신청 조회 + 사전검증 (이미 승인됐는지, 신청서에 mb_id/password_hash 있는지)
  //   2) extras 의 mb_id + password_hash 를 그대로 사용해 신규 상담사 생성
  //      - createCounselor 가 password 를 다시 해시하므로, 평문 PW 를 전달해야 함.
  //        → 가입 단계에서 평문은 절대 저장하지 않고 hash 만 보관 → 승인 시점에 hash 를
  //          그대로 member.password 에 INSERT. (createCounselor 우회용 내부 메서드 사용)
  //   3) 신청서의 사진/계약서를 /uploads/counselor-apply/ → /uploads/member/ 로 복사
  //      + member_file row 추가
  //   4) post_apply 상태 갱신 — accepted, extras 에 created_member_id/created_at 기록
  //
  // 휴대폰 중복: 신청 단계에서 이미 'pending/accepted 상담사 신청' 중복을 차단함.
  // 일반 회원과는 휴대폰이 겹쳐도 OK — 상담사는 별도 mb_id 로 가입되므로 충돌 없음.
  // ─────────────────────────────────────────────
  async approve(id: number): Promise<ApproveResult> {
    type Row = {
      id: number;
      status: string;
      member_id: number | null;
      title: string;
      content: string | null;
      applicant_phone: string | null;
      applicant_email: string | null;
      extras: unknown;
    };
    const rows = await this.sql<Row[]>`
      SELECT id, status, member_id, title, content,
             applicant_phone, applicant_email, extras
        FROM post_apply WHERE id = ${id} LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('해당 신청을 찾을 수 없습니다.');
    if (r.status === 'accepted') {
      throw new ConflictException('이미 승인된 신청입니다.');
    }
    if (r.status === 'superseded') {
      throw new ConflictException(
        '이 신청은 더 최신 신청으로 대체되었습니다. 최신 신청서를 확인해주세요.',
      );
    }
    const phone = (r.applicant_phone ?? '').replace(/[^0-9]/g, '');
    if (!phone) throw new BadRequestException('휴대폰 번호가 없는 신청은 승인할 수 없습니다.');

    const extras = normalizeExtras(r.extras);
    const penName = String(extras.pen_name ?? '').trim();
    const realName = String(extras.real_name ?? '').trim();
    const mbId = String(extras.mb_id ?? '').trim();
    const passwordHash = String(extras.password_hash ?? '').trim();
    if (!penName) throw new BadRequestException('예명이 비어있습니다 — 신청서를 확인해주세요.');
    if (!realName) throw new BadRequestException('실명이 비어있습니다 — 신청서를 확인해주세요.');
    if (!mbId) throw new BadRequestException('신청서에 아이디 정보가 없습니다.');
    // passwordHash 검증은 비회원 신규 생성 분기에서만 수행 (회원 승격은 password 무관).
    // SNS 가입 회원(member.password 빈값)이 상담사 신청해도 승급될 수 있도록 분기 이동 (2026-05-22).

    // 한 사람 한 mb_id 정책 (2026-05-22) — 같은 휴대폰에 일반회원이 이미 있으면 그 회원을 상담사로 승격.
    // 신청서의 mb_id 와 회원의 mb_id 가 다르면 충돌이므로 차단 (한 사람 두 계정 방지).
    const existingByPhone = await this.sql<{ id: number; mb_id: string; role: string }[]>`
      SELECT id, mb_id, role FROM member
       WHERE phone = ${phone} AND left_at IS NULL
       LIMIT 1
    `;
    let memberId: number;
    if (existingByPhone.length > 0) {
      const ex = existingByPhone[0];
      if (ex.role === 'counselor') {
        throw new ConflictException('이미 같은 휴대폰으로 상담사 가입되어 있습니다.');
      }
      if (ex.mb_id !== mbId) {
        throw new ConflictException(
          `같은 휴대폰으로 다른 아이디(${ex.mb_id}) 의 회원이 있습니다. 회원 아이디와 동일하게 신청해주세요.`,
        );
      }
      // 같은 mb_id 회원 → 상담사로 승격 (role / dtmfno / telno / counselor_category 채움)
      memberId = await this.members.promoteToCounselor({
        memberId: ex.id,
        nickname: penName,
        counselor_category: (extras.field as string | undefined) ?? null,
        profile_intro: (extras.intro as string | undefined) ?? null,
        profile_specialty: Array.isArray(extras.specialties)
          ? (extras.specialties as string[])
          : null,
      });
    } else {
      // 비회원 신청 — mb_id 중복 검사 후 새 상담사 회원 생성 (회원 단계 거치지 않음, 1회 생성)
      if (!passwordHash) {
        throw new BadRequestException('비회원 신청서에 비밀번호 정보가 없습니다.');
      }
      const dupMbId = await this.sql<{ id: number }[]>`
        SELECT id FROM member WHERE mb_id = ${mbId} LIMIT 1
      `;
      if (dupMbId.length > 0) {
        throw new ConflictException(`아이디 "${mbId}" 가 이미 사용 중입니다.`);
      }
      memberId = await this.members.createCounselorWithHash({
        mb_id: mbId,
        password_hash: passwordHash,
        name: realName,
        nickname: penName,
        email: r.applicant_email ?? null,
        phone,
        telno: phone,
        counselor_category: (extras.field as string | undefined) ?? null,
        profile_intro: (extras.intro as string | undefined) ?? null,
        profile_specialty: Array.isArray(extras.specialties)
          ? (extras.specialties as string[])
          : null,
      });
    }

    // m2net 연동 — 별도 호출. 실패해도 승인은 그대로 완료.
    const m2netResult = await this.members
      .linkCounselorToM2net(memberId)
      .catch((e: unknown) => ({
        ok: false,
        csrid: null as string | null,
        error: e instanceof Error ? e.message : '엠투넷 연동 실패',
      }));

    // 엠투넷 연동 실패 시 운영자 알림 — 어드민이 멤버 상세에서 "재연동" 버튼으로 수동 복구해야 함.
    // 이전엔 .catch 로 흡수만 되어 운영자가 csrid 누락을 알아채지 못하고
    // 통화/채팅 라우팅 실패 후 사용자 컴플레인으로 발견되는 패턴이 있었다 (2026-05-22 핸드오버).
    if (!m2netResult.ok) {
      void this.opsAlert.send(
        '상담사 엠투넷 연동 실패',
        `신청서: id=${id} mb_id=${mbId}\n` +
          `회원 id=${memberId}, 별명=${penName}\n` +
          `사유: ${m2netResult.error ?? '알 수 없음'}\n\n` +
          `→ 어드민 → 상담사 → 해당 상담사 상세 → "엠투넷 재연동" 버튼으로 복구.\n` +
          `csrid 가 비어있으면 통화/채팅이 라우팅되지 않습니다.`,
      );
    }

    // 신청서 첨부파일을 member 폴더로 복사 + member_file insert
    await this.transferFilesToMember(memberId, extras);

    // post_apply 갱신 — 평문 PW 는 신청서에 없으므로 보관할 게 없음. hash 는 그대로 유지.
    extras.approved_at = new Date().toISOString();
    extras.created_member_id = memberId;
    extras.created_mb_id = mbId;
    extras.created_csrid = m2netResult.csrid;
    extras.m2net_result = { ok: m2netResult.ok, error: m2netResult.error };
    await this.sql`
      UPDATE post_apply
         SET status = 'accepted',
             member_id = COALESCE(member_id, ${memberId}),
             mb_id = COALESCE(mb_id, ${mbId}),
             extras = ${this.sql.json(extras as never)},
             updated_at = now()
       WHERE id = ${id}
    `;

    return {
      ok: true,
      member_id: memberId,
      mb_id: mbId,
      csrid: m2netResult.csrid,
      m2net: { ok: m2netResult.ok, error: m2netResult.error },
    };
  }

  /** 신청서의 사진/계약서 파일을 /uploads/member/ 로 복사하고 member_file row 추가. */
  private async transferFilesToMember(
    memberId: number,
    extras: Record<string, unknown>,
  ): Promise<void> {
    await mkdir(MEMBER_UPLOAD_DIR, { recursive: true });

    const tasks: Array<{ kind: 'profile' | 'wide' | 'contract'; url: string; webp?: string | null; original_name?: string }> = [];

    const profile = (extras.profile_photo_url as string | undefined) ?? null;
    if (profile) tasks.push({
      kind: 'profile',
      url: profile,
      webp: (extras.profile_photo_url_webp as string | undefined) ?? null,
    });

    const wide = (extras.wide_photo_url as string | undefined) ?? null;
    if (wide) tasks.push({
      kind: 'wide',
      url: wide,
      webp: (extras.wide_photo_url_webp as string | undefined) ?? null,
    });

    const contracts = Array.isArray(extras.contract_files)
      ? (extras.contract_files as Array<{ url?: string; original_name?: string }>)
      : [];
    for (const c of contracts) {
      if (!c?.url) continue;
      tasks.push({ kind: 'contract', url: c.url, original_name: c.original_name });
    }

    for (const t of tasks) {
      try {
        const srcName = basename(t.url);
        const srcPath = join(APPLY_UPLOAD_DIR, srcName);
        if (!existsSync(srcPath)) {
          // 파일이 사라진 경우 메타만 남김 — addMemberFile 호출하지 않고 스킵.
          continue;
        }
        const destPath = join(MEMBER_UPLOAD_DIR, srcName);
        await copyFile(srcPath, destPath);

        let webpName: string | null = null;
        if (t.webp) {
          const webpSrc = join(APPLY_UPLOAD_DIR, basename(t.webp));
          if (existsSync(webpSrc)) {
            webpName = basename(t.webp);
            await copyFile(webpSrc, join(MEMBER_UPLOAD_DIR, webpName));
          }
        }

        const isImage = /\.(jpe?g|png|gif|webp)$/i.test(srcName);
        await this.members.addMemberFile(memberId, t.kind, {
          originalname: t.original_name ?? srcName,
          filename: srcName,
          size: 0, // 신청서엔 정확한 size 가 없을 수 있음 — 프론트가 표시할 때 실제 파일 크기로 대체 가능
          mimetype: isImage ? 'image/*' : 'application/octet-stream',
          stored_name_webp: webpName,
        });
      } catch {
        // 한 파일 실패가 전체 승인을 막지 않도록 — 로그만 남기고 계속.
      }
    }
  }
}

/**
 * 과거 버그(JSON.stringify + ::jsonb 이중 인코딩) 로 인해 extras 가 JSONB string scalar
 * 로 저장된 행을 정상 객체처럼 다루기 위한 보정 함수.
 *  - 정상 행: object 그대로 반환
 *  - 레거시 행: 문자열을 JSON.parse 해서 object 로 풀어서 반환
 *  - 그 외 (배열/숫자/parse 실패): 빈 객체로 안전하게 폴백
 */
function normalizeExtras(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fallthrough */
    }
  }
  return {};
}
