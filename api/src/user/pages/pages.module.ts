import { Module } from '@nestjs/common';
import { UserPagesController } from './pages.controller';
import { UserPagesService } from './pages.service';

@Module({
  controllers: [UserPagesController],
  providers: [UserPagesService],
})
export class UserPagesModule {}
