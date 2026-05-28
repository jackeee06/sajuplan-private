import {Platform, PermissionsAndroid} from 'react-native';
import {APP_CONFIG} from './config';

/**
 * FCM 토큰 발급 + 서버 등록.
 *
 * - Android 13+ 는 POST_NOTIFICATIONS 런타임 권한 필요. 거부되면 토큰은
 *   여전히 발급되지만 알림은 안 뜸.
 * - iOS 는 messaging().requestPermission() 으로 별도 요청.
 *
 * 모듈 lazy require — @react-native-firebase 미설치 환경(예: 빌드 시점에는
 * 의존성 깔려있지만 빌드 산출물이 없는 dev 케이스)에서도 앱이 죽지 않게.
 */

export type ForegroundNotification = {
  title?: string;
  body?: string;
  data?: Record<string, string>;
};

type RemoteMessage = {
  notification?: {title?: string; body?: string};
  data?: Record<string, string>;
};

type Messaging = {
  requestPermission?: () => Promise<number>;
  getToken: () => Promise<string>;
  onTokenRefresh: (cb: (token: string) => void) => () => void;
  onMessage: (cb: (msg: RemoteMessage) => void) => () => void;
  subscribeToTopic: (topic: string) => Promise<void>;
  unsubscribeFromTopic: (topic: string) => Promise<void>;
  // 백그라운드에서 알림을 탭해 앱이 포그라운드로 올라올 때.
  onNotificationOpenedApp?: (cb: (msg: RemoteMessage) => void) => () => void;
  // 앱이 완전히 종료된 상태에서 알림 탭으로 콜드스타트될 때 (1회).
  getInitialNotification?: () => Promise<RemoteMessage | null>;
};

function loadMessaging(): Messaging | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/messaging');
    const fn = mod?.default ?? mod;
    return typeof fn === 'function' ? fn() : null;
  } catch {
    return null;
  }
}

async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 33) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function ensureIOSPermission(messaging: Messaging): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  if (typeof messaging.requestPermission !== 'function') return true;
  const status = await messaging.requestPermission();
  // 1=AUTHORIZED, 2=PROVISIONAL — 둘 다 OK
  return status === 1 || status === 2;
}

/** 앱 부팅 시 호출 — 권한 요청, 토큰 발급, 서버 등록까지 처리. */
export async function initFcm(): Promise<string | null> {
  const messaging = loadMessaging();
  if (!messaging) return null;

  // 권한 (Android 13+ / iOS)
  const ok =
    Platform.OS === 'android'
      ? await ensureAndroidNotificationPermission()
      : await ensureIOSPermission(messaging);
  if (!ok) {
    // 알림 권한 거부 — 토큰은 받아둘 수 있지만 사용자에게 알림 못 띄움.
    // 그래도 토큰 등록은 진행 (사용자가 나중에 권한 켜는 경우 대비).
  }

  let token: string | null = null;
  try {
    token = await messaging.getToken();
  } catch {
    return null;
  }
  if (!token) return null;

  // chl_all 은 "앱을 설치한 모든 사용자" 채널 — 로그인 무관, 부팅 시 항상 구독.
  // (fcm.md 8.2 / 8.4 표준). 로그인/로그아웃 흐름은 chl_2 · chl_5 만 토글한다.
  messaging.subscribeToTopic('chl_all').catch(() => {});

  // 서버에 토큰 등록 (비로그인 상태로 시작, 로그인 후 자동 매핑됨).
  registerTokenOnServer(token).catch(() => {});

  // 토큰 회전 시 서버에 갱신 알림.
  messaging.onTokenRefresh((next) => {
    if (next) registerTokenOnServer(next).catch(() => {});
  });

  return token;
}

async function registerTokenOnServer(token: string): Promise<void> {
  try {
    const url = `${APP_CONFIG.apiUrl.replace(/\/+$/, '')}/api/user/auth/push-token`;
    await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }),
    });
  } catch {
    // 네트워크 실패는 onTokenRefresh / 다음 부팅에서 자동 재시도.
  }
}

export async function fcmSubscribe(topics: string[]): Promise<void> {
  const messaging = loadMessaging();
  if (!messaging) return;
  for (const t of topics) {
    if (!t) continue;
    try {
      await messaging.subscribeToTopic(t);
    } catch {}
  }
}

export async function fcmUnsubscribe(topics: string[]): Promise<void> {
  const messaging = loadMessaging();
  if (!messaging) return;
  for (const t of topics) {
    if (!t) continue;
    try {
      await messaging.unsubscribeFromTopic(t);
    } catch {}
  }
}

export async function fcmGetToken(): Promise<string | null> {
  const messaging = loadMessaging();
  if (!messaging) return null;
  try {
    return await messaging.getToken();
  } catch {
    return null;
  }
}

/**
 * 포그라운드(앱 화면 안) 에서 푸시가 오면 시스템이 알림을 안 띄우므로
 * RN 측에서 직접 처리. 호출자는 받은 notification 으로 인앱 배너/토스트
 * 를 띄우면 된다. unsubscribe 함수 반환.
 */
export function onForegroundMessage(
  cb: (n: ForegroundNotification) => void,
): () => void {
  const messaging = loadMessaging();
  if (!messaging) return () => {};
  return messaging.onMessage((msg) => {
    const n = msg?.notification ?? {};
    // eslint-disable-next-line no-console
    console.log('[fcm] foreground onMessage', {
      title: n.title,
      body: n.body,
      data: msg?.data,
    });
    cb({title: n.title, body: n.body, data: msg?.data});
  });
}

/**
 * 푸시 data 페이로드에서 딥링크(이동 경로)를 추출.
 * 서버가 보내는 키가 환경마다 달라서 우선순위대로 훑는다. event_url 이 1순위.
 * 값은 절대 URL(https://…) 또는 경로(/event/123)/상대경로 모두 허용 — 실제
 * WebView 이동은 호출부(App.tsx)에서 webUrl 기준으로 해석한다.
 */
export function extractDeepLink(
  data?: Record<string, string> | null,
): string | null {
  if (!data) return null;
  const keys = [
    'event_url',
    'url',
    'link',
    'target_url',
    'move_url',
    'landing_url',
    'path',
    'deeplink',
  ];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * 알림 탭으로 앱이 열릴 때의 딥링크를 받는다. 두 경우를 모두 커버:
 *  - 백그라운드 → 알림 탭 (onNotificationOpenedApp)
 *  - 종료 상태 → 알림 탭 콜드스타트 (getInitialNotification, 부팅 시 1회)
 * data 에서 event_url 등 이동 경로가 있으면 url 로 콜백. unsubscribe 반환.
 */
export function onNotificationOpen(cb: (url: string) => void): () => void {
  const messaging = loadMessaging();
  if (!messaging) return () => {};

  // 콜드스타트: 종료 상태에서 알림 탭으로 실행된 케이스.
  if (typeof messaging.getInitialNotification === 'function') {
    messaging
      .getInitialNotification()
      .then((msg) => {
        const url = extractDeepLink(msg?.data);
        if (url) {
          // eslint-disable-next-line no-console
          console.log('[fcm] initial notification deeplink', url);
          cb(url);
        }
      })
      .catch(() => {});
  }

  // 백그라운드 → 포그라운드 복귀 케이스.
  if (typeof messaging.onNotificationOpenedApp === 'function') {
    return messaging.onNotificationOpenedApp((msg) => {
      const url = extractDeepLink(msg?.data);
      if (url) {
        // eslint-disable-next-line no-console
        console.log('[fcm] notification opened deeplink', url);
        cb(url);
      }
    });
  }

  return () => {};
}
