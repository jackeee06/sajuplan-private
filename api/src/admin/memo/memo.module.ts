import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminMemoController } from './memo.controller';
import { AdminMemoService } from './memo.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminMemoController],
  providers: [AdminMemoService],
})
export class AdminMemoModule {}
