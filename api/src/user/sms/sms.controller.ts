import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { SmsService } from './sms.service';

class SendDto {
  @IsString()
  @Length(9, 14)
  phone!: string;
}

class VerifyDto {
  @IsString()
  @Length(9, 14)
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}

@Controller('user/sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  /** POST /api/user/sms/send — 휴대폰 인증번호 발송 */
  @Post('send')
  @HttpCode(200)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  async send(@Body() body: SendDto) {
    await this.sms.send(body.phone);
    return { ok: true };
  }

  /** POST /api/user/sms/verify — 인증번호 확인 */
  @Post('verify')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async verify(@Body() body: VerifyDto) {
    await this.sms.verify(body.phone, body.code);
    return { ok: true };
  }
}
