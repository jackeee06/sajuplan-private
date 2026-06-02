import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminShortCallRefundsController } from './short-call-refunds.controller';
import { AdminShortCallRefundsService } from './short-call-refunds.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminShortCallRefundsController],
  providers: [AdminShortCallRefundsService],
})
export class AdminShortCallRefundsModule {}
