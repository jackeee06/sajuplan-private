import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { ConsultationsService } from './consultations.service';
import type { ConsultationFilter, Sfl, View } from './consultations.service';

const ALLOWED_VIEWS: View[] = ['all', 'call', 'chat'];
const ALLOWED_SFLS: Sfl[] = ['mb_id', 'cmb_id', 'mb_hp', 'mb_nick', 'preflag'];

@Controller('admin/consultations')
@UseGuards(AdminAuthGuard)
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  /** 사용(상담) 내역: GET /admin/consultations
   *  - sample/adm/coin_counsel_history.php 화면과 동일 파라미터 지원
   */
  @Get()
  list(@Query() q: Record<string, string>) {
    const view = ALLOWED_VIEWS.includes(q.view as View) ? (q.view as View) : 'all';
    const sfl = ALLOWED_SFLS.includes(q.sfl as Sfl) ? (q.sfl as Sfl) : undefined;

    const filter: ConsultationFilter = {
      view,
      sfl,
      stx: q.stx || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.consultationsService.findAll(filter);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.consultationsService.getDetail(id);
  }
}
