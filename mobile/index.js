/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// 백그라운드/Quit 메시지 핸들러 — RN-Firebase 요구사항: index.js 최상단에서
// 등록해야 한다 (앱이 종료된 상태에서 메시지가 오면 JS 엔진이 headless 로
// 다시 떠서 이 핸들러만 실행하기 때문). 우리는 시스템이 자동으로 알림을
// 띄우므로 별도 처리 안 함 (no-op). 그래도 등록은 해줘야 RN-Firebase 가
// '백그라운드' 라우팅 경고를 안 띄우고 onMessage 가 정상 fire 됨.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messagingMod = require('@react-native-firebase/messaging');
  const messaging = (messagingMod && (messagingMod.default ?? messagingMod))();
  if (messaging && typeof messaging.setBackgroundMessageHandler === 'function') {
    messaging.setBackgroundMessageHandler(async () => {});
  }
} catch {
  // firebase 미설치 환경에선 조용히 패스
}

AppRegistry.registerComponent(appName, () => App);
