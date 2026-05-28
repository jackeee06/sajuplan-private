/**
 * App configuration.
 *
 * 단일 플래그 SAJUMOON_ENV (test|prod) 한 곳에서만 도메인 결정.
 * localhost 는 어디서도 fallback 으로 쓰지 않는다.
 *
 *   SAJUMOON_ENV=test → https://sajumoon.kr     / https://api.sajumoon.kr     (테스트)
 *   SAJUMOON_ENV=prod → https://sajuplan.com    / https://api.sajuplan.com    (운영)
 *
 * .env 의 값을 react-native-config 로 읽는다. 네이티브 dotenv 플러그인이 미연결인 경우엔
 * Config 가 null 일 수 있어 try/catch — 그래도 환경값이 빠지면 명시적으로 throw 해서
 * "조용히 잘못된 도메인으로" 가는 사고는 차단한다.
 */

type SajumoonEnv = 'test' | 'prod';

const MAP: Record<SajumoonEnv, { userDomain: string; apiDomain: string }> = {
  test: { userDomain: 'sajumoon.kr', apiDomain: 'api.sajumoon.kr' },
  prod: { userDomain: 'sajuplan.com', apiDomain: 'api.sajuplan.com' },
};

// react-native-config 1.6.1 + RN 0.78 Old Architecture 조합에서 Config 모듈이 비어 반환되어
// 항상 test 폴백되는 사고가 발생했다 (BuildConfig 에는 prod 가 박혔는데도 JS 측에서 못 읽음).
// 우리 빌드는 어차피 deploy.sh 시점에 환경이 결정되므로 컴파일 타임 상수로 박는다.
// 환경 전환 시 이 한 줄만 갈고 재빌드: 'test' | 'prod'
function resolveEnv(): SajumoonEnv {
  return 'prod';
}

const ENV = resolveEnv();
const { userDomain, apiDomain } = MAP[ENV];

export const SAJUMOON_ENV: SajumoonEnv = ENV;
export const WEB_URL: string = `https://${userDomain}`;
export const API_URL: string = `https://${apiDomain}`;

export const APP_CONFIG = {
  env: ENV,
  webUrl: WEB_URL,
  apiUrl: API_URL,
  bridgeName: 'SajumoonBridge',
  userAgentSuffix: 'SajumoonApp/1.0',
} as const;
