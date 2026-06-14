import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql, type TxSql } from '../shared/db/db.module';
import { M2netService } from '../shared/m2net/m2net.service';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';
import { AlertsService } from '../shared/alerts/alerts.service';
import { GradeUpgradeService } from '../shared/grade-upgrade/grade-upgrade.service';

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
    private readonly alerts: AlertsService,
    private readonly gradeUpgrade: GradeUpgradeService,
  ) {}

  /**
   * [2026-05-27] 전화 통화 5분 잔여 알림 setTimeout 등록.
   * CONNECT_CSR 콜백 시 1회 호출. 회원 코인 + 상담사 단가/단위시간 기반으로 종료 예상 시각 계산.
   * 발화 시점에 alerts 큐에 push (회원/상담사 양쪽). 클라이언트 polling 으로 수신.
   * pm2 reload 시 setTimeout 손실하지만 5분 알림은 짧은 수명이라 영향 미미.
   *
   * [엄격검증 2차 fix 2026-05-27]
   *  - callid 인자 추가 — alerts dedup key (consult_id) + setTimeout idempotency key.
   *  - 같은 callid 로 두 번 호출되면 두 번째 setTimeout 등록 안 함 (m2net retry 콜백 방어).
   *  - alerts payload data 에 consult_id 추가 — 연속 통화 시 두 번째 알림 dedup 으로 누락 방지.
   */
  private readonly phoneAlertTimers = new Map<string, NodeJS.Timeout>();

  async schedulePhoneFiveMinAlert(
    memberId: number,
    counselorId: number | null,
    callid: string,
  ): Promise<void> {
    try {
      if (!callid) return;
      // idempotency — 같은 callid 에 대해 이미 등록된 setTimeout 있으면 skip
      if (this.phoneAlertTimers.has(callid)) return;

      const rows = await this.sql<{
        member_point: number;
        unit_sec: number;
        unit_cost: number;
      }[]>`
        SELECT
          (SELECT point FROM member WHERE id = ${memberId}) AS member_point,
          (SELECT COALESCE(call_unit_seconds, 30) FROM member WHERE id = ${counselorId ?? 0}) AS unit_sec,
          (SELECT COALESCE(call_070_unit_cost, 0) FROM member WHERE id = ${counselorId ?? 0}) AS unit_cost
      `;
      const r = rows[0];
      if (!r || !r.member_point || !r.unit_sec || !r.unit_cost) return;
      const remainSec = Math.floor((Number(r.member_point) * Number(r.unit_sec)) / Number(r.unit_cost));
      const FIVE_MIN = 300;
      // 5분 전 시점까지 남은 ms
      const delayMs = Math.max(0, (remainSec - FIVE_MIN) * 1000);
      // 0 또는 음수면 이미 5분 미만 — 즉시 발화. 너무 멀면 (예: 24시간+) 등록 안 함.
      if (delayMs > 24 * 60 * 60 * 1000) return;

      const t = setTimeout(() => {
        this.phoneAlertTimers.delete(callid);
        // [엄격검증 6차 fix 2026-05-27] consultation.five_min_alert_sent_at first-write-wins.
        //   cron + setTimeout 양쪽이 같은 callid 에 발화 시도해도 한 번만 발화.
        void this.firePhoneFiveMinAlert(callid, memberId, counselorId).catch((e) => {
          this.logger.warn(`[phoneAlert.setTimeout] firePhoneFiveMinAlert 실패 callid=${callid}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }, delayMs);
      this.phoneAlertTimers.set(callid, t);
    } catch (e) {
      this.logger.warn(
        `[schedulePhoneFiveMinAlert] memberId=${memberId} callid=${callid} 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * 통화 종료/실패 시 예약된 5분 알림 setTimeout 취소.
   * DISCONNECT/END_CHAT/NO_ANSWER_CSR 등에서 호출.
   */
  cancelPhoneFiveMinAlert(callid: string): void {
    if (!callid) return;
    const t = this.phoneAlertTimers.get(callid);
    if (t) {
      clearTimeout(t);
      this.phoneAlertTimers.delete(callid);
    }
  }

  /**
   * [엄격검증 6차 fix 2026-05-27] 전화 5분 알림 실제 발화.
   *  - consultation.five_min_alert_sent_at first-write-wins 멱등성.
   *  - cron + setTimeout 양쪽이 호출해도 한 번만 발화 (UPDATE...RETURNING 가드).
   */
  private async firePhoneFiveMinAlert(
    callid: string,
    memberId: number,
    counselorId: number | null,
  ): Promise<boolean> {
    if (!callid) return false;
    const won = await this.sql<{ id: number }[]>`
      UPDATE consultation
         SET five_min_alert_sent_at = now()
       WHERE callid = ${callid}
         AND five_min_alert_sent_at IS NULL
       RETURNING id
    `;
    if (won.length === 0) return false; // 다른 경로가 이미 발화함
    this.alerts.enqueue(memberId, {
      type: 'consult_5min_warning' as const,
      title: '⏰ 5분 남았어요',
      body: '충전하시면 끊김 없이 계속 통화 가능합니다',
      link: '/mypage/charge',
      data: { consult_id: callid, consult_type: 'phone', audience: 'member' },
    });
    if (counselorId) {
      this.alerts.enqueue(counselorId, {
        type: 'consult_5min_warning' as const,
        title: '⏰ 회원 5분 남았어요',
        body: '마무리 멘트 안내 부탁드립니다',
        link: '/counselor/mypage',
        data: { consult_id: callid, consult_type: 'phone', audience: 'counselor' },
      });
    }
    return true;
  }

  /**
   * [엄격검증 6차 fix 2026-05-27] 전화 5분 알림 안전망 cron.
   *
   * setTimeout 만으론 pm2 reload 시 손실 위험. cron 이 매분 active 통화 검사.
   * 잔여시각 = (회원 코인 × 단위시간) ÷ 단가 - 통화 경과시간
   *
   * 좀비 row (m2net DISCONNECT 누락) 방어:
   *  - started_at 이 60분 내 (장시간 통화는 사주플랜 정책 외)
   *  - reason 이 종료 키워드 아닌 경우만 (CONNECT_CSR 등)
   */
  async scanPhoneFiveMinAlerts(): Promise<{ fired: number; calls: string[] }> {
    const candidates = await this.sql<{
      callid: string;
      member_id: number | null;
      counselor_id: number | null;
      member_point: number;
      unit_sec: number;
      unit_cost: number;
      started_at: Date;
    }[]>`
      SELECT c.callid, c.member_id, c.counselor_id, c.started_at,
             COALESCE(m.point, 0) AS member_point,
             COALESCE(s.call_unit_seconds, 30) AS unit_sec,
             COALESCE(s.call_070_unit_cost, 0) AS unit_cost
        FROM consultation c
        LEFT JOIN member m ON m.id = c.member_id
        LEFT JOIN member s ON s.id = c.counselor_id
       WHERE c.roomid IS NULL
         AND c.started_at IS NOT NULL
         AND c.ended_at IS NULL
         AND c.five_min_alert_sent_at IS NULL
         AND c.started_at > now() - interval '60 minutes'
         AND c.callid IS NOT NULL
         AND c.callid <> ''
    `;
    const fired: string[] = [];
    const FIVE_MIN = 300;
    for (const r of candidates) {
      if (!r.member_id || !r.member_point || !r.unit_sec || !r.unit_cost) continue;
      const elapsedSec = Math.floor((Date.now() - new Date(r.started_at).getTime()) / 1000);
      const totalSec = Math.floor((Number(r.member_point) * Number(r.unit_sec)) / Number(r.unit_cost));
      const remainSec = totalSec - elapsedSec;
      if (remainSec <= 0 || remainSec > FIVE_MIN) continue;
      const ok = await this.firePhoneFiveMinAlert(r.callid, r.member_id, r.counselor_id);
      if (ok) fired.push(r.callid);
    }
    if (fired.length > 0) {
      this.logger.log(`[scanPhoneFiveMinAlerts] 발화 ${fired.length}건: [${fired.join(',')}]`);
    }
    return { fired: fired.length, calls: fired };
  }

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
      // 2026-05-22 ID 단일화: 회원의 m2net 측 membid 는 m2net_membid 컬럼 (csrid 는 상담사 전용)
      const r = await this.sql<{ id: number; mb_id: string | null }[]>`
        SELECT id, mb_id FROM member WHERE m2net_membid = ${membid} LIMIT 1
      `;
      if (r[0]) {
        memberId = r[0].id;
        memberMbId = r[0].mb_id ?? '';
      }
    }

    // 5) 금액 정규화 — INSUFFICIENT_CONN 은 무조건 0
    let amt = rawAmt;
    if (reason === 'INSUFFICIENT_CONN') amt = 0;

    // 5-b) [2026-05-29 F 정책] 채팅 선결제(charge_minutes NOT NULL) 모드면 m2net 종량제 amt 무시.
    //   상담사 입장(START_CHAT) 시점에 사주플랜이 이미 chargeMinutes × 단가 전액을 차감했으므로,
    //   m2net 의 추가 종량제 차감 push 는 사주플랜 측에서 무시한다 (이중 차감 방지).
    //   _PREPAID_CHAT_POLICY.md §2 / §6 참조.
    let prepaidChatRoomChargeMinutes: number | null = null;
    if (isChat && roomid) {
      // [2026-06-14 fix] chat_room.roomid 는 `__c_<id>` suffix 변형을 가질 수 있는데,
      //   END 푸시의 base roomid 와 정확히 안 맞으면 선결제 무시가 안 걸려 → consultation 차감까지
      //   발생 = 회원 이중차감 사고. base roomid + suffix 변형 모두 매칭해서 선결제 chat_room 을 찾는다.
      const baseRoomid = roomid.replace(/__c_\d+$/, '');
      const cr = await this.sql<{ charge_minutes: number | null }[]>`
        SELECT charge_minutes FROM chat_room
         WHERE (roomid = ${baseRoomid} OR roomid LIKE ${baseRoomid + '\\_\\_c\\_%'} ESCAPE '\\')
           AND charge_minutes IS NOT NULL AND charge_minutes > 0
         ORDER BY id DESC LIMIT 1
      `;
      if (cr[0]?.charge_minutes != null && Number(cr[0].charge_minutes) > 0) {
        prepaidChatRoomChargeMinutes = Number(cr[0].charge_minutes);
        amt = 0;
      }
    }

    // 6) 종료 이벤트 판정
    const endsHere = (isCall && reason === 'DISCONNECT') || (isChat && reason === 'END_CHAT');

    // 정책 (2026-05-13): "m2net 이 반환한 값으로만 차감한다."
    //   - push 의 amt / m2net 잔액 조회 결과 = single source of truth
    //   - 사주플랜 측 자체 계산(use_seconds × unit_cost)은 부정확의 원인이므로 사용하지 않음
    //   - 따라서 채팅 amt 자체 보정 블록 제거. push amt 가 0 이면 그대로 0, diff 조회만 신뢰.
    const chatUsetm = usetm;

    // 7) 환불 대상 (콜이고 원본금액이 임계값 이하)
    const refundEligible = isCall && rawAmt > 0 && rawAmt <= this.CSR_THRESHOLD_DEFAULT;

    // 7-b) 단기 통화 자동 환불 (2026-05-21 사장님 정책)
    //   30초 미만 + 1단위 단가 이하 통화는 회원 차감 skip.
    //   사용자가 잘못 누르거나 상담사가 즉시 끊은 케이스 — UX 보호.
    //   m2net 측은 이미 차감했으므로 트랜잭션 외부에서 addMemberCoin 으로 잔액 복구.
    //   단가 비교는 snapUnitCost 계산 후 진행 (handleCallPush 의 차감 분기에서).
    //   short_call_refund_seconds=30 (하드코딩, 향후 setting 으로 이전 가능).
    const SHORT_CALL_SEC = 30;

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
      // [2026-05-27] 전화 통화 시작 시점 — 5분 잔여 알림 setTimeout 등록 (회원+상담사 양쪽)
      // [엄격검증 2차 fix 2026-05-27] callid 전달 — idempotency + dedup key
      if (memberId && callid) {
        void this.schedulePhoneFiveMinAlert(memberId, counselorId, callid);
      }
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

        // ★ [2026-05-29 F 정책] 채팅 선결제 차감 — 상담사 입장 (STAY→CNCH 전환) 시점에 1회.
        //   chargeMinutes 가 있는 chat_room 만 대상. 멱등성은 STAY→CNCH RETURNING 으로 보장.
        //   실패해도 채팅 자체는 진행 (OpsAlert 알림 + 사장님 수동 정리).
        try {
          const chargeRows = await this.sql<{
            charge_minutes: number | null;
            member_id: number;
            unit_seconds: number;
            unit_cost: number;
          }[]>`
            SELECT charge_minutes, member_id, unit_seconds, unit_cost
              FROM chat_room WHERE id = ${chatRoomId} LIMIT 1
          `;
          const cr = chargeRows[0];
          if (cr?.charge_minutes && Number(cr.charge_minutes) > 0) {
            const cm = Number(cr.charge_minutes);
            const us = Number(cr.unit_seconds) > 0 ? Number(cr.unit_seconds) : 30;
            const uc = Number(cr.unit_cost) > 0 ? Number(cr.unit_cost) : 0;
            const requiredCost = Math.ceil((cm * 60) / us) * uc;
            if (requiredCost > 0) {
              await this.sql.begin(async (tx) => {
                // member.point 잔액 확인 (FOR UPDATE — 동시 차감 방지)
                const m = await tx<{ point: number }[]>`
                  SELECT point FROM member WHERE id = ${cr.member_id} FOR UPDATE
                `;
                if (!m[0]) throw new Error(`member ${cr.member_id} 없음`);
                if (Number(m[0].point) < requiredCost) {
                  throw new Error(
                    `회원 잔액 부족 member=${cr.member_id} point=${m[0].point} < required=${requiredCost}`,
                  );
                }
                // [BUG FIX 2026-06-10] point.free_balance/paid_balance 도 함께 차감.
                // 기존 코드는 member.point 만 줄이고 point 테이블을 그대로 뒀음.
                // 이후 전화 통화 시 deductMemberPointInTx 가 point 테이블 기준으로
                // member.point 를 절대값 동기화해 선결제 코인을 복원하는 버그 발생.
                let pt = await tx<{ free_balance: number; paid_balance: number }[]>`
                  SELECT free_balance, paid_balance FROM point WHERE member_id = ${cr.member_id} FOR UPDATE
                `;
                if (pt.length === 0) {
                  await tx`
                    INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
                    VALUES (${cr.member_id}, 0, 0, 0, 0)
                    ON CONFLICT (member_id) DO NOTHING
                  `;
                  pt = await tx<{ free_balance: number; paid_balance: number }[]>`
                    SELECT free_balance, paid_balance FROM point WHERE member_id = ${cr.member_id} FOR UPDATE
                  `;
                }
                const free = Number(pt[0]?.free_balance ?? 0);
                const paid = Number(pt[0]?.paid_balance ?? 0);
                // free 우선 차감 (deductMemberPointInTx 와 동일 정책)
                const takeFree = Math.min(free, requiredCost);
                const takePaid = Math.min(paid, requiredCost - takeFree);
                await tx`
                  UPDATE point SET
                    free_balance = free_balance - ${takeFree},
                    paid_balance = paid_balance - ${takePaid},
                    total_used   = total_used + ${requiredCost},
                    updated_at   = now()
                   WHERE member_id = ${cr.member_id}
                `;
                // member.point 는 point 테이블 기준 절대값 동기화 (deductMemberPointInTx 와 동일 패턴)
                await tx`
                  UPDATE member SET
                    point = (SELECT free_balance + paid_balance FROM point WHERE member_id = ${cr.member_id}),
                    updated_at = now()
                   WHERE id = ${cr.member_id}
                `;
                const newPoint = Number(m[0].point) - requiredCost;
                await tx`
                  INSERT INTO point_history (
                    member_id, content, earn_point, use_point, balance_after,
                    rel_table, rel_id, rel_action, is_paid, actor_type
                  ) VALUES (
                    ${cr.member_id}, ${`채팅 선결제 (${cm}분)`}, 0, ${requiredCost}, ${newPoint},
                    'chat_room', ${String(chatRoomId)},
                    ${`chat_room@${chatRoomId}@prepaid_${cm}min`},
                    ${takePaid > 0}, 'system'
                  )
                `;
              });
              this.logger.log(
                `[START_CHAT prepaid] chatRoomId=${chatRoomId} member=${cr.member_id} -${requiredCost} (charge_minutes=${cm})`,
              );
            }
          }
        } catch (e) {
          this.logger.error(
            `[START_CHAT prepaid] 차감 실패 chatRoomId=${chatRoomId}: ${e instanceof Error ? e.message : String(e)}`,
          );
          // OpsAlert 통합은 별도 작업 — 현재는 logger.error 만 (사장님이 prod 로그 모니터링).
        }
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
      // [엄격검증 2차 fix 2026-05-27] 통화 종료/실패 시 예약된 5분 알림 setTimeout 취소.
      //   통화가 5분 안 종료되거나 NO_ANSWER 처리 시 잘못된 알림 발화 방지.
      if (callid) this.cancelPhoneFiveMinAlert(callid);

      if (csrid) {
        const readyState = computeReadyState(counselorUsePhone, counselorUseChat);
        // [2026-06-12] 실제 상담 종료(통화 DISCONNECT / 채팅 END_CHAT)면 last_consult_ended_at=now()
        //   → 상담사 리스팅에서 "방금 상담 끝남(30분)" 2순위로 노출. NO_ANSWER_CSR(미응답)은 제외.
        const isRealConsultEnd = reason === 'DISCONNECT' || reason === 'END_CHAT';
        if (isRealConsultEnd) {
          await this.sql`UPDATE member SET state = ${readyState}, last_consult_ended_at = now() WHERE csrid = ${csrid}`;
        } else {
          await this.sql`UPDATE member SET state = ${readyState} WHERE csrid = ${csrid}`;
        }

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

        // ★ [2026-05-29 G 정책] 5초 이내 자동 환불 (선결제 모드)
        //   상담사 입장 후 5초 안에 비정상 종료 시 회원에게 전액 자동 환불.
        //   abuse 제한: 회원당 일 2회 / 주 4회. 초과 시 환불 skip (어드민 수동).
        //   m2net 첫 30초 1,000원은 사주플랜 측 손해 감수 (사장님 명시).
        //   _PREPAID_CHAT_POLICY.md §5.2 참조.
        if (prepaidChatRoomChargeMinutes != null) {
          try {
            const crInfo = await this.sql<{
              id: number;
              member_id: number;
              unit_seconds: number;
              unit_cost: number;
              charge_minutes: number;
            }[]>`
              SELECT id, member_id, unit_seconds, unit_cost, charge_minutes
                FROM chat_room WHERE roomid = ${roomid} LIMIT 1
            `;
            const rr = crInfo[0];
            if (rr) {
              const elapsed = Number(chatUsetm ?? 0);
              if (elapsed >= 0 && elapsed < 5) {
                // 환불 제한 카운트 — 일 2회 / 주 4회
                const limitRows = await this.sql<{ day_cnt: string; week_cnt: string }[]>`
                  SELECT
                    COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '1 day') AS day_cnt,
                    COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '7 days') AS week_cnt
                  FROM member_chat_quick_refund_log WHERE member_id = ${rr.member_id}
                `;
                const dayCnt = Number(limitRows[0]?.day_cnt ?? 0);
                const weekCnt = Number(limitRows[0]?.week_cnt ?? 0);
                if (dayCnt < 2 && weekCnt < 4) {
                  const refundAmount = Math.ceil(
                    (Number(rr.charge_minutes) * 60) / Number(rr.unit_seconds),
                  ) * Number(rr.unit_cost);
                  if (refundAmount > 0) {
                    await this.sql.begin(async (tx) => {
                      const m = await tx<{ point: number }[]>`
                        SELECT point FROM member WHERE id = ${rr.member_id} FOR UPDATE
                      `;
                      if (!m[0]) throw new Error(`member ${rr.member_id} 없음`);
                      // [BUG FIX 2026-06-10] point.free_balance/paid_balance 도 복원.
                      // START_CHAT 선결제 차감 fix 와 쌍: 차감 시 point 테이블을 줄였으므로
                      // 환불 시에도 point 테이블을 복원해야 member.point = free+paid 일치.
                      // paid_balance 에 환불 (선결제는 paid 우선 사용 정책 — 환불은 역순).
                      const pt = await tx<{ free_balance: number; paid_balance: number }[]>`
                        SELECT free_balance, paid_balance FROM point WHERE member_id = ${rr.member_id} FOR UPDATE
                      `;
                      const curFree = Number(pt[0]?.free_balance ?? 0);
                      // 원래 차감은 free 우선이었으므로 환불도 free 우선 복원
                      // (현재 free 가 0 이면 paid 에 환불, free 가 있으면 free 에 환불)
                      const restoreToPaid = curFree === 0 ? refundAmount : 0;
                      const restoreToFree = refundAmount - restoreToPaid;
                      await tx`
                        UPDATE point SET
                          free_balance = free_balance + ${restoreToFree},
                          paid_balance = paid_balance + ${restoreToPaid},
                          total_used   = total_used - ${refundAmount},
                          updated_at   = now()
                         WHERE member_id = ${rr.member_id}
                      `;
                      await tx`
                        UPDATE member SET
                          point = (SELECT free_balance + paid_balance FROM point WHERE member_id = ${rr.member_id}),
                          updated_at = now()
                         WHERE id = ${rr.member_id}
                      `;
                      const newPoint = Number(m[0].point) + refundAmount;
                      await tx`
                        INSERT INTO point_history (
                          member_id, content, earn_point, use_point, balance_after,
                          rel_table, rel_id, rel_action, is_paid, actor_type
                        ) VALUES (
                          ${rr.member_id},
                          ${`채팅 선결제 자동 환불 (${rr.charge_minutes}분, 5초 이내 종료)`},
                          ${refundAmount}, 0, ${newPoint},
                          'chat_room', ${String(rr.id)},
                          ${`chat_room@${rr.id}@quick_refund`},
                          false, 'system'
                        )
                      `;
                      await tx`
                        INSERT INTO member_chat_quick_refund_log (
                          member_id, chat_room_id, refund_amount, use_seconds, reason
                        ) VALUES (
                          ${rr.member_id}, ${rr.id}, ${refundAmount}, ${elapsed}, ${reason}
                        )
                      `;
                    });
                    this.logger.log(
                      `[END_CHAT quick_refund] chatRoomId=${rr.id} member=${rr.member_id} +${refundAmount} (use_seconds=${elapsed})`,
                    );
                  }
                } else {
                  this.logger.warn(
                    `[END_CHAT quick_refund] 제한 초과 — 환불 skip member=${rr.member_id} day=${dayCnt} week=${weekCnt}`,
                  );
                }
              }
            }
          } catch (e) {
            this.logger.error(
              `[END_CHAT quick_refund] 자동 환불 실패 roomid=${roomid}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        // ★ [2026-05-29 정책 §6 D-2] 채팅 종료 시 m2net 강제 동기화 (선결제 모드)
        //   사주플랜 측 잔액(선결제 차감 + 환불 적용 후) → m2net 측 잔액으로 덮어쓰기.
        //   이 호출이 없으면 m2net 측에 더 많은 잔액이 남아 다음 통화 시 음수 사고 가능.
        //   syncM2netBalanceForMember 와 동일 로직을 inline (모듈 의존성 추가 없이).
        if (prepaidChatRoomChargeMinutes != null && memberId != null) {
          try {
            const mm = await this.sql<{ point: number; m2net_membid: string | null }[]>`
              SELECT point, m2net_membid FROM member WHERE id = ${memberId} LIMIT 1
            `;
            const target = Number(mm[0]?.point ?? 0);
            const membid = mm[0]?.m2net_membid;
            if (membid && this.m2net.isEnabled()) {
              const fetched = await this.m2net.getMemberByMembid(membid);
              if (fetched.ok && typeof fetched.amt === 'number') {
                const delta = target - fetched.amt;
                if (delta !== 0) {
                  // 1차: fill(delta). 실패 시 2차: updateMember(amt=target) 로 덮어쓰기.
                  const fillRes = await this.m2net.addMemberCoin(membid, delta);
                  if (!fillRes.ok) {
                    const ov = await this.m2net.updateMember(membid, { amt: target });
                    if (!ov.ok) {
                      this.logger.warn(
                        `[END_CHAT m2net_sync] overwrite 실패 member=${memberId} target=${target}: ${ov.error}`,
                      );
                    } else {
                      this.logger.log(
                        `[END_CHAT m2net_sync overwrite] member=${memberId} m2net=${fetched.amt} → ${target} (delta=${delta})`,
                      );
                    }
                  } else {
                    this.logger.log(
                      `[END_CHAT m2net_sync] member=${memberId} m2net=${fetched.amt} → ${target} (delta=${delta})`,
                    );
                  }
                }
              } else {
                // 조회 실패 — 폴백으로 그냥 덮어쓰기
                const ov = await this.m2net.updateMember(membid, { amt: target });
                if (!ov.ok) {
                  this.logger.warn(
                    `[END_CHAT m2net_sync] 폴백 overwrite 실패 member=${memberId}: ${ov.error}`,
                  );
                }
              }
            }
          } catch (e) {
            this.logger.error(
              `[END_CHAT m2net_sync] 동기화 실패 roomid=${roomid}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
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

    // [Audit #4] consultation INSERT + 회원 차감 + 상담사 적립을 단일 트랜잭션으로 묶음.
    //   기존 3-개 트랜잭션 분리 시: consultation 만 남고 차감 실패 → 수익 손실 시나리오 발생 가능.
    //   단일 트랜잭션이면 차감/적립 중 하나라도 실패 시 consultation 도 롤백 → 재시도 가능.
    //
    // [Audit B-#3] DB 레벨 중복 INSERT 차단 — UNIQUE 제약 (uq_consultation_call_callid,
    // uq_consultation_chat_roomid) 위반 시 ON CONFLICT DO NOTHING 으로 graceful skip.
    const svcType = isCall ? '[전화]' : '[채팅]';
    let txResult: { dup: boolean; consultationId?: number; shortCallRefund?: boolean };
    try {
      txResult = await this.sql.begin(async (tx): Promise<{ dup: boolean; consultationId?: number; shortCallRefund?: boolean }> => {
        const inserted = await tx<{ id: number }[]>`
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
          return { dup: true };
        }
        const consultationId = Number(inserted[0]?.id ?? 0);

        // ─── 포인트 정산 ───
        //   정책 (2026-05-13): m2net push 의 amt 그대로 사용.
        //   - 회원 차감: amt>0 && !refund_eligible && !short_call_refund && !is_postpaid
        //   - 상담사 적립: amt>0 (후불·단기통화환불 포함 — 단기는 회사 부담으로 적립 보존)
        //   - m2net 은 자체 차감 완료 → fill 호출 X (이중 차감 방지)
        //
        // 단기통화환불 (2026-05-21 신규, 2026-05-22 정정):
        //   30초 미만 + amt<=단가스냅샷 인 콜 = 자동 환불.
        //   회원 차감 skip + m2net 잔액 복구는 트랜잭션 외부 + **상담사 적립은 정상 발생**.
        //   사장님 정책: 사용자 UX 보호 + 상담사 보호 + 회사가 m2net 손실 부담.
        const shortCallRefund =
          isCall && endsHere && usetm < SHORT_CALL_SEC
          && amt > 0 && !!snapUnitCost && amt <= snapUnitCost;

        // [2026-06-14] 상담사 적립 기준액.
        //   선결제 채팅은 회원을 START 에서 이미 차감했으므로 END 에서 amt=0(이중차감 방지)이지만,
        //   상담사 적립은 m2net 실제 과금(rawAmt) 기준으로 정상 발생해야 한다 (안 그러면 상담사 과소적립).
        //   종량제(비선결제)는 기존대로 amt 기준.
        const counselorEarnAmt = (prepaidChatRoomChargeMinutes != null && endsHere) ? rawAmt : amt;

        if (endsHere && amt > 0) {
          this.logger.log(
            `[handleCallPush] 차감 svc=${svcType} memberId=${memberId} counselorId=${counselorId} membid=${membid} pushAmt=${amt} reason=${reason} usetm=${usetm} refundEligible=${refundEligible} shortCallRefund=${shortCallRefund} isPostpaid=${isPostpaid}`,
          );

          // 회원 차감 — 선결제(amt=0)는 여기 진입 안 함 → consultation 차감 없음 = 이중차감 방지.
          if (!refundEligible && !shortCallRefund && !isPostpaid && memberId !== null) {
            await this.deductMemberPointInTx(
              tx,
              memberId, amt, amtFree, amtPro,
              `${svcType}상담코인 차감`,
              consultationId,
              `${consultationId}@상담코인 차감@${eventtm}`,
              isPaid,
            );
          }

          // 단기통화환불 메타 기록 — 회계/m2net 정산 추적용 (2026-05-22 추가).
          //   refund_status='short_call_refund' 는 어드민 수동 환불 화면에서 차단됨.
          if (shortCallRefund && consultationId > 0) {
            await tx`
              UPDATE consultation
                 SET refund_status = 'short_call_refund',
                     refunded_amount = ${amt}
               WHERE id = ${consultationId}
            `;
          }
        }

        // 상담사 적립 — 종량제(amt) + 선결제(rawAmt) 모두. m2net 실제 과금 기준, 동일 트랜잭션.
        //   단기통화환불 시에도 적립은 **정상 발생** (상담사 보호, 사장님 정책 2026-05-22). 멱등(rel_action UNIQUE).
        if (endsHere && counselorEarnAmt > 0 && counselorId !== null) {
          await this.creditCounselorPointInTx(
            tx,
            counselorId, counselorEarnAmt,
            `${svcType}상담코인 증가`,
            consultationId,
            `${consultationId}@상담코인 증가@${eventtm}`,
            counselorEarnAmt >= 10000,
          );
        }

        return { dup: false, consultationId, shortCallRefund };
      });
    } catch (e) {
      // [Audit #4] 트랜잭션 전체 실패 — consultation/deduct/credit 모두 롤백된 상태.
      //   M2NET 이 push 재전송 시 ON CONFLICT 안 걸리므로 재시도 자동 처리.
      //   하지만 운영자 인지가 중요 → OpsAlert 1회 발송.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `[handleCallPush] 트랜잭션 실패 — 롤백됨. callid=${callid} roomid=${roomid} memberId=${memberId} counselorId=${counselorId}: ${msg}`,
      );
      void this.opsAlert.send(
        'M2NET 콜백 트랜잭션 실패 (전체 롤백)',
        `callid=${callid} roomid=${roomid}\nmemberId=${memberId} counselorId=${counselorId}\namt=${amt} reason=${reason}\n\n${msg}\n\nM2NET 재전송 시 자동 재시도 가능. 그래도 영구 실패하면 수동 점검 필요.`,
      );
      throw e;
    }

    if (txResult.dup) {
      // 멱등 — consultation UNIQUE 위반 (이미 처리된 통화)
      this.logger.warn(
        `[handleCallPush] consultation 중복 INSERT 차단 — callid=${callid} roomid=${roomid} counselorId=${counselorId} memberId=${memberId}`,
      );
      return { ok: true, idempotent: true };
    }

    // ─── 단기통화 자동 환불 — m2net 측 잔액 복구 (트랜잭션 외부) ───
    //   사주플랜은 회원 차감 skip 했으므로 양쪽 잔액 정합을 위해 m2net 측에도 +amt 복구.
    //   m2net 의 비즈니스 구조(회선료 정책)에 따라 사주플랜이 약간 손해를 볼 수 있으나
    //   사장님 결정 — 사용자 UX 우선. 손실 추적은 OpsAlert 로 매번 알림.
    //   실패해도 본 처리는 영향 X (consultation 은 이미 INSERT 됨).
    if (txResult.shortCallRefund && membid && amt > 0) {
      const refundAmt = amt;  // 차감 안 한 금액만큼 m2net 측도 +복구
      void this.m2net
        .addMemberCoin(membid, refundAmt)
        .then((sync) => {
          if (sync.ok) {
            this.logger.log(
              `[short-call-refund] m2net 복구 성공 membid=${membid} amt=${refundAmt} callid=${callid} usetm=${usetm}`,
            );
          } else {
            this.logger.error(
              `[short-call-refund] m2net 복구 실패 — 양쪽 잔액 불일치 위험. membid=${membid} amt=${refundAmt} error=${sync.error ?? 'unknown'}`,
            );
            void this.opsAlert.send(
              '단기통화 환불 m2net 복구 실패',
              `callid=${callid} membid=${membid} amt=${refundAmt}\nerror: ${sync.error ?? 'unknown'}\n\nm2net 잔액이 사주플랜보다 ${refundAmt} 적은 상태. 수동 보정 필요.`,
            );
          }
        })
        .catch((e) => {
          this.logger.error(
            `[short-call-refund] m2net 복구 예외 callid=${callid} membid=${membid}: ${(e as Error).message}`,
          );
        });
    }

    // 사용 안 함 (TS unused 경고 회피, 추후 알림톡 트리거에 사용 예정)
    void counselorMbId;
    void memberMbId;

    // 실시간 등급 승급 체크 — 당월 누적 상담시간이 다음 등급 임계값 도달 시 즉시 승급.
    // void 호출: 실패해도 상담 처리 롤백 없음. usetm>0 인 실 상담에서만 체크.
    if (counselorId !== null && usetm > 0) {
      void this.gradeUpgrade.checkAndUpgrade(counselorId);
    }

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

    // [2026-05-30] 사용 0초 채팅은 정산 대상 아님 — m2net 측에도 등록 안 됨 (상담사 입장 전 종료).
    //   m2net.getMemberByMembid 호출 시 "응답 없음" 으로 실패 → settle_status='m2net_failed' → retry 5회 → 영구 실패 OpsAlert 까지 도달했던 사고 (chat_room.id=38, 48).
    //   첫 줄에서 즉시 skipped 마킹하여 retry-cron 대상에서 제외.
    if (Number(room.use_seconds) <= 0) {
      await this.sql`
        UPDATE chat_room
           SET settle_status = 'skipped',
               settle_failure_reason = 'no_use_seconds (상담사 입장 전 종료 또는 자동 취소)'
         WHERE id = ${chatRoomId}
      `;
      this.logger.log(
        `[settleChatRoomLocal] use_seconds=0 → skipped chatRoomId=${chatRoomId}`,
      );
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
    //   사주플랜 측 use_seconds × unit_cost 자체 계산은 사용하지 않는다.
    //   m2net 잔액 조회 결과만 신뢰: sajumoon DB 잔액 - m2net 잔액 = 차감되어야 할 금액.
    //   조회 실패 / diff <= 0 이면 차감 skip (END_CHAT push 도착 후 그쪽에서 정합).
    // 2026-05-22 ID 단일화: 회원 m2net id 는 m2net_membid 컬럼 (csrid 는 상담사 전용)
    const memberRows = await this.sql<{ m2net_membid: string | null; sajumoon_balance: number }[]>`
      SELECT m2net_membid, point AS sajumoon_balance
        FROM member WHERE id = ${room.member_id} LIMIT 1
    `;
    const membid = memberRows[0]?.m2net_membid ?? null;
    const sajumoonBalance = Number(memberRows[0]?.sajumoon_balance ?? 0);

    const secs = Number(room.use_seconds) || 0;
    let amt = 0;
    if (!membid) {
      this.logger.warn(
        `[settleChatRoomLocal] m2net_membid 없음 → m2net 조회 불가, skip chatRoomId=${chatRoomId}`,
      );
      return { ok: true, settled: false };
    }
    try {
      const r = await this.m2net.getMemberByMembid(membid);
      if (r.ok && typeof r.amt === 'number') {
        const m2netBalance = Math.max(0, Math.floor(Number(r.amt)));
        const diff = sajumoonBalance - m2netBalance;
        if (diff > 0) {
          amt = diff;
          this.logger.log(
            `[settleChatRoomLocal] m2net-diff 적용 chatRoomId=${chatRoomId} membid=${membid} sajumoon=${sajumoonBalance} m2net=${m2netBalance} → amt=${amt}`,
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
          `[settleChatRoomLocal] m2net 잔액 조회 실패 membid=${membid} error=${reason} → m2net_failed 마킹`,
        );
        await this.markChatRoomSettleFailed(chatRoomId, `m2net_get_balance_failed: ${reason}`);
        return { ok: true, settled: false, marked_for_retry: true };
      }
    } catch (e) {
      // [Audit C-#9] 예외 발생 — 같은 처리
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[settleChatRoomLocal] m2net 잔액 조회 예외 membid=${membid}: ${reason} → m2net_failed 마킹`,
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

    // [Audit #4-B] handleCallPush 와 동일하게 consultation + deduct + credit + chat_room.settle_status
    //   를 단일 트랜잭션으로 통합. 부분 실패 시 전체 롤백 → retry cron 이 다시 처리 가능.
    let txResult: { dup: boolean; consultationId?: number };
    try {
      txResult = await this.sql.begin(async (tx): Promise<{ dup: boolean; consultationId?: number }> => {
        // consultation INSERT — reason='END_CHAT_LOCAL' 로 push 와 구분
        // [Audit B-#3] UNIQUE 제약 (roomid, member, counselor, reason) 위반 시 graceful skip.
        const inserted = await tx<{ id: number }[]>`
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
          return { dup: true };
        }
        const consultationId = Number(inserted[0]?.id ?? 0);

        // 회원 차감 — 실패 시 throw → 전체 롤백
        if (room.member_id) {
          await this.deductMemberPointInTx(
            tx,
            room.member_id, amt, amtFree, amtPro,
            '[채팅]상담코인 차감',
            consultationId,
            `${consultationId}@상담코인 차감@${nowIso}`,
            isPaid,
          );
        }

        // 상담사 적립 — 실패 시 throw → 회원 차감/consultation 도 롤백
        if (room.counselor_id) {
          await this.creditCounselorPointInTx(
            tx,
            room.counselor_id, amt,
            '[채팅]상담코인 증가',
            consultationId,
            `${consultationId}@상담코인 증가@${nowIso}`,
            isPaid,
          );
        }

        // chat_room 정산 성공 마킹 — 같은 트랜잭션이므로 retry cron 가 다시 시도하지 않게 atomic 보장
        await tx`
          UPDATE chat_room
             SET settle_status = 'completed',
                 settle_failure_reason = NULL
           WHERE id = ${chatRoomId}
        `;

        return { dup: false, consultationId };
      });
    } catch (e) {
      // [Audit #4-B] 트랜잭션 전체 실패 — 모든 변경 롤백. retry cron 이 chat_room.settle_status
      // 가 여전히 m2net_failed/누락 상태이므로 다시 시도. 운영자에게 알림 1회.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `[settleChatRoomLocal] 트랜잭션 실패 — 롤백됨. chatRoomId=${chatRoomId} memberId=${room.member_id} counselorId=${room.counselor_id}: ${msg}`,
      );
      void this.opsAlert.send(
        '채팅 정산 트랜잭션 실패 (전체 롤백)',
        `chatRoomId=${chatRoomId}\nmemberId=${room.member_id} counselorId=${room.counselor_id}\namt=${amt}\n\n${msg}\n\nretry cron 이 다시 시도. 영구 실패 시 수동 점검 필요.`,
      );
      // 실패 마킹 (트랜잭션 밖) — retry cron 이 다음 cycle 에 다시 시도
      await this.markChatRoomSettleFailed(chatRoomId, `tx_rollback: ${msg.slice(0, 200)}`);
      return { ok: true, settled: false, marked_for_retry: true };
    }

    if (txResult.dup) {
      this.logger.warn(
        `[settleChatRoomLocal] consultation 중복 INSERT 차단 — roomid=${room.roomid} chatRoomId=${chatRoomId}`,
      );
      return { ok: true, settled: false };
    }

    this.logger.log(
      `[settleChatRoomLocal] chatRoomId=${chatRoomId} secs=${secs} amt=${amt} amtFree=${amtFree} amtPro=${amtPro}`,
    );

    // 실시간 등급 승급 체크 — 채팅 정산 완료 후 동일하게 적용
    if (room.counselor_id !== null && secs > 0) {
      void this.gradeUpgrade.checkAndUpgrade(room.counselor_id);
    }

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
  // m2net ↔ 사주플랜 잔액 정합 (reconcile) — m2net = single source of truth.
  //
  // 통화/채팅 진행 중 m2net 은 내부적으로 1분/1만원 단위 차감하지만 그 중간 차감을
  // 사주플랜에 push 해 주지 않는다. 종료 push 1회만 도착하므로, 그 사이 시점에 사주플랜
  // DB 잔액은 m2net 실제 잔액보다 큰 상태로 남아 회원에게 노출된다.
  //
  // 이 함수는 m2net 측 amt(=잔액)를 fetch 해 사주플랜 DB(point.free/paid + member.point)에
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
    // 2026-05-22 ID 단일화: 회원 m2net id 는 m2net_membid 컬럼
    const memberRows = await this.sql<{ m2net_membid: string | null }[]>`
      SELECT m2net_membid FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const membid = memberRows[0]?.m2net_membid ?? null;
    if (!membid) {
      return { ok: false, error: 'm2net_membid 없음 — m2net 등록 안 된 회원' };
    }

    // m2net 잔액 조회
    let m2netBalance: number;
    try {
      const r = await this.m2net.getMemberByMembid(membid);
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
      const diff = sajumoonBefore - m2netBalance; // > 0 이면 사주플랜이 더 큼 = 미반영 차감분

      // 잔액 동일하면 skip (멱등 + 노이즈 방지)
      if (diff === 0) {
        return { applied: false, sajumoonBefore, diff };
      }

      // free 우선 차감/증가 정책으로 m2net 잔액에 맞춤.
      //   - 사주플랜이 더 크면 (diff>0): free 부터 차감 후 paid 차감
      //   - 사주플랜이 더 작으면 (diff<0): m2net 이 충전된 상태 — paid_balance 에 증가 반영
      //     (충전은 보통 사주플랜→m2net 흐름이므로 역방향은 드물지만 안전하게 처리)
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
  /**
   * [Audit #4] 회원 차감 (DB 부분만, 트랜잭션 인자 받음).
   *
   *   handleCallPush 가 consultation INSERT 와 같은 트랜잭션 내에서 호출하면
   *   원자성 보장 → 시나리오 A/B 차단.
   *
   *   m2net.addMemberCoin 동기화는 호출자(wrapper)에서 커밋 후 수행.
   *   반환값의 membid 가 null 이 아니고 applied=true 일 때만 호출자가 m2net fill 함.
   */
  private async deductMemberPointInTx(
    tx: TxSql,
    memberId: number,
    amt: number,
    amtFree: number,
    amtPro: number,
    content: string,
    consultationId: number,
    relAction: string,
    isPaid: boolean,
  ): Promise<{ applied: boolean; membid: string | null }> {
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
      // member.point 는 point 테이블 기준으로 절대값 동기화 (delta 방식 사용 시 채팅 선결제와 이중 차감 발생)
      await tx`
        UPDATE member SET
          point = (SELECT free_balance + paid_balance FROM point WHERE member_id = ${memberId}),
          updated_at = now()
         WHERE id = ${memberId}
      `;
      // consultation 의 amt_free/amt_pro 도 실제 차감액으로 보정 — 정산 일관성
      await tx`
        UPDATE consultation
           SET amt_free = ${actualFree},
               amt_pro = ${actualPro}
         WHERE id = ${consultationId}
      `;
      // 2026-05-22 ID 단일화: 회원 m2net id 는 m2net_membid 컬럼
      const r = await tx<{ m2net_membid: string | null }[]>`
        SELECT m2net_membid FROM member WHERE id = ${memberId} LIMIT 1
      `;
      return { applied: true, membid: r[0]?.m2net_membid ?? null };
  }

  /**
   * 회원 차감 wrapper — 자체 트랜잭션 + 커밋 후 m2net 동기화.
   *
   *   호출처 (handleCallPush 외):
   *     - settleChatRoomLocal: 자체 트랜잭션 유지 (m2net 차감 이미 끝 → syncToM2net=false)
   *
   *   handleCallPush 는 wrapper 대신 deductMemberPointInTx 직접 호출 (단일 트랜잭션 통합).
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
    syncToM2net: boolean = true,
  ): Promise<void> {
    const result = await this.sql.begin(async (tx) =>
      this.deductMemberPointInTx(tx, memberId, amt, amtFree, amtPro, content, consultationId, relAction, isPaid),
    );

    // 트랜잭션 커밋 후에만 m2net 동기화. 멱등 skip 케이스는 호출 안 함.
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
   * 상담사 포인트 적립 — earning_balance(수익포인트) 누적 (매월 1일 정산 대상).
   * (rel_table='consultation', rel_action) 멱등.
   *
   * 수익포인트는 회원 표면 잔액(member.point = free+paid)과 별개로 관리되므로
   * member.point 는 갱신하지 않는다. point_history.balance_after 는 적립 직후
   * earning_balance 값(수익포인트 잔액)을 기록.
   */
  /**
   * [Audit #4] 상담사 적립 (DB 부분만, 트랜잭션 인자 받음).
   *
   *   handleCallPush 가 consultation INSERT 와 같은 트랜잭션 내에서 호출 시 원자성 보장.
   *   m2net 동기화는 wrapper 가 커밋 후 수행.
   */
  private async creditCounselorPointInTx(
    tx: TxSql,
    counselorId: number,
    amt: number,
    content: string,
    consultationId: number,
    relAction: string,
    isPaid: boolean,
  ): Promise<{ applied: boolean; csrMembid: string | null }> {
    // [A안 2026-06-02] revenue_rate 적립 시점 적용 — 상담사가 보는 수익금이 고객 결제액과 같아
    // "사주플랜 마진 0%" 오해를 유발하던 버그 수정.
    // 등급별 수익률을 적립 시점에 바로 반영 → earning_balance = 상담사 실제 몫.
    const gradeRow = await tx<{ grade: string | null; free_royalty_pct: number | null; paid_royalty_pct: number | null }[]>`
      SELECT grade, free_royalty_pct, paid_royalty_pct FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    // [2026-06-12 안전화] 정산률을 못 구하면 100%(회사 마진 0%) 적립하던 위험 fallback 제거.
    //   등급은 있는데 setting(grade/revenue_rate.<grade>)이 누락/오류면 보수적 기본값(예비등급 0.4) 적용 + 에러 로그.
    //   → 설정 실수가 곧바로 "상담사 전액 적립" 사고로 이어지던 구멍 차단.
    const SAFE_FALLBACK_REVENUE_RATE = 0.4;
    let revenueRate: number | null = null;
    if (gradeRow.length > 0) {
      const g = gradeRow[0];
      if (g.grade) {
        const rateRow = await tx<{ value: string }[]>`
          SELECT value FROM setting WHERE namespace='grade' AND key=${`revenue_rate.${g.grade}`} LIMIT 1
        `;
        if (rateRow.length > 0) {
          const rate = Number(rateRow[0].value);
          if (Number.isFinite(rate) && rate >= 0 && rate <= 1) revenueRate = rate;
        }
      } else if (isPaid && g.paid_royalty_pct != null) {
        revenueRate = Number(g.paid_royalty_pct) / 100;
      } else if (!isPaid && g.free_royalty_pct != null) {
        revenueRate = Number(g.free_royalty_pct) / 100;
      }
    }
    if (revenueRate == null || !Number.isFinite(revenueRate) || revenueRate < 0 || revenueRate > 1) {
      this.logger.error(
        `[creditCounselorPoint] 정산률 미해결 — counselorId=${counselorId} grade=${gradeRow[0]?.grade ?? 'none'} ` +
        `→ 안전 기본값 ${SAFE_FALLBACK_REVENUE_RATE} 적용. setting grade/revenue_rate.<등급> 확인 필요.`,
      );
      revenueRate = SAFE_FALLBACK_REVENUE_RATE;
    }
    // 상담사 실수익 = 고객결제액 × 수익률 (회사 마진 제외)
    const effectiveAmt = Math.floor(amt * revenueRate);

    let pt = await tx<{ earning_balance: number }[]>`
        SELECT earning_balance FROM point WHERE member_id = ${counselorId} FOR UPDATE
      `;
      if (pt.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
          VALUES (${counselorId}, 0, 0, 0, 0, 0)
          ON CONFLICT (member_id) DO NOTHING
        `;
        pt = await tx<{ earning_balance: number }[]>`
          SELECT earning_balance FROM point WHERE member_id = ${counselorId} FOR UPDATE
        `;
      }
      const earningBefore = Number(pt[0].earning_balance);
      const balanceAfter = earningBefore + effectiveAmt;

      const ins = await tx<{ id: number }[]>`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          rel_table, rel_id, rel_action,
          is_paid, is_expired, expire_date, actor_type, balance_kind
        ) VALUES (
          ${counselorId}, ${content},
          ${effectiveAmt}, 0, ${balanceAfter},
          'consultation', ${String(consultationId)}, ${relAction},
          ${isPaid}, false, NULL, 'system', 'earning'
        )
        ON CONFLICT (rel_table, rel_id, rel_action)
          WHERE rel_table IN ('payment','payment_autopay','consultation')
          DO NOTHING
        RETURNING id
      `;
      if (ins.length === 0) return { applied: false, csrMembid: null as string | null };

      // 상담사는 earning_balance(수익포인트, 정산 대상) 으로 적립
      // member.point(=free+paid 회원 표면 잔액) 는 갱신하지 않음
      await tx`
        UPDATE point SET
          earning_balance = earning_balance + ${effectiveAmt},
          total_earned    = total_earned + ${effectiveAmt},
          updated_at      = now()
         WHERE member_id = ${counselorId}
      `;

      // ─── 추천수익금 실시간 적립 (2026-06-10) ──────────────────────────────────
      // [정책] 추천수익금 = 상담사 수익금과 동급으로 동일 관리 (별도 cron/지급버튼 폐지).
      //   이 상담사(counselorId = 피추천자)를 추천한 상담사(referrer)가 active 이면,
      //   이번 상담 실수익(effectiveAmt)의 rate_snapshot 비율을 referrer 수익금으로 이전한다.
      //   - 제로섬: 피추천자 earning 에서 차감 → 추천자 earning 으로 적립 (회사 비용 0, 사장님 정책).
      //   - 상담 시점 실시간 적립이라 정산 컷("전월 말일까지 earning 합산")에 자동·정확히 포함됨.
      //   - 멱등성: 이 블록은 위 상담사 적립 INSERT(ON CONFLICT) 가 성공(ins.length>0)한 경우에만
      //     도달하므로, consultation 재처리 시 자동으로 한 번만 실행된다. (추가 가드 불필요)
      if (effectiveAmt > 0) {
        const refRows = await tx<{
          id: number; referrer_id: number; referrer_mb_id: string | null; rate_snapshot: string;
        }[]>`
          SELECT cr.id, cr.referrer_id, rer.mb_id AS referrer_mb_id, cr.rate_snapshot
            FROM counselor_referral cr
            LEFT JOIN member rer ON rer.id = cr.referrer_id
           WHERE cr.referee_id = ${counselorId}
             AND cr.status = 'active'
             AND cr.expires_at > now()
           LIMIT 1
        `;
        if (refRows.length > 0) {
          const ref = refRows[0];
          const refRate = parseFloat(ref.rate_snapshot);
          const incentive = Math.floor(effectiveAmt * refRate);
          // 자기 자신 추천 방지 + 비율 유효성 + 양수만
          if (
            incentive > 0 &&
            Number.isFinite(refRate) && refRate > 0 && refRate < 1 &&
            Number(ref.referrer_id) !== Number(counselorId)
          ) {
            // 추천자 point row 보장
            await tx`
              INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
              VALUES (${ref.referrer_id}, 0, 0, 0, 0, 0)
              ON CONFLICT (member_id) DO NOTHING
            `;
            // 추천자 earning 적립 (FOR UPDATE 로 정확한 balance_after 산출)
            const refPt = await tx<{ earning_balance: number }[]>`
              SELECT earning_balance FROM point WHERE member_id = ${ref.referrer_id} FOR UPDATE
            `;
            const refAfter = Number(refPt[0].earning_balance) + incentive;
            const refIns = await tx<{ id: number }[]>`
              INSERT INTO point_history (
                member_id, mb_id, content, earn_point, use_point, balance_after,
                rel_table, rel_id, rel_action, is_paid, is_expired, expire_date, actor_type, balance_kind
              ) VALUES (
                ${ref.referrer_id}, ${ref.referrer_mb_id},
                ${`[추천수익금] 피추천 상담사 수익의 ${(refRate * 100).toFixed(2)}%`},
                ${incentive}, 0, ${refAfter},
                'consultation', ${String(consultationId)}, ${`${consultationId}@추천수익금적립`},
                false, false, NULL, 'system', 'earning'
              )
              ON CONFLICT (rel_table, rel_id, rel_action)
                WHERE rel_table IN ('payment','payment_autopay','consultation')
                DO NOTHING
              RETURNING id
            `;
            // 멱등 안전망 — 이미 처리된 상담이면 refIns 0건 → 적립/차감 모두 스킵
            if (refIns.length > 0) {
              await tx`
                UPDATE point SET
                  earning_balance = earning_balance + ${incentive},
                  total_earned    = total_earned + ${incentive},
                  updated_at      = now()
                 WHERE member_id = ${ref.referrer_id}
              `;
              // 피추천자(counselorId) earning 에서 차감 (제로섬)
              const refereePt = await tx<{ earning_balance: number }[]>`
                SELECT earning_balance FROM point WHERE member_id = ${counselorId} FOR UPDATE
              `;
              const refereeAfter = Math.max(0, Number(refereePt[0].earning_balance) - incentive);
              await tx`
                UPDATE point SET
                  earning_balance = GREATEST(earning_balance - ${incentive}, 0),
                  total_used      = total_used + ${incentive},
                  updated_at      = now()
                 WHERE member_id = ${counselorId}
              `;
              await tx`
                INSERT INTO point_history (
                  member_id, content, earn_point, use_point, balance_after,
                  rel_table, rel_id, rel_action, is_paid, is_expired, expire_date, actor_type, balance_kind
                ) VALUES (
                  ${counselorId}, ${`[추천수익금 차감] 추천 상담사에게 ${(refRate * 100).toFixed(2)}% 이전`},
                  0, ${incentive}, ${refereeAfter},
                  'consultation', ${String(consultationId)}, ${`${consultationId}@추천수익금차감`},
                  false, false, NULL, 'system', 'earning'
                )
                ON CONFLICT (rel_table, rel_id, rel_action)
                  WHERE rel_table IN ('payment','payment_autopay','consultation')
                  DO NOTHING
              `;
              this.logger.log(
                `[referral-realtime] consultation=${consultationId} referee=${counselorId} → referrer=${ref.referrer_id} incentive=${incentive} (rate=${refRate})`,
              );
            }
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      // m2net 측 상담사 회원 잔액 동기화용 — 상담사도 사용자처럼 회원으로 등록된 경우 csrid 사용
      const r = await tx<{ csrid: string | null }[]>`
        SELECT csrid FROM member WHERE id = ${counselorId} LIMIT 1
      `;
      return { applied: true, csrMembid: r[0]?.csrid ?? null };
  }

  /**
   * 상담사 적립 wrapper — 자체 트랜잭션 + 커밋 후 m2net 동기화.
   * settleChatRoomLocal 등 자체 트랜잭션이 필요한 곳에서 사용.
   */
  private async creditCounselorPoint(
    counselorId: number,
    amt: number,
    content: string,
    consultationId: number,
    relAction: string,
    isPaid: boolean,
    syncToM2net: boolean = true,
  ): Promise<void> {
    const result = await this.sql.begin(async (tx) =>
      this.creditCounselorPointInTx(tx, counselorId, amt, content, consultationId, relAction, isPaid),
    );

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
