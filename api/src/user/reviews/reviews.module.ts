import { Module } from '@nestjs/common';
import { UserReviewsController } from './reviews.controller';
import { UserReviewsService } from './reviews.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserReviewsController],
  providers: [UserReviewsService],
  exports: [UserReviewsService],
})
export class UserReviewsModule {}
