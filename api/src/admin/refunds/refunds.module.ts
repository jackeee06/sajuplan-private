import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminRefundsController } from './refunds.controller';
import { AdminRefundsService } from './refunds.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminRefundsController],
  providers: [AdminRefundsService],
  exports: [AdminRefundsService],
})
export class AdminRefundsModule {}
