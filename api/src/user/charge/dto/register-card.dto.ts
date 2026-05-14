import { IsInt, IsString, Length, Matches, Min } from 'class-validator';

/**
 * 사주문페이(자동결제) 카드 등록 입력.
 *
 * sample/coin/coin_fill_auto_card.php 폼 5필드:
 *   - 카드번호 16자리 (대시 허용 → 서버에서 제거)
 *   - 만료월 MM (2자리)
 *   - 만료년 YY (2자리)
 *   - 생년월일 6자리 (YYMMDD) — 법인은 사업자번호 10자리지만 sample 정책상 6자리
 *   - 카드 비밀번호 앞 2자리
 *   - 자동결제 단가 패키지 (account_setting.id)
 */
export class RegisterCardDto {
  @IsString()
  @Matches(/^\d[\d-]{14,20}\d$/, { message: '카드번호 형식이 잘못되었습니다.' })
  cardno!: string;

  @IsString()
  @Length(2, 2)
  expMonth!: string;

  @IsString()
  @Length(2, 2)
  expYear!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '생년월일 6자리(YYMMDD) 또는 사업자번호 앞 6자리' })
  socno!: string;

  @IsString()
  @Matches(/^\d{2}$/, { message: '카드 비밀번호 앞 2자리' })
  pass!: string;

  @IsInt()
  @Min(1)
  packageId!: number;
}
