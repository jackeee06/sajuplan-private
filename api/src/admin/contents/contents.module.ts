import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { ContentsController } from './contents.controller';
import { ContentsService } from './contents.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}
