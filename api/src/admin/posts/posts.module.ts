import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { ReviewReportsController } from './review-reports.controller';
import { UserReviewsModule } from '../../user/reviews/reviews.module';

@Module({
  imports: [AdminAuthModule, UserReviewsModule],
  controllers: [PostsController, ReviewReportsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
