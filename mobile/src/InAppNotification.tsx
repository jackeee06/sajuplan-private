import React, {useCallback, useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export type InAppMessage = {
  id: number;
  title?: string;
  body?: string;
  /** 푸시 data 의 이동 경로(event_url 등). 배너 탭 시 이 URL 로 이동. */
  url?: string;
};

type Props = {
  message: InAppMessage | null;
  onDismiss: () => void;
  onPress?: () => void;
  /** ms */
  duration?: number;
};

// 사용자가 직접 닫을 때까지 유지하는 게 기본. 자동 타이머는 너무 오래 떠 있는
// 케이스를 막기 위한 백업.
const DEFAULT_DURATION = 15000;

/**
 * 포그라운드 푸시 인앱 배너 — Android 헤드업 알림 느낌의 상단 슬라이드 토스트.
 *
 * - 시스템 알림은 앱이 백그라운드일 때만 자동 표시되므로 포그라운드에서는
 *   `messaging().onMessage()` 로 받은 알림을 이걸로 대신 띄워준다.
 * - 카드 탭 → onPress(딥링크 이동) + 닫힘. 우측 상단 X → 단순 닫힘.
 * - 자동 타이머(15초)는 백업이고, 사용자가 명시적으로 닫는 게 1차 흐름.
 */
export default function InAppNotification({
  message,
  onDismiss,
  onPress,
  duration = DEFAULT_DURATION,
}: Props) {
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // 슬라이드 아웃 → onDismiss. X 버튼/카드 탭/자동 타이머 모두 동일 경로.
  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (finished) onDismiss();
    });
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();

    const t = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(t);
  }, [message, translateY, opacity, dismiss, duration]);

  if (!message) return null;

  const hasUrl = !!message.url;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          transform: [{translateY}],
          opacity,
          paddingTop: insets.top + 8,
        },
      ]}>
      <Pressable
        onPress={() => {
          onPress?.();
          dismiss();
        }}
        style={styles.card}
        accessibilityRole="alert">
        <Image
          source={require('./assets/logo.png')}
          style={styles.icon}
          resizeMode="cover"
        />
        <View style={styles.textWrap}>
          {!!message.title && (
            <Text style={styles.title} numberOfLines={1}>
              {message.title}
            </Text>
          )}
          {!!message.body && (
            <Text style={styles.body} numberOfLines={2}>
              {message.body}
            </Text>
          )}
          {hasUrl && (
            <Text style={styles.linkHint} numberOfLines={1}>
              탭하여 자세히 보기 →
            </Text>
          )}
        </View>
        {/* 우측 상단 닫기 — 카드 탭(딥링크)과 분리. 자식 Pressable 이 부모보다
            먼저 hit 되므로 X 탭은 dismiss 만 실행되고 onPress 는 발화 안 됨. */}
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="알림 닫기">
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 14,
    // 우측은 X 버튼(28) + 8 여백 확보.
    paddingRight: 44,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  textWrap: {flex: 1, gap: 2},
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#030712',
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    color: '#4A5565',
    lineHeight: 20,
  },
  linkHint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#8259F5',
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  closeIcon: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
    lineHeight: 14,
  },
});
