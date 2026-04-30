import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as admin from 'firebase-admin';

/**
 * FCM 푸시 발송 서비스 (Firebase Admin SDK 기반).
 *
 *  - 환경변수
 *    FCM_CREDENTIALS_PATH : 서비스 계정 JSON 파일 경로 (예: ./secrets/fcm-service-account.json)
 *    또는
 *    GOOGLE_APPLICATION_CREDENTIALS : 위와 동일 (Firebase 표준)
 *
 *  - 서비스 계정 키가 없으면 자동으로 비활성 모드로 폴백 (큐만 기록).
 *  - 토픽 발송 / 토큰 다중발송 / 토큰 구독 관리 모두 지원.
 *
 *  실제 사용:
 *    sendToTokens(tokens, payload)
 *    sendToTopic('all', payload)
 *    subscribeToTopic(tokens, 'all')
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: admin.app.App | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const credPath = this.config.get<string>('FCM_CREDENTIALS_PATH')
      ?? this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    if (!credPath) {
      this.logger.warn('FCM 환경변수(FCM_CREDENTIALS_PATH) 미설정 — 푸시 발송 비활성 (notification_log만 기록)');
      return;
    }
    const abs = resolve(credPath);
    if (!existsSync(abs)) {
      this.logger.warn(`FCM 키 파일 없음: ${abs} — 비활성`);
      return;
    }
    try {
      const json = JSON.parse(readFileSync(abs, 'utf-8')) as admin.ServiceAccount;
      this.app = admin.initializeApp({ credential: admin.credential.cert(json) });
      this.enabled = true;
      this.logger.log(`Firebase Admin 초기화 완료 (project=${(json as { project_id?: string }).project_id ?? 'unknown'})`);
    } catch (e) {
      this.logger.error(`Firebase 초기화 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** 토큰 다중 발송 — 최대 500개씩 청크 처리 */
  async sendToTokens(
    tokens: string[],
    payload: { title: string; body?: string; data?: Record<string, string> },
  ): Promise<{ ok: boolean; success: number; failure: number; error?: string }> {
    if (!this.enabled || !this.app) return { ok: false, success: 0, failure: 0, error: 'FCM 비활성' };
    if (tokens.length === 0) return { ok: true, success: 0, failure: 0 };
    let success = 0;
    let failure = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      try {
        const res = await admin.messaging(this.app).sendEachForMulticast({
          tokens: chunk,
          notification: { title: payload.title, body: payload.body ?? '' },
          data: payload.data,
        });
        success += res.successCount;
        failure += res.failureCount;
      } catch (e) {
        failure += chunk.length;
        this.logger.error(`sendEachForMulticast 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { ok: true, success, failure };
  }

  /** 토픽 발송 */
  async sendToTopic(
    topic: string,
    payload: { title: string; body?: string; data?: Record<string, string> },
  ): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    if (!this.enabled || !this.app) return { ok: false, error: 'FCM 비활성' };
    try {
      const messageId = await admin.messaging(this.app).send({
        topic,
        notification: { title: payload.title, body: payload.body ?? '' },
        data: payload.data,
      });
      return { ok: true, messageId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`sendToTopic(${topic}) 실패: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  /** 토큰을 토픽에 구독 */
  async subscribeToTopic(tokens: string[], topic: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.enabled || !this.app) return { ok: false, error: 'FCM 비활성' };
    if (tokens.length === 0) return { ok: true };
    try {
      await admin.messaging(this.app).subscribeToTopic(tokens, topic);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.enabled || !this.app) return { ok: false, error: 'FCM 비활성' };
    if (tokens.length === 0) return { ok: true };
    try {
      await admin.messaging(this.app).unsubscribeFromTopic(tokens, topic);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }
}
