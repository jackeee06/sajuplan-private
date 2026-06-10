import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserCounselorMypageGradeController } from './counselor-mypage-grade.controller';
import { UserCounselorMypageGradeService } from './counselor-mypage-grade.service';
import { GradeUpgradeModule } from '../../shared/grade-upgrade/grade-upgrade.module';

@Module({
  imports: [AuthModule, GradeUpgradeModule],
  controllers: [UserCounselorMypageGradeController],
  providers: [UserCounselorMypageGradeService],
  exports: [UserCounselorMypageGradeService],
})
export class UserCounselorMypageGradeModule {}
