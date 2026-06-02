import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * 운영 바이블 (Handbook) — _HANDBOOK 디렉토리 정적 md 파일을 관리자 페이지에서 조회.
 *
 * 자료 구조:
 *   _HANDBOOK/
 *     index.json   ← 카테고리/항목 메타데이터 (slug, title, tags)
 *     chat/01-prepaid-policy.md
 *     payment/02-charge-flow.md
 *     ...
 *
 * 인덱스/본문 fetch + 자연어 질문 키워드 매칭 검색 제공.
 */

export interface HandbookItem {
  slug: string;
  title: string;
  tags: string[];
  available?: boolean;
}

export interface HandbookCategory {
  key: string;
  title: string;
  icon: string;
  order: number;
  items: HandbookItem[];
}

export interface HandbookIndex {
  categories: HandbookCategory[];
}

export interface SearchHit {
  slug: string;
  title: string;
  category: string;
  score: number;
  snippet: string;
}

@Injectable()
export class AdminHandbookService {
  private readonly logger = new Logger(AdminHandbookService.name);
  // process.cwd() 가 api 폴더이므로 한 단계 위 (프로젝트 루트) 에서 _HANDBOOK 찾음.
  // prod 서버에선 _HANDBOOK 디렉토리를 /data/wwwroot/api.sajumoon.co.kr/_HANDBOOK/ 로 동기화.
  // RAG service 가 컨텍스트 추출 시 직접 접근하므로 readonly 공개.
  readonly root: string;

  constructor() {
    const candidates = [
      join(process.cwd(), '_HANDBOOK'),
      resolve(process.cwd(), '..', '_HANDBOOK'),
      resolve(process.cwd(), '..', '..', '_HANDBOOK'),
    ];
    this.root = candidates.find((p) => existsSync(p)) ?? candidates[0];
    this.logger.log(`[Handbook] root=${this.root}`);
  }

  /** index.json 로딩 (메모리 캐시 X — 운영 중 콘텐츠 갱신 즉시 반영). */
  getIndex(): HandbookIndex {
    const path = join(this.root, 'index.json');
    if (!existsSync(path)) {
      return { categories: [] };
    }
    try {
      const raw = readFileSync(path, 'utf-8');
      const idx = JSON.parse(raw) as HandbookIndex;
      // 각 항목에 available 플래그 추가 + md 본문 첫 h1 을 title 로 자동 동기화.
      //   인덱스에 등록되었으나 콘텐츠 미작성 항목은 UI 에서 회색/비활성으로 표시.
      //   md 본문 제목을 바꾸면 인덱스 별도 수정 없이 사이드바 title 도 자동 갱신.
      for (const cat of idx.categories) {
        for (const item of cat.items) {
          const mdPath = join(this.root, `${item.slug}.md`);
          item.available = existsSync(mdPath);
          if (item.available) {
            try {
              const md = readFileSync(mdPath, 'utf-8');
              const m = md.match(/^#\s+(.+)$/m);
              if (m?.[1]) item.title = m[1].trim();
            } catch {
              // 읽기 실패 시 인덱스 title 그대로 사용
            }
          }
        }
      }
      return idx;
    } catch (e) {
      this.logger.error(`index.json 읽기 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { categories: [] };
    }
  }

  /** slug → md 본문. 경로 traversal + .tech.md 직접 접근 차단. */
  getItem(slug: string): { slug: string; title: string; markdown: string } {
    // slug 보안: 영문/숫자/-/_/ 만 허용. .. 차단. .tech 접미사 차단 (AI 전용 파일).
    if (!/^[a-z0-9_/-]+$/i.test(slug) || slug.includes('..') || slug.endsWith('.tech')) {
      throw new NotFoundException('잘못된 slug');
    }
    const path = join(this.root, `${slug}.md`);
    if (!existsSync(path)) {
      throw new NotFoundException('항목 없음');
    }
    const markdown = readFileSync(path, 'utf-8');
    // 인덱스에서 title 찾기 — 못 찾으면 첫 # 헤더에서 추출
    const idx = this.getIndex();
    let title = '';
    for (const cat of idx.categories) {
      const found = cat.items.find((it) => it.slug === slug);
      if (found) {
        title = found.title;
        break;
      }
    }
    if (!title) {
      const m = markdown.match(/^#\s+(.+)$/m);
      title = m?.[1] ?? slug;
    }
    return { slug, title, markdown };
  }

  /**
   * Phase 1 키워드 검색.
   *   - 질문 텍스트 → 단어 분리 (공백 + 한글/영문/숫자 토큰)
   *   - 각 md 본문 + 제목 + 태그 매칭
   *   - 가중치: 제목 매칭 × 10, 태그 × 5, 본문 × 1
   *   - 상위 N개 반환 (점수 0 제외)
   */
  search(query: string, limit = 5): SearchHit[] {
    const q = (query ?? '').trim();
    if (!q) return [];

    // 토큰화 — 2글자 이상 단어 추출 (조사/접속어 1글자 단어는 노이즈)
    const tokens = q
      .split(/[\s,.!?·;:\-+()[\]{}"'`/\\]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    if (tokens.length === 0) return [];

    const idx = this.getIndex();
    const hits: SearchHit[] = [];

    for (const cat of idx.categories) {
      for (const item of cat.items) {
        const path = join(this.root, `${item.slug}.md`);
        if (!existsSync(path)) continue;
        let body = '';
        try {
          body = readFileSync(path, 'utf-8');
        } catch {
          continue;
        }

        let score = 0;
        const titleLower = item.title.toLowerCase();
        const tagsLower = item.tags.map((t) => t.toLowerCase());
        const bodyLower = body.toLowerCase();

        for (const tok of tokens) {
          const t = tok.toLowerCase();
          // 제목 매칭 (가중치 10)
          if (titleLower.includes(t)) score += 10;
          // 태그 매칭 (가중치 5)
          for (const tag of tagsLower) {
            if (tag.includes(t)) {
              score += 5;
              break;
            }
          }
          // 본문 매칭 (가중치 1, 빈도 누적 cap 3)
          const matches = bodyLower.split(t).length - 1;
          score += Math.min(matches, 3);
        }

        if (score > 0) {
          // 스니펫 — 첫 매칭 단어 주변 80자
          let snippet = '';
          for (const tok of tokens) {
            const idx2 = bodyLower.indexOf(tok.toLowerCase());
            if (idx2 >= 0) {
              const start = Math.max(0, idx2 - 30);
              const end = Math.min(body.length, idx2 + 80);
              snippet = body.slice(start, end).replace(/\s+/g, ' ').trim();
              if (start > 0) snippet = '… ' + snippet;
              if (end < body.length) snippet = snippet + ' …';
              break;
            }
          }
          if (!snippet) {
            snippet = body.slice(0, 100).replace(/\s+/g, ' ').trim();
          }
          hits.push({
            slug: item.slug,
            title: item.title,
            category: cat.title,
            score,
            snippet,
          });
        }
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}
