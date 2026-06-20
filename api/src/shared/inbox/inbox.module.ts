import { Global, Module } from '@nestjs/common';
import { InboxService } from './inbox.service';

/**
 * 알림함 기록 헬퍼 전역 모듈.
 *  - @Global 이라 어느 모듈에서든 InboxService 를 주입할 수 있다 (DbModule 과 동일 패턴).
 *  - AppModule 에 1회만 import.
 */
@Global()
@Module({
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
