import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { SmsModule } from '../../user/sms/sms.module';
import { PromoterCoreModule } from '../../shared/promoter/promoter-core.module';
import { AdminPromotersController } from './promoters.controller';
import { AdminPromotersService } from './promoters.service';

@Module({
  imports: [AdminAuthModule, SmsModule, PromoterCoreModule],
  controllers: [AdminPromotersController],
  providers: [AdminPromotersService],
})
export class AdminPromotersModule {}
