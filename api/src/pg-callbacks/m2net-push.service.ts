import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';
import { M2netService } from '../shared/m2net/m2net.service';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';

/**
 * 엠투넷(M2NET) Push 콜백 처리.
 *
 * sample 매핑 (sample/mtonet/mtonet_rcv.php · mtonet_state.php 동등 — 정밀 이식):
 *
 *  ─ mtonet_rcv (handleCallPush) ─
 *    1) 원본 JSON → consultation_log 적재
 *    2) reason 검사 — 없으면 무시
 *    3) roomid 유무로 콜/채팅 판별
 *    4) csrid → counselor (member.csrid) / membid → member (member.csrid) 매핑
 *    5) 금액 정규화: INSUFFICIENT_CONN 은 amt=0
 *    6) 종료 이벤트: (call+DISCONNECT) || (chat+END_CHAT)
 *    7) 환불 임계값(default 1000원) 이하의 콜은 환불대상 — 회원 차감 안 함
 *    8) 후불(to=5000878) — 회원 차감 안 함, 상담사 적립은 함
 *    9) 상태 분기:
 *         CONNECT_CSR  → counselor.state = 'CONN'
 *         START_CHAT   → chat_room.status = 'CNCH'
 *         DISCONNECT/END_CHAT/NO_ANSWER_CSR → counselor 의 use_phone/use_chat 으로
 *           ready state 계산 (RDVC/IDLE/RDCH/ABSE) 후 member.state 복귀
 *           END_CHAT 시 chat_room.status='DISCONNECT', ended_at=now()
 *           END_CHAT 시 m2net chat-mgr/csrstat 으로 외부 상태 동기화 (set_crs_status_chg)
 *   10) consultation INSERT — 모든 필드 + amt_free/amt_pro 분리 (free_balance 기준)
 *   11) 종료 이벤트 + amt>0 일 때만 정산 (insert_point 동등 — rel_table='consultation' UNIQUE 멱등)
 *         회원 차감: !환불대상 && !후불 → free_balance 우선 차감 후 paid_balance
 *         상담사 적립: 모든 정상 통화 (후불 포함)
 *
 *  ─ mtonet_state (handleStatePush) ─
 *    list 순회 → state='RDVC' 는 무시 (sample 정책) → member.state 일괄 UPDATE
 *
 *  보안: 토큰 없음. 운영에서 nginx allow/deny 또는 IP 화이트리스트로 PassCall 도메인만 허용 권장.
 */
@Injectable()
export class M2netPushService {
  private readonly logger = new Logger(M2netPushService.name);

  /** sample 의 csr_threshold (mb_4) — 신규 schema 에 매핑 컬럼 없음. 일단 1000 고정 (sample 기본값). */
  private readonly CSR_THRESHOLD_DEFAULT = 1000;

