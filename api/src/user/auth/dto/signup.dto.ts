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
 *         이 경우 mb_id/password 무시.
 * — 로컬: pending 쿠키가 없으면 mb_id + password 필수.
 */
export class SignupDto {
  // 가입 경로 — 프론트가 명시적으로 보냄 (쿠키 누락/만료 시 명확한 에러 분기에 사용)
  @IsOptional()
  @IsIn(['kakao', 'naver', 'apple'])
  social?: 'kakao' | 'naver' | 'apple';

  // ── 필수 ──
  @IsString()
  @Length(1, 50)
  name!: string;

  // sample 정책: 최대 20자
  @IsString()
  @Length(1, 20)
  nickname!: string;

  @IsBoolean()
  agree_terms!: boolean;

  @IsBoolean()
  agree_privacy!: boolean;

  // ── 로컬 가입 시 필수 (소셜은 무시) ──
  // sample 정책: 3~20자, 영문/숫자/_ 만 허용
  // 추가: '_K' '_N' 으로 끝나는 ID 금지 (소셜 자동 부여 형식과 충돌 방지)
  @IsOptional()
  @IsString()
  @Length(3, 20)
  @Matches(/^(?!.*_[KNA]$)[A-Za-z0-9_]+$/, {
    message: '아이디는 영문/숫자/_ 만 사용 가능합니다. (소셜 가입 형식과 동일한 ID는 사용할 수 없습니다)',
  })
  mb_id?: string;

  // sample 정책: 3~20자
  @IsOptional()
  @IsString()
  @Length(3, 20)
  password?: string;

  // ── 선택 ──
  // sample 정책: 최대 100자
  @IsOptional()
  @IsEmail()
  @Length(0, 100)
  email?: string;

  // sample 정책: ^01[0-9]{8,9}$ (010/011/016~019 + 8~9자리)
  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, {
    message: '휴대폰번호 형식이 올바르지 않습니다.',
  })
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

  // ── 로컬 가입 보안 검증 (소셜은 무시) ──
  /** 휴대폰 인증번호 — sms_auth 5분 내 매칭 검증 */
  @IsOptional()
  @IsString()
  @Length(4, 8)
  phone_code?: string;

  /** 자동등록방지 — GET /captcha 에서 발급된 토큰 + 사용자 입력 */
  @IsOptional()
  @IsString()
  captcha_token?: string;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  captcha_input?: string;
}
