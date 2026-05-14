import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { ChatHistoryService } from './chat-history.service';
import type { ChatFilter } from './chat-history.service';

@Controller('admin/chat-history')
@UseGuards(AdminAuthGuard)
export class ChatHistoryController {
  constructor(private readonly svc: ChatHistoryService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    const filter: ChatFilter = {
      q: q.q || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.svc.findRooms(filter);
  }

  @Get('rooms/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getRoomMessages(id);
  }

  @Get('rooms/by-roomid/:roomid')
  detailByRoomid(@Param('roomid') roomid: string) {
    return this.svc.getRoomMessagesByRoomid(roomid);
  }
}
