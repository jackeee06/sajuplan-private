import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';
import { SmsService } from '../sms/sms.service';

export interface PhoneConsultResult {
  /** 사용자가 dial 해야 하는 대표번호 (선불=070, 후불=060) */
  phone_number: string;
  /** 통화 연결 후 입력할 상담사 번호 (csrid 또는 mb_no) */
  counselor_code: string;
  /** 'prepaid' | 'postpaid' */
  variant: 'prepaid' | 'postpaid';
}

export interface ChatConsultResult {
  /** 새로 생성됐거나 기존 채팅방 ID (DB PK) */
  chat_room_id: number;
  /** m2net 측 방 토큰 (wss URL 식별자, chat_room.roomid 와 동일) */
  roomid: string;
  /** 회원이 wss 접속 시 사용할 토큰 — `wss://{host}/wscp/{token}` */
  member_token: string;
  /** wss 베이스 URL (env M2NET_WSS_URL 또는 기본값) */
  wss_url: string;
  /** 재입장 여부 — true 면 기존 방 재사용, 처음 입장 시 false */
  is_rejoin: boolean;
}

/**
 * 전화/채팅 상담 시작 처리.
 *  - 전화: m2net etc-mgr/drconn 으로 발신자 휴대폰을 미리 등록(예약) → 사용자가 대표번호로 발신 시 자동으로 상담사에게 라우팅
 *  - 채팅: chat_room row 생성 (있으면 재사용) — 실제 메시징은 별도 채널
 */
