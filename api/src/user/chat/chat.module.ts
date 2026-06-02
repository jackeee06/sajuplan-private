import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { M2netModule } from '../../shared/m2net/m2net.module';
import { M2netPushModule } from '../../pg-callbacks/m2net-push.module';
import { UserChatController } from './chat.controller';
import { UserChatService } from './chat.service';

@Module({
  imports: [AuthModule, M2netModule, M2netPushModule],
  controllers: [UserChatController],
  providers: [UserChatService],
  exports: [UserChatService],
})
export class UserChatModule {}
