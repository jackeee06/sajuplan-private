import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { UserCounselorsModule } from '../counselors/counselors.module';
import { UserNoticesModule } from '../notices/notices.module';
import { UserEventsModule } from '../events/events.module';

/**
 * SEO dynamic rendering 모듈.
 * 봇/카톡 스크래퍼 전용 풀 HTML(메타·OG·JSON-LD) + sitemap.xml 생성.
 * 공개 데이터는 기존 사용자 서비스(Counselors/Notices/Events)를 그대로 재사용.
 */
@Module({
  imports: [UserCounselorsModule, UserNoticesModule, UserEventsModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
