/**
 * 회원 포인트 정합성 점검 CLI
 *
 * 사용:
 *   ts-node db/scripts/audit-points.ts <mb_id|login_id>
 *   ts-node db/scripts/audit-points.ts ubuub1234
 *
 * 동작:
 *   1. member.point / point.{free,paid,total_earned,total_used} 출력
 *   2. point_history 합계로 잔액 재계산해서 일치 여부 확인
 *   3. consultation 합계 (amt, amt_free, amt_pro) 출력
 *   4. m2net 측 잔액(member.csrid 가 있을 때)도 GET 으로 가져와 비교
 *
 * 운영 DB 를 SELECT 만 합니다 — 어떤 row 도 수정하지 않음.
 */
import 'dotenv/config';
import postgres from 'postgres';

interface MemberRow {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string | null;
  role: string;
  csrid: string | null;
  point: number;
  created_at: Date;
}

async function fetchM2netBalance(membid: string): Promise<{ amt: number | null; error: string | null }> {
  const apiUrl = process.env.M2NET_API_URL;
  const cpid = process.env.M2NET_CPID;
  const headerKey = process.env.M2NET_HEADER_KEY;
  if (!apiUrl || !cpid || !headerKey) {
    return { amt: null, error: 'M2NET env 미설정' };
  }
  try {
    const jsonStr = JSON.stringify({ list: [{ membid: String(membid) }] });
    const url = `${apiUrl}/memb-mgrp/${cpid}/${encodeURIComponent(jsonStr)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: headerKey },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    if (!text) return { amt: null, error: '응답 없음' };
    const data = JSON.parse(text) as { req_result?: string; list?: Array<{ amt?: number | string }> };
    if (data.req_result !== '00') {
      return { amt: null, error: `req_result=${data.req_result ?? 'unknown'}` };
    }
    const amt = data.list && data.list[0] && data.list[0].amt !== undefined ? Number(data.list[0].amt) : null;
    return { amt, error: null };
  } catch (e) {
    return { amt: null, error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function main() {
  const [, , key] = process.argv;
  if (!key) {
    console.error('사용법: ts-node db/scripts/audit-points.ts <mb_id|login_id>');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL 미설정. api/.env 확인');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const members = await sql<MemberRow[]>`
      SELECT id, mb_id, name, nickname, role, csrid, point, created_at
        FROM member
       WHERE mb_id = ${key}
       ORDER BY id
       LIMIT 5
    `;
    if (members.length === 0) {
      console.log(`회원을 찾을 수 없음: ${key}`);
      return;
    }

    for (const m of members) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`회원: id=${m.id} mb_id=${m.mb_id} name=${m.name} role=${m.role}`);
      console.log(`      csrid(m2net membid)=${m.csrid ?? '(없음)'} member.point=${m.point} 가입=${m.created_at.toISOString()}`);

      // point 테이블
      const pt = await sql<{ free_balance: number; paid_balance: number; total_earned: string; total_used: string }[]>`
        SELECT free_balance, paid_balance, total_earned::text, total_used::text
          FROM point WHERE member_id = ${m.id}
      `;
      if (pt.length === 0) {
        console.log('point row 없음');
      } else {
        const p = pt[0];
        const total = Number(p.free_balance) + Number(p.paid_balance);
        console.log(
          `point: free=${p.free_balance} paid=${p.paid_balance} total(free+paid)=${total} ` +
          `total_earned=${p.total_earned} total_used=${p.total_used}`,
        );
        if (total !== Number(m.point)) {
          console.log(`  ⚠ member.point(${m.point}) ≠ free+paid(${total})  차이=${Number(m.point) - total}`);
        }
      }

      // point_history 합계로 재계산
      const phAgg = await sql<{
        earn_sum: string; use_sum: string; cnt: string;
      }[]>`
        SELECT COALESCE(SUM(earn_point),0)::text AS earn_sum,
               COALESCE(SUM(use_point),0)::text  AS use_sum,
               COUNT(*)::text                    AS cnt
          FROM point_history WHERE member_id = ${m.id}
      `;
      const earnSum = Number(phAgg[0].earn_sum);
      const useSum = Number(phAgg[0].use_sum);
      const computedBalance = earnSum - useSum;
      console.log(
        `point_history: rows=${phAgg[0].cnt} SUM(earn)=${earnSum} SUM(use)=${useSum} ` +
        `SUM(earn)-SUM(use)=${computedBalance}`,
      );
      if (computedBalance !== Number(m.point)) {
        console.log(`  ⚠ history 재계산(${computedBalance}) ≠ member.point(${m.point})  차이=${Number(m.point) - computedBalance}`);
      }

      // consultation 합계 (이 회원이 차감당한 금액)
      const csAgg = await sql<{
        cnt: string; amt_sum: string; amt_free_sum: string; amt_pro_sum: string;
      }[]>`
        SELECT COUNT(*)::text                       AS cnt,
               COALESCE(SUM(amt),0)::text           AS amt_sum,
               COALESCE(SUM(amt_free),0)::text      AS amt_free_sum,
               COALESCE(SUM(amt_pro),0)::text       AS amt_pro_sum
          FROM consultation
         WHERE member_id = ${m.id}
           AND amt > 0
      `;
      console.log(
        `consultation(차감대상): rows=${csAgg[0].cnt} SUM(amt)=${csAgg[0].amt_sum} ` +
        `SUM(amt_free)=${csAgg[0].amt_free_sum} SUM(amt_pro)=${csAgg[0].amt_pro_sum}`,
      );

      // point_history 의 consultation 차감 합계 vs consultation.amt 합계
      const phConsult = await sql<{ cnt: string; use_sum: string }[]>`
        SELECT COUNT(*)::text AS cnt, COALESCE(SUM(use_point),0)::text AS use_sum
          FROM point_history
         WHERE member_id = ${m.id}
           AND rel_table = 'consultation'
           AND use_point > 0
      `;
      console.log(
        `point_history(rel=consultation, use_point>0): rows=${phConsult[0].cnt} SUM(use_point)=${phConsult[0].use_sum}`,
      );
      if (Number(phConsult[0].use_sum) !== Number(csAgg[0].amt_sum)) {
        console.log(
          `  ⚠ history 의 상담차감 합(${phConsult[0].use_sum}) ≠ consultation.amt 합(${csAgg[0].amt_sum})  ` +
          `차이=${Number(phConsult[0].use_sum) - Number(csAgg[0].amt_sum)}`,
        );
      }

      // 최근 point_history 20행
      const recent = await sql<{
        id: number; content: string | null; earn_point: number; use_point: number;
        balance_after: number; rel_table: string | null; rel_id: string | null;
        rel_action: string | null; created_at: Date;
      }[]>`
        SELECT id, content, earn_point, use_point, balance_after,
               rel_table, rel_id, rel_action, created_at
          FROM point_history
         WHERE member_id = ${m.id}
         ORDER BY created_at DESC, id DESC
         LIMIT 20
      `;
      console.log(`최근 point_history (최대 20행):`);
      for (const r of recent) {
        const sign = r.earn_point > 0 ? `+${r.earn_point}` : `-${r.use_point}`;
        console.log(
          `  [${r.created_at.toISOString()}] #${r.id} ${sign} bal=${r.balance_after} ` +
          `rel=${r.rel_table ?? '-'}#${r.rel_id ?? '-'} act=${r.rel_action ?? '-'} | ${r.content ?? ''}`,
        );
      }

      // 최근 consultation 10건
      const consRecent = await sql<{
        id: number; reason: string; amt: number; amt_free: number; amt_pro: number;
        usetm: number; roomid: string | null; started_at: Date | null; ended_at: Date | null;
        created_at: Date;
      }[]>`
        SELECT id, reason, amt, amt_free, amt_pro, usetm, roomid, started_at, ended_at, created_at
          FROM consultation
         WHERE member_id = ${m.id}
         ORDER BY created_at DESC
         LIMIT 10
      `;
      console.log(`최근 consultation (최대 10건):`);
      for (const c of consRecent) {
        console.log(
          `  [${c.created_at.toISOString()}] #${c.id} ${c.reason} amt=${c.amt} ` +
          `(free=${c.amt_free}/pro=${c.amt_pro}) usetm=${c.usetm}s ` +
          `room=${c.roomid ?? '-'} start=${c.started_at?.toISOString() ?? '-'} end=${c.ended_at?.toISOString() ?? '-'}`,
        );
      }

      // m2net 잔액 비교
      if (m.csrid) {
        const m2 = await fetchM2netBalance(m.csrid);
        if (m2.amt !== null) {
          const diff = Number(m.point) - m2.amt;
          console.log(`m2net: membid=${m.csrid} amt=${m2.amt}  →  sajumoon(${m.point}) - m2net(${m2.amt}) = ${diff}`);
          if (diff !== 0) {
            console.log(`  ⚠ 사주문 ↔ m2net 잔액 불일치  차이=${diff}`);
          }
        } else {
          console.log(`m2net: 조회 실패 — ${m2.error}`);
        }
      } else {
        console.log('m2net: member.csrid 없음 (m2net 미연동 또는 사용자가 m2net 회원으로 등록 안 됨)');
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
