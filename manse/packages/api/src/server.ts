/**
 * 만세력 API — 엔진을 감싼 독립 HTTP 서비스
 * ──────────────────────────────────────────────────────────────
 * - 외부 사이트·웹위젯·앱·타사 임베드가 호출하는 "유일한 창구".
 * - 무의존(Node 내장 http) — 보안 표면 최소화.
 * - API 키로 호출 추적·차단·향후 과금 (외부 임베드 모델).
 *
 * ⚠️ 분리 원칙: 사주플랜을 모른다. 회원·코인·결제 의존 0. 순수 계산만.
 *
 * 환경변수:
 *   PORT            기본 8787
 *   MANSE_API_KEYS  콤마구분 허용 키. 비우면 개방(개발용).
 *   MANSE_CORS      허용 Origin. 기본 "*" (임베드 위해).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { computeManse, ENGINE_VERSION, type ManseInput } from "@manse/engine";

const PORT = Number(process.env.PORT ?? 8787);
const API_KEYS = (process.env.MANSE_API_KEYS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CORS_ORIGIN = process.env.MANSE_CORS ?? "*";

function setCommon(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-api-key");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function send(res: ServerResponse, status: number, body: unknown): void {
  setCommon(res);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, limitBytes = 8192): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("요청 본문이 너무 큽니다"));
        req.destroy();
        return;
      }
      data += chunk.toString("utf8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** API 키 검사. 키가 설정돼 있으면 헤더 일치 필수. */
function authorized(req: IncomingMessage): boolean {
  if (API_KEYS.length === 0) return true; // 개발 개방
  const key = req.headers["x-api-key"];
  return typeof key === "string" && API_KEYS.includes(key);
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = (req.url ?? "/").split("?")[0];

  if (method === "OPTIONS") {
    setCommon(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === "GET" && url === "/health") {
    send(res, 200, { ok: true, engine: ENGINE_VERSION, keysRequired: API_KEYS.length > 0 });
    return;
  }

  if (method === "POST" && url === "/v1/manse") {
    if (!authorized(req)) {
      send(res, 401, { error: "유효한 x-api-key 가 필요합니다" });
      return;
    }
    try {
      const raw = await readBody(req);
      const input = JSON.parse(raw) as ManseInput;
      if (!input || typeof input.birth !== "string" || (input.gender !== "M" && input.gender !== "F")) {
        send(res, 400, { error: "birth(YYYY-MM-DDTHH:mm) 와 gender(M|F) 는 필수입니다" });
        return;
      }
      const chart = computeManse(input);
      send(res, 200, chart);
    } catch (e) {
      send(res, 400, { error: (e as Error).message });
    }
    return;
  }

  send(res, 404, { error: "not found", hint: "GET /health · POST /v1/manse" });
});

server.listen(PORT, () => {
  const mode = API_KEYS.length > 0 ? `키 ${API_KEYS.length}개 필요` : "개방(개발)";
  // eslint-disable-next-line no-console
  console.log(`[manse-api] :${PORT} 기동 · 엔진 ${ENGINE_VERSION} · 인증 ${mode} · CORS ${CORS_ORIGIN}`);
});
