import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicBanner {
  id: number;
  position: string | null;
  title: string | null;
  link_url: string | null;
  image_url: string | null;
  image_url_webp: string | null;
  display_order: number;
}

/**
 * 사용자 페이지에 노출되는 배너 조회.
 * 활성(is_active = true) + 기간 내(starts_at 이전 / ends_at 이후) 배너만.
 */
@Injectable()
export class UserBannersService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async listByPosition(position: string): Promise<PublicBanner[]> {
    if (!position?.trim()) return [];
    return this.sql<PublicBanner[]>`
      SELECT id, position, title, link_url, image_url, image_url_webp, display_order
        FROM shop_banner
       WHERE position = ${position}
         AND is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now())
       ORDER BY display_order ASC, id DESC
    `;
  }
}
