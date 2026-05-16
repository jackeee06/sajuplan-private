import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserCounselorMypageGradeController } from './counselor-mypage-grade.controller';
import { UserCounselorMypageGradeService } from './counselor-mypage-grade.service';

@Module({
  imports: [AuthModule],
  controllers: [UserCounselorMypageGradeController],
  providers: [UserCounselorMypageGradeService],
  exports: [UserCounselorMypageGradeService],
})
export class UserCounselorMypageGradeModule {}
