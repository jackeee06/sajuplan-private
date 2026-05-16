import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserCounselorsService, CounselorTab, PublicEventCounselor } from './counselors.service';
import { UserReviewsService } from '../reviews/reviews.service';
import { OptionalUserGuard, type OptionalUserRequest } from '../auth/optional-user.guard';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';

/**
 * 사용자 메인 페이지 상담사 리스트 (sample 메인 4탭 중 전체/인기/채팅).
 * 후기 탭은 별도 엔드포인트 (`/api/user/reviews/recent`) 에서 처리.
 */
@Controller('user/counselors')
export class UserCounselorsController {
  constructor(
    private readonly svc: UserCounselorsService,
    private readonly reviewsSvc: UserReviewsService,
  ) {}

  /**
   * GET /api/user/counselors?tab=all|popular|chat&category=사주|타로|신점&limit=13
   * 로그인 시 각 카드의 is_liked(단골 등록 여부) 도 같이 반환.
   */
  @Get()
  @UseGuards(OptionalUserGuard)
  async list(
    @Req() req: OptionalUserRequest,
    @Query('tab') tab?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.svc.list({
      tab: parseTab(tab),
      category,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 13)) : 13,
      requesterId: req.user?.sub,
    });
    return { items };
  }

  /**
   * GET /api/user/counselors/event — 현재 활성 이벤트 상담사 (최대 3명).
   * ※ 라우트 우선순위 — :id 매칭 전에 등록.
   */
  @Get('event')
  async eventCounselors(): Promise<{ items: PublicEventCounselor[] }> {
    const items = await this.svc.listEvent();
    return { items };
  }

  /**
   * GET /api/user/counselors/filter-options — 분야(해시태그) 동적 옵션.
   * ※ 라우트 우선순위 — :id 매칭 전에 등록.
   */
  @Get('filter-options')
  async filterOptions() {
    return this.svc.getFilterOptions();
  }

  /**
   * GET /api/user/counselors/search?q=...&limit=
   * 상담사 검색 — 이름/닉네임/해시태그/전문분야/헤드라인/소개/약력 부분 일치.
   * 빈 q → 빈 결과. 로그인 시 is_liked 같이 반환.
   * ※ 라우트 우선순위 — :id 매칭 전에 등록되어야 함.
   */
  @Get('search')
  @UseGuards(OptionalUserGuard)
  async search(
    @Req() req: OptionalUserRequest,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const term = (q ?? '').trim();
    const items = await this.svc.search({
      q: term,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 30)) : 30,
      requesterId: req.user?.sub,
    });
    // fire-and-forget — 검색 통계 적재 (빈 q 제외)
    if (term) {
      void this.svc.logSearch(term, req.user?.sub, items.length, req.ip);
    }
    return { items, total: items.length, q: term };
  }

  /**
   * GET /api/user/counselors/popular-keywords?limit=6
   * 인기 검색어 (현재 v1: 활성 상담사들의 hashtag 빈도 상위).
   */
  @Get('popular-keywords')
  async popularKeywords(@Query('limit') limit?: string) {
    const n = limit ? Math.min(20, Math.max(1, Number(limit) || 6)) : 6;
    const items = await this.svc.popularKeywords(n);
    return { items };
  }

  /**
   * GET /api/user/counselors/favorites?category=&limit=
   *  - 로그인된 회원의 단골 상담사 목록 (member_favorite_counselor JOIN).
   *  - ※ 라우트 우선순위 — :id 매칭 전에 등록되어야 함.
   */
  @Get('favorites')
  @UseGuards(UserAuthGuard)
  async favorites(
    @Req() req: UserAuthedRequest,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.svc.listFavorites({
      memberId: req.user.sub,
      category,
      limit: limit ? Math.min(100, Math.max(1, Number(limit) || 50)) : 50,
    });
    return { items };
  }

  /**
   * GET /api/user/counselors/me/availability — 본인 상담사 토글 현재값 (마이페이지 prefill).
   * 상담사만 호출 가능.
   *  ※ 라우트 우선순위 — :id 매칭 전에 등록되어야 함.
   */
  @Get('me/availability')
  @UseGuards(UserAuthGuard)
  async getMyAvailability(@Req() req: UserAuthedRequest) {
    return this.svc.getMyAvailability(req.user.sub);
  }

  /**
   * PATCH /api/user/counselors/me/availability
   * Body: { use_phone?: boolean; use_chat?: boolean; available?: boolean }
   *  - 상담사 본인이 자기 토글 변경. DB 갱신 + member.state 자동 보정 + m2net 동기화.
   *  - admin 폼과 동일한 컬럼(`use_phone`, `use_chat`)을 갱신해 3-way 일관성 보장.
   */
  @Patch('me/availability')
  @UseGuards(UserAuthGuard)
  async setMyAvailability(
    @Req() req: UserAuthedRequest,
    @Body() body: { use_phone?: boolean; use_chat?: boolean; available?: boolean },
  ) {
    return this.svc.setMyAvailability(req.user.sub, body);
  }

  /** GET /api/user/counselors/me/intro — 본인 소개(post_counselor.intro) 조회 */
  @Get('me/intro')
  @UseGuards(UserAuthGuard)
  async getMyIntro(@Req() req: UserAuthedRequest) {
    return this.svc.getMyIntro(req.user.sub);
  }

  /** PATCH /api/user/counselors/me/intro — 본인 소개 수정. Body: { intro: string } */
  @Patch('me/intro')
  @UseGuards(UserAuthGuard)
  async setMyIntro(
    @Req() req: UserAuthedRequest,
    @Body() body: { intro?: string },
  ) {
    return this.svc.setMyIntro(req.user.sub, body.intro ?? '');
  }

  /**
   * GET /api/user/counselors/:id  — 상담사 상세.
   * 로그인 시 단골 등록 여부(is_liked)도 같이 반환.
   */
  @Get(':id')
  @UseGuards(OptionalUserGuard)
  async detail(@Param('id', ParseIntPipe) id: number, @Req() req: OptionalUserRequest) {
    return this.svc.getDetail(id, req.user?.sub);
  }

  /**
   * GET /api/user/counselors/:id/reviews
   */
  @Get(':id/reviews')
  async reviews(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reviewsSvc.byCounselor({
      counselorId: id,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 20)) : 20,
      offset: offset ? Math.max(0, Number(offset) || 0) : 0,
    });
  }

  /** POST /api/user/counselors/:id/like — 단골 등록 (회원 인증 필요) */
  @Post(':id/like')
  @UseGuards(UserAuthGuard)
  async addLike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: UserAuthedRequest,
  ) {
    const r = await this.svc.addFavorite(req.user.sub, id);
    return { is_liked: true, fan_count: r.fan_count };
  }

  /** DELETE /api/user/counselors/:id/like — 단골 해제 */
  @Delete(':id/like')
  @UseGuards(UserAuthGuard)
  async removeLike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: UserAuthedRequest,
  ) {
    const r = await this.svc.removeFavorite(req.user.sub, id);
    return { is_liked: false, fan_count: r.fan_count };
  }
}

function parseTab(v: unknown): CounselorTab | undefined {
  if (v === 'all' || v === 'popular' || v === 'chat' || v === 'new') return v;
  return undefined;
}
