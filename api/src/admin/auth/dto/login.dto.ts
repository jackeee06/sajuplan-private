import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 60)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'mb_id는 영문/숫자/._- 만 사용 가능합니다.',
  })
  mb_id!: string;

  @IsString()
  @Length(4, 200)
  password!: string;
}
