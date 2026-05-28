/**
 * Sajumoon mobile shell — WebView wrapper around APP_CONFIG.webUrl.
 *
 * Responsibilities:
 *  - Render the website inside react-native-webview.
 *  - Hardware back: walk webview history first, exit app at root.
 *  - Bridge: web can postMessage to request native image picking
 *    (useful when <input type=file> behaves badly on Android WebView).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  BackHandler,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {WebView, type WebViewMessageEvent, type WebViewNavigation} from 'react-native-webview';
import BootSplash from 'react-native-bootsplash';
import CookieManager from '@react-native-cookies/cookies';

import {APP_CONFIG} from './src/config';
import {
  buildInjectedReply,
  parseBridgeMessage,
  type BridgeReply,
} from './src/bridge';
import {pickImage} from './src/useImagePicker';
import {
  extractDeepLink,
  fcmGetToken,
  fcmSubscribe,
  fcmUnsubscribe,
  initFcm,
  onForegroundMessage,
  onNotificationOpen,
} from './src/fcm';
import InAppNotification, {type InAppMessage} from './src/InAppNotification';
import UpdateRequiredModal from './src/UpdateRequiredModal';
import {APP_VERSION, checkForUpdate, type UpdateInfo} from './src/appVersion';

const INJECTED_BOOTSTRAP = `
(function () {
  // 시스템 글자 크기 설정(접근성/디스플레이) 영향 차단 — 디자인된 px 그대로 노출.
  // iOS WebView 의 자동 텍스트 조정 + Android WebView 의 텍스트 줌 + 사용자 핀치 확대로
  // 글자만 비례 없이 커지는 현상을 막는다. (Android 는 RN 측 textZoom={100} 과 함께)
  try {
    var __fixFont = function () {
      var d = document.documentElement;
      if (!d) return;
      d.style.setProperty('-webkit-text-size-adjust', '100%', 'important');
      d.style.setProperty('text-size-adjust', '100%', 'important');
      if (document.body) {
        document.body.style.setProperty('-webkit-text-size-adjust', '100%', 'important');
        document.body.style.setProperty('text-size-adjust', '100%', 'important');
      }
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp) {
        vp = document.createElement('meta');
        vp.setAttribute('name', 'viewport');
        document.head && document.head.appendChild(vp);
      }
      vp.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    };
    __fixFont();
    document.addEventListener('DOMContentLoaded', __fixFont);
  } catch (_) {}

  if (window.__sajumoonBridgeReady) { return; }
  window.__sajumoonBridgeReady = true;
  window.__sajumoonBridgeListeners = {};
  window.__sajumoonBackHandler = null;

  // Auto-route inbound MessageEvents to per-request listeners and to the
  // currently-registered back handler.
  window.addEventListener('message', function (e) {
    var msg;
    try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (_) { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'BACK_PRESSED') {
      var fn = window.__sajumoonBackHandler;
      var handled = false;
      if (typeof fn === 'function') {
        try { handled = !!fn({ url: location.href, path: location.pathname }); } catch (_) {}
      }
      // Always answer native — explicit > timeout. Native skips its default
      // for HANDLED, runs default immediately for DELEGATE.
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: handled ? 'BACK_HANDLED' : 'BACK_DELEGATE',
          requestId: msg.requestId
        }));
      }
      return;
    }
    if (msg.requestId && window.__sajumoonBridgeListeners[msg.requestId]) {
      try { window.__sajumoonBridgeListeners[msg.requestId](msg); } catch (_) {}
    }
  });

  window.SajumoonBridge = {
    isNative: true,
    platform: '${Platform.OS}',
    pickImage: function (source) {
      return new Promise(function (resolve, reject) {
        if (!window.ReactNativeWebView) {
          reject(new Error('not in webview'));
          return;
        }
        var requestId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        window.__sajumoonBridgeListeners[requestId] = function (msg) {
          if (!msg || msg.requestId !== requestId) return;
          delete window.__sajumoonBridgeListeners[requestId];
          if (msg.ok) resolve(msg);
          else reject(new Error(msg.error || 'failed'));
        };
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PICK_IMAGE',
          requestId: requestId,
          source: source || 'auto'
        }));
      });
    },
    // Register a function to be called when the user presses hardware back.
    // Signature: (info: {url, path}) => boolean
    //   return true  -> web handled it; native does nothing
    //   return false -> native runs default (goBack history, then exit dialog)
    // Replaces any previously-registered handler.
    onBackPressed: function (handler) {
      window.__sajumoonBackHandler = typeof handler === 'function' ? handler : null;
    },
    closeApp: function () {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOSE_APP' }));
      }
    },
    // Open a URL outside the WebView (system browser or matching app —
    // e.g. Kakao channel link should open the Kakao app or browser, not
    // navigate the WebView away from sajumoon.kr).
    openExternal: function (url) {
      if (!window.ReactNativeWebView || typeof url !== 'string' || !url) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'OPEN_EXTERNAL_URL', url: url
      }));
    },
    // FCM 토픽 일괄 갱신 — sample push_topic_update 의 RN 버전.
    // unsubscribe 먼저, subscribe 다음으로 처리되어 toggle 잔재가 없음.
    fcmTopicUpdate: function (subscribe, unsubscribe) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FCM_TOPIC_UPDATE',
        subscribe: Array.isArray(subscribe) ? subscribe : [],
        unsubscribe: Array.isArray(unsubscribe) ? unsubscribe : []
      }));
    },
    // 현재 디바이스 FCM 토큰 요청. Promise 로 반환 (네이티브가 비동기로
    // dispatch 하는 native_fcm_token 이벤트를 1회 listen).
    fcmGetToken: function () {
      return new Promise(function (resolve) {
        if (!window.ReactNativeWebView) {
          resolve(null);
          return;
        }
        var done = false;
        var listener = function (e) {
          if (done) return;
          done = true;
          window.removeEventListener('native_fcm_token', listener);
          resolve((e && e.detail && e.detail.token) || null);
        };
        window.addEventListener('native_fcm_token', listener);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FCM_REQUEST_TOKEN'
        }));
        setTimeout(function () {
          if (done) return;
          done = true;
          window.removeEventListener('native_fcm_token', listener);
          resolve(null);
        }, 4000);
      });
    }
  };
  window.dispatchEvent(new Event('SajumoonBridgeReady'));
})();
true;
`;

// How long native waits for the web side to acknowledge BACK_PRESSED before
// running its own default behavior. Round-trip across the WebView bridge is
// usually < 30ms; 120ms keeps us responsive while tolerating slower devices.
const BACK_ACK_TIMEOUT_MS = 120;

export default function App(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const currentUrlRef = useRef<string>(APP_CONFIG.webUrl);
  // Loader is only for the very first page load. In-page navigations after
  // that are fast and shouldn't pop a fullscreen spinner — and we'd otherwise
  // get stuck if onLoadEnd never fires (cancelled redirects, hash changes…).
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  // 포그라운드(앱 화면 안)에서 받은 푸시를 표시할 인앱 배너 메시지.
  // 시스템 알림은 백그라운드일 때만 자동 표시되므로 포그라운드 메시지는
  // onForegroundMessage 로 받아서 우리가 직접 띄운다.
  const [inAppMessage, setInAppMessage] = useState<InAppMessage | null>(null);
  const inAppCounterRef = useRef(0);

  // 강제 업데이트 안내 모달.
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // 푸시 딥링크 — 첫 로드가 끝나기 전(콜드스타트)에 도착한 URL 은 여기에 담아뒀다가
  // onLoadEnd 에서 이동시킨다. WebView 가 아직 webUrl 로딩 중이면 location.href 주입이
  // 첫 로드에 묻혀버리기 때문.
  const firstLoadDoneRef = useRef(false);
  const pendingDeepLinkRef = useRef<string | null>(null);

  // 딥링크 경로를 webUrl 기준 절대 URL 로 해석. 절대 URL 은 그대로,
  // '/path' 또는 'path' 는 webUrl 에 붙인다.
  const resolveDeepLink = useCallback((raw: string): string | null => {
    const s = (raw || '').trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    const base = APP_CONFIG.webUrl.replace(/\/+$/, '');
    return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
  }, []);

  // WebView 를 해당 URL 로 이동. 첫 로드 전이면 보류 후 onLoadEnd 에서 처리.
  const navigateWebView = useCallback(
    (raw: string) => {
      const target = resolveDeepLink(raw);
      if (!target) return;
      if (!firstLoadDoneRef.current) {
        pendingDeepLinkRef.current = target;
        return;
      }
      webViewRef.current?.injectJavaScript(
        `try { location.href = ${JSON.stringify(target)}; } catch (e) {} true;`,
      );
    },
    [resolveDeepLink],
  );

  // 쿠키 영속화 — 앱이 background/inactive 로 전환되거나 종료되기 직전 강제 종료에 대비해
  // CookieManager.flush() 로 메모리상의 sjm_user 쿠키를 디스크로 영속화.
  //  - Android WebView 의 알려진 이슈: 앱 강제 종료 시 메모리 쿠키가 디스크에 저장되지 않아
  //    재실행 시 로그인이 풀리는 케이스. flush() 호출로 즉시 영속화 보장.
  //  - iOS 는 자동 영속화되므로 noop 이지만 호출은 안전.
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        CookieManager.flush().catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  // 앱 부팅 시 FCM 토큰 발급 + 서버 등록 (비로그인 상태로). 로그인 후
  // /push-token 이 다시 호출되면 자동으로 회원에 매핑된다. 권한 요청 +
  // 네트워크 호출이 들어가므로 fire-and-forget 으로 백그라운드 진행.
  useEffect(() => {
    initFcm().catch(() => {});

    // 포그라운드 푸시 수신 → 인앱 배너로 표시. data 에 event_url 등 이동 경로가
    // 있으면 함께 담아서 배너 탭 시 WebView 가 그 링크로 이동하게 한다.
    const unsub = onForegroundMessage((n) => {
      if (!n.title && !n.body) return;
      inAppCounterRef.current += 1;
      setInAppMessage({
        id: inAppCounterRef.current,
        title: n.title,
        body: n.body,
        url: extractDeepLink(n.data) ?? undefined,
      });
    });

    // 백그라운드/종료 상태에서 알림 탭 → 딥링크가 있으면 WebView 자동 이동.
    const unsubOpen = onNotificationOpen((url) => {
      navigateWebView(url);
    });

    return () => {
      try { unsub(); } catch {}
      try { unsubOpen(); } catch {}
    };
  }, [navigateWebView]);

  // 부팅 시 서버 최신 버전 조회 후 강제 업데이트 모달 노출 판단.
  useEffect(() => {
    checkForUpdate()
      .then((info) => {
        if (info?.needsUpdate) setUpdateInfo(info);
      })
      .catch(() => {});
  }, []);

  // Failsafe: hide the native splash after this long even if onLoadEnd never
  // fires (cert error, redirect storm, SSL handshake hang…). Without this,
  // a user on a flaky network sees the splash forever.
  useEffect(() => {
    const t = setTimeout(() => {
      BootSplash.hide({fade: true}).catch(() => {});
    }, 3500);
    return () => clearTimeout(t);
  }, []);

  // Pending BACK_PRESSED that web has not yet acknowledged. When web responds
  // BACK_HANDLED with a matching id we clear the timeout and skip native default.
  const backRequestRef = useRef<{
    requestId: string;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);

  // Generic native fallback for when the web side doesn't intercept. No
  // per-path logic and no native dialogs — page-specific behavior (including
  // the exit-confirm modal) is the web's responsibility, kept consistent with
  // the design system. If web JS is unreachable at the root, exit the app.
  const runNativeBackFallback = useCallback(() => {
    if (canGoBackRef.current) {
      webViewRef.current?.goBack();
      return;
    }
    BackHandler.exitApp();
  }, []);

  // Hardware back (Android only — iOS has no system back).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Cancel any in-flight back request — only the latest matters.
      if (backRequestRef.current) {
        clearTimeout(backRequestRef.current.timeout);
        backRequestRef.current = null;
      }

      const requestId = `back_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Ask web first. If web has registered SajumoonBridge.onBackPressed and
      // returns true, it will reply with BACK_HANDLED.
      webViewRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
          JSON.stringify({type: 'BACK_PRESSED', requestId}),
        )} })); true;`,
      );

      const timeout = setTimeout(() => {
        if (backRequestRef.current?.requestId !== requestId) return;
        backRequestRef.current = null;
        runNativeBackFallback();
      }, BACK_ACK_TIMEOUT_MS);

      backRequestRef.current = {requestId, timeout};
      return true;
    });
    return () => {
      sub.remove();
      if (backRequestRef.current) {
        clearTimeout(backRequestRef.current.timeout);
        backRequestRef.current = null;
      }
    };
  }, [runNativeBackFallback]);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
    currentUrlRef.current = nav.url;
  }, []);

  const replyToWeb = useCallback((reply: BridgeReply) => {
    webViewRef.current?.injectJavaScript(buildInjectedReply(reply));
  }, []);

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const msg = parseBridgeMessage(event.nativeEvent.data);
      if (!msg) return;

      switch (msg.type) {
        case 'PICK_IMAGE': {
          const result = await pickImage(msg.source ?? 'auto');
          if (result.ok) {
            replyToWeb({
              type: 'PICK_IMAGE_RESULT',
              requestId: msg.requestId,
              ok: true,
              uri: result.image.uri,
              mime: result.image.mime,
              fileName: result.image.fileName,
              width: result.image.width,
              height: result.image.height,
              fileSize: result.image.fileSize,
            });
          } else {
            replyToWeb({
              type: 'PICK_IMAGE_RESULT',
              requestId: msg.requestId,
              ok: false,
              error: result.error,
            });
          }
          break;
        }
        case 'BACK_HANDLED': {
          const pending = backRequestRef.current;
          if (pending && pending.requestId === msg.requestId) {
            clearTimeout(pending.timeout);
            backRequestRef.current = null;
          }
          break;
        }
        case 'BACK_DELEGATE': {
          const pending = backRequestRef.current;
          if (pending && pending.requestId === msg.requestId) {
            clearTimeout(pending.timeout);
            backRequestRef.current = null;
            runNativeBackFallback();
          }
          break;
        }
        case 'SNS_LOGIN': {
          // 카카오: @react-native-seoul/kakao-login → access_token (→ GET native_callback)
          // 네이버: @react-native-seoul/naver-login → access_token (→ GET native_callback)
          // 애플:  @invertase/react-native-apple-authentication → identityToken (→ web 에 dispatch → POST /apple/native)
          //        ※ iOS 전용. Android 에선 not_implemented.
          let token: string | null = null;
          let appleExtra: { name?: string; email?: string } = {};
          let isApple = false;
          let errorMsg = 'unknown';
          try {
            if (msg.provider === 'kakao') {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const KakaoLogin = require('@react-native-seoul/kakao-login');
              const login = KakaoLogin?.login ?? KakaoLogin?.default?.login;
              const r = await login?.();
              token = r?.accessToken ?? null;
            } else if (msg.provider === 'naver') {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const NaverLoginMod = require('@react-native-seoul/naver-login');
              const NaverLogin = NaverLoginMod?.default ?? NaverLoginMod;
              await NaverLogin.initialize?.({
                appName: '사주플랜',
                consumerKey: 'el3J2RlODMyuPtyBRq0X',
                consumerSecret: 'DFuP7CgJme',
                serviceUrlSchemeIOS: 'naverlogin',
                disableNaverAppAuthIOS: false,
              });
              const r = await NaverLogin.login?.();
              token =
                r?.successResponse?.accessToken ?? r?.accessToken ?? null;
              if (!token && r?.failureResponse?.message) {
                errorMsg = r.failureResponse.message;
              }
            } else if (msg.provider === 'apple') {
              if (Platform.OS === 'ios') {
                // iOS: 네이티브 시스템 시트 (Sign in with Apple)
                isApple = true;
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const AppleAuthMod = require('@invertase/react-native-apple-authentication');
                const appleAuth =
                  AppleAuthMod?.appleAuth ?? AppleAuthMod?.default ?? AppleAuthMod;
                const r = await appleAuth.performRequest({
                  requestedOperation: appleAuth.Operation.LOGIN,
                  requestedScopes: [
                    appleAuth.Scope.FULL_NAME,
                    appleAuth.Scope.EMAIL,
                  ],
                });
                token = r?.identityToken ?? null;
                if (token) {
                  const fn = r?.fullName?.familyName ?? '';
                  const gn = r?.fullName?.givenName ?? '';
                  const combined = `${fn}${gn}`.trim();
                  if (combined) appleExtra.name = combined;
                  if (r?.email) appleExtra.email = r.email;
                } else {
                  errorMsg = 'apple_no_token';
                }
              } else {
                // Android/기타: 네이티브 Apple SDK 없음 → WebView 안에서 Apple OAuth 페이지로 이동.
                // 백엔드 /apple/start 가 state 쿠키 발급 + Apple authorize 페이지로 302.
                const ret = encodeURIComponent(msg.ret ?? '/');
                const url =
                  `${APP_CONFIG.apiUrl}/api/user/auth/social/apple/start?redirect=${ret}`;
                webViewRef.current?.injectJavaScript(
                  `try { location.replace(${JSON.stringify(url)}); } catch(e) {} true;`,
                );
                break; // 후속 token 처리 분기 스킵
              }
            } else {
              errorMsg = 'not_implemented';
            }
          } catch (e: unknown) {
            errorMsg = e instanceof Error ? e.message : 'unknown';
          }
          if (token && isApple) {
            // apple: GET callback이 아니라 web에 identityToken 그대로 dispatch → web이 POST /apple/native 호출
            const detail = JSON.stringify({
              provider: 'apple',
              success: true,
              token,
              name: appleExtra.name,
              email: appleExtra.email,
            });
            webViewRef.current?.injectJavaScript(
              `try { window.dispatchEvent(new CustomEvent('native_sns_login_result',{detail:${detail}})); } catch(e) {} true;`,
            );
          } else if (token) {
            const url =
              `${APP_CONFIG.apiUrl}/api/user/auth/social/${msg.provider}/native_callback` +
              `?token=${encodeURIComponent(token)}&ret=${encodeURIComponent(msg.ret ?? '/')}`;
            webViewRef.current?.injectJavaScript(
              `try { location.replace(${JSON.stringify(url)}); } catch(e) {} true;`,
            );
          } else {
            const detail = JSON.stringify({
              provider: msg.provider,
              success: false,
              error: errorMsg,
            });
            webViewRef.current?.injectJavaScript(
              `try { window.dispatchEvent(new CustomEvent('native_sns_login_result',{detail:${detail}})); } catch(e) {} true;`,
            );
          }
          break;
        }
        case 'OPEN_EXTERNAL_URL': {
          if (typeof msg.url === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(msg.url)) {
            Linking.openURL(msg.url).catch(() => {});
          }
          break;
        }
        case 'FCM_TOPIC_UPDATE': {
          // sample 의 push_topic_update 와 동일 시퀀스: 해제 먼저, 구독 다음.
          // chl_2 / chl_5 토글 시 디바이스가 양쪽에 동시에 들어가지 않게.
          (async () => {
            const unsub = msg.unsubscribe ?? [];
            const sub = msg.subscribe ?? [];
            if (unsub.length > 0) await fcmUnsubscribe(unsub);
            if (sub.length > 0) await fcmSubscribe(sub);
          })().catch(() => {});
          break;
        }
        case 'FCM_REQUEST_TOKEN': {
          // web 이 현재 토큰을 알아야 할 때 호출. 응답은 CustomEvent 로
          // dispatch (sample 의 native_sns_login_result 와 같은 패턴).
          (async () => {
            const token = await fcmGetToken();
            if (!token) return;
            const safe = token.replace(/[\\"]/g, '');
            webViewRef.current?.injectJavaScript(
              `(function(){try{window.dispatchEvent(new CustomEvent('native_fcm_token',{detail:{token:"${safe}"}}));}catch(e){}})();true;`,
            );
          })().catch(() => {});
          break;
        }
        case 'CLOSE_APP': {
          // react-native-exit-app calls System.exit(0) (Android) and
          // exit(0) (iOS) so the OS process actually dies, not just the
          // activity. BackHandler.exitApp() only finishes the activity.
          // Lazy require so the module being missing doesn't crash boot.
          try {
            const RNExitApp = require('react-native-exit-app').default;
            RNExitApp?.exitApp?.();
          } catch {
            BackHandler.exitApp();
          }
          break;
        }
        case 'LOG': {
          // eslint-disable-next-line no-console
          console.log('[web]', msg.payload);
          break;
        }
      }
    },
    [replyToWeb, runNativeBackFallback],
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <WebView
          ref={webViewRef}
          source={{uri: APP_CONFIG.webUrl}}
          style={styles.flex}
          // ★ '*'로 둬서 모든 스킴이 onShouldStartLoadWithRequest로 들어오게 함.
          // http(s)만 등록하면 intent://, hanaskcardansimclick://, kb-acp:// 등
          // 결제 앱 인텐트가 핸들러를 우회하고 webview가 자체적으로 처리해버림
          // (→ Play Store fallback URL로 가서 카드앱 대신 마켓이 열림).
          // 핸들러에서 http(s)만 true 반환하고 나머지는 Linking.openURL로 외부 앱 호출.
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          // 시스템 글자 크기(접근성·디스플레이 글꼴) 영향 차단 — 디자인된 px 그대로 노출.
          //  - Android: WebView 의 textZoom 을 100 으로 고정 (기본은 OS 설정값 추종)
          //  - iOS: 위 INJECTED_BOOTSTRAP 의 -webkit-text-size-adjust:100% 로 처리
          textZoom={100}
          // 쿠키 영속화 — 앱 강제 종료 후에도 sjm_user 쿠키 유지.
          //  - iOS: WebView 와 NSURLSession 간 쿠키 공유 (HTTPCookieStorage)
          //  - Android: api.sajumoon.kr 가 cross-origin(=3rd-party) 이므로 thirdPartyCookies 허용
          //  - cacheEnabled: WebView 디스크 캐시 유지 (강제 종료 시 메모리 캐시 손실 보완)
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled
          allowsBackForwardNavigationGestures
          allowFileAccess
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={INJECTED_BOOTSTRAP}
          applicationNameForUserAgent={APP_CONFIG.userAgentSuffix}
          pullToRefreshEnabled
          onNavigationStateChange={onNavigationStateChange}
          onMessage={onMessage}
          onLoadEnd={() => {
            setFirstLoadDone(true);
            firstLoadDoneRef.current = true;
            // 콜드스타트 시 보류해둔 푸시 딥링크가 있으면 첫 로드 직후 이동.
            const pending = pendingDeepLinkRef.current;
            if (pending) {
              pendingDeepLinkRef.current = null;
              webViewRef.current?.injectJavaScript(
                `try { location.href = ${JSON.stringify(pending)}; } catch (e) {} true;`,
              );
            }
            // Native splash held by RNBootSplash.init until we call hide().
            // Fade for ~150ms so the WebView's first paint isn't a hard cut.
            BootSplash.hide({fade: true}).catch(() => {});
          }}
          onError={() => {
            setFirstLoadDone(true);
            BootSplash.hide({fade: true}).catch(() => {});
          }}
          onHttpError={() => {
            setFirstLoadDone(true);
            BootSplash.hide({fade: true}).catch(() => {});
          }}
          onShouldStartLoadWithRequest={(req) => {
            // 결제 PG는 카드사·간편결제 앱(ISP/카카오페이/네이버페이/페이코/삼성페이/KB/신한/우리/하나/농협/롯데/토스 등)
            // 호출 시 webview에서 외부 스킴(intent://, hanaskcardansimclick://, kb-acp:// 등)으로 redirect.
            // 일반 http(s) 외에는 모두 외부 앱으로 넘기고 webview는 진입 차단.
            const url = req.url || '';
            if (
              url.startsWith('http://') ||
              url.startsWith('https://') ||
              url.startsWith('about:') ||
              url.startsWith('blob:') ||
              url.startsWith('data:') ||
              url.startsWith('file://')
            ) {
              return true;
            }

            // Android intent:// URL 파싱
            //   intent://path#Intent;scheme=foo;package=bar;S.browser_fallback_url=...;end
            //   → scheme://path 형태로 변환해 외부 앱 호출. 앱 미설치 시 fallback URL 또는 Play Store.
            //   Linking.openURL('intent://...')은 Android에서 직접 처리 안 됨 — 직접 파싱 필수.
            if (url.startsWith('intent://')) {
              const m = url.match(/^intent:\/\/(.*?)#Intent;(.*?)(?:;end)?$/);
              if (m) {
                const path = m[1];
                const params: Record<string, string> = {};
                m[2].split(';').filter(Boolean).forEach(kv => {
                  const eq = kv.indexOf('=');
                  if (eq > 0) params[kv.slice(0, eq)] = kv.slice(eq + 1);
                });
                const scheme = params.scheme;
                const pkg = params.package;
                const fallback = params['S.browser_fallback_url'];
                const tryFallback = () => {
                  if (fallback) {
                    Linking.openURL(decodeURIComponent(fallback)).catch(() => {});
                  } else if (pkg) {
                    Linking.openURL(`market://details?id=${pkg}`).catch(() => {});
                  }
                };
                if (scheme) {
                  Linking.openURL(`${scheme}://${path}`).catch(tryFallback);
                } else {
                  tryFallback();
                }
                return false;
              }
              const pkg2 = url.match(/package=([^;]+)/)?.[1];
              if (pkg2) {
                Linking.openURL(`market://details?id=${pkg2}`).catch(() => {});
              }
              return false;
            }

            // 일반 외부 스킴 (kakaopay://, ispmobile://, kb-acp:// 등)
            Linking.openURL(url).catch(() => {});
            return false;
          }}
        />
        {!firstLoadDone && (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#9b7af7" />
          </View>
        )}
      </SafeAreaView>
      {/* 포그라운드 푸시 인앱 배너 — SafeAreaView 바깥에서 status bar 위로
          올라가도록 SafeAreaProvider 직하위에 둠. 자기 안에서 useSafeAreaInsets
          로 top 패딩 처리. */}
      <InAppNotification
        message={inAppMessage}
        onPress={() => {
          if (inAppMessage?.url) navigateWebView(inAppMessage.url);
        }}
        onDismiss={() => setInAppMessage(null)}
      />
      <UpdateRequiredModal
        visible={!!updateInfo}
        currentVersion={APP_VERSION}
        latestVersion={updateInfo?.latestVersion ?? ''}
        storeUrl={updateInfo?.storeUrl ?? ''}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#ffffff'},
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
