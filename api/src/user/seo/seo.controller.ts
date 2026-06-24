import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SeoService } from './seo.service';

/**
 * SEO dynamic rendering 진입점 (비인증 공개).
 *   GET /api/seo/render       — nginx 가 봇 UA 요청을 여기로 프록시. 원 경로는 X-Original-Path 헤더.
 *   GET /api/seo/sitemap.xml  — nginx 가 /sitemap.xml 을 여기로 프록시.
 */
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('render')
  async render(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path =
      (req.headers['x-original-path'] as string | undefined) ||
      (req.query.path as string | undefined) ||
      '/';
    const { status, html } = await this.seo.render(path);
    res.status(status).type('text/html; charset=utf-8').send(html);
  }

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response): Promise<void> {
    const xml = await this.seo.sitemap();
    res.status(200).type('application/xml; charset=utf-8').send(xml);
  }
}
