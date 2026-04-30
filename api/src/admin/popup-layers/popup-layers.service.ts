import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PopupLayerRow {
  id: number;
  device: string;
  starts_at: Date;
  ends_at: Date;
  disable_hours: number;
  pos_left: number;
  pos_top: number;
  size_width: number;
  size_height: number;
  title: string;
  content: string;
  is_html: boolean;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PopupLayerInput {
  device?: string;
  starts_at: string;
  ends_at: string;
  disable_hours?: number;
  pos_left?: number;
  pos_top?: number;
  size_width?: number;
  size_height?: number;
  title: string;
  content?: string;
  is_html?: boolean;
  image_url?: string | null;
  link_url?: string | null;
  is_active?: boolean;
}

@Injectable()
export class PopupLayersService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findAll(): Promise<PopupLayerRow[]> {
    return this.sql<PopupLayerRow[]>`
      SELECT id, device, starts_at, ends_at, disable_hours,
             pos_left, pos_top, size_width, size_height,
             title, content, is_html, image_url, link_url, is_active,
             created_at, updated_at
        FROM popup_notice
       ORDER BY id DESC
    `;
  }

  async findOne(id: number): Promise<PopupLayerRow> {
    const rows = await this.sql<PopupLayerRow[]>`
      SELECT id, device, starts_at, ends_at, disable_hours,
             pos_left, pos_top, size_width, size_height,
             title, content, is_html, image_url, link_url, is_active,
             created_at, updated_at
        FROM popup_notice
       WHERE id = ${id}
    `;
    if (rows.length === 0) throw new NotFoundException('팝업레이어를 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: PopupLayerInput): Promise<PopupLayerRow> {
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO popup_notice (
        device, starts_at, ends_at, disable_hours,
        pos_left, pos_top, size_width, size_height,
        title, content, is_html, image_url, link_url, is_active
      ) VALUES (
        ${input.device ?? 'both'},
        ${input.starts_at}::timestamptz,
        ${input.ends_at}::timestamptz,
        ${input.disable_hours ?? 24},
        ${input.pos_left ?? 10},
        ${input.pos_top ?? 10},
        ${input.size_width ?? 450},
        ${input.size_height ?? 500},
        ${input.title},
        ${input.content ?? ''},
        ${input.is_html ?? true},
        ${input.image_url ?? null},
        ${input.link_url ?? null},
        ${input.is_active ?? true}
      )
      RETURNING id
    `;
    return this.findOne(rows[0].id);
  }

  async update(id: number, input: Partial<PopupLayerInput>): Promise<PopupLayerRow> {
    await this.findOne(id); // 404 check
    // postgres.js dynamic SET — 들어온 키만 업데이트
    const updates: Record<string, unknown> = {};
    if (input.device !== undefined) updates.device = input.device;
    if (input.starts_at !== undefined) updates.starts_at = input.starts_at;
    if (input.ends_at !== undefined) updates.ends_at = input.ends_at;
    if (input.disable_hours !== undefined) updates.disable_hours = input.disable_hours;
    if (input.pos_left !== undefined) updates.pos_left = input.pos_left;
    if (input.pos_top !== undefined) updates.pos_top = input.pos_top;
    if (input.size_width !== undefined) updates.size_width = input.size_width;
    if (input.size_height !== undefined) updates.size_height = input.size_height;
    if (input.title !== undefined) updates.title = input.title;
    if (input.content !== undefined) updates.content = input.content;
    if (input.is_html !== undefined) updates.is_html = input.is_html;
    if (input.image_url !== undefined) updates.image_url = input.image_url;
    if (input.link_url !== undefined) updates.link_url = input.link_url;
    if (input.is_active !== undefined) updates.is_active = input.is_active;

    if (Object.keys(updates).length > 0) {
      await this.sql`
        UPDATE popup_notice SET ${this.sql(updates)}, updated_at = now()
         WHERE id = ${id}
      `;
    }
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: number }> {
    const result = await this.sql`DELETE FROM popup_notice WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('팝업레이어를 찾을 수 없습니다.');
    return { deleted: result.count };
  }

  async setImage(id: number, imageUrl: string | null): Promise<PopupLayerRow> {
    return this.update(id, { image_url: imageUrl });
  }
}
