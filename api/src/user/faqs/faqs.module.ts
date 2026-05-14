import { Module } from '@nestjs/common';
import { UserFaqsController } from './faqs.controller';
import { UserFaqsService } from './faqs.service';

@Module({
  controllers: [UserFaqsController],
  providers: [UserFaqsService],
})
export class UserFaqsModule {}
