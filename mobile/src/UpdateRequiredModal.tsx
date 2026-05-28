/**
 * 강제 업데이트 모달.
 *
 * - 부팅 시 GET https://api.sajuplan.com/api/app/version 으로 받은 최신 버전과
 *   현재 빌드 버전(versionName / CFBundleShortVersionString)이 다르면 표시한다.
 * - 닫기 버튼 없음 — "업데이트하기" 외에는 동작 불가 (Android 하드웨어 백도 무시).
 *   백 버튼 처리는 App.tsx 에서 visible 상태일 때 true 반환으로 같이 막는다.
 */

import React from 'react';
import {
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  latestVersion: string;
  currentVersion: string;
  storeUrl: string;
};

export default function UpdateRequiredModal({
  visible,
  latestVersion,
  currentVersion,
  storeUrl,
}: Props): React.JSX.Element {
  // 모달 떠 있는 동안 하드웨어 백 무시.
  React.useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const openStore = React.useCallback(() => {
    Linking.openURL(storeUrl).catch(() => {});
  }, [storeUrl]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Android 하드웨어 백 / Esc 닫기 요청 — 무시.
      }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>업데이트 안내</Text>
          <Text style={styles.body}>
            사주플랜의 새로운 버전이 출시되었습니다.{'\n'}
            원활한 이용을 위해 최신 버전으로 업데이트해주세요.
          </Text>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>현재 버전</Text>
            <Text style={styles.versionValue}>{currentVersion}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>최신 버전</Text>
            <Text style={[styles.versionValue, styles.versionLatest]}>
              {latestVersion}
            </Text>
          </View>
          <Pressable
            onPress={openStore}
            style={({pressed}) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.buttonText}>업데이트하기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#030712',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  versionLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  versionLatest: {
    color: '#8259F5',
    fontWeight: '700',
  },
  button: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#9B7AF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: '#8259F5',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
