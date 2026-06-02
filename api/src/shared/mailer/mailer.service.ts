import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * 이메일 발송 서비스 — 네이버 SMTP 기반.
 *
 * 환경변수:
 *   SMTP_HOST=smtp.naver.com
 *   SMTP_PORT=587 (TLS) 또는 465 (SSL)
 *   SMTP_USER=네이버메일아이디           (예: originhouse9 — '@naver.com' 자동 추가)
 *   SMTP_PASS=애플리케이션 비밀번호
 *   MAIL_FROM_NAME=사주플랜
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = Number(config.get<string>('SMTP_PORT') ?? 587);
    const userRaw = config.get<string>('SMTP_USER') ?? '';
    const pass = config.get<string>('SMTP_PASS') ?? '';
    const user = userRaw.includes('@') ? userRaw : `${userRaw}@naver.com`;

    this.fromAddress = user;
    this.fromName = config.get<string>('MAIL_FROM_NAME') ?? '사주플랜';

    if (!host || !userRaw || !pass) {
      this.logger.warn(
        'SMTP 환경변수 미설정 — 이메일 발송 비활성 (콘솔 로깅만)',
      );
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465=SSL, 587=STARTTLS
      auth: { user, pass },
    });
    this.logger.log(
      `[MailerService] enabled host=${host}:${port} from=${this.fromAddress}`,
    );
  }

  isEnabled(): boolean {
    return !!this.transporter;
  }

  /** HTML 메일 발송 — 성공: true / 실패: false (예외 throw 안 함) */
  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(
        `[MAIL DEV] to=${params.to} subject=${params.subject}`,
      );
      return true;
    }
    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      this.logger.log(
        `[MAIL ok] to=${params.to} subject="${params.subject}" id=${info.messageId}`,
      );
      return true;
    } catch (e) {
      this.logger.error(
        `[MAIL fail] to=${params.to}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
