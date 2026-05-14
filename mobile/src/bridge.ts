/**
 * Web ↔ Native bridge protocol.
 *
 * Web → Native: window.ReactNativeWebView.postMessage(JSON.stringify(BridgeMessage))
 * Native → Web: webViewRef.injectJavaScript(buildInjectedReply(...))
 */

export type ImageSource = 'camera' | 'gallery' | 'auto';

export type SnsProvider = 'kakao' | 'naver';

export type BridgeMessage =
  | {type: 'PICK_IMAGE'; requestId: string; source?: ImageSource}
  | {type: 'CLOSE_APP'}
  | {type: 'LOG'; payload: unknown}
  // Web → native: web handled the BACK_PRESSED with this id; native does nothing.
  | {type: 'BACK_HANDLED'; requestId: string}
  // Web → native: web does NOT want to handle this back press; native should
  // run its default (history.back or exit dialog). Sent when the registered
  // back handler returns false, or when no handler is registered.
  | {type: 'BACK_DELEGATE'; requestId: string}
  // Web → native: 카카오/네이버 등 네이티브 SDK 로그인 요청.
  // 성공 시 native 가 webView 를 GET 콜백 URL 로 이동 →
  //   백엔드가 token 으로 /me 검증 + 쿠키 발급 + SPA 페이지로 302.
  // 실패/취소 시 native 는 'native_sns_login_result' CustomEvent 를 dispatch.
  | {type: 'SNS_LOGIN'; provider: SnsProvider; ret?: string}
  // Web → native: 외부 URL을 시스템 브라우저 / 외부 앱으로 열기.
  // 카카오 채널, 외부 링크 등 — 웹뷰 내부 네비로 열면 사용자가 앱을 벗어나지
  // 못하므로 Linking.openURL 로 OS 인텐트에 위임.
  | {type: 'OPEN_EXTERNAL_URL'; url: string}
  // Web → native: FCM 토픽 일괄 구독/해제. 로그인/로그아웃 시 호출.
  // sample 의 platform.js push_topic_update 와 동일 책임.
  | {type: 'FCM_TOPIC_UPDATE'; subscribe?: string[]; unsubscribe?: string[]}
  // Web → native: 앱 토큰 다시 가져가기 (현재 토큰을 web 으로 보내라).
  // 응답은 'native_fcm_token' CustomEvent 로 전달.
  | {type: 'FCM_REQUEST_TOKEN'};


export type BridgeReply =
  | {
      type: 'PICK_IMAGE_RESULT';
      requestId: string;
      ok: true;
      uri: string;
      mime: string;
      fileName?: string;
      width?: number;
      height?: number;
      fileSize?: number;
    }
  | {
      type: 'PICK_IMAGE_RESULT';
      requestId: string;
      ok: false;
      error: string;
    };

export function buildInjectedReply(reply: BridgeReply): string {
  const json = JSON.stringify(reply).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `(function() {
    try {
      var evt = new MessageEvent('message', { data: "${json}" });
      window.dispatchEvent(evt);
      if (typeof window.__sajumoonBridgeListeners === 'object' && window.__sajumoonBridgeListeners) {
        Object.values(window.__sajumoonBridgeListeners).forEach(function(cb){ try { cb(JSON.parse("${json}")); } catch(e) {} });
      }
    } catch (e) {}
    true;
  })();`;
}

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed as BridgeMessage;
    }
  } catch {}
  return null;
}
