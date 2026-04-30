import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * 사용자(회원) 로그인 DTO.
 * — login_id 기반(이메일과 별개). 소셜 로그인은 다른 엔드포인트.
 */
export class LoginDto {
  @IsString()
  @Length(3, 60)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'login_id는 영문/숫자/._- 만 사용 가능합니다.',
  })
  login_id!: string;

  @IsString()
  @Length(4, 200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  keep_login?: boolean;
}
