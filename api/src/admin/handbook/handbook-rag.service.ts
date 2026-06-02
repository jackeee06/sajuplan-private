import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { SQL, type Sql } from '../../shared/db/db.module';
import { AdminHandbookService } from './handbook.service';
import { HandbookSqlToolService } from './sql-tool.service';

/**
 * 운영 바이블 RAG (Phase 2-A).
 *
 * 흐름:
 *  1. 관리자 질문 입력
 *  2. 키워드 검색으로 관련 항목 추출 (운영자용 .md + AI 전용 .tech.md)
 *  3. Claude API 호출 (시스템 프롬프트 + 컨텍스트 + 멀티턴 대화 + 사용자 질문)
 *  4. 답변 + 출처 반환 + DB 저장
 *
 * 안전망:
 *  - API 키 미설정 시 명확한 에러
 *  - cap 도달 자동 차단 (rate limit error 감지)
 *  - 출처 강제 (system prompt)
 *  - 컨텍스트 외 답변 거부 (system prompt)
 */
@Injectable()
export class AdminHandbookRagService {
  private readonly logger = new Logger(AdminHandbookRagService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly handbook: AdminHandbookService,
    private readonly sqlTool: HandbookSqlToolService,
  ) {}

  /** 설정 조회 — API 키 (마스킹) + 모델 + 활성화 여부 */
  async getConfig(): Promise<{ api_key_masked: string | null; model: string; max_tokens: number; enabled: boolean; updated_at: string | null }> {
    const rows = await this.sql<{ api_key: string | null; model: string; max_tokens: number; enabled: boolean; updated_at: string }[]>`
      SELECT api_key, model, max_tokens, enabled, updated_at FROM handbook_config WHERE id = 1
    `;
    const c = rows[0] ?? { api_key: null, model: 'claude-sonnet-4-6', max_tokens: 1000, enabled: false, updated_at: null };
    const masked = c.api_key ? `${c.api_key.slice(0, 12)}...${c.api_key.slice(-4)}` : null;
    return { api_key_masked: masked, model: c.model, max_tokens: c.max_tokens, enabled: c.enabled, updated_at: c.updated_at };
  }

  /** 설정 갱신 — 슈퍼관리자만 (컨트롤러에서 가드). */
  async updateConfig(params: { api_key?: string; model?: string; max_tokens?: number; enabled?: boolean }, adminId: number): Promise<{ ok: boolean }> {
    // 부분 갱신: 전달된 필드만 업데이트
    const sets: string[] = [];
    const values: unknown[] = [];
    if (params.api_key !== undefined) {
      // 'sk-ant-' 시작 검증 (간단)
      if (params.api_key && !params.api_key.startsWith('sk-ant-')) {
        throw new BadRequestException('Anthropic API 키 형식이 아닙니다 (sk-ant- 로 시작해야 함)');
      }
      sets.push('api_key = $' + (values.length + 1));
      values.push(params.api_key);
    }
    if (params.model !== undefined) {
      sets.push('model = $' + (values.length + 1));
      values.push(params.model);
    }
    if (params.max_tokens !== undefined) {
      sets.push('max_tokens = $' + (values.length + 1));
      values.push(params.max_tokens);
    }
    if (params.enabled !== undefined) {
      sets.push('enabled = $' + (values.length + 1));
      values.push(params.enabled);
    }
    if (sets.length === 0) return { ok: true };

    sets.push('updated_at = NOW()');
    sets.push(`updated_by = ${adminId}`);

    // postgres.js sql 템플릿으로 동적 UPDATE — sql.unsafe 사용
    await this.sql.unsafe(
      `UPDATE handbook_config SET ${sets.join(', ')} WHERE id = 1`,
      values as never[],
    );
    return { ok: true };
  }

