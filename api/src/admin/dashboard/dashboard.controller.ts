import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AdminAuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('sales-trend')
  salesTrend(@Query('days') days?: string) {
    const n = days ? Math.min(Math.max(Number(days), 1), 90) : 14;
    return this.service.salesTrend(n);
  }

  @Get('visitor-trend')
  visitorTrend(@Query('days') days?: string) {
    const n = days ? Math.min(Math.max(Number(days), 1), 90) : 14;
    return this.service.visitorTrend(n);
  }

  @Get('top-counselors')
  topCounselors(@Query('metric') metric?: string) {
    return metric === 'count'
      ? this.service.topCounselorsByCount()
      : this.service.topCounselorsByAmount();
  }

  @Get('top-customers')
  topCustomers() {
    return this.service.topCustomers();
  }

  @Get('recent-members')
  recentMembers() {
    return this.service.recentMembers();
  }

  @Get('recent-points')
  recentPoints() {
    return this.service.recentPoints();
  }

  @Get('recent-posts')
  recentPosts() {
    return this.service.recentPosts();
  }

  /** 즉시 액션 알림 — 운영자가 매일 처리해야 할 큐 카운트 */
  @Get('alerts')
  alerts() {
    return this.service.alerts();
  }

  /** 최근 N일 상담 건수 추이 — 일별 060/070/채팅 분리 */
  @Get('consultation-trend')
  consultationTrend(@Query('days') days?: string) {
    const n = days ? Math.min(Math.max(Number(days), 1), 90) : 14;
    return this.service.consultationTrend(n);
  }

  /** 상담사 운영 패널 — 오늘 활성 / 7일 0건 / 미답변 후기 명단 */
  @Get('counselor-panel')
  counselorPanel() {
    return this.service.counselorPanel();
  }

  /** 품질 지표 — 평균 별점 / 별점 1~2점 후기 카운트 */
  @Get('quality-kpi')
  qualityKpi() {
    return this.service.qualityKpi();
  }

  /** 단기통화 자동환불 KPI — 이번달/지난달/누적 건수+금액 (m2net 정산 대조용) */
  @Get('short-call-refund-kpi')
  shortCallRefundKpi() {
    return this.service.shortCallRefundKpi();
  }

  /** 운영 인사이트 — 이번주 vs 지난주 / 채널 비중 / 시간대 / 휴면 / 등급 변동 */
  @Get('insights')
  insights() {
    return this.service.insights();
  }
}
