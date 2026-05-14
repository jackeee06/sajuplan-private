import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChargeService } from './charge.service';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { PrepareChargeDto } from './dto/prepare-charge.dto';
import { RegisterCardDto } from './dto/register-card.dto';
import { SetAutoConfigDto } from './dto/set-auto-config.dto';

/**
 * 사용자 측 포인트 충전 (https://sajumoon.kr/mypage/charge).
 *
 * sample 매핑:
 *   GET    /api/user/charge/packages         ← coin_fill.php 라인 42-48
 *   GET    /api/user/charge/methods          ← coin_fill.php 라인 32-39
 *   POST   /api/user/charge/prepare          ← ajax.coin_fill_update.php
 *   POST   /api/user/charge/autopay-charge   ← coin_pay_ok_auto.php
 *   POST   /api/user/charge/autopay-register ← coin_fill_auto_card_update.php
 *   DELETE /api/user/charge/autopay-card     ← coin_fill_auto_card_del.php
 *   PUT    /api/user/charge/auto-config      ← coin_fill_auto_card_member_update.php
 *   GET    /api/user/charge/status/:oid      ← (신규) frontend 폴링
 */
@Controller('user/charge')
@UseGuards(UserAuthGuard)
export class ChargeController {
  constructor(private readonly svc: ChargeService) {}

  @Get('packages')
  async packages() {
    return this.svc.getPackages();
  }

  @Get('methods')
  async methods(@Req() req: UserAuthedRequest) {
    return this.svc.getMethods(req.user.sub);
  }

  @Post('prepare')
  async prepare(@Req() req: UserAuthedRequest, @Body() dto: PrepareChargeDto) {
    const ua = req.headers['user-agent'] ?? '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return this.svc.prepareCharge(req.user.sub, dto, isMobile);
  }

  @Post('autopay-register')
  async autopayRegister(@Req() req: UserAuthedRequest, @Body() dto: RegisterCardDto) {
    return this.svc.registerAutoPayCard(req.user.sub, dto);
  }

  @Delete('autopay-card')
  async autopayCardDelete(@Req() req: UserAuthedRequest) {
    return this.svc.deleteAutoPayCard(req.user.sub);
  }

  @Post('autopay-charge')
  async autopayCharge(@Req() req: UserAuthedRequest, @Body() body: { packageId: number }) {
    return this.svc.autoPayCharge(req.user.sub, Number(body.packageId));
  }

  @Put('auto-config')
  async autoConfig(@Req() req: UserAuthedRequest, @Body() dto: SetAutoConfigDto) {
    return this.svc.setAutoConfig(req.user.sub, dto);
  }

  @Get('status/:oid')
  async status(@Req() req: UserAuthedRequest, @Param('oid') oid: string) {
    return this.svc.getStatus(req.user.sub, oid);
  }

  @Get('payments')
  async payments(@Req() req: UserAuthedRequest) {
    return this.svc.getPayments(req.user.sub);
  }
}