  /** 후불 식별: callee_phone == '5000878' 이면 회원 차감 안 함. sample mtonet_rcv 의 is_postpaid 로직. */
  private readonly POSTPAID_TO = '5000878';

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly opsAlert: OpsAlertService,
  ) {}

  // ─────────────────────────────────────────────
  // Push 통지 (mtonet_rcv.php)
  // ─────────────────────────────────────────────

  async handleCallPush(payload: Record<string, unknown>): Promise<{ ok: true; idempotent?: boolean }> {
    const raw = JSON.stringify(payload);

    // 1) 원본 로그 (sample 동등) — 실패해도 본 처리에 영향 없음
    this.sql`INSERT INTO consultation_log (message) VALUES (${raw})`.catch((e) => {
      this.logger.warn(`consultation_log 적재 실패: ${e instanceof Error ? e.message : String(e)}`);
    });

    // 2) reason 없으면 그대로 무시
    const reason = String(payload.reason ?? '');
    if (!reason) return { ok: true };

    // 3) 콜/채팅 판별
    const csrid = String(payload.csrid ?? '');
    const membid = String(payload.membid ?? '');
    const roomid = String(payload.roomid ?? '');
    const isCall = !roomid || roomid.trim().length === 0;
    const isChat = !isCall;

    // 페이로드 키 안전 추출
    const cpid = String(payload.cpid ?? payload.cp_id ?? '');
    const dtmfno = String(payload.dtmfno ?? '');
    const fromPhone = String(payload.from ?? '');
    const toPhone = String(payload.to ?? '');
    const telno = String(payload.telno ?? '');
    const usetm = Number(payload.usetm ?? 0) || 0;
    const rawAmt = Number(payload.amt ?? 0) || 0;
    const preflag = String(payload.preflag ?? '');
    const eventtm = String(payload.eventtm ?? '');
    const startStr = String(payload.start ?? '');
    const endStr = String(payload.end ?? '');
    const callid = String(payload.callid ?? '');

    // 4) 회원/상담사 매핑 — 신규 schema 에서 csrid 컬럼은 상담사·회원 양쪽 m2net id 보관
    let counselorId: number | null = null;
    let counselorMbId = '';
    let counselorUsePhone = true;
    let counselorUseChat = true;
    if (csrid) {
      const r = await this.sql<{
        id: number; mb_id: string | null; use_phone: boolean; use_chat: boolean;
      }[]>`
        SELECT id, mb_id, use_phone, use_chat
          FROM member WHERE csrid = ${csrid} LIMIT 1
      `;
      if (r[0]) {
        counselorId = r[0].id;
        counselorMbId = r[0].mb_id ?? '';
        counselorUsePhone = !!r[0].use_phone;
        counselorUseChat = !!r[0].use_chat;
      }
    }
    let memberId: number | null = null;
    let memberMbId = '';
    if (membid) {
      const r = await this.sql<{ id: number; mb_id: string | null }[]>`
        SELECT id, mb_id FROM member WHERE csrid = ${membid} LIMIT 1
      `;
      if (r[0]) {
        memberId = r[0].id;
        memberMbId = r[0].mb_id ?? '';
      }
    }

    // 5) 금액 정규화 — INSUFFICIENT_CONN 은 무조건 0
    let amt = rawAmt;
    if (reason === 'INSUFFICIENT_CONN') amt = 0;

    // 6) 종료 이벤트 판정
    const endsHere = (isCall && reason === 'DISCONNECT') || (isChat && reason === 'END_CHAT');

    // 정책 (2026-05-13): "m2net 이 반환한 값으로만 차감한다."
    //   - push 의 amt / m2net 잔액 조회 결과 = single source of truth
    //   - 사주문 측 자체 계산(use_seconds × unit_cost)은 부정확의 원인이므로 사용하지 않음
    //   - 따라서 채팅 amt 자체 보정 블록 제거. push amt 가 0 이면 그대로 0, diff 조회만 신뢰.
    const chatUsetm = usetm;

    // 7) 환불 대상 (콜이고 원본금액이 임계값 이하)
    const refundEligible = isCall && rawAmt > 0 && rawAmt <= this.CSR_THRESHOLD_DEFAULT;

    // 8) 후불 판정 — 전화 only. 채팅은 항상 선불 (후불 개념 없음).
    //    sample 의 is_postpaid 도 to=5000878 비교라 채팅 push 엔 자연스럽게 false 가 되지만,
    //    명시적으로 채팅은 후불 분기 진입 금지 → 잔액 부족 시 m2net 이 채팅을 끊고 차감만 반영.
    const isPostpaid = isCall && toPhone === this.POSTPAID_TO;

    // 9) p_gubun → is_paid (10000원 이상이면 유료, sample 정책 그대로)
    const isPaid = endsHere && amt > 0 && amt >= 10000;

    // skip_charge — 콜이고 종료인데 amt=0 (sample 정책)
    const skipCharge = endsHere && isCall && amt <= 0;

    // ─── 상담사/채팅방 상태 업데이트 (sample 의 두 분기) ───────
    if (reason === 'CONNECT_CSR' && csrid) {
      await this.sql`UPDATE member SET state = 'CONN' WHERE csrid = ${csrid}`;
    } else if (reason === 'START_CHAT' && roomid) {
      // 상담사가 실제 채팅방에 입장한 시점 — 채팅방 + 상담사 양쪽 동기 'CNCH' 전환.
      // (회원의 startChat 단계에서는 status='STAY'/state=ready 그대로 둔다.)
      // STAY → CNCH 전환을 RETURNING 으로 1회 감지해서 시스템 메시지 INSERT 한다.
      // (이미 CNCH 면 어떤 이유로 START_CHAT 이 재전송된 경우라 메시지 중복 INSERT 안 함.)
      const transitioned = await this.sql<{ id: number }[]>`
        UPDATE chat_room SET status = 'CNCH'
         WHERE roomid = ${roomid} AND status = 'STAY'
         RETURNING id
      `;
      if (csrid) {
        await this.sql`UPDATE member SET state = 'CNCH', updated_at = now() WHERE csrid = ${csrid}`;
      }
      if (transitioned.length > 0) {
        // 메시지의 단일 원천 = DB. 상담사 실입장 시스템 메시지.
        // 본문은 사용자에게 보이는 형태: "[홍길동]상담사 님이 입장하였습니다."
        // (insertActorSystemMessage 와 같은 규약 — `[닉네임]상담사 님이 ...` 포맷)
        // 중복 INSERT 는 chat_room 당 같은 본문이 이미 있으면 skip (NOT EXISTS).
        const chatRoomId = transitioned[0].id;
        const csrRows = await this.sql<{ name: string | null; nickname: string | null }[]>`
          SELECT m.name, m.nickname
            FROM chat_room cr
            INNER JOIN member m ON m.id = cr.counselor_id
           WHERE cr.id = ${chatRoomId}
           LIMIT 1
        `;
        const displayName = (csrRows[0]?.nickname || csrRows[0]?.name || '').trim();
        const personLabel = displayName ? `[${displayName}]상담사 님` : '상담사 님';
        const storedMsg = `${personLabel}이 입장하였습니다.`;
        await this.sql`
          INSERT INTO chat_message (chat_room_id, sender_id, message, message_type)
          SELECT ${chatRoomId}, NULL, ${storedMsg}, 3
           WHERE NOT EXISTS (
             SELECT 1 FROM chat_message
              WHERE chat_room_id = ${chatRoomId}
                AND message_type = 3
                AND message = ${storedMsg}
           )
        `.catch((e) => {
          this.logger.warn(
            `START_CHAT 시스템 메시지 INSERT 실패 (chat_room_id=${chatRoomId}): ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }
    } else if (
      reason === 'DISCONNECT' || reason === 'END_CHAT' || reason === 'NO_ANSWER_CSR'
    ) {
      if (csrid) {
        const readyState = computeReadyState(counselorUsePhone, counselorUseChat);
        await this.sql`UPDATE member SET state = ${readyState} WHERE csrid = ${csrid}`;

        // 채팅 종료 — m2net chat-mgr 외부 상태도 동기화 (sample 의 set_crs_status_chg)
        if (reason === 'END_CHAT') {
          this.m2net.updateCounselorState(csrid, readyState).then((r) => {
            if (!r.ok) {
              this.logger.warn(
                `set_crs_status_chg 실패 (csrid=${csrid}, state=${readyState}): ${r.error ?? '알 수 없음'}`,
              );
            }
          }).catch((e) => {
            this.logger.error(
              `set_crs_status_chg 예외 (csrid=${csrid}): ${e instanceof Error ? e.message : String(e)}`,
            );
          });
        }
      }
      // END_CHAT 처리 — sample/mtonet/mtonet_rcv.php 동등.
      // m2net 의 END_CHAT push 는 정상 종료(상담종료 버튼) / 강제종료(wss abrupt close) /
      // 잔액소진(INSUFFICIENT_CONN) 모두에서 발화된다. sample 은 push 도착 시
      // 무조건 status='DISCONNECT' + 정산. 우리도 동일하게 처리한다.
      //
      // 멱등성은 아래 consultation INSERT 의 roomid 멱등 가드(sample insert_point 동등)가
      // 보장하므로 중복 정산 위험 없음.
      if (reason === 'END_CHAT' && roomid) {
        await this.sql`
          UPDATE chat_room
             SET status = 'DISCONNECT',
                 ended_at = COALESCE(ended_at, now()),
                 roomid = CASE WHEN roomid LIKE '%\\_\\_c\\_%' ESCAPE '\\'
                               THEN roomid
                               ELSE roomid || '__c_' || id END
           WHERE roomid = ${roomid} AND status <> 'DISCONNECT'
        `;
      }
    }

    // ─── consultation INSERT (amt_free / amt_pro 정확 분리) ───────────
    const wrAt = startStr ? safeTimestamp(startStr) ?? new Date() : new Date();
    const startedAt = startStr ? safeTimestamp(startStr) : null;
    const endedAt = endStr ? safeTimestamp(endStr) : null;
    const eventAt = eventtm ? safeTimestamp(eventtm) : null;

    // amt_free: 종료 이벤트 시 free_balance 잔액에서 충당 가능한 금액 (그 외에는 0).
    // sample 은 회원가입쿠폰(cz_id=39) 잔액 기반으로 계산하지만, 신규 schema 의
    // point.free_balance 가 동일 의도(쿠폰 적립분)를 보유하므로 그것을 사용.
    let amtFree = 0;
    let amtPro = amt;
    if (endsHere && amt > 0 && memberId !== null) {
      const balRows = await this.sql<{ free_balance: number }[]>`
        SELECT free_balance FROM point WHERE member_id = ${memberId} LIMIT 1
      `;
      const free = Number(balRows[0]?.free_balance ?? 0);
      amtFree = Math.max(0, Math.min(amt, free));
      amtPro = amt - amtFree;
    }

    // 멱등 가드 — 같은 채팅 세션(같은 base roomid)에 이미 종료 정산 row 가 있으면 skip.
    // roomid 에 붙는 `__c_<id>` suffix 변형을 우회하기 위해 base prefix 기준으로 검색.
    if (
      endsHere &&
      isChat &&
      roomid &&
      memberId !== null &&
      counselorId !== null
    ) {
      const baseRoomid = roomid.replace(/__c_\d+$/, '');
      const dup = await this.sql<{ id: number }[]>`
        SELECT id FROM consultation
         WHERE reason IN ('END_CHAT', 'END_CHAT_LOCAL')
           AND member_id = ${memberId}
           AND counselor_id = ${counselorId}
           AND (roomid = ${baseRoomid} OR roomid LIKE ${baseRoomid + '\\_\\_c\\_%'} ESCAPE '\\')
         LIMIT 1
      `;
      if (dup.length > 0) {
        this.logger.log(
          `[handleCallPush] END_CHAT 중복 — 같은 base roomid=${baseRoomid} consultation.id=${dup[0].id} 존재. skip INSERT`,
        );
        return { ok: true };
      }
    }

    // ─── 등급/단가 스냅샷 (Phase 2) ───
    // 통화 종료 시점의 상담사 등급/단가를 consultation 에 박제. 정산/분쟁 추적용.
    // 월 1일 락 정책상 통화 중 단가 변경은 불가하므로 종료 시점 값 = 통화 시점 값.
    let snapGrade: string | null = null;
    let snapUnitCost: number | null = null;
    if (counselorId !== null) {
      const snap = await this.sql<{ grade: string; unit_cost: number }[]>`
        SELECT grade, COALESCE(call_070_unit_cost, chat_unit_cost, 0)::int AS unit_cost
          FROM member WHERE id = ${counselorId} LIMIT 1
      `;
      if (snap.length > 0) {
        snapGrade = snap[0].grade ?? null;
        snapUnitCost = Number(snap[0].unit_cost) || null;
      }
    }

    // [Audit B-#3] DB 레벨 중복 INSERT 차단 — UNIQUE 제약 (uq_consultation_call_callid,
    // uq_consultation_chat_roomid) 위반 시 ON CONFLICT DO NOTHING 으로 graceful skip.
    // RETURNING 결과가 비면 중복으로 인한 INSERT 미수행 → 후속 포인트 차감/적립도 skip.
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO consultation (
        member_id, mb_id, counselor_id, csrid, cpid, dtmfno,
        callee_phone, caller_phone, telno, reason, usetm,
        amt, amt_free, amt_pro, preflag,
        is_paid, membid, roomid, callid,
        skip_charge, mrtn,
        started_at, ended_at, eventtm, created_at,
        unit_cost_snapshot, grade_at_session
      ) VALUES (
        ${memberId}, ${memberMbId || null}, ${counselorId}, ${csrid || null},
        ${cpid || null}, ${dtmfno || null},
        ${toPhone || null}, ${fromPhone || null}, ${telno || null},
        ${reason}, ${chatUsetm},
        ${amt}, ${amtFree}, ${amtPro}, ${preflag || null},
        ${isPaid}, ${membid || null}, ${roomid || null}, ${callid || null},
        ${skipCharge}, ${raw},
        ${startedAt}, ${endedAt}, ${eventAt}, ${wrAt},
        ${snapUnitCost}, ${snapGrade}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 0) {
      // 중복 콜백 — 이미 처리된 통화 (callid 또는 roomid 기반 UNIQUE 위반)
      this.logger.warn(
        `[handleCallPush] consultation 중복 INSERT 차단 — callid=${callid} roomid=${roomid} counselorId=${counselorId} memberId=${memberId}`,
      );
      return { ok: true, idempotent: true };
    }
    const consultationId = Number(inserted[0]?.id ?? 0);

    // ─── 포인트 정산 — sample/mtonet/mtonet_rcv.php 정책 1:1 매핑 ─────────
    //
    // 정책 (2026-05-13, 사용자 명시):
    //   "엠투넷에서 반환되는 값(push amt)으로만 차감해야 정확하다."
    //
    //   - push 의 amt 를 그대로 사용 (sample 그대로). m2net 잔액 재조회/diff 보정 X.
    //   - 회원 차감: amt > 0 && !refund_eligible && !is_postpaid → -amt
    //     (채팅은 후불 없음 — is_postpaid 는 to=5000878 전화에만 해당)
    //   - 상담사 적립: amt > 0 → +amt (후불 포함)
    //   - m2net 은 이미 자체 차감 완료 — fill 호출 안 함 (이중 차감 방지)
    if (endsHere && amt > 0) {
      const svcType = isCall ? '[전화]' : '[채팅]';
      this.logger.log(
        `[handleCallPush] 차감 svc=${svcType} memberId=${memberId} counselorId=${counselorId} membid=${membid} pushAmt=${amt} reason=${reason} refundEligible=${refundEligible} isPostpaid=${isPostpaid}`,
      );

      // 회원 차감 — 환불대상/후불은 제외 (채팅은 후불 없음)
      if (!refundEligible && !isPostpaid && memberId !== null) {
        try {
          await this.deductMemberPoint(
            memberId,
            amt,
            amtFree,
            amtPro,
            `${svcType}상담코인 차감`,
            consultationId,
            `${consultationId}@상담코인 차감@${eventtm}`,
            isPaid,
            // m2net 은 이미 자체 차감 완료 — fill 호출 절대 금지 (이중 차감).
            false,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(
            `회원 포인트 차감 실패 (memberId=${memberId}, consultationId=${consultationId}): ${msg}`,
          );
          // 운영자 알림 — 회원-상담사 포인트 불일치 가능, 즉시 인지 필요
          void this.opsAlert.send(
            'M2NET 회원 차감 실패',
            `memberId=${memberId} consultationId=${consultationId}\namt=${amt} reason=${reason}\n\n${msg}`,
          );
        }
      }

      // 상담사 적립 — 후불 포함 모든 정상 통화
      if (counselorId !== null) {
        try {
          await this.creditCounselorPoint(
            counselorId,
            amt,
            `${svcType}상담코인 증가`,
            consultationId,
            `${consultationId}@상담코인 증가@${eventtm}`,
            isPaid,
            // 상담사 잔액도 m2net 측에서 자동 처리되므로 fill 생략.
            false,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(
            `상담사 포인트 적립 실패 (counselorId=${counselorId}, consultationId=${consultationId}): ${msg}`,
          );
          // [Audit A-#11] 상담사 적립 실패도 OpsAlert — 상담사 수익 미적립 = 정산 분쟁 직결.
          void this.opsAlert.send(
            'M2NET 상담사 적립 실패',
            `counselorId=${counselorId} consultationId=${consultationId}\namt=${amt} reason=${reason}\n\n${msg}`,
          );
        }
      }
    }

    // 사용 안 함 (TS unused 경고 회피, 추후 알림톡 트리거에 사용 예정)
    void counselorMbId;
    void memberMbId;

    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // 자체 정산 — m2net END_CHAT push 지연/누락 대비.
  //
  // chat.service.markLeave 가 사용자가 채팅종료 누른 시점에 호출.
  // chat_room.use_seconds + unit_seconds/unit_cost 기반으로 amt 계산 → 회원 차감 + 상담사 적립.
  // 같은 chat_room 에 대해 consultation row 가 이미 있으면(=push 가 이미 도착) 멱등 skip.
  // ─────────────────────────────────────────────

  async settleChatRoomLocal(
    chatRoomId: number,
  ): Promise<{ ok: true; settled: boolean; marked_for_retry?: boolean }> {
    const rooms = await this.sql<{
      id: number;
      roomid: string | null;
      member_id: number | null;
      counselor_id: number | null;
      csrid: string | null;
      use_seconds: number;
      started_at: Date | null;
      ended_at: Date | null;
    }[]>`
      SELECT id, roomid, member_id, counselor_id, csrid,
             use_seconds, started_at, ended_at
        FROM chat_room WHERE id = ${chatRoomId} LIMIT 1
    `;
    const room = rooms[0];
    if (!room || !room.member_id || !room.counselor_id) {
      return { ok: true, settled: false };
    }

    // 멱등 — 같은 chat_room 에 대해 이미 정산 row 가 있으면 skip.
    // ⚠️ roomid 만으로 가드하면 안 된다: tickRoom/markLeave 가 `__c_<id>` suffix 를 매번 다르게
    // 붙일 수 있어 우회되고 차감이 중복으로 들어가는 버그가 있었음.
    // 따라서 chat_room.id 와 매핑되는 모든 변형 roomid (원본/__c_*) + roomid prefix 기반으로 검색.
    const baseRoomid = room.roomid ? room.roomid.replace(/__c_\d+$/, '') : null;
    if (baseRoomid) {
      const existing = await this.sql<{ id: number }[]>`
        SELECT id FROM consultation
         WHERE reason IN ('END_CHAT', 'END_CHAT_LOCAL')
           AND member_id = ${room.member_id}
           AND counselor_id = ${room.counselor_id}
           AND (roomid = ${baseRoomid} OR roomid LIKE ${baseRoomid + '\\_\\_c\\_%'} ESCAPE '\\')
         LIMIT 1
      `;
      if (existing.length > 0) {
        return { ok: true, settled: false };
      }
    } else {
      // roomid 가 없는 케이스 — (member, counselor, started_at) 으로 추정 매칭
      if (room.started_at) {
        const existing = await this.sql<{ id: number }[]>`
          SELECT id FROM consultation
           WHERE reason IN ('END_CHAT', 'END_CHAT_LOCAL')
             AND member_id = ${room.member_id}
             AND counselor_id = ${room.counselor_id}
             AND started_at = ${room.started_at}
           LIMIT 1
        `;
        if (existing.length > 0) {
          return { ok: true, settled: false };
        }
      }
    }

    // 정책 (2026-05-13): "m2net 이 반환한 값으로만 차감".
    //   사주문 측 use_seconds × unit_cost 자체 계산은 사용하지 않는다.
    //   m2net 잔액 조회 결과만 신뢰: sajumoon DB 잔액 - m2net 잔액 = 차감되어야 할 금액.
    //   조회 실패 / diff <= 0 이면 차감 skip (END_CHAT push 도착 후 그쪽에서 정합).
    const memberRows = await this.sql<{ csrid: string | null; sajumoon_balance: number }[]>`
      SELECT csrid, point AS sajumoon_balance
        FROM member WHERE id = ${room.member_id} LIMIT 1
    `;
    const csrid = memberRows[0]?.csrid ?? null;
    const sajumoonBalance = Number(memberRows[0]?.sajumoon_balance ?? 0);

    const secs = Number(room.use_seconds) || 0;
    let amt = 0;
    if (!csrid) {
      this.logger.warn(
        `[settleChatRoomLocal] csrid 없음 → m2net 조회 불가, skip chatRoomId=${chatRoomId}`,
      );
      return { ok: true, settled: false };
    }
    try {
      const r = await this.m2net.getMemberByMembid(csrid);
      if (r.ok && typeof r.amt === 'number') {
        const m2netBalance = Math.max(0, Math.floor(Number(r.amt)));
        const diff = sajumoonBalance - m2netBalance;
        if (diff > 0) {
          amt = diff;
          this.logger.log(
            `[settleChatRoomLocal] m2net-diff 적용 chatRoomId=${chatRoomId} csrid=${csrid} sajumoon=${sajumoonBalance} m2net=${m2netBalance} → amt=${amt}`,
          );
        } else {
          this.logger.log(
            `[settleChatRoomLocal] m2net 잔액 >= sajumoon (diff=${diff}) → 차감 skip chatRoomId=${chatRoomId}`,
          );
          return { ok: true, settled: false };
        }
      } else {
        // [Audit C-#9] M2NET 잔액 조회 실패 — chat_room.settle_status 마킹 + retry cron 재시도
        const reason = r.error ?? 'unknown';
        this.logger.warn(
          `[settleChatRoomLocal] m2net 잔액 조회 실패 csrid=${csrid} error=${reason} → m2net_failed 마킹`,
        );
        await this.markChatRoomSettleFailed(chatRoomId, `m2net_get_balance_failed: ${reason}`);
        return { ok: true, settled: false, marked_for_retry: true };
      }
    } catch (e) {
      // [Audit C-#9] 예외 발생 — 같은 처리
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[settleChatRoomLocal] m2net 잔액 조회 예외 csrid=${csrid}: ${reason} → m2net_failed 마킹`,
      );
      await this.markChatRoomSettleFailed(chatRoomId, `m2net_exception: ${reason}`);
      return { ok: true, settled: false, marked_for_retry: true };
    }
    if (amt <= 0) return { ok: true, settled: false };

    // amt_free / amt_pro 분리
    const balRows = await this.sql<{ free_balance: number }[]>`
      SELECT free_balance FROM point WHERE member_id = ${room.member_id} LIMIT 1
    `;
    const free = Number(balRows[0]?.free_balance ?? 0);
    const amtFree = Math.max(0, Math.min(amt, free));
    const amtPro = amt - amtFree;
    const isPaid = amt >= 10000;
    const nowIso = new Date().toISOString();

    // 등급/단가 스냅샷 (Phase 2)
    let snapGradeLocal: string | null = null;
    let snapUnitCostLocal: number | null = null;
    if (room.counselor_id != null) {
      const snap = await this.sql<{ grade: string; unit_cost: number }[]>`
        SELECT grade, COALESCE(call_070_unit_cost, chat_unit_cost, 0)::int AS unit_cost
          FROM member WHERE id = ${room.counselor_id} LIMIT 1
      `;
      if (snap.length > 0) {
        snapGradeLocal = snap[0].grade ?? null;
        snapUnitCostLocal = Number(snap[0].unit_cost) || null;
      }
    }

    // consultation INSERT — reason='END_CHAT_LOCAL' 로 push 와 구분
    // [Audit B-#3] DB UNIQUE 제약 (roomid, member, counselor, reason) 위반 시 graceful skip.
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO consultation (
        member_id, counselor_id, csrid, reason, usetm,
        amt, amt_free, amt_pro,
        is_paid, roomid,
        started_at, ended_at, created_at,
        unit_cost_snapshot, grade_at_session
      ) VALUES (
        ${room.member_id}, ${room.counselor_id}, ${room.csrid || null},
        'END_CHAT_LOCAL', ${secs},
        ${amt}, ${amtFree}, ${amtPro},
        ${isPaid}, ${room.roomid || null},
        ${room.started_at}, ${room.ended_at ?? new Date()}, now(),
        ${snapUnitCostLocal}, ${snapGradeLocal}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 0) {
      this.logger.warn(
        `[settleChatRoomLocal] consultation 중복 INSERT 차단 — roomid=${room.roomid} chatRoomId=${chatRoomId}`,
      );
      return { ok: true, settled: false };
    }
    const consultationId = Number(inserted[0]?.id ?? 0);

    // 회원 차감 + 상담사 적립
    try {
      await this.deductMemberPoint(
        room.member_id, amt, amtFree, amtPro,
        '[채팅]상담코인 차감',
        consultationId,
        `${consultationId}@상담코인 차감@${nowIso}`,
        isPaid,
        // 채팅은 m2net 가 자체 차감을 마친 상태 → fill 금지 (이중 차감 방지).
        false,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `[settleChatRoomLocal] 회원 차감 실패 memberId=${room.member_id} consultationId=${consultationId}: ${msg}`,
      );
      void this.opsAlert.send(
        'M2NET 채팅 정산 회원 차감 실패',
        `memberId=${room.member_id} consultationId=${consultationId}\namt=${amt}\n\n${msg}`,
      );
    }
    try {
      await this.creditCounselorPoint(
        room.counselor_id, amt,
        '[채팅]상담코인 증가',
        consultationId,
        `${consultationId}@상담코인 증가@${nowIso}`,
        isPaid,
        // 채팅은 m2net 측 fill 생략
        false,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `[settleChatRoomLocal] 상담사 적립 실패 counselorId=${room.counselor_id} consultationId=${consultationId}: ${msg}`,
      );
      // [Audit A-#11] 채팅 정산 시 상담사 적립 실패도 OpsAlert.
      void this.opsAlert.send(
        'M2NET 채팅 정산 상담사 적립 실패',
        `counselorId=${room.counselor_id} consultationId=${consultationId}\namt=${amt}\n\n${msg}`,
      );
    }

    this.logger.log(
      `[settleChatRoomLocal] chatRoomId=${chatRoomId} secs=${secs} amt=${amt} amtFree=${amtFree} amtPro=${amtPro}`,
    );
    // [Audit C-#9] 정산 성공 마킹 — retry cron 이 다시 처리 안 하게
    await this.sql`
      UPDATE chat_room
         SET settle_status = 'completed',
             settle_failure_reason = NULL
       WHERE id = ${chatRoomId}
    `;
    return { ok: true, settled: true };
  }

  /**
   * [Audit C-#9] chat_room 정산 실패 마킹 — 별도 retry cron 이 다시 처리하게.
   * 트랜잭션 없이 단발 UPDATE (실패해도 본 흐름 영향 X).
   */
  private async markChatRoomSettleFailed(chatRoomId: number, reason: string): Promise<void> {
    try {
      await this.sql`
        UPDATE chat_room
           SET settle_status = 'm2net_failed',
               settle_retry_count = COALESCE(settle_retry_count, 0) + 1,
               settle_last_retry_at = NOW(),
               settle_failure_reason = ${reason.slice(0, 500)}
         WHERE id = ${chatRoomId}
      `;
    } catch (e) {
      this.logger.error(
        `[markChatRoomSettleFailed] UPDATE 실패 chatRoomId=${chatRoomId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ─────────────────────────────────────────────
  // m2net ↔ 사주문 잔액 정합 (reconcile) — m2net = single source of truth.
  //
  // 통화/채팅 진행 중 m2net 은 내부적으로 1분/1만원 단위 차감하지만 그 중간 차감을
  // 사주문에 push 해 주지 않는다. 종료 push 1회만 도착하므로, 그 사이 시점에 사주문
  // DB 잔액은 m2net 실제 잔액보다 큰 상태로 남아 회원에게 노출된다.
  //
  // 이 함수는 m2net 측 amt(=잔액)를 fetch 해 사주문 DB(point.free/paid + member.point)에
  // 그대로 overwrite 한다. diff 만큼 보정 point_history row 를 남겨 감사 가능.
  // ─────────────────────────────────────────────
  async reconcileMemberBalanceFromM2net(memberId: number, options?: {
    reason?: string;
  }): Promise<{
    ok: boolean;
    skipped?: boolean;
    sajumoonBefore?: number;
    m2netBalance?: number;
    diff?: number;
    error?: string;
  }> {
    // 회원 csrid 조회
    const memberRows = await this.sql<{ csrid: string | null }[]>`
      SELECT csrid FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const csrid = memberRows[0]?.csrid ?? null;
    if (!csrid) {
      return { ok: false, error: 'csrid 없음 — m2net 등록 안 된 회원' };
    }

    // m2net 잔액 조회
    let m2netBalance: number;
    try {
      const r = await this.m2net.getMemberByMembid(csrid);
      if (!r.ok || typeof r.amt !== 'number') {
        return { ok: false, error: r.error ?? 'm2net amt 없음' };
      }
      m2netBalance = Math.max(0, Math.floor(Number(r.amt)));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'm2net 조회 예외' };
    }

    const reason = options?.reason ?? 'reconcile';

    // 트랜잭션: point + member.point 를 m2net 잔액으로 강제 overwrite + 보정 history 기록.
    const result = await this.sql.begin(async (tx) => {
      // point row 보장
      let pt = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point
         WHERE member_id = ${memberId} FOR UPDATE
      `;
      if (pt.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
          VALUES (${memberId}, 0, 0, 0, 0)
          ON CONFLICT (member_id) DO NOTHING
        `;
        pt = await tx<{ free_balance: number; paid_balance: number }[]>`
          SELECT free_balance, paid_balance FROM point
           WHERE member_id = ${memberId} FOR UPDATE
        `;
      }
      const freeBefore = Number(pt[0].free_balance);
      const paidBefore = Number(pt[0].paid_balance);
      const sajumoonBefore = freeBefore + paidBefore;
      const diff = sajumoonBefore - m2netBalance; // > 0 이면 사주문이 더 큼 = 미반영 차감분

      // 잔액 동일하면 skip (멱등 + 노이즈 방지)
      if (diff === 0) {
        return { applied: false, sajumoonBefore, diff };
      }

      // free 우선 차감/증가 정책으로 m2net 잔액에 맞춤.
      //   - 사주문이 더 크면 (diff>0): free 부터 차감 후 paid 차감
      //   - 사주문이 더 작으면 (diff<0): m2net 이 충전된 상태 — paid_balance 에 증가 반영
      //     (충전은 보통 사주문→m2net 흐름이므로 역방향은 드물지만 안전하게 처리)
      let newFree = freeBefore;
      let newPaid = paidBefore;
      if (diff > 0) {
        const takeFree = Math.min(freeBefore, diff);
        newFree = freeBefore - takeFree;
        newPaid = Math.max(0, paidBefore - (diff - takeFree));
      } else {
        // diff < 0 → m2net 이 더 큼. 증가분은 paid_balance 에 반영.
        newPaid = paidBefore + -diff;
      }

      // 보정 point_history 1행 — 멱등성을 위해 reason+now 기반 rel_action 키 사용.
      // (consultation 멱등 UNIQUE 와 충돌하지 않도록 rel_table='reconcile')
      const nowIso = new Date().toISOString();
      const relAction = `${memberId}@${reason}@${nowIso}`;
      const usePoint = diff > 0 ? diff : 0;
      const earnPoint = diff < 0 ? -diff : 0;
      const balanceAfter = m2netBalance;
      await tx`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          rel_table, rel_id, rel_action,
          is_paid, is_expired, expire_date, actor_type
        ) VALUES (
          ${memberId},
          ${diff > 0 ? '[정합]m2net 차감 반영' : '[정합]m2net 충전 반영'},
          ${earnPoint}, ${usePoint}, ${balanceAfter},
          'reconcile', ${String(memberId)}, ${relAction},
          false, false, NULL, 'system'
        )
      `;

      // point + member.point overwrite
      await tx`
        UPDATE point SET
          free_balance = ${newFree},
          paid_balance = ${newPaid},
          total_used   = total_used   + ${usePoint},
          total_earned = total_earned + ${earnPoint},
          updated_at   = now()
         WHERE member_id = ${memberId}
      `;
      await tx`
        UPDATE member SET point = ${m2netBalance}, updated_at = now()
         WHERE id = ${memberId}
      `;
      return { applied: true, sajumoonBefore, diff };
    });

    if (result.applied) {
      this.logger.log(
        `[reconcile] memberId=${memberId} reason=${reason} sajumoon ${result.sajumoonBefore} → m2net ${m2netBalance} (diff=${result.diff})`,
      );
    }
    return {
      ok: true,
      skipped: !result.applied,
      sajumoonBefore: result.sajumoonBefore,
      m2netBalance,
      diff: result.diff,
    };
  }

  // ─────────────────────────────────────────────
  // 상태 통지 (mtonet_state.php)
  // ─────────────────────────────────────────────

  async handleStatePush(payload: Record<string, unknown>): Promise<{ ok: true; updated: number }> {
    const list = Array.isArray((payload as { list?: unknown }).list)
      ? (payload as { list: unknown[] }).list
      : [];
    let updated = 0;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const csrid = String((item as Record<string, unknown>).csrid ?? '');
      const state = String((item as Record<string, unknown>).state ?? '');
      if (!csrid || !state) continue;
      // sample 정책: state='RDVC' 는 무시 (라이브 코드의 보존된 분기)
      if (state === 'RDVC') continue;

      // 보호 가드: m2net 가 'CNCH'/'CONN' 을 계속 푸시하는 경우(인지 지연), 우리 DB 에
      // 진짜 진행 중인 세션이 없으면 stale 푸시로 간주하고 무시 → 다음 회원이 상담 불가하게
      // 막히는 버그 방지. (sample mtonet_state.php 는 무조건 덮어씌우지만 그건 라이브 m2net
      // 가 정확하다는 가정. 실제론 종종 지연/오류 푸시가 옴.)
      if (state === 'CNCH' || state === 'CONN') {
        const active = await this.sql<{ id: number }[]>`
          (SELECT 1 AS id FROM chat_room cr
             INNER JOIN member m ON m.id = cr.counselor_id
            WHERE m.csrid = ${csrid}
              AND cr.status IN ('STAY', 'CNCH')
            LIMIT 1)
          UNION ALL
          (SELECT 1 AS id FROM consultation c
             INNER JOIN member m ON m.id = c.counselor_id
            WHERE m.csrid = ${csrid}
              AND c.ended_at IS NULL
              AND c.created_at > now() - interval '2 hours'
            LIMIT 1)
        `;
        if (active.length === 0) {
          this.logger.warn(`[state-push] stale ${state} 무시 (csrid=${csrid}) — active session 없음`);
          continue;
        }
      }

      const r = await this.sql`UPDATE member SET state = ${state} WHERE csrid = ${csrid}`;
      if (r.count > 0) updated += r.count;
    }
    return { ok: true, updated };
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼 — 회원 차감 (free 우선)
  // ─────────────────────────────────────────────

  /**
   * 회원 포인트 차감 — free_balance 우선 차감, 부족분은 paid_balance.
   * point_history 1행 + point/member 집계 갱신. (rel_table='consultation', rel_action) 멱등.
   */
  private async deductMemberPoint(
    memberId: number,
    amt: number,
    amtFree: number,
    amtPro: number,
    content: string,
    consultationId: number,
    relAction: string,
    isPaid: boolean,
    // 채팅 정산이면 m2net 측이 이미 자체 차감을 수행하므로 fill 호출 금지 (이중 차감 방지).
    // 전화 정산은 m2net 가 amt 를 push 로 알려주는 표준 흐름이라 fill 필요.
    syncToM2net: boolean = true,
  ): Promise<void> {
    const result = await this.sql.begin(async (tx) => {
      // 잔액 row 보장
      let pt = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
      `;
      if (pt.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
          VALUES (${memberId}, 0, 0, 0, 0)
          ON CONFLICT (member_id) DO NOTHING
        `;
        pt = await tx<{ free_balance: number; paid_balance: number }[]>`
          SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
        `;
      }
      const free = Number(pt[0].free_balance);
      const paid = Number(pt[0].paid_balance);

      // [Audit B-#5] 실제 차감액 재계산 — FOR UPDATE 후 잠긴 잔액 기준.
      // 호출자(handleCallPush)가 전달한 amtFree/amtPro 는 트랜잭션 밖에서 계산되어
      // race 시 stale 값일 수 있음. 여기서 실제 잔액에 맞게 재계산해
      // consultation.amt_free/pro 와 point 차감을 일관되게 유지.
      const actualFree = Math.max(0, Math.min(amtFree, free));
      const remaining = amt - actualFree;
      const actualPro = Math.max(0, Math.min(remaining, paid));
      const totalDeducted = actualFree + actualPro;
      const balanceAfter = free + paid - totalDeducted;

      // 호출자 기대값과 실제 차감액이 다르면 race 발생 — 경고 로그 + OpsAlert
      if (actualFree !== amtFree || actualPro !== amtPro) {
        this.logger.warn(
          `[deductMemberPoint] 잔액 불일치 보정 memberId=${memberId} consultationId=${consultationId} ` +
          `requested(free=${amtFree}, pro=${amtPro}) → actual(free=${actualFree}, pro=${actualPro})`,
        );
      }
      // 잔액 부족 (totalDeducted < amt) 이면 명시적 알림
      if (totalDeducted < amt) {
        this.logger.error(
          `[deductMemberPoint] 잔액 부족 memberId=${memberId} consultationId=${consultationId} ` +
          `amt=${amt} actual=${totalDeducted} shortfall=${amt - totalDeducted}`,
        );
        void this.opsAlert.send(
          'M2NET 회원 잔액 부족',
          `memberId=${memberId} consultationId=${consultationId}\n` +
          `요청 ${amt} / 실차감 ${totalDeducted} / 부족 ${amt - totalDeducted}`,
        );
      }

      // 멱등 INSERT — DB 의 unique index 가 partial 이므로 ON CONFLICT 에 WHERE 동일하게 명시.
      // (uq_point_history_payment_action: WHERE rel_table IN ('payment','payment_autopay','consultation'))
      const ins = await tx<{ id: number }[]>`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          rel_table, rel_id, rel_action,
          is_paid, is_expired, expire_date, actor_type
        ) VALUES (
          ${memberId}, ${content},
          0, ${totalDeducted}, ${balanceAfter},
          'consultation', ${String(consultationId)}, ${relAction},
          ${isPaid}, false, NULL, 'system'
        )
        ON CONFLICT (rel_table, rel_id, rel_action)
          WHERE rel_table IN ('payment','payment_autopay','consultation')
          DO NOTHING
        RETURNING id
      `;
      // 이미 처리된 콜백이면 잔액 갱신 안 함 (멱등)
      if (ins.length === 0) return { applied: false, membid: null as string | null };

      // 잔액 갱신 — actualFree/actualPro 사용 (FOR UPDATE 기준 정확한 값)
      await tx`
        UPDATE point SET
          free_balance = free_balance - ${actualFree},
          paid_balance = paid_balance - ${actualPro},
          total_used = total_used + ${totalDeducted},
          updated_at = now()
         WHERE member_id = ${memberId}
      `;
      await tx`
        UPDATE member SET point = point - ${totalDeducted}, updated_at = now()
         WHERE id = ${memberId}
      `;
      // consultation 의 amt_free/amt_pro 도 실제 차감액으로 보정 — 정산 일관성
      await tx`
        UPDATE consultation
           SET amt_free = ${actualFree},
               amt_pro = ${actualPro}
         WHERE id = ${consultationId}
      `;
      // m2net 측 잔액에도 반영하기 위해 회원의 membid(=member.csrid) 조회
      const r = await tx<{ csrid: string | null }[]>`
        SELECT csrid FROM member WHERE id = ${memberId} LIMIT 1
      `;
      return { applied: true, membid: r[0]?.csrid ?? null };
    });

    // 트랜잭션 커밋 후에만 m2net 동기화. 멱등 skip 케이스는 호출 안 함.
    // 채팅 정산(syncToM2net=false)에서는 m2net 가 이미 자체 차감을 마친 상태라 추가 fill 시
    // 이중 차감(=1유닛 만큼 더 차감) 됨. sample 도 채팅 케이스에서 fill 안 함.
    if (syncToM2net && result.applied && result.membid) {
      this.m2net
        .addMemberCoin(result.membid, -amt)
        .then((r) => {
          if (!r.ok) {
            this.logger.warn(
              `[deductMemberPoint] m2net fill 실패 memberId=${memberId} membid=${result.membid} amt=${-amt}: ${r.error}`,
            );
          }
        })
        .catch((e) => {
          this.logger.warn(
            `[deductMemberPoint] m2net fill 예외 memberId=${memberId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
  }

  /**
   * 상담사 포인트 적립 — paid_balance 누적 (정산 대상).
   * (rel_table='consultation', rel_action) 멱등.
   */
  private async creditCounselorPoint(
    counselorId: number,
    amt: number,
    content: string,
    consultationId: number,
    relAction: string,
    isPaid: boolean,
    // 채팅 정산이면 m2net 측은 상담사 코인 적립을 별도 처리하므로 fill 금지.
    // 상담사 csrid 가 다른 회원 mb_id 와 충돌하면 엉뚱한 회원 잔액에 적립될 위험도 있음.
    syncToM2net: boolean = true,
  ): Promise<void> {
    const result = await this.sql.begin(async (tx) => {
      let pt = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${counselorId} FOR UPDATE
      `;
      if (pt.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
          VALUES (${counselorId}, 0, 0, 0, 0)
          ON CONFLICT (member_id) DO NOTHING
        `;
        pt = await tx<{ free_balance: number; paid_balance: number }[]>`
          SELECT free_balance, paid_balance FROM point WHERE member_id = ${counselorId} FOR UPDATE
        `;
      }
      const free = Number(pt[0].free_balance);
      const paid = Number(pt[0].paid_balance);
      const balanceAfter = free + paid + amt;

      const ins = await tx<{ id: number }[]>`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          rel_table, rel_id, rel_action,
          is_paid, is_expired, expire_date, actor_type
        ) VALUES (
          ${counselorId}, ${content},
          ${amt}, 0, ${balanceAfter},
          'consultation', ${String(consultationId)}, ${relAction},
          ${isPaid}, false, NULL, 'system'
        )
        ON CONFLICT (rel_table, rel_id, rel_action)
          WHERE rel_table IN ('payment','payment_autopay','consultation')
          DO NOTHING
        RETURNING id
      `;
      if (ins.length === 0) return { applied: false, csrMembid: null as string | null };

      // 상담사는 paid_balance(정산 대상) 으로 적립
      await tx`
        UPDATE point SET
          paid_balance = paid_balance + ${amt},
          total_earned = total_earned + ${amt},
          updated_at = now()
         WHERE member_id = ${counselorId}
      `;
      await tx`
        UPDATE member SET point = point + ${amt}, updated_at = now()
         WHERE id = ${counselorId}
      `;
      // m2net 측 상담사 회원 잔액 동기화용 — 상담사도 사용자처럼 회원으로 등록된 경우 csrid 사용
      const r = await tx<{ csrid: string | null }[]>`
        SELECT csrid FROM member WHERE id = ${counselorId} LIMIT 1
      `;
      return { applied: true, csrMembid: r[0]?.csrid ?? null };
    });

    // 상담사가 m2net 회원으로도 등록된 경우에만 fill (csrid 가 회원/상담사 양쪽 가능).
    // 상담사 적립은 일반적으로 정산용이라 m2net 잔액 반영은 선택적이지만 정합성 위해 시도.
    if (syncToM2net && result.applied && result.csrMembid) {
      this.m2net
        .addMemberCoin(result.csrMembid, amt)
        .then((r) => {
          if (!r.ok) {
            this.logger.warn(
              `[creditCounselorPoint] m2net fill 실패 counselorId=${counselorId} membid=${result.csrMembid} amt=${amt}: ${r.error}`,
            );
          }
        })
        .catch((e) => {
          this.logger.warn(
            `[creditCounselorPoint] m2net fill 예외 counselorId=${counselorId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
  }
}

/**
 * sample/mtonet/mtonet_rcv.php : get_counselor_ready_state 와 1:1 동등.
 *  - 전화+채팅 → RDVC
 *  - 전화만   → IDLE
 *  - 채팅만   → RDCH
 *  - 둘 다 끔 → ABSE
 */
function computeReadyState(usePhone: boolean, useChat: boolean): string {
  if (usePhone && useChat) return 'RDVC';
  if (usePhone && !useChat) return 'IDLE';
  if (!usePhone && useChat) return 'RDCH';
  return 'ABSE';
}

/** "YYYY-MM-DD HH:mm:ss" / ISO 모두 파싱. 실패 시 null. */
function safeTimestamp(s: string): Date | null {
  if (!s) return null;
  const dt = new Date(s.replace(' ', 'T'));
  if (isNaN(dt.getTime())) return null;
  return dt;
}
