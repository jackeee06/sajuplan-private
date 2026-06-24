import { Module } from '@nestjs/common';
import { UserEventsController } from './events.controller';
import { UserEventsService } from './events.service';

@Module({
  controllers: [UserEventsController],
  providers: [UserEventsService],
  exports: [UserEventsService],
})
export class UserEventsModule {}
