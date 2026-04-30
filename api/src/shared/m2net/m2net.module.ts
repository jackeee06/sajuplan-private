import { Global, Module } from '@nestjs/common';
import { M2netService } from './m2net.service';

/**
 * m2net (passcall) 외부 API 클라이언트
 *   - 상담사 등록: POST {API}/csr-mgr/{CPID}
 *   - 회원 등록  : POST {API}/memb-mgr/{CPID}
 * 인증: Authorization 헤더 (env M2NET_HEADER_KEY)
 */
@Global()
@Module({
  providers: [M2netService],
  exports: [M2netService],
})
export class M2netModule {}