  /** API 키 + 활성화 상태 검증 + Anthropic 클라이언트 생성. */
  private async getClient(): Promise<{ client: Anthropic; model: string; max_tokens: number }> {
    const rows = await this.sql<{ api_key: string | null; model: string; max_tokens: number; enabled: boolean }[]>`
      SELECT api_key, model, max_tokens, enabled FROM handbook_config WHERE id = 1
    `;
    const c = rows[0];
    if (!c || !c.api_key) {
      throw new BadRequestException('Anthropic API 키 미설정. 슈퍼관리자가 사이드바 → 환경설정 → 운영 바이블 AI 에서 키 입력 필요.');
    }
    if (!c.enabled) {
      throw new BadRequestException('운영 바이블 AI 비활성 상태. 슈퍼관리자가 활성화 토글 후 사용 가능.');
    }
    const client = new Anthropic({ apiKey: c.api_key });
    return { client, model: c.model, max_tokens: c.max_tokens };
  }

  /**
   * 컨텍스트 추출 — 키워드 검색으로 상위 N개 항목 + 본문 + .tech.md 양쪽.
   */
  private buildContext(query: string, limit = 4): { contextText: string; sources: { slug: string; title: string }[] } {
    const hits = this.handbook.search(query, limit);
    if (hits.length === 0) {
      return { contextText: '관련 운영 바이블 항목을 찾지 못함.', sources: [] };
    }
    const blocks: string[] = [];
    const sources: { slug: string; title: string }[] = [];
    for (const hit of hits) {
      const mdPath = join(this.handbook.root, `${hit.slug}.md`);
      const techPath = join(this.handbook.root, `${hit.slug}.tech.md`);
      let body = '';
      try {
        if (existsSync(mdPath)) body += readFileSync(mdPath, 'utf-8');
        if (existsSync(techPath)) body += '\n\n--- 기술 상세 (AI 전용) ---\n' + readFileSync(techPath, 'utf-8');
      } catch {
        continue;
      }
      // 본문 최대 4000자 cap (토큰 절약)
      if (body.length > 4000) body = body.slice(0, 4000) + '\n... (생략)';
      blocks.push(`## [${hit.title}] (slug: ${hit.slug})\n\n${body}`);
      sources.push({ slug: hit.slug, title: hit.title });
    }
    return { contextText: blocks.join('\n\n=====\n\n'), sources };
  }

