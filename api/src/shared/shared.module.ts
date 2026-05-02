import { Global, Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { M2netModule } from './m2net/m2net.module';
import { PushModule } from './push/push.module';
import { MailerModule } from './mailer/mailer.module';

@Global()
@Module({
  imports: [DbModule, M2netModule, PushModule, MailerModule],
  providers: [],
  exports: [DbModule, M2netModule, PushModule, MailerModule],
})
export class SharedModule {}
