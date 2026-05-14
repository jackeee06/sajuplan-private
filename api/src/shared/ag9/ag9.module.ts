import { Global, Module } from '@nestjs/common';
import { Ag9Service } from './ag9.service';

/**
 * AG9 (passcall.co.kr:32837) 결제 PG 클라이언트.
 *  - 일반결제 form 파라미터 빌더
 *  - 사주문페이 BillKey 등록/즉시결제/삭제
 *  - 결제 취소 (전액/부분)
 *  - 카드정보 AES-128-CBC 암호화 (sample/coin/coin_fill_auto_card_update.php)
 *
 * 인증: Authorization 헤더 (env AG9_AUTH_TOKEN)
 */
@Global()
@Module({
  providers: [Ag9Service],
  exports: [Ag9Service],
})
export class Ag9Module {}