  /** 시스템 프롬프트 빌더. SQL Tool 활성 여부에 따라 분기. */
  private buildSystemPrompt(contextText: string, sqlEnabled: boolean): string {
    const sqlSection = sqlEnabled
      ? `

## DB 조회 Tool (sql_query)

운영자가 "특정 회원의 데이터", "어제 매출", "최근 환불 케이스" 같이 **실제 DB 데이터가 필요한 질문**을 하면 sql_query Tool 을 호출해 PostgreSQL SELECT 쿼리를 실행하세요.

### SQL 작성 규칙
- SELECT 또는 WITH 만 허용 (INSERT/UPDATE/DELETE 금지)
- LIMIT 100 자동 적용됨
- 민감 필드 자동 마스킹 (phone, password, bank_account 등)
- 일반 사용자 질문에 답하기 위한 최소한의 쿼리만

### 주요 테이블 요약

- \`member\`: 회원 정보 (id, mb_id, nickname, phone, role, m2net_membid, csrid, grade, state)
- \`point\`: 회원 잔액 (member_id, free_balance, paid_balance, earning_balance)
- \`point_history\`: 코인 변동 이력 (member_id, amount, type='charge'/'use'/'refund'/'attendance' 등, reason)
- \`consultation\`: 통화/채팅 이력 (id, member_id, counselor_id, type='call'/'chat', usetm, amt, reason, started_at)
- \`chat_room\`: 채팅방 (id, member_id, counselor_id, status='STAY'/'CNCH'/'DISCONNECT', charge_minutes, started_at)
- \`payment\`: 결제 이력 (id, member_id, amount, status, pg_method, paid_at)
- \`refund\`: 환불 이력 (id, member_id, amount, reason, admin_id)
- \`member_chat_quick_refund_log\`: G 정책 5초 환불 (member_id, chat_room_id, refund_amount)
- \`settlement\`: 상담사 정산 (counselor_id, gross_amount, withholding_tax, net_amount, status)
- \`payout_request\`: 선지급 (counselor_id, requested_amount, fee, withholding_tax, actual_amount, status)
- \`alimtalk_log\`: 알림톡 발송 이력 (template_code, phone, success, error_reason)

### Tool 호출 예시

질문: "01012345678 회원이 통화시간과 차감이 이상하다고 해요"

→ sql_query 호출:
\`\`\`sql
SELECT c.id, c.type, c.usetm, c.amt, c.reason, c.started_at
FROM consultation c
JOIN member m ON m.id = c.member_id
WHERE m.phone = '01012345678'
ORDER BY c.started_at DESC LIMIT 10
\`\`\`

→ 결과 받아서 정책 (바이블) + 실제 데이터로 종합 답변:
"01012345678 회원의 최근 통화 10건 확인 결과:
- 5/30 14:30 통화 73초, 5,000원 차감 → 정상 (50초 초과)
- 5/30 15:42 통화 38초, 5,000원 차감 → ⚠️ 50초 이내인데 환불 안 됨, 점검 필요

50초 이내 통화는 '고객보호비용' 으로 자동 환불되어야 하는데, 두 번째 케이스는 처리 누락 의심됩니다. 사이드바 → 매출현황 → 환불 이력에서 수동 환불 처리 권장.

📚 출처: [환불 정책](payment/04-refund)"

### SQL Tool 사용 가이드라인
- 운영자 질문에 실제 데이터가 필요할 때만 호출
- 일반 정책 답변만으로 충분하면 호출하지 말 것
- 한 번에 한 쿼리만, 최소한의 컬럼만 선택
- 결과 분석 후 정책 (바이블) 과 비교해 진단까지 제공
`
      : '';

    return `당신은 사주플랜(SAJUPLAN) 운영자를 돕는 어시스턴트입니다.

## 답변 규칙

1. **운영자 친화 톤**: 일반관리자(개발자 X)도 이해할 수 있게. 코드 라인·DB 컬럼명은 가급적 피하고 메뉴 위치·시나리오 중심으로.
2. **출처 강제**: 답변 끝에 반드시 "📚 출처: [항목명](slug)" 형식으로 참조한 바이블 항목을 명시.
3. **컨텍스트 외 답변 금지**: 아래 운영 바이블 컨텍스트에 없는 내용은 답변하지 말고 "바이블에 정보 없습니다. 더 자세한 영역은 사장님께 문의해주세요." 라고 답할 것.
4. **추측 금지**: 확신 없으면 모른다고 답할 것.
5. **간결성**: 2-5단락 권장. 불필요한 장황함 X.
${sqlSection}
## 답변 형식 예시

회원이 채팅 5초 안에 끝나면 자동 환불됩니다 (G 정책).
한도는 일 2회, 주 4회예요. 한도 초과 시 환불 X.

수동 환불은 사이드바 → 매출현황 → 환불 이력 에서 처리 가능합니다.

📚 출처:
- [채팅 코인 차감 정책](chat/01-prepaid-policy)
- [환불 정책](payment/04-refund)

## 사주플랜 운영 바이블 컨텍스트

${contextText}

---

위 컨텍스트와 (필요 시) DB 조회 결과를 근거로 운영자 질문에 답하세요. 한국어로 답변.`;
  }

