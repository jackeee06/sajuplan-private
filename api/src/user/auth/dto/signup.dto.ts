import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * 회원가입 DTO — 소셜/로컬 공용.
 * — 소셜: sjm_social_pending 쿠키가 있으면 (provider, uid) 가 새 member 에 연결됨.
 *         이 경우 login_id/password 무시.
 * — 로컬: pending 쿠키가 없으면 login_id + password 필수.
 */
export class SignupDto {
  // ── 필수 ──
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsString()
  @Length(1, 30)
  nickname!: string;

  @IsBoolean()
  agree_terms!: boolean;

  @IsBoolean()
  agree_privacy!: boolean;

  // ── 로컬 가입 시 필수 (소셜은 무시) ──
  @IsOptional()
  @IsString()
  @Length(3, 60)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'login_id는 영문/숫자/._- 만 사용 가능합니다.',
  })
  login_id?: string;

  @IsOptional()
  @IsString()
  @Length(8, 50)
  password?: string;

  // ── 선택 ──
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{9,11}$/, { message: '휴대폰번호는 숫자만 9~11자리여야 합니다.' })
  phone?: string;

  /** 'YYYY-MM-DD' */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '생년월일은 YYYY-MM-DD 형식이어야 합니다.' })
  birth_date?: string;

  /** 'HH:mm' */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: '시간은 HH:mm 형식이어야 합니다.' })
  birth_time?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: 'M' | 'F';

  @IsOptional()
  @IsIn(['SOLAR', 'LUNAR'])
  calendar_type?: 'SOLAR' | 'LUNAR';

  @IsOptional()
  @IsString()
  @Length(0, 6)
  zip?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  addr1?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  addr2?: string;

  /** 유입경로 텍스트 (mb_21 / acquisition_source) */
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  acquisition_source?: string;

  @IsOptional()
  @IsBoolean()
  agree_email?: boolean;

  @IsOptional()
  @IsBoolean()
  agree_sms?: boolean;
}
