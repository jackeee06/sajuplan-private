import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminRefundsController } from './refunds.controller';
import { AdminRefundsService } from './refunds.service';
import { PromoterCoreModule } from '../../shared/promoter/promoter-core.module';

@Module({
  imports: [AdminAuthModule, PromoterCoreModule],
  controllers: [AdminRefundsController],
  providers: [AdminRefundsService],
  exports: [AdminRefundsService],
})
export class AdminRefundsModule {}