  /**
   * 세션 생성 또는 이어쓰기.
   * sessionId 없으면 새 세션 만들기.
   */
  async ask(params: { adminId: number; query: string; sessionId?: number | null }): Promise<{
    session_id: number;
    answer: string;
    sources: { slug: string; title: string }[];
    sql_executions: { sql: string; row_count: number; truncated: boolean }[];
    tokens_in: number;
    tokens_out: number;
  }> {
    const q = (params.query ?? '').trim();
    if (!q) throw new BadRequestException('질문이 비어있습니다.');
    if (q.length > 2000) throw new BadRequestException('질문이 너무 깁니다 (2000자 이내).');

    const { client, model, max_tokens } = await this.getClient();

    // 1) 세션 결정
    let sessionId = params.sessionId ?? null;
    if (sessionId) {
      const sess = await this.sql<{ id: number; admin_id: number }[]>`
        SELECT id, admin_id FROM handbook_chat_session WHERE id = ${sessionId}
      `;
      if (sess.length === 0) throw new NotFoundException('세션 없음');
      if (sess[0].admin_id !== params.adminId) throw new ForbiddenException('본인 세션 아님');
    } else {
      const created = await this.sql<{ id: number }[]>`
        INSERT INTO handbook_chat_session (admin_id, title)
        VALUES (${params.adminId}, ${q.slice(0, 80)})
        RETURNING id
      `;
      sessionId = created[0].id;
    }

    // 2) 옛 대화 turn (멀티턴)
    const prior = await this.sql<{ role: 'user' | 'assistant'; content: string }[]>`
      SELECT role, content FROM handbook_chat_message
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC LIMIT 10
    `;
    const priorAsc = prior.reverse();

    // 3) 컨텍스트 추출
    const { contextText, sources } = this.buildContext(q, 4);

    // 4) SQL Tool 활성 여부
    const sqlEnabled = this.sqlTool.isEnabled();
    const systemPrompt = this.buildSystemPrompt(contextText, sqlEnabled);

    // Tool 정의
    const tools: Anthropic.Tool[] = sqlEnabled
      ? [
          {
            name: 'sql_query',
            description:
              '사주플랜 DB 에서 PostgreSQL SELECT 쿼리 실행. 회원/상담사/결제/채팅/통화/정산 데이터 조회. 변경 작업 X. LIMIT 100 자동 적용. 민감 필드 자동 마스킹.',
            input_schema: {
              type: 'object' as const,
              properties: {
                sql: {
                  type: 'string',
                  description: 'PostgreSQL SELECT 또는 WITH 쿼리. 다른 명령 차단됨.',
                },
                purpose: {
                  type: 'string',
                  description: '이 쿼리를 실행하는 이유 (운영자 질문 답변에 어떻게 쓸지).',
                },
              },
              required: ['sql', 'purpose'],
            },
          },
        ]
      : [];

    // 5) Tool Use loop — 최대 5 round
    const messages: Anthropic.MessageParam[] = [
      ...priorAsc.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: q },
    ];
    const sqlExecutions: { sql: string; row_count: number; truncated: boolean }[] = [];
    let tokensIn = 0;
    let tokensOut = 0;
    let finalAnswer = '';
    const MAX_ROUNDS = 5;

    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const response = await client.messages.create({
          model,
          max_tokens,
          system: systemPrompt,
          messages,
          ...(sqlEnabled ? { tools } : {}),
        });
        tokensIn += response.usage.input_tokens;
        tokensOut += response.usage.output_tokens;

        // assistant 메시지 추가 (다음 라운드 컨텍스트 유지)
        messages.push({ role: 'assistant', content: response.content });

