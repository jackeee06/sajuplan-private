import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { PaymentsService } from './payments.service';
import type {
  CancelInput,
  PaymentFilter,
  PaymentSfl,
  PaymentSmode,
} from './payments.service';

const ALLOWED_SFLS: PaymentSfl[] = [
  'mb_id', 'mb_name', 'mb_nick', 'mb_hp', 'mb_tel', 'mb_level', 'mb_point',
];
const ALLOWED_SMODES: PaymentSmode[] = ['card', 'vbank', 'card_cancle'];

@Controller('admin/payments')
@UseGuards(AdminAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** 결제 내역 (sample/adm/coin_pay_history.php와 동일 파라미터) */
  @Get()
  list(@Query() q: Record<string, string>) {
    const sfl = ALLOWED_SFLS.includes(q.sfl as PaymentSfl) ? (q.sfl as PaymentSfl) : undefined;
    const smode = ALLOWED_SMODES.includes(q.smode as PaymentSmode) ? (q.smode as PaymentSmode) : undefined;
    const filter: PaymentFilter = {
      sfl,
      stx: q.stx || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      smode,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.paymentsService.findAll(filter);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.getDetail(id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CancelInput,
    @Req() req: AuthedRequest,
  ) {
    return this.paymentsService.cancel(id, body, {
      adminId: req.admin.sub,
      ip: req.ip ?? null,
    });
  }
}
