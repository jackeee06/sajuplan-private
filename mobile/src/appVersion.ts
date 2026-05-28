/**
 * 앱 버전 체크 — 부팅 시 서버 최신 버전과 비교해 강제 업데이트 여부 판단.
 *
 * 서버: GET https://api.sajuplan.com/api/app/version
 *   { aos_latest_version, ios_latest_version, aos_store_url, ios_store_url }
 *
 * 현재 빌드 버전:
 *   - Android: versionName (예: "1.1.1")
 *   - iOS: CFBundleShortVersionString (예: "1.1")
 *   react-native-device-info 등 추가 의존성 없이 네이티브 fetch 로는 못 가져오므로
 *   빌드 시 build.gradle / Info.plist 와 동일한 값을 상수로 둔다.
 *   → 신규 빌드 낼 때마다 APP_VERSION 도 함께 갱신.
 */

import { Platform } from 'react-native';
import { API_URL } from './config';

// 빌드 시점 버전. android/app/build.gradle versionName / ios Info.plist CFBundleShortVersionString 과 일치시킨다.
export const APP_VERSION = Platform.select({
  ios: '1.1.5',
  android: '1.1.5',
  default: '0.0.0',
});

export type AppVersionResponse = {
  aos_latest_version: string;
  ios_latest_version: string;
  aos_store_url: string;
  ios_store_url: string;
};

export type UpdateInfo = {
  needsUpdate: boolean;
  latestVersion: string;
  storeUrl: string;
};

/**
 * SemVer 풍 비교 — "1.1" vs "1.1.1" 같은 다른 자리수도 처리.
 * 빈 자리는 0 으로 채워 비교.
 */
function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export async function fetchAppVersion(): Promise<AppVersionResponse | null> {
  try {
    const r = await fetch(`${API_URL}/api/app/version`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return null;
    return (await r.json()) as AppVersionResponse;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const data = await fetchAppVersion();
  if (!data) return null;

  const latestVersion =
    Platform.OS === 'ios' ? data.ios_latest_version : data.aos_latest_version;
  const storeUrl =
    Platform.OS === 'ios' ? data.ios_store_url : data.aos_store_url;

  if (!latestVersion || !storeUrl) return null;

  const needsUpdate = compareVersion(APP_VERSION, latestVersion) < 0;
  return { needsUpdate, latestVersion, storeUrl };
}
