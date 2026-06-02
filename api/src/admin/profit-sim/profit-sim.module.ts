import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { ProfitSimController } from './profit-sim.controller';
import { ProfitSimService } from './profit-sim.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [ProfitSimController],
  providers: [ProfitSimService],
})
export class ProfitSimModule {}
