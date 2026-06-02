import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminHandbookController } from './handbook.controller';
import { AdminHandbookService } from './handbook.service';
import { AdminHandbookRagService } from './handbook-rag.service';
import { HandbookSqlToolService } from './sql-tool.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminHandbookController],
  providers: [AdminHandbookService, AdminHandbookRagService, HandbookSqlToolService],
})
export class AdminHandbookModule {}
