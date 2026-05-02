import { Module } from '@nestjs/common';
import { UserStatsController } from './stats.controller';
import { UserStatsService } from './stats.service';

@Module({
  controllers: [UserStatsController],
  providers: [UserStatsService],
})
export class UserStatsModule {}
