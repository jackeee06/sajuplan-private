import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