        if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
          // 최종 답변
          for (const block of response.content) {
            if (block.type === 'text') finalAnswer += block.text;
          }
          break;
        }

        if (response.stop_reason === 'tool_use') {
          // Tool 호출 처리
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use' && block.name === 'sql_query') {
              const input = block.input as { sql?: string; purpose?: string };
              const sql = (input.sql ?? '').toString();
              try {
                const result = await this.sqlTool.execute(sql);
                sqlExecutions.push({
                  sql: result.executed_sql,
                  row_count: result.row_count,
                  truncated: result.truncated,
                });
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({
                    row_count: result.row_count,
                    truncated: result.truncated,
                    rows: result.rows.slice(0, 50),
                  }),
                });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  is_error: true,
                  content: `SQL 실행 실패: ${msg}`,
                });
              }
            }
          }
          messages.push({ role: 'user', content: toolResults });
          continue;
        }

        // 그 외 stop_reason — break
        for (const block of response.content) {
          if (block.type === 'text') finalAnswer += block.text;
        }
        break;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Claude API 호출 실패: ${msg}`);
      if (msg.includes('rate') || msg.includes('quota') || msg.includes('credit')) {
        throw new BadRequestException('Anthropic 크레딧 / 한도 초과. 슈퍼관리자가 console.anthropic.com 에서 충전 또는 cap 확인 필요.');
      }
      if (msg.includes('authentication') || msg.includes('invalid') || msg.includes('401')) {
        throw new BadRequestException('Anthropic API 키 인증 실패. 슈퍼관리자가 키 재확인 필요.');
      }
      throw new BadRequestException(`AI 답변 실패: ${msg}`);
    }

    if (!finalAnswer) finalAnswer = '답변 생성 실패. 다시 시도해주세요.';

    // 6) 대화 저장
    await this.sql`
      INSERT INTO handbook_chat_message (session_id, role, content)
      VALUES (${sessionId}, 'user', ${q})
    `;
    await this.sql`
      INSERT INTO handbook_chat_message (session_id, role, content, sources, tokens_in, tokens_out)
      VALUES (${sessionId}, 'assistant', ${finalAnswer}, ${JSON.stringify({ sources, sql_executions: sqlExecutions })}::jsonb, ${tokensIn}, ${tokensOut})
    `;
    await this.sql`
      UPDATE handbook_chat_session SET updated_at = NOW() WHERE id = ${sessionId}
    `;

    return { session_id: sessionId, answer: finalAnswer, sources, sql_executions: sqlExecutions, tokens_in: tokensIn, tokens_out: tokensOut };
  }

  /** 본인 세션 목록 (최신순). */
  async listSessions(adminId: number, limit = 30): Promise<Array<{ id: number; title: string; updated_at: string; message_count: number }>> {
    const rows = await this.sql<{ id: number; title: string; updated_at: string; message_count: number }[]>`
      SELECT s.id, s.title, s.updated_at,
        (SELECT COUNT(*)::int FROM handbook_chat_message m WHERE m.session_id = s.id) AS message_count
      FROM handbook_chat_session s
      WHERE s.admin_id = ${adminId}
      ORDER BY s.updated_at DESC
      LIMIT ${limit}
    `;
    return rows;
  }

  /** 세션 메시지 전체 조회. */
  async getSession(adminId: number, sessionId: number): Promise<{
    id: number;
    title: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string; sources?: { slug: string; title: string }[]; created_at: string }>;
  }> {
    const sess = await this.sql<{ id: number; title: string; admin_id: number }[]>`
      SELECT id, title, admin_id FROM handbook_chat_session WHERE id = ${sessionId}
    `;
    if (sess.length === 0) throw new NotFoundException('세션 없음');
    if (sess[0].admin_id !== adminId) throw new ForbiddenException('본인 세션 아님');

    const messages = await this.sql<{ role: 'user' | 'assistant'; content: string; sources: unknown; created_at: string }[]>`
      SELECT role, content, sources, created_at FROM handbook_chat_message
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;
    return {
      id: sess[0].id,
      title: sess[0].title,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources as { slug: string; title: string }[] | undefined,
        created_at: m.created_at,
      })),
    };
  }

  /** 세션 삭제. */
  async deleteSession(adminId: number, sessionId: number): Promise<{ ok: boolean }> {
    const sess = await this.sql<{ admin_id: number }[]>`
      SELECT admin_id FROM handbook_chat_session WHERE id = ${sessionId}
    `;
    if (sess.length === 0) throw new NotFoundException('세션 없음');
    if (sess[0].admin_id !== adminId) throw new ForbiddenException('본인 세션 아님');
    await this.sql`DELETE FROM handbook_chat_session WHERE id = ${sessionId}`;
    return { ok: true };
  }
}
