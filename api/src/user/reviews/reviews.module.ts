import { Module } from '@nestjs/common';
import { UserReviewsController } from './reviews.controller';
import { UserReviewsService } from './reviews.service';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [UserReviewsController],
  providers: [UserReviewsService],
  exports: [UserReviewsService],
})
export class UserReviewsModule {}
