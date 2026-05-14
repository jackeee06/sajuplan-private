import { Module } from '@nestjs/common';
import { UserCounselorsController } from './counselors.controller';
import { UserCounselorsService } from './counselors.service';
import { UserReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UserReviewsModule, AuthModule],
  controllers: [UserCounselorsController],
  providers: [UserCounselorsService],
})
export class UserCounselorsModule {}
