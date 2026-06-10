import { Injectable, Logger } from '@nestjs/common';

/**
 * 전역 in-process 알림 큐 — 단일 pm2 인스턴스 (fork mode) 가정.
 *
 * 용도:
 *  - 5분 잔여 알림 (채팅/전화) 등 실시간 시스템 알림을 회원/상담사 폰에 push.
 *  - 클라이언트가 30초 polling 으로 큐에서 꺼냄.
 *  - 백그라운드/잠금 화면 도달은 FCM 빌드 후 보완 (이 큐와 별개로 함께 발송).
 *
 * 특징:
 *  - In-process Map (Redis 없이 단일 인스턴스 정책).
 *  - pm2 reload 시 큐 손실 — 5분 알림은 짧은 수명이라 영향 미미.
 *  - 만료 정책: created_at + 10분 이상 된 알림은 polling 시 자동 폐기.
 */

export type AlertType = 'consult_5min_warning';

export interface PendingAlert {
  id: string;
  type: AlertType;
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
  created_at: number; // epoch ms
}

const TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly queues = new Map<number, PendingAlert[]>();
  private seq = 0;

  /** 멤버 큐에 알림 push. 같은 type+link+consult_id 이미 있으면 중복 X (멱등성). */
  enqueue(memberId: number | string, alert: Omit<PendingAlert, 'id' | 'created_at'>): void {
    // [2026-06-07 fix] 키 타입 정규화 — enqueue 는 number(m.id), polling 은 JWT sub(string "91")
    //   로 들어와 Map.get(91) ≠ Map.get("91") 미스매치 → 알림 영구 미수신 버그. Number 로 통일.
    const key = Number(memberId);
    if (!Number.isFinite(key) || key <= 0) return;
    const list = this.queues.get(key) ?? [];
    // [엄격검증 fix 2026-05-27] 기존 코드의 `alert.data?.consult_id === alert.data?.consult_id` 는
    //   자기 자신 비교라 항상 true 였음. 의도대로 a.data ↔ alert.data 비교로 수정.
    const dup = list.find(
      (a) =>
        a.type === alert.type &&
        a.link === alert.link &&
        a.data?.consult_id === alert.data?.consult_id,
    );
    if (dup) return;
    const id = `${Date.now()}-${++this.seq}`;
    list.push({ ...alert, id, created_at: Date.now() });
    this.queues.set(key, list);
    this.logger.log(
      `[alerts.enqueue] memberId=${key} type=${alert.type} link=${alert.link ?? '-'}`,
    );
  }

  /** 멤버 큐에서 모든 알림 꺼내고 비움. 만료된 알림은 자동 폐기. */
  dequeueAll(memberId: number | string): PendingAlert[] {
    // [2026-06-07 fix] enqueue 와 동일하게 Number 정규화 (JWT sub 가 string 이라 미스매치 방지)
    const key = Number(memberId);
    if (!Number.isFinite(key) || key <= 0) return [];
    const list = this.queues.get(key);
    if (!list || list.length === 0) return [];
    const now = Date.now();
    const fresh = list.filter((a) => now - a.created_at < TTL_MS);
    this.queues.delete(key);
    return fresh;
  }

  /** TTL 만료 청소 — 메모리 누수 방지. cron 또는 주기 호출 가능. */
  sweepExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [memberId, list] of this.queues.entries()) {
      const fresh = list.filter((a) => now - a.created_at < TTL_MS);
      if (fresh.length === 0) {
        this.queues.delete(memberId);
        cleaned += list.length;
      } else if (fresh.length !== list.length) {
        this.queues.set(memberId, fresh);
        cleaned += list.length - fresh.length;
      }
    }
    return cleaned;
  }
}
