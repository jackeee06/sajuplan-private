import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { UserEventsService, type EventStatus } from './events.service';

/**
 * 사용자 이벤트 (인증 불필요).
 *  GET /api/user/events?page=&limit=&status=
 *  GET /api/user/events/:id
 */
@Controller('user/events')
export class UserEventsController {
  constructor(private readonly svc: UserEventsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const allowed: EventStatus[] = ['active', 'ended', 'upcoming'];
    const s =
      status && (allowed as string[]).includes(status)
        ? (status as EventStatus)
        : undefined;
    return this.svc.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: s,
    });
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }
}
