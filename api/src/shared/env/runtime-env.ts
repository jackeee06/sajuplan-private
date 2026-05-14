/**
 * 단일 환경 플래그 SAJUMOON_ENV (test|prod) 한 곳에서 도메인 의존 값 모두 결정.
 * .env 에 도메인을 직접 적지 않는다. localhost 는 어디서도 fallback 으로 쓰지 않는다.
 *
 *   SAJUMOON_ENV=test → sajumoon.kr        (테스트 서버, 현재 동작 환경)
 *   SAJUMOON_ENV=prod → sajumoon.co.kr     (운영 서버)
 *
 * 코드에서 도메인이 필요한 모든 지점은 runtimeEnv() 의 결과를 쓴다.
 */
export type SajumoonEnv = 'test' | 'prod';

export interface RuntimeEnv {
  env: SajumoonEnv;
  userDomain: string;        // sajumoon.kr        | sajumoon.co.kr
  apiDomain: string;         // api.sajumoon.kr    | api.sajumoon.co.kr
  userSiteUrl: string;       // https://{userDomain}
  apiPublicUrl: string;      // https://{apiDomain}
  corsOrigins: string[];     // [userSiteUrl]
  cookieSecure: boolean;     // 항상 true (둘 다 https)
  pgReturnUrl: string;       // https://{apiDomain}/api/pg/charge/callback     ← PG returnurl(서버 push)
  pgFormUrl: string;         // https://{apiDomain}/api/pg/charge/complete     ← PG formurl(브라우저 POST → 백엔드)
  pgCompleteSpaUrl: string;  // https://{userDomain}/charge/complete           ← 백엔드 핸들러가 최종 redirect 할 SPA 결과 화면
  pgVbankCallbackUrl: string;// https://{apiDomain}/api/pg/charge/vbank-callback
  pgAutopayPushUrl: string;  // https://{apiDomain}/api/pg/charge/autopay-push
}

const MAP: Record<SajumoonEnv, { userDomain: string; apiDomain: string }> = {
  test: { userDomain: 'sajumoon.kr',    apiDomain: 'api.sajumoon.kr' },
  prod: { userDomain: 'sajumoon.co.kr', apiDomain: 'api.sajumoon.co.kr' },
};

let cached: RuntimeEnv | null = null;

export function runtimeEnv(): RuntimeEnv {
  if (cached) return cached;

  const raw = (process.env.SAJUMOON_ENV ?? '').trim().toLowerCase();
  if (raw !== 'test' && raw !== 'prod') {
    throw new Error(
      `SAJUMOON_ENV 환경변수가 비어있거나 잘못된 값입니다 (현재: "${raw}"). ` +
        `.env 에 SAJUMOON_ENV=test 또는 SAJUMOON_ENV=prod 를 지정하세요.`,
    );
  }
  const env = raw as SajumoonEnv;
  const { userDomain, apiDomain } = MAP[env];
  const userSiteUrl = `https://${userDomain}`;
  const apiPublicUrl = `https://${apiDomain}`;

  cached = {
    env,
    userDomain,
    apiDomain,
    userSiteUrl,
    apiPublicUrl,
    corsOrigins: [userSiteUrl],
    cookieSecure: true,
    pgReturnUrl: `${apiPublicUrl}/api/pg/charge/callback`,
    // PG formurl 은 백엔드로 받아야 한다 (nginx 정적 SPA 에 POST 가면 405 Not Allowed).
    // 백엔드 핸들러가 처리 후 pgCompleteSpaUrl 로 302 redirect 한다.
    pgFormUrl: `${apiPublicUrl}/api/pg/charge/complete`,
    pgCompleteSpaUrl: `${userSiteUrl}/charge/complete`,
    pgVbankCallbackUrl: `${apiPublicUrl}/api/pg/charge/vbank-callback`,
    pgAutopayPushUrl: `${apiPublicUrl}/api/pg/charge/autopay-push`,
  };
  return cached;
}
