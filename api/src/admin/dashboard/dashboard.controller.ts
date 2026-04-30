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
}
