import { Module } from '@nestjs/common';
import { UserConsultController } from './consult.controller';
import { UserConsultService } from './consult.service';
import { AuthModule } from '../auth/auth.module';
import { M2netModule } from '../../shared/m2net/m2net.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [AuthModule, M2netModule, SmsModule],
  controllers: [UserConsultController],
  providers: [UserConsultService],
})
export class UserConsultModule {}