@Injectable()
export class UserConsultService {
  private readonly logger = new Logger(UserConsultService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  /** wss 접속 베이스 URL — env 미설정 시 sample/chat_test/cn.php 와 동일한 기본값 */
  private wssUrl(): string {
    return (
      this.config.get<string>('M2NET_WSS_URL') ??
      'wss://passcall.co.kr:28729/wscp'
    ).replace(/\/$/, '');
  }

  /** 전화상담 시작 */
  async startPhone(params: {
    memberId: number;
    counselorId: number;
    variant: 'prepaid' | 'postpaid';
  }): Promise<PhoneConsultResult> {
    if (params.memberId === params.counselorId) {
      throw new BadRequestException('본인에게 상담을 요청할 수 없습니다.');
    }
    // 회원/상담사 정보 조회
    const meRows = await this.sql<{ phone: string | null }[]>`
      SELECT phone FROM member WHERE id = ${params.memberId} AND left_at IS NULL LIMIT 1
    `;
    const me = meRows[0];
    if (!me?.phone) {
      throw new BadRequestException('휴대폰 번호가 등록되어 있지 않습니다. 마이페이지 > 회원 정보 수정에서 추가해주세요.');
    }

    const csrRows = await this.sql<{
      id: number;
      nickname: string;
      csrid: string | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
    }[]>`
      SELECT id, nickname, csrid, state, use_phone, use_chat
        FROM member
       WHERE id = ${params.counselorId}
         AND role = 'counselor'
         AND left_at IS NULL
       LIMIT 1
    `;
    const csr = csrRows[0];
    if (!csr) {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }
    if (!csr.use_phone) {
      throw new ConflictException('해당 상담사는 전화상담을 운영하지 않습니다.');
    }
    if (!csr.csrid) {
      throw new BadRequestException('상담사가 외부 콜시스템에 등록되어 있지 않습니다. 잠시 후 다시 시도해주세요.');
    }
    if (csr.state === 'CONN' || csr.state === 'CNCH') {
      // stale 상태 자동 복구 — startChat 과 동일 로직 (orphan 보호)
      const active = await this.sql<{ id: number }[]>`
        SELECT 1 AS id FROM chat_room
         WHERE counselor_id = ${params.counselorId}
           AND status IN ('STAY', 'CNCH')
         LIMIT 1
        UNION ALL
        SELECT 1 AS id FROM consultation
         WHERE counselor_id = ${params.counselorId}
           AND ended_at IS NULL
           AND created_at > now() - interval '2 hours'
         LIMIT 1
      `;
      if (active.length === 0) {
        const target = csr.use_phone ? 'IDLE' : 'ABSE';
        await this.sql`UPDATE member SET state = ${target}, updated_at = now() WHERE id = ${params.counselorId}`;
        this.m2net.updateCounselorState(String(csr.csrid).padStart(5, '0'), target).catch(() => {});
        this.logger.warn(`[startPhone] stale ${csr.state} 복구 (counselorId=${params.counselorId}) → ${target}`);
        csr.state = target;
      } else {
        throw new ConflictException('현재 상담 중입니다. 잠시 후 다시 시도해주세요.');
      }
    }
    if (csr.state === 'ABSE' || csr.state === 'RESV') {
      throw new ConflictException('지금은 상담이 어렵습니다. 잠시 후 다시 시도해주세요.');
    }

    // 대표번호 조회 (selecting all consult.* settings — 한 번에)
    const settingsRows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'consult'
         AND key IN ('phone_prepaid', 'phone_postpaid')
    `;
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows) settingsMap[r.key] = r.value ?? '';
    const phoneNumber =
      params.variant === 'prepaid'
        ? settingsMap['phone_prepaid']
        : settingsMap['phone_postpaid'];
    if (!phoneNumber) {
      throw new BadRequestException('대표 전화번호가 설정되지 않았습니다. 관리자에게 문의해주세요.');
    }

    // sample(ajax.call_reserve.php) 은 drconn 직전 csrstat 을 호출하지 않는다.
    // 우리도 강제 동기화를 제거 — m2net 측 단말 등록 상태와 drconn 의 단말 매칭은
    // m2net 이 자체적으로 처리한다. (이전 csrstat preflight 가 오히려 상담사 단말
    // state 를 잘못된 값으로 덮어쓰는 사례가 의심됨 → 콜이 안 울리는 증상.)

    // m2net 에 발신자 → 상담사 라우팅 예약
    const m = await this.m2net.reserveDirectConnect({
      callerPhone: me.phone,
      counselorCsrid: csr.csrid,
    });
    if (!m.ok) {
      this.logger.warn(`[startPhone] m2net drconn 실패 — member=${params.memberId} counselor=${params.counselorId}: ${m.error}`);
      // m2net 의 raw resultmessage 는 운영자 관점의 메시지(예: "해당 csrid는 없는 아이디",
      // "등록된 단말 없음")라 사용자에게 그대로 노출하면 혼란스럽다. csrid/아이디 관련
      // 에러는 상담사 등록 이슈로 매핑하고, 그 외는 일반 안내 문구로 통일.
      const rawMsg =
        m.raw && typeof m.raw === 'object' && 'resultmessage' in m.raw
          ? String((m.raw as { resultmessage?: unknown }).resultmessage ?? '')
          : '';
      const looksLikeRegistrationIssue =
        /csrid|아이디|등록|단말|미등록/i.test(rawMsg) ||
        /csrid|registration|not\s*found/i.test(m.error ?? '');
      throw new ConflictException(
        looksLikeRegistrationIssue
          ? '연결이나 등록이 되어있지 않은 상담사입니다. 잠시 후 다시 시도하시거나 다른 상담사를 이용해주세요.'
          : '전화 연결 예약에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }

    return {
      phone_number: phoneNumber,
      counselor_code: csr.csrid,
      variant: params.variant,
    };
  }

  /**
   * 채팅상담 시작 — 규칙:
   *  - 진행 중(STAY/CNCH, ended_at IS NULL) 방이 있으면 그 방을 재사용 = **재입장**
   *  - 종료된(DISCONNECT 또는 ended_at NOT NULL) 방은 절대 재사용 안함 = 새 상담은 새 방
   *  - 더블클릭/재시도 멱등성은 위 활성-방 재사용 규칙 + sql.begin 트랜잭션으로 보장
   *  - m2net `chat-mgr csrchat` 호출로 진짜 roomid + membtoken 발급 (매뉴얼 §4.5).
   *    재입장 시에도 토큰은 1회용이므로 매번 새로 받는다.
   */
  async startChat(params: {
    memberId: number;
    counselorId: number;
    /** [2026-05-24] 사전 시간 선택 — 15/30/45/60 분.
     *  값이 들어오면 chat_room.alloc_seconds_member 를 그만큼만 배정.
     *  실제 차감은 사용한 시간 × 단가 (기존 정산 모델 그대로).
     *  값이 없으면 기존 "잔액 소진까지" 모드 — 하위 호환. */
    chargeMinutes?: number;
  }): Promise<ChatConsultResult> {
    if (params.memberId === params.counselorId) {
      throw new BadRequestException('본인에게 상담을 요청할 수 없습니다.');
    }
    // chargeMinutes 화이트리스트 검증
    // [2026-05-30] 1분 테스트 옵션 추가 — _PREPAID_CHAT_POLICY.md §1
    //   운영 시작 후 1분 제거 시 allowed = [15, 30, 45, 60] 으로 복귀.
    if (params.chargeMinutes != null) {
      const allowed = [1, 15, 30, 45, 60];
      if (!allowed.includes(params.chargeMinutes)) {
        throw new BadRequestException('상담 시간은 1/15/30/45/60분 중 하나여야 합니다.');
      }
    }

    // 2026-05-22 ID 단일화: 회원 m2net id 는 m2net_membid 컬럼 (csrid 는 상담사 전용)
    const meRows = await this.sql<{ m2net_membid: string | null; point: number }[]>`
      SELECT m2net_membid, point FROM member WHERE id = ${params.memberId} AND left_at IS NULL LIMIT 1
    `;
    const me = meRows[0];
    if (!me?.m2net_membid) {
      throw new BadRequestException(
        '채팅 시스템에 회원이 등록되어 있지 않습니다. 잠시 후 다시 시도해주세요.',
      );
    }
    const memberPoint = Number(me.point) || 0;

    const csrRows = await this.sql<{
      id: number;
      csrid: string | null;
      state: string;
      use_chat: boolean;
      use_phone: boolean;
      chat_unit_seconds: number | null;
      chat_unit_cost: number | null;
    }[]>`
      SELECT id, csrid, state, use_chat, use_phone, chat_unit_seconds, chat_unit_cost
        FROM member
       WHERE id = ${params.counselorId}
         AND role = 'counselor'
         AND left_at IS NULL
       LIMIT 1
    `;
    const csr = csrRows[0];
    if (!csr) throw new NotFoundException('상담사를 찾을 수 없습니다.');
    if (!csr.use_chat) {
      throw new ConflictException('해당 상담사는 채팅상담을 운영하지 않습니다.');
    }
    if (!csr.csrid) {
      throw new BadRequestException(
        '상담사가 외부 채팅 시스템에 등록되어 있지 않습니다. 잠시 후 다시 시도해주세요.',
      );
    }
    if (csr.state === 'CONN' || csr.state === 'CNCH') {
      // stale 상태 자동 복구 — m2net 푸시 지연으로 CNCH/CONN 가 풀리지 않은 케이스.
      // 실제 진행 중 chat_room/consultation 이 없으면 ready state 로 강제 복귀.
      const active = await this.sql<{ id: number }[]>`
        SELECT 1 AS id FROM chat_room
         WHERE counselor_id = ${params.counselorId}
           AND status IN ('STAY', 'CNCH')
         LIMIT 1
        UNION ALL
        SELECT 1 AS id FROM consultation
         WHERE counselor_id = ${params.counselorId}
           AND ended_at IS NULL
           AND created_at > now() - interval '2 hours'
         LIMIT 1
      `;
      if (active.length === 0) {
        // orphan 상태 — ready 로 복귀시키고 진행
        const target = csr.use_phone && csr.use_chat
          ? 'RDVC'
          : !csr.use_phone && csr.use_chat
            ? 'RDCH'
            : csr.use_phone && !csr.use_chat
              ? 'IDLE'
              : 'ABSE';
        await this.sql`UPDATE member SET state = ${target}, updated_at = now() WHERE id = ${params.counselorId}`;
        // m2net 측에도 알림 (실패해도 진행 — 본 흐름에 영향 없음)
        this.m2net.updateCounselorState(String(csr.csrid).padStart(5, '0'), target).catch(() => {});
        this.logger.warn(`[startChat] stale ${csr.state} 복구 (counselorId=${params.counselorId}) → ${target}`);
        csr.state = target;
      } else {
        throw new ConflictException('현재 상담 중입니다. 잠시 후 다시 시도해주세요.');
      }
    }
    if (csr.state === 'ABSE' || csr.state === 'RESV') {
      throw new ConflictException('지금은 상담이 어렵습니다. 잠시 후 다시 시도해주세요.');
    }

    // 단가 스냅샷 + 잔여시간 계산 — chat_room INSERT 에 채워야 tick 이 즉시 종료시키지 않는다.
    const unitSec = Number(csr.chat_unit_seconds) > 0 ? Number(csr.chat_unit_seconds) : 30;
    const unitCost = Number(csr.chat_unit_cost) > 0 ? Number(csr.chat_unit_cost) : 1500;

    // [2026-05-24] 시간 사전 선택 모델 — chargeMinutes 가 있으면 alloc 을 그만큼 제한,
    //   없으면 기존 "잔액 소진까지" 모드 (하위 호환).
    //   실제 차감은 사용한 시간 × 단가 (m2net 정산이 아닌 사주플랜 자체 use_seconds 기준).
    let allocSeconds: number;
    if (params.chargeMinutes) {
      const requiredCost = Math.ceil((params.chargeMinutes * 60) / unitSec) * unitCost;
      if (requiredCost > memberPoint) {
        throw new ConflictException(
          `${params.chargeMinutes}분 상담에는 ${requiredCost.toLocaleString()}코인이 필요합니다. 충전 후 다시 시도해주세요.`,
        );
      }
      allocSeconds = params.chargeMinutes * 60;
    } else {
      allocSeconds = unitCost > 0 ? Math.floor(memberPoint / unitCost) * unitSec : 0;
      if (allocSeconds < unitSec) {
        throw new ConflictException('포인트가 부족합니다. 충전 후 다시 시도해주세요.');
      }
    }

    // m2net 매뉴얼 §3.3 상태머신: csrchat 호출 전 상담사 m2net 측 상태가
    // RDCH(채팅가능) 또는 RDVC(전화+채팅 가능) 여야 한다. IDLE/CRDY 등 다른 상태에선
    // req_result=27 "채팅상담가능(RDCH)상태가 아님" 으로 거부됨.
    //
    // ⚠️ DB ↔ m2net 동기화 핵심 지점:
    //  - 사주플랜 DB(member.state) 가 RDCH/RDVC 라도 m2net 측이 CNCH/CONN 로 stale 일 수 있다.
    //    (반대 케이스도 발생 — 위쪽 stale 자동 복구에서 처리.)
    //  - 따라서 csrchat 호출 직전에 m2net 측 상태를 명시적으로 RDCH/RDVC 로 동기 push (await).
    //  - 실패 시 한 번 재시도 — 일시적 네트워크 오류 흡수.
    const memberMembid = String(me.m2net_membid).padStart(6, '0');
    const counselorCsrid = String(csr.csrid).padStart(5, '0');
    const chatTargetState = csr.use_phone ? 'RDVC' : 'RDCH';
    let preflight = await this.m2net.updateCounselorState(counselorCsrid, chatTargetState);
    if (!preflight.ok) {
      this.logger.warn(
        `[startChat] csrstat preflight 실패 (재시도) csrid=${counselorCsrid} target=${chatTargetState}: ${preflight.error ?? ''}`,
      );
      preflight = await this.m2net.updateCounselorState(counselorCsrid, chatTargetState);
      if (!preflight.ok) {
        this.logger.warn(
          `[startChat] csrstat preflight 재시도 실패 csrid=${counselorCsrid} target=${chatTargetState}: ${preflight.error ?? ''}`,
        );
      }
    }
    // 사주플랜 DB 측도 ready state 로 명시적 정렬 (선반영 제거 후의 추가 보장)
    await this.sql`
      UPDATE member
         SET state = ${chatTargetState}, updated_at = now()
       WHERE id = ${params.counselorId}
         AND state NOT IN ('CONN', 'CNCH')
    `.catch(() => { /* 동기화 보강 — 실패해도 본 흐름 진행 */ });
    const m = await this.m2net.createChatRoom({
      membid: memberMembid,
      csrid: counselorCsrid,
    });
    if (!m.ok || !m.roomid || !m.membtoken) {
      const rawMsg =
        m.raw && typeof m.raw === 'object' && 'resultmessage' in m.raw
          ? String((m.raw as { resultmessage?: unknown }).resultmessage ?? '')
          : '';
      this.logger.warn(
        `[startChat] m2net createChatRoom 실패 — member=${params.memberId}(membid=${memberMembid}) counselor=${params.counselorId}(csrid=${counselorCsrid}): err=${m.error} raw=${JSON.stringify(m.raw)}`,
      );
      // m2net 결과코드를 사용자 친화적 한글 메시지로 정규화.
      // 매뉴얼 §5 결과코드 + raw resultmessage 한글 키워드 패턴 매칭.
      const code = m.error?.match(/req_result=(\d+)/)?.[1];
      const userMsg = mapM2netErrorToKorean(code, rawMsg);
      throw new ConflictException(userMsg);
    }
    const m2netRoomid = m.roomid;
    const memberToken = m.membtoken;

    // 트랜잭션 내에서 활성 방 조회 → 있으면 재입장. 없으면 신규 INSERT.
    //
    // m2net 가 옛 roomid 를 재발급할 수 있어 종료된 chat_room 과 UNIQUE 충돌이 발생한다.
    // 충돌 시: 충돌 row 가 종료방이면 그 roomid 를 suffix 붙여 무효화하고 다시 INSERT,
    //         활성방이면 재입장(rejoin).
    const result = await this.sql.begin(async (tx) => {
      // 1) 본인의 활성 방 우선 조회 (m2net roomid 무관)
      const existing = await tx<{ id: number; roomid: string; rejoin_count: number }[]>`
        SELECT id, roomid, rejoin_count FROM chat_room
         WHERE member_id = ${params.memberId}
           AND counselor_id = ${params.counselorId}
           AND status <> 'DISCONNECT'
           AND ended_at IS NULL
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE
      `;
      if (existing[0]) {
        // 재입장 시에도 단가/잔여 스냅샷 갱신 (충전 반영)
        // [엄격검증 5차 fix 2026-05-27] 재입장 시 alloc 가 GREATEST 로 증가 가능 → five_min_alert_sent_at reset
        //   (현재 alloc < 신규 allocSeconds 면 잔여 증가 → 다음 5분 진입 시 재발화 필요)
        await tx`
          UPDATE chat_room
             SET rejoin = TRUE,
                 rejoin_count = rejoin_count + 1,
                 rejoin_last_at = now(),
                 unit_seconds = ${unitSec},
                 unit_cost = ${unitCost},
                 alloc_seconds_member = GREATEST(alloc_seconds_member, ${allocSeconds}),
                 alloc_seconds_counselor = GREATEST(alloc_seconds_counselor, ${allocSeconds}),
                 snapshot_member_point = ${memberPoint},
                 five_min_alert_sent_at = CASE
                   WHEN ${allocSeconds}::int > alloc_seconds_member THEN NULL
                   ELSE five_min_alert_sent_at
                 END
           WHERE id = ${existing[0].id}
        `;
        // 재입장 — chat_room.roomid 는 절대 덮어쓰지 않는다. m2net 이 새 roomid 를 발급하더라도
        // m2net-push (START_CHAT/END_CHAT) 와 자체 DB 가 같은 키로 라우팅돼야 메시지 동기화가 깨지지 않는다.
        // chat.service.getRoom 의 동일 주석 참조.
        if (existing[0].roomid !== m2netRoomid) {
          this.logger.warn(
            `[startChat rejoin] m2net csrchat 응답 roomid=${m2netRoomid} 가 DB roomid=${existing[0].roomid} 와 다름 — DB 유지`,
          );
        }
        return { chat_room_id: existing[0].id, is_rejoin: true };
      }

      // 2) 신규 INSERT. roomid 충돌 시 → 충돌 row 가 종료방이면 무효화 후 재시도, 활성이면 rejoin.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const inserted = await tx<{ id: number }[]>`
            INSERT INTO chat_room (
              member_id, counselor_id, csrid, roomid, status, started_at,
              unit_seconds, unit_cost,
              alloc_seconds_member, alloc_seconds_counselor,
              snapshot_member_point,
              charge_minutes
            ) VALUES (
              ${params.memberId}, ${params.counselorId}, ${csr.csrid ?? ''}, ${m2netRoomid}, 'STAY', now(),
              ${unitSec}, ${unitCost},
              ${allocSeconds}, ${allocSeconds},
              ${memberPoint},
              ${params.chargeMinutes ?? null}
            )
            RETURNING id
          `;
          return { chat_room_id: inserted[0].id, is_rejoin: false };
        } catch (e) {
          // UNIQUE 충돌 케이스만 처리, 그 외 예외는 그대로 throw
          if (!(e instanceof Error) || !/duplicate key/i.test(e.message)) throw e;
          const conflict = await tx<{ id: number; status: string }[]>`
            SELECT id, status FROM chat_room WHERE roomid = ${m2netRoomid} LIMIT 1
          `;
          if (!conflict[0]) throw e;
          if (conflict[0].status === 'DISCONNECT') {
            // 종료방 → roomid 무효화 후 다시 INSERT 시도
            await tx`
              UPDATE chat_room SET roomid = roomid || '__c_' || id WHERE id = ${conflict[0].id}
            `;
            continue;
          }
          // 활성 방 (다른 회원/상담사 조합으로 사용중) — rejoin 처리
          await tx`
            UPDATE chat_room
               SET rejoin = TRUE, rejoin_count = rejoin_count + 1, rejoin_last_at = now()
             WHERE id = ${conflict[0].id}
          `;
          return { chat_room_id: conflict[0].id, is_rejoin: true };
        }
      }
      throw new ConflictException('채팅방 생성 중 충돌이 반복되었습니다. 잠시 후 다시 시도해주세요.');
    });

    // ⚠️ 상담사 상태 'CNCH'(채팅상담중) 마킹은 여기서 하지 않는다.
    //
    // 회원이 채팅 시작을 "요청"한 시점일 뿐, 상담사가 실제로 채팅방에 입장한 것이 아니기 때문이다.
    // 상담사가 입장하기 전에 DB/m2net 양쪽을 CNCH 로 바꿔버리면:
    //  - 다른 회원의 '상담가능' 목록에서 사라져 영업 손실
    //  - m2net 측은 RDCH/RDVC 상태인데 사주플랜 DB 만 CNCH 라 동기화 깨짐
    //  - 상담사가 입장 거부/지연해도 영원히 CNCH 잠금
    //
    // 따라서 chat_room.status='STAY' 로만 두고, 상담사가 실제로 채팅방에 들어왔다는
    // m2net 의 START_CHAT push 가 도착했을 때 m2net-push.service 가
    // member.state='CNCH' + chat_room.status='CNCH' 로 동기 전환한다.
    // (재입장 케이스 — 이미 status='CNCH' 인 방 — 는 그대로 둔다.)

    // 채팅방 신규 개설 시 상담사에게 BizM 알림톡 발송 (sample 의 ajax.send_chat 동등).
    // 템플릿: chat_request_to_counselor  변수: 상담사닉네임 / url
    // (2026-05-23: 옛 chat_counseling2 에서 교체. notifyCounselorChatRequest 참조)
    // 버튼 url 은 채팅방 직접 진입 경로 (chat/{chat_room_id}). 비로그인이면 ChatRoom 컴포넌트가
    // /login?redirect=/chat/{id} 로 자동 라우팅 (가드 처리).
    // 재입장(is_rejoin=true) 케이스는 발송하지 않는다 — 이미 진행 중인 방.
    // void 로 띄워 응답 지연이 발생해도 채팅 시작 자체가 막히지 않도록.
    if (!result.is_rejoin) {
      void this.notifyCounselorChatRequest(params.counselorId, result.chat_room_id).catch((e) => {
        this.logger.warn(
          `[startChat] 상담사 알림톡 발송 실패 counselorId=${params.counselorId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }

    return {
      chat_room_id: result.chat_room_id,
      roomid: m2netRoomid,
      member_token: memberToken,
      wss_url: this.wssUrl(),
      is_rejoin: result.is_rejoin,
    };
  }

  /**
   * 상담사 BizM 알림톡 — "채팅 상담방 개설" 안내.
   * 템플릿: chat_counseling2 (BizM 콘솔 승인)
   *   ※ 사주플랜 긴급 상담 참여 요청 ※
   *   #{상담사명}님, 고객이 채팅 상담 입장을 기다리고 있습니다.
   *   지금 바로 상담에 참여해 주세요.
   *   ※ 상담 연결이 늦어지면 고객 연결이 자동 취소될 수 있습니다.
   */
  private async notifyCounselorChatRequest(
    counselorId: number,
    chatRoomId: number,
  ): Promise<void> {
    const rows = await this.sql<{ phone: string | null; nickname: string | null; name: string | null }[]>`
      SELECT phone, nickname, name FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const csr = rows[0];
    if (!csr || !csr.phone) {
      this.logger.warn(`[notifyCounselorChatRequest] 상담사 휴대폰 없음 counselorId=${counselorId}`);
      return;
    }
    const displayName = (csr.nickname || csr.name || '상담사').trim();
    // [2026-05-23] BizM 신규 템플릿 chat_request_to_counselor 사용:
    //   [ 사주플랜 ] 채팅 상담 요청
    //   #{상담사닉네임} 선생님께 새로운 채팅 상담이 들어왔어요.
    //   3분 안에 채팅방으로 입장하지 않으시면 해당 요청은 자동으로 종료됩니다.
    // 버튼 url 은 채팅방 직접 진입 경로 (ChatRoom 가 비로그인 시 자동 redirect).
    const r = await this.sms.sendAlimtalkByCode(
      'chat_request_to_counselor',
      csr.phone,
      { 상담사닉네임: displayName, url: `chat/${chatRoomId}` },
      '채팅 상담 요청 알림',
    );
    if (!r.ok) {
      this.logger.warn(
        `[notifyCounselorChatRequest] BizM 발송 실패 counselorId=${counselorId} reason=${r.reason}`,
      );
    }
  }

  /**
   * [2026-05-23] 상담사 미입장 채팅방 자동 취소.
   *
   * 조건: chat_room.status='STAY' (상담사 미입장) 이면서
   *       created_at < NOW() - 3분 인 채팅방을 모두 자동 종료.
   *
   * 처리:
   *   1) chat_room.status = 'DISCONNECT' + ended_at = now() 마킹
   *   2) 회원에게 카톡 안내 알림톡 발송 (chat_auto_cancelled)
   *   3) m2net 측 채팅방은 별도 END 콜백이 없어도 무방 — 사용 시간 0 이므로 차감 발생 X
   *
   * 호출: 매 1분마다 GET /api/cron/chat/auto-cancel?token=... 가 호출.
   *       사용 시간 = 0 이라 회원 차감/상담사 적립 모두 0 (사주플랜 결제 모델: 사용 시간 기반).
   */
  async autoCancelStaleChats(): Promise<{ cancelled: number; details: Array<{ roomId: number; memberId: number; counselorId: number }> }> {
    // 3분 이상 상담사 미입장 STAY 방
    const stale = await this.sql<{
      id: number;
      member_id: number;
      counselor_id: number;
      roomid: string | null;
    }[]>`
      SELECT id, member_id, counselor_id, roomid
        FROM chat_room
       WHERE status = 'STAY'
         AND started_at < NOW() - INTERVAL '3 minutes'
       ORDER BY id
       LIMIT 50
    `;

    const details: Array<{ roomId: number; memberId: number; counselorId: number }> = [];
    for (const r of stale) {
      try {
        // 1) 채팅방 종료 마킹
        await this.sql`
          UPDATE chat_room
             SET status = 'DISCONNECT',
                 ended_at = NOW()
           WHERE id = ${r.id} AND status = 'STAY'
        `;
        // 2) 회원에게 카톡 안내 발송 (실패해도 진행)
        void this.notifyMemberChatAutoCancelled(r.member_id, r.counselor_id).catch((e) => {
          this.logger.warn(
            `[autoCancelStaleChats] 회원 알림 실패 chatRoomId=${r.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
        // 3) [2026-05-29 추가] 상담사에게도 알림톡 — "회원 요청 무응답으로 자동 취소" 인지용.
        //    템플릿: counselor_state_changed_v2 (BizM 콘솔 이미 승인됨, 그동안 코드 호출 0건)
        //    사장님 정책 C안 (2026-05-29): chat_auto_cancelled(회원) + counselor_auto_absent(상담사) 둘 다 필요.
        //    state 자동 전환은 m2net csrstat 충돌 위험으로 안 함 — 알림만.
        void this.notifyCounselorAutoAbsent(r.counselor_id, r.member_id).catch((e) => {
          this.logger.warn(
            `[autoCancelStaleChats] 상담사 알림 실패 chatRoomId=${r.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
        details.push({ roomId: r.id, memberId: r.member_id, counselorId: r.counselor_id });
        this.logger.log(`[autoCancelStaleChats] 자동 취소 chatRoomId=${r.id} member=${r.member_id} counselor=${r.counselor_id}`);
      } catch (e) {
        this.logger.warn(`[autoCancelStaleChats] 실패 chatRoomId=${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { cancelled: details.length, details };
  }

  /**
   * [2026-05-23] 상담사 글로벌 polling — 들어온 채팅 요청(STAY 방) 목록.
   *
   *   사주플랜 앱이 백그라운드/다른 화면이어도 즉시 모달로 알림 띄우기 위한 글로벌 polling.
   *   응답 시간 최소화 — counselor_id + status='STAY' 인덱스 활용.
   *   가장 오래 기다린 (started_at ASC) 방 우선 정렬.
   */
  async listIncomingChats(counselorId: number): Promise<{
    items: Array<{
      chat_room_id: number;
      member_id: number;
      member_nickname: string | null;
      member_name: string | null;
      started_at: string;
      waited_seconds: number;
    }>;
  }> {
    const rows = await this.sql<{
      chat_room_id: number;
      member_id: number;
      member_nickname: string | null;
      member_name: string | null;
      started_at: Date;
      waited_seconds: number;
    }[]>`
      SELECT cr.id AS chat_room_id,
             cr.member_id,
             m.nickname AS member_nickname,
             m.name AS member_name,
             cr.started_at,
             EXTRACT(EPOCH FROM (NOW() - cr.started_at))::int AS waited_seconds
        FROM chat_room cr
        LEFT JOIN member m ON m.id = cr.member_id
       WHERE cr.counselor_id = ${counselorId}
         AND cr.status = 'STAY'
       ORDER BY cr.started_at ASC
       LIMIT 10
    `;
    return {
      items: rows.map((r) => ({
        chat_room_id: Number(r.chat_room_id),
        member_id: Number(r.member_id),
        member_nickname: r.member_nickname,
        member_name: r.member_name,
        started_at: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
        waited_seconds: Number(r.waited_seconds),
      })),
    };
  }

  /**
   * 회원에게 채팅 자동 취소 안내 알림톡 발송.
   * 템플릿: chat_auto_cancelled_to_member (BizM 콘솔 신규 등록 필요)
   */
  private async notifyMemberChatAutoCancelled(memberId: number, counselorId: number): Promise<void> {
    const rows = await this.sql<{ phone: string | null; nickname: string | null; name: string | null }[]>`
      SELECT phone, nickname, name FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const mb = rows[0];
    if (!mb || !mb.phone) return;
    const csrRows = await this.sql<{ nickname: string | null; name: string | null }[]>`
      SELECT nickname, name FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const counselorName = (csrRows[0]?.nickname || csrRows[0]?.name || '상담사').trim();
    const r = await this.sms.sendAlimtalkByCode(
      'chat_auto_cancelled_to_member',
      mb.phone,
      { 상담사닉네임: counselorName },
      '채팅 상담 요청 자동 취소',
    );
    if (!r.ok) {
      this.logger.warn(
        `[notifyMemberChatAutoCancelled] BizM 발송 실패 memberId=${memberId} reason=${r.reason}`,
      );
    }
  }

  /**
   * [2026-05-29] 상담사에게 회원 요청 자동 취소 안내 알림톡.
   * 사장님 정책 C안 — chat_auto_cancelled (회원 알림) + counselor_auto_absent (상담사 알림) 둘 다 필요.
   *
   * 템플릿: counselor_state_changed_v2 (BizM 콘솔 이미 승인됨)
   *   ※ 사주플랜 상담 부재 안내 ※
   *   #{상담사명}님, 고객 상담 요청 후 전화 연결을 시도했으나 응답이 없어...
   *
   * 변수: 상담사명
   * state 자동 전환은 m2net csrstat 충돌 위험으로 안 함 (알림만 발송).
   */
  private async notifyCounselorAutoAbsent(counselorId: number, _memberId: number): Promise<void> {
    const rows = await this.sql<{ phone: string | null; nickname: string | null; name: string | null }[]>`
      SELECT phone, nickname, name FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const csr = rows[0];
    if (!csr?.phone) {
      this.logger.warn(`[notifyCounselorAutoAbsent] 상담사 phone 없음 counselorId=${counselorId}`);
      return;
    }
    const displayName = (csr.nickname || csr.name || '상담사').trim();
    const r = await this.sms.sendAlimtalkByCode(
      'counselor_state_changed_v2',
      csr.phone,
      { 상담사명: displayName },
      '상담 부재 안내',
    );
    if (!r.ok) {
      this.logger.warn(
        `[notifyCounselorAutoAbsent] BizM 발송 실패 counselorId=${counselorId} reason=${r.reason}`,
      );
    }
  }

  // ============================================================
  // 통합 상담내역 (sample/my/history.php 동등)
  //
  //  - 본인 회원의 종료된(DISCONNECT/END_CHAT) consultation 만 조회.
  //  - 전화/채팅 통합. type='call' 이면 roomid IS NULL, type='chat' 이면 roomid 있음.
  //  - 각 row 에 review_id 동봉 → "후기 작성하기" 또는 "후기 보러가기" 분기.
  // ============================================================
  async history(params: {
    memberId: number;
    page?: number;
    limit?: number;
    type?: 'all' | 'call' | 'chat';
    /** 'counselor' 면 counselor_id = me 기준, 그 외엔 member_id = me 기준. */
    role?: 'member' | 'counselor';
  }): Promise<{
    items: ConsultHistoryItem[];
    total: number;
    page: number;
    limit: number;
    /** 반대 역할(회원↔상담사) 시점의 데이터 건수 — 0 이면 안내 비노출 */
    other_role_count: number;
  }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 10)));
    const offset = (page - 1) * limit;
    const t = params.type ?? 'all';
    const isCounselor = params.role === 'counselor';

    const typeFilter =
      t === 'call'
        ? this.sql`AND (c.roomid IS NULL OR c.roomid = '')`
        : t === 'chat'
        ? this.sql`AND c.roomid IS NOT NULL AND c.roomid <> ''`
        : this.sql``;

    type Row = {
      kind: 'ended' | 'active_chat';
      id: number;
      chat_room_id: number | null;
      chat_status: string | null;
      reason: string | null;
      usetm: number;
      amt: number;
      roomid: string | null;
      started_at: Date | null;
      ended_at: Date | null;
      created_at: Date | null;
      /** member 시점에선 상담사 정보, counselor 시점에선 회원 정보를 담는다. */
      counselor_id: number | null;
      counselor_name: string | null;
      counselor_nickname: string | null;
      counselor_code: string | null;
      counselor_profile_image: string | null;
      counselor_profile_image_webp: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      specialty: string | null;
      review_id: number | null;
      /** counselor 시점 — 상담사가 작성한 답변 id (없으면 null) */
      reply_id: number | null;
      sort_at: Date | null;
      total: string;
    };

    // call 탭이면 active chat 행은 자동 제외, chat/전체면 포함.
    const includeActiveChats = t !== 'call';

    // role 별 owner / peer 컬럼 결정.
    //  - member 시점: owner=member_id, peer=counselor_id (peer 가 상담사 → 뱃지/코드 노출)
    //  - counselor 시점: owner=counselor_id, peer=member_id (peer 가 회원)
    const ownerCol = isCounselor ? this.sql`counselor_id` : this.sql`member_id`;
    const peerCol = isCounselor ? this.sql`member_id` : this.sql`counselor_id`;
    const activeOwnerCol = isCounselor ? this.sql`counselor_id` : this.sql`member_id`;
    const activePeerCol = isCounselor ? this.sql`member_id` : this.sql`counselor_id`;

    // review 매칭: chat_room 종료 후 작성된 회원 후기 1건 (review.member_id = 상담받은 회원).
    // counselor 시점이라도 후기는 회원(member_id) 이 작성한 것이므로 peer 가 회원 = 상담의 member_id.
    // 단순화: review 매칭은 (member_id, counselor_id) 쌍 + created_at 기준으로 동일하게 유지.
    // counselor 시점에서는 추가로 본인이 작성한 답변(reply_id) 도 LATERAL 로 함께 끌어온다.
    const replyJoin = isCounselor
      ? this.sql`
          LEFT JOIN LATERAL (
            SELECT id FROM post_review_reply
             WHERE post_review_reply.review_id = pr.id
               AND post_review_reply.counselor_id = ${params.memberId}
             LIMIT 1
          ) rep ON TRUE
        `
      : this.sql``;
    const replySelect = isCounselor
      ? this.sql`rep.id AS reply_id,`
      : this.sql`NULL::bigint AS reply_id,`;
    const replySelectActive = this.sql`NULL::bigint AS reply_id,`;

    // 진행 중 방은 is_member_deleted 무시 — 사용자가 우연히 "삭제" 눌렀어도 재입장
    // 경로가 살아있어야 정산이 정상 동작한다. (정산이 완료된 종료 상담만 삭제 의미 있음)
    const activeChatBranch = includeActiveChats
      ? this.sql`
          UNION ALL
          SELECT
                 'active_chat'::text         AS kind,
                 cr.id                        AS id,
                 cr.id                        AS chat_room_id,
                 cr.status                    AS chat_status,
                 NULL::varchar                AS reason,
                 cr.use_seconds               AS usetm,
                 0                            AS amt,
                 cr.roomid                    AS roomid,
                 cr.started_at                AS started_at,
                 NULL::timestamptz            AS ended_at,
                 cr.started_at                AS created_at,
                 pm.id                        AS counselor_id,
                 pm.name                      AS counselor_name,
                 pm.nickname                  AS counselor_nickname,
                 pm.csrid                     AS counselor_code,
                 (SELECT mf.stored_name      FROM member_file mf
                   WHERE mf.member_id = pm.id AND mf.kind = 'profile'
                   ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
                 (SELECT mf.stored_name_webp FROM member_file mf
                   WHERE mf.member_id = pm.id AND mf.kind = 'profile'
                   ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image_webp,
                 pc.hashtag1, pc.hashtag2, pc.specialty,
                 NULL::bigint                 AS review_id,
                 ${replySelectActive}
                 COALESCE(cr.started_at, now()) AS sort_at
            FROM chat_room cr
            LEFT JOIN member pm           ON pm.id = cr.${activePeerCol}
            LEFT JOIN post_counselor pc   ON pc.member_id = pm.id
           WHERE cr.${activeOwnerCol} = ${params.memberId}
             AND cr.status IN ('STAY', 'CNCH')
        `
      : this.sql``;

    // sample/my/history.php 와 동일하게 reason 으로 종료건만 필터.
    // post_review 와 LEFT JOIN 해서 후기 존재 여부도 한 번에 가져옴.
    // 추가: 진행 중(STAY/CNCH) chat_room 은 active_chat 행으로 UNION — 후기/완료 카드 대신 "채팅방 입장하기" 노출.
    const rows = await this.sql<Row[]>`
      WITH unioned AS (
        SELECT
               'ended'::text                AS kind,
               c.id                          AS id,
               cr.id                         AS chat_room_id,
               cr.status                     AS chat_status,
               c.reason                      AS reason,
               c.usetm                       AS usetm,
               c.amt                         AS amt,
               c.roomid                      AS roomid,
               c.started_at                  AS started_at,
               c.ended_at                    AS ended_at,
               c.created_at                  AS created_at,
               pm.id                         AS counselor_id,
               pm.name                       AS counselor_name,
               pm.nickname                   AS counselor_nickname,
               pm.csrid                      AS counselor_code,
               (SELECT mf.stored_name      FROM member_file mf
                 WHERE mf.member_id = pm.id AND mf.kind = 'profile'
                 ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
               (SELECT mf.stored_name_webp FROM member_file mf
                 WHERE mf.member_id = pm.id AND mf.kind = 'profile'
                 ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image_webp,
               pc.hashtag1, pc.hashtag2, pc.specialty,
               pr.id                         AS review_id,
               ${replySelect}
               c.created_at                  AS sort_at
          FROM consultation c
          LEFT JOIN member pm           ON pm.id = c.${peerCol}
          LEFT JOIN post_counselor pc   ON pc.member_id = c.counselor_id
          -- chat_room.roomid 는 종료 시 __c_id suffix 가 붙고 consultation.roomid 는
          -- m2net push 시점의 원본을 그대로 갖는 경우가 있어, suffix 를 정규화한 base
          -- roomid 로 매칭한다. 매칭 안 되면 (member, counselor, started_at) 근사 매칭으로 폴백.
          -- 같은 base roomid 로 여러 chat_room 이 있을 수 있어 LATERAL 로 1건만 선택.
          LEFT JOIN LATERAL (
            SELECT cr2.id, cr2.status, cr2.roomid
              FROM chat_room cr2
             WHERE c.roomid IS NOT NULL AND c.roomid <> ''
               AND (
                 regexp_replace(cr2.roomid, '__c_\d+$', '') = regexp_replace(c.roomid, '__c_\d+$', '')
                 OR (
                   cr2.member_id = c.member_id
                   AND cr2.counselor_id = c.counselor_id
                   AND cr2.started_at = c.started_at
                 )
               )
             ORDER BY cr2.id DESC
             LIMIT 1
          ) cr ON TRUE
          LEFT JOIN LATERAL (
            -- 1순위: extras.consultation_id 로 정확 매칭 (현행 작성 경로가 항상 저장).
            -- 폴백: (member_id, counselor_id) + 종료 후 + extras.consultation_id 미보유 인 후기만
            --       시간 순으로 1건. 같은 상담사에게 여러 번 상담받았더라도, 이미 다른 상담에
            --       매칭된 후기는 제외되어 카드별 review_id 가 중복되지 않는다.
            SELECT id FROM post_review
             WHERE post_review.member_id = c.member_id
               AND post_review.counselor_id = c.counselor_id
               AND (
                 (
                   (post_review.extras ->> 'consultation_id') ~ '^[0-9]+$'
                   AND (post_review.extras ->> 'consultation_id')::bigint = c.id
                 )
                 OR (
                   (post_review.extras ->> 'consultation_id') IS NULL
                   AND post_review.created_at >= COALESCE(c.ended_at, c.created_at)
                   AND NOT EXISTS (
                     SELECT 1 FROM consultation c2
                      WHERE c2.member_id = c.member_id
                        AND c2.counselor_id = c.counselor_id
                        AND c2.id <> c.id
                        AND c2.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
                        AND COALESCE(c2.ended_at, c2.created_at)
                              BETWEEN COALESCE(c.ended_at, c.created_at)
                                  AND post_review.created_at
                   )
                 )
               )
             ORDER BY
               -- 정확 매칭이 우선
               CASE
                 WHEN (post_review.extras ->> 'consultation_id') ~ '^[0-9]+$'
                  AND (post_review.extras ->> 'consultation_id')::bigint = c.id THEN 0
                 ELSE 1
               END,
               post_review.id ASC
             LIMIT 1
          ) pr ON TRUE
          ${replyJoin}
         WHERE c.${ownerCol} = ${params.memberId}
           AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
           AND c.counselor_id IS NOT NULL
           -- 같은 상대와의 채팅방이 아직 진행 중(STAY/CNCH) 이면 ended 카드는 표시하지 않는다.
           -- 진행 중 방은 active_chat 분기로만 "채팅방 재입장하기" 카드 1개만 노출.
           -- 후기 작성하기는 채팅방이 완전히 종료된 후에만 가능해야 함.
           AND NOT EXISTS (
             SELECT 1 FROM chat_room cra
              WHERE cra.${activeOwnerCol} = ${params.memberId}
                AND cra.${activePeerCol} = c.${peerCol}
                AND cra.status IN ('STAY', 'CNCH')
           )
           ${typeFilter}
        ${activeChatBranch}
      )
      SELECT *, COUNT(*) OVER ()::text AS total
        FROM unioned
       ORDER BY
         -- 진행 중(채팅방 입장 대기) 카드는 항상 목록 끝으로.
         -- 종료된 상담을 시간 역순으로 우선 노출하고, 대기 중인 방은 그 뒤에 배치.
         CASE WHEN kind = 'active_chat' THEN 1 ELSE 0 END ASC,
         sort_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    const items: ConsultHistoryItem[] = rows.map((r) => {
      const isActiveChat = r.kind === 'active_chat';
      const isChat = isActiveChat || !!(r.roomid && r.roomid.trim().length > 0);
      const startedAt = r.started_at ?? r.created_at;
      const endedAt = r.ended_at;
      return {
        id: r.id,
        consult_type: isChat ? 'chat' : 'call',
        consult_type_label: isChat ? '채팅상담' : '전화상담',
        started_at: startedAt instanceof Date ? startedAt.toISOString() : startedAt,
        ended_at: endedAt instanceof Date ? endedAt.toISOString() : endedAt,
        usetm_seconds: Number(r.usetm) || 0,
        usetm_label: formatUsetm(Number(r.usetm) || 0),
        amt: Number(r.amt) || 0,
        counselor_id: r.counselor_id,
        counselor_name: r.counselor_nickname || r.counselor_name || '상담사',
        counselor_code: r.counselor_code,
        counselor_avatar: r.counselor_profile_image
          ? `/uploads/member/${r.counselor_profile_image}`
          : null,
        counselor_avatar_webp: r.counselor_profile_image_webp
          ? `/uploads/member/${r.counselor_profile_image_webp}`
          : null,
        counselor_badge: inferBadge(r.specialty, r.hashtag1, r.hashtag2),
        review_id: r.review_id,
        reply_id: r.reply_id ?? null,
        chat_room_id: r.chat_room_id ? Number(r.chat_room_id) : null,
        chat_status: r.chat_status,
        is_active_chat: isActiveChat,
      };
    });

    // [2026-05-24] 동시 역할자(회원+상담사) 안내 — 반대 시점에 데이터가 있는지 항상 카운트.
    //   total 과 무관하게 항상 계산 (사장님 케이스처럼 본인 시점에 1건만 있어도 반대 시점에
    //   더 많은 데이터가 있을 수 있음). 일반 회원은 본인이 counselor_id 인 row 가 없어
    //   other_role_count = 0 → 안내 절대 노출 X (상담사 브랜드 신뢰 보호).
    const otherOwnerCol = isCounselor ? this.sql`member_id` : this.sql`counselor_id`;
    const otherCount = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
        FROM consultation c
       WHERE c.${otherOwnerCol} = ${params.memberId}
         AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
    `;
    const other_role_count = Number(otherCount[0]?.cnt ?? 0);

    return { items, total, page, limit, other_role_count };
  }

  // ─────────────────────────────────────────────
  // 상담 메모 (상담사 전용) — sample c_history 동등
  // ─────────────────────────────────────────────

  /** GET — 본인이 상담사인 consultation 의 메모 조회 + 상담 헤더 정보 */
  async getMemo(params: { counselorId: number; consultationId: number }): Promise<{
    consultation: {
      id: number;
      member_name: string;
      started_at: string | null;
      ended_at: string | null;
      amt: number;
      reason: string;
      is_chat: boolean;
    } | null;
    memo: { category: string | null; topic: string | null; memo: string | null } | null;
  }> {
    const rows = await this.sql<{
      id: number;
      counselor_id: number | null;
      member_id: number | null;
      member_name: string | null;
      started_at: Date | null;
      ended_at: Date | null;
      amt: number;
      reason: string | null;
      roomid: string | null;
    }[]>`
      SELECT c.id, c.counselor_id, c.member_id, m.name AS member_name,
             c.started_at, c.ended_at, c.amt, c.reason, c.roomid
        FROM consultation c
        LEFT JOIN member m ON m.id = c.member_id
       WHERE c.id = ${params.consultationId}
       LIMIT 1
    `;
    const c = rows[0];
    if (!c) return { consultation: null, memo: null };
    if (Number(c.counselor_id) !== params.counselorId) {
      // 본인 상담이 아니면 403 대신 null 반환 (정보 노출 방지)
      return { consultation: null, memo: null };
    }
    const memoRows = await this.sql<{ category: string | null; topic: string | null; memo: string | null }[]>`
      SELECT category, topic, memo
        FROM consult_memo
       WHERE consultation_id = ${params.consultationId}
       LIMIT 1
    `;
    return {
      consultation: {
        id: c.id,
        member_name: c.member_name ?? '회원',
        started_at: c.started_at?.toISOString() ?? null,
        ended_at: c.ended_at?.toISOString() ?? null,
        amt: Number(c.amt) || 0,
        reason: c.reason ?? '',
        is_chat: c.reason === 'END_CHAT' || c.reason === 'END_CHAT_LOCAL' || !!c.roomid,
      },
      memo: memoRows[0] ?? null,
    };
  }

  /** POST — UPSERT 메모 (본인 상담만 작성 가능). */
  async upsertMemo(params: {
    counselorId: number;
    consultationId: number;
    category: string | null;
    topic: string | null;
    memo: string | null;
  }): Promise<{ ok: true }> {
    const check = await this.sql<{ counselor_id: number | null }[]>`
      SELECT counselor_id FROM consultation WHERE id = ${params.consultationId} LIMIT 1
    `;
    if (!check[0]) {
      throw new BadRequestException('상담 정보가 없습니다.');
    }
    if (Number(check[0].counselor_id) !== params.counselorId) {
      throw new BadRequestException('본인 상담만 메모를 작성할 수 있습니다.');
    }
    const cat = params.category ? params.category.slice(0, 50) : null;
    const topic = params.topic ? params.topic.slice(0, 50) : null;
    const memo = params.memo ?? null;
    await this.sql`
      INSERT INTO consult_memo (consultation_id, counselor_id, category, topic, memo, created_at, updated_at)
      VALUES (${params.consultationId}, ${params.counselorId}, ${cat}, ${topic}, ${memo}, now(), now())
      ON CONFLICT (consultation_id) DO UPDATE
         SET category = EXCLUDED.category,
             topic    = EXCLUDED.topic,
             memo     = EXCLUDED.memo,
             updated_at = now()
    `;
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // 상담사 "나의 상담 통계" — 기간별 집계 + 상세 리스트
  //   - 집계: 상담건/부재건/상담시간 + 파생지표(평균/일평균/부재율)
  //   - 분류: reason='DISCONNECT' → call, reason in ('END_CHAT','END_CHAT_LOCAL') → chat
  //   - 부재: is_absent_disconnect = true
  // ─────────────────────────────────────────────
  async myStats(params: {
    counselorId: number;
    from: string;  // YYYY-MM-DD (포함)
    to: string;    // YYYY-MM-DD (포함, 종일)
    type?: 'all' | 'call' | 'chat';
    page?: number;
    limit?: number;
  }): Promise<ConsultMyStats> {
    const type = params.type ?? 'all';
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    // [from, to+1day) 구간으로 종일 포함.
    const fromTs = `${params.from} 00:00:00+09`;
    const toTsExcl = `${params.to} 00:00:00+09`;
    const typeWhere =
      type === 'call'
        ? this.sql`AND reason = 'DISCONNECT'`
        : type === 'chat'
          ? this.sql`AND reason IN ('END_CHAT','END_CHAT_LOCAL')`
          : this.sql`AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')`;

    // 집계 1쿼리 (filtered count) + 리스트 1쿼리 — 병렬.
    const [aggRows, items] = await Promise.all([
      this.sql<
        {
          total_count: string;
          missed_count: string;
          total_seconds: string;
        }[]
      >`
        SELECT
          COUNT(*) FILTER (WHERE is_absent_disconnect = false)             AS total_count,
          COUNT(*) FILTER (WHERE is_absent_disconnect = true)              AS missed_count,
          COALESCE(SUM(usetm) FILTER (WHERE is_absent_disconnect = false), 0)
                                                                          AS total_seconds
          FROM consultation
         WHERE counselor_id = ${params.counselorId}
           AND created_at >= ${fromTs}::timestamptz
           AND created_at <  (${toTsExcl}::timestamptz + INTERVAL '1 day')
           ${typeWhere}
      `,
      this.sql<
        {
          id: string;
          reason: string;
          usetm: number;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          is_absent_disconnect: boolean;
          mb_id: string | null;
          member_no: string | null;
        }[]
      >`
        SELECT
          c.id::text                                AS id,
          c.reason                                  AS reason,
          c.usetm                                   AS usetm,
          c.started_at                              AS started_at,
          c.ended_at                                AS ended_at,
          c.created_at                              AS created_at,
          c.is_absent_disconnect                    AS is_absent_disconnect,
          c.mb_id                                   AS mb_id,
          m.mb_id                                   AS member_no
          FROM consultation c
          LEFT JOIN member m ON m.id = c.member_id
         WHERE c.counselor_id = ${params.counselorId}
           AND c.created_at >= ${fromTs}::timestamptz
           AND c.created_at <  (${toTsExcl}::timestamptz + INTERVAL '1 day')
           ${typeWhere}
         ORDER BY COALESCE(c.ended_at, c.started_at, c.created_at) DESC, c.id DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = Number(aggRows[0]?.total_count ?? 0);
    const missed = Number(aggRows[0]?.missed_count ?? 0);
    const totalSec = Number(aggRows[0]?.total_seconds ?? 0);

    // 일수: from~to 포함 일수 (최소 1)
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.max(
      1,
      Math.round(
        (new Date(`${params.to}T00:00:00+09:00`).getTime() -
          new Date(`${params.from}T00:00:00+09:00`).getTime()) /
          dayMs,
      ) + 1,
    );

    const avgSec = total > 0 ? Math.round(totalSec / total) : 0;
    const dailyAvg = +(total / days).toFixed(2);
    const missedRate =
      total + missed > 0 ? +((missed / (total + missed)) * 100).toFixed(1) : 0;

    const formatted: ConsultStatsItem[] = items.map((r) => ({
      id: Number(r.id),
      consult_type: r.reason === 'DISCONNECT' ? 'call' : 'chat',
      started_at: r.started_at,
      ended_at: r.ended_at,
      created_at: r.created_at,
      is_missed: !!r.is_absent_disconnect,
      usetm_seconds: Number(r.usetm) || 0,
      usetm_label: formatUsetm(Number(r.usetm) || 0),
      customer_no: r.member_no ?? r.mb_id ?? '',
    }));

    return {
      total_count: total,
      missed_count: missed,
      total_seconds: totalSec,
      avg_seconds: avgSec,
      daily_avg: dailyAvg,
      missed_rate_pct: missedRate,
      days,
      page,
      limit,
      items: formatted,
      has_more: formatted.length === limit,
    };
  }
}

export interface ConsultStatsItem {
  id: number;
  consult_type: 'call' | 'chat';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  is_missed: boolean;
  usetm_seconds: number;
  usetm_label: string;
  customer_no: string;
}

export interface ConsultMyStats {
  total_count: number;
  missed_count: number;
  total_seconds: number;
  avg_seconds: number;
  daily_avg: number;
  missed_rate_pct: number;
  days: number;
  page: number;
  limit: number;
  items: ConsultStatsItem[];
  has_more: boolean;
}

export interface ConsultHistoryItem {
  id: number;
  consult_type: 'call' | 'chat';
  consult_type_label: string;
  started_at: string | null;
  ended_at: string | null;
  /** 통화/채팅 진행 시간 (초). sample 의 usetm 동일. */
  usetm_seconds: number;
  /** "00시간17분30초" 포맷 */
  usetm_label: string;
  /** 사용 코인 (amt) */
  amt: number;
  counselor_id: number | null;
  counselor_name: string;
  counselor_code: string | null;
  counselor_avatar: string | null;
  counselor_avatar_webp: string | null;
  counselor_badge: '사주' | '타로' | '신점' | '기타';
  /** 후기 작성 완료된 경우 review id, 없으면 null */
  review_id: number | null;
  /** 상담사 시점에서만 채워짐 — 본인이 작성한 후기 답변 id, 없으면 null */
  reply_id: number | null;
  /** 채팅방 id (진행 중이거나 종료된 채팅 상담에 한해 매칭됨). 없으면 null. */
  chat_room_id: number | null;
  /** 채팅방 status — 'STAY' | 'CNCH' | 'DISCONNECT' | null */
  chat_status: string | null;
  /** 진행 중인 채팅(STAY/CNCH) 인지. true 면 "채팅방 입장하기" 버튼 노출 대상 */
  is_active_chat: boolean;
}

/** sample 의 gmdate("H:i:s", $usetm) 와 유사하지만 한국어 라벨로. */
function formatUsetm(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}시간${String(m).padStart(2, '0')}분${String(sec).padStart(2, '0')}초`;
}

function inferBadge(...vals: (string | null)[]): '사주' | '타로' | '신점' | '기타' {
  const text = vals.filter(Boolean).join(' ');
  if (text.includes('타로')) return '타로';
  if (text.includes('신점')) return '신점';
  if (text.includes('사주')) return '사주';
  return '기타';
}

/**
 * m2net 결과코드/메시지를 회원이 알아볼 수 있는 한글 안내로 정규화.
 * 매뉴얼 §5 결과코드 + raw resultmessage 한글 키워드 매칭.
 * 영어 코드(req_result, csrid 등) 는 회원에게 절대 노출하지 않는다.
 */
function mapM2netErrorToKorean(code: string | undefined, rawMsg: string): string {
  // 1) 결과코드로 정확한 의미가 있는 경우 그 한글 안내를 사용
  switch (code) {
    case '01':
      return '상담사 상태 정보가 누락되었습니다. 관리자에게 문의해주세요.';
    case '02':
    case '03':
    case '04':
    case '05':
    case '06':
    case '08':
    case '09':
    case '10':
    case '11':
    case '12':
      return '상담사 정보 등록이 완전하지 않습니다. 관리자에게 문의해주세요.';
    case '07':
      return '상담 시스템에 일시적인 오류가 있습니다. 잠시 후 다시 시도해주세요.';
    case '21':
    case '22':
      return '인증 정보 오류로 채팅을 시작할 수 없습니다. 관리자에게 문의해주세요.';
    case '23':
      return '회원 또는 상담사가 외부 채팅 시스템에 등록되어 있지 않습니다.';
    case '24':
      return '동일한 휴대폰 번호로 이미 등록된 회원이 있습니다.';
    case '25':
      return '상담사 연결 번호가 올바르지 않습니다. 관리자에게 문의해주세요.';
    case '27':
      // 27 은 채팅에서 "상태 아님" 거절도 사용. raw 메시지로 세분화.
      if (rawMsg.includes('RDCH') || rawMsg.includes('채팅') || rawMsg.includes('상태')) {
        return '상담사가 현재 채팅을 받을 수 없는 상태입니다. 잠시 후 다시 시도해주세요.';
      }
      return '채팅 시작 처리에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }

  // 2) raw 메시지의 한글 키워드로 매칭
  if (rawMsg) {
    if (/부재중|ABSE/.test(rawMsg)) {
      return '상담사가 현재 부재중입니다. 잠시 후 다시 시도해주세요.';
    }
    if (/상담중|통화중|CONN|CNCH/.test(rawMsg)) {
      return '상담사가 다른 상담을 진행 중입니다. 잠시 후 다시 시도해주세요.';
    }
    if (/잔액|포인트|부족|INSUFFICIENT/i.test(rawMsg)) {
      return '보유 포인트가 부족하여 채팅을 시작할 수 없습니다.';
    }
    if (/등록|미등록|존재하지|없는/.test(rawMsg)) {
      return '회원 또는 상담사 정보가 외부 시스템에 등록되어 있지 않습니다.';
    }
    if (/상태|RDCH|RDVC/.test(rawMsg)) {
      return '상담사가 현재 채팅을 받을 수 없는 상태입니다. 잠시 후 다시 시도해주세요.';
    }
  }

  // 3) 그 외엔 일반 안내
  return '채팅을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.';
}
