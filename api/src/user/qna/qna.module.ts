import { Module } from '@nestjs/common';
import { UserCounselorQnaController } from './qna.controller';
import { UserMyQnaController } from './my-qna.controller';
import { UserCounselorCustomerQnaController } from './counselor-qna.controller';
import { UserCounselorQnaService } from './qna.service';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { PushModule } from '../../shared/push/push.module';

@Module({
  imports: [AuthModule, SmsModule, PushModule],
  controllers: [
    UserCounselorQnaController,
    UserMyQnaController,
    UserCounselorCustomerQnaController,
  ],
  providers: [UserCounselorQnaService],
  exports: [UserCounselorQnaService],
})
export class UserCounselorQnaModule {}
