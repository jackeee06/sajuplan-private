import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminGradeController } from './grade.controller';
import { AdminGradeService } from './grade.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminGradeController],
  providers: [AdminGradeService],
  exports: [AdminGradeService],
})
export class AdminGradeModule {}
