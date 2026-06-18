import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SQL, type Sql } from '../shared/db/db.module';
import { SmsService } from '../user/sms/sms.service';
import { PromoterCoreService } from '../shared/promoter/promoter-core.service';

export type OtpVerifyResult = {
  status: 'active' | 'pending' | 'rejected' | 'inactive' | 'new';
  token?: string;
  promoterId?: number;
  memberName?: string | null;
};

/** 공개 — 모집인(서포터즈) 랜딩·OTP 로그인·자가 신청·대시보드. 앱 불필요(일반 브라우저). */
@Injectable()
export class PromoterPublicService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
    private readonly core: PromoterCoreService,
    private readonly jwt: JwtService,
  ) {}

  /** 코드 유효성(존재·활성)만. 가입 화면 prefill 검증용. */
  byCode(code: string) {
    return this.core.getByCode(code);
  }

  private digits(s: string): string {
    return (s ?? '').replace(/\D/g, '');
  }

  /** OTP 발송 — 유효한 휴대폰이면 누구나(로그인 또는 신청용). sms_auth 5분/5회 제한 재사용. */
  async otpRequest(phone: string): Promise<{ ok: true }> {
    const d = this.digits(phone);
    if (!/^01[0-9]{8,9}$/.test(d)) {
      throw new BadRequestException('휴대폰번호를 올바르게 입력해주세요.');
    }
    await this.sms.send(d);
    return { ok: true };
  }

  /**
   * OTP 검증 → 상태 분기.
   *  - active   : 로그인(세션 토큰 발급)
   *  - pending  : 승인 대기 중
   *  - rejected : 반려됨
   *  - inactive : 비활성(관리자가 끔)
   *  - new      : 미등록 → 신청 가능 (회원이면 이름 prefill)
   */
  async otpVerify(phone: string, code: string): Promise<OtpVerifyResult> {
    const d = this.digits(phone);
    await this.sms.verify(d, code); // 실패 시 BadRequestException
    const p = await this.core.getPromoterByPhone(d);
    if (p && p.is_active) {
      const token = await this.jwt.signAsync(
        { pid: p.id, phone: d, typ: 'promoter' },
        { expiresIn: '30d' },
      );
      return { status: 'active', token, promoterId: p.id };
    }
    if (p && p.status === 'pending') return { status: 'pending' };
    if (p && p.status === 'rejected') return { status: 'rejected' };
    if (p) return { status: 'inactive' };
    const memberName = await this.core.findMemberNameByPhone(d);
    return { status: 'new', memberName };
  }

  /** 자가 신청 (휴대폰 인증 후) → status='pending' 으로 등록. 관리자 승인 후 활동. */
  async apply(args: {
    phone: string; name: string; bankName?: string; bankAccount?: string; accountHolder?: string;
  }): Promise<{ ok: true }> {
    const d = this.digits(args.phone);
    const verified = await this.sms.isVerifiedRecently(d, 30).catch(() => false);
    if (!verified) throw new BadRequestException('휴대폰 인증 후 신청해주세요.');
    await this.core.createApplication({ ...args, phone: d });
    return { ok: true };
  }

  dashboard(promoterId: number) {
    return this.core.getDashboard(promoterId);
  }
}
