import { IsEnum, IsInt, Min } from 'class-validator';

export const GENERAL_PAY_METHODS = [
  'CARD',
  'VBANK',
  'PAYCO',
  'KAKAO',
  'NAVER',
  'APPLE',
  'TOSS',
  'SSPAY',
] as const;

export type GeneralPayMethod = (typeof GENERAL_PAY_METHODS)[number];

export class PrepareChargeDto {
  @IsInt()
  @Min(1)
  packageId!: number;

  @IsEnum(GENERAL_PAY_METHODS)
  payMethod!: GeneralPayMethod;
}
