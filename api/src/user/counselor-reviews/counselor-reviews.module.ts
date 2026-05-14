import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserCounselorReviewsController } from './counselor-reviews.controller';
import { UserCounselorReviewsService } from './counselor-reviews.service';

@Module({
  imports: [AuthModule],
  controllers: [UserCounselorReviewsController],
  providers: [UserCounselorReviewsService],
  exports: [UserCounselorReviewsService],
})
export class UserCounselorReviewsModule {}
