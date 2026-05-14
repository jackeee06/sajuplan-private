import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * 자동충전 설정 변경.
 *
 * sample/coin/coin_fill_auto_card_member_update.php 동등 — autopayflag Y/N 토글.
 * threshold/packageId가 변경되면 amount/coinamt도 재계산해서 엠투넷 PUT.
 */
export class SetAutoConfigDto {
  @IsBoolean()
  enabled!: boolean;

  /** 자동충전 임계값 (보유 포인트 < threshold일 때 자동결제 트리거 — 엠투넷 자율 처리) */
  @IsOptional()
  @IsInt()
  @Min(0)
  threshold?: number;

  /** 자동충전 시 결제할 패키지 (account_setting.id). enabled=true일 때 필수 */
  @IsOptional()
  @IsInt()
  @Min(1)
  packageId?: number;
}
