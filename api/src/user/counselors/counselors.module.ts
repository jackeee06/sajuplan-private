import { Module } from '@nestjs/common';
import { UserCounselorsController } from './counselors.controller';
import { UserCounselorsService } from './counselors.service';
import { UserReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { PushModule } from '../../shared/push/push.module';

@Module({
  imports: [UserReviewsModule, AuthModule, SmsModule, PushModule],
  controllers: [UserCounselorsController],
  providers: [UserCounselorsService],
})
export class UserCounselorsModule {}
