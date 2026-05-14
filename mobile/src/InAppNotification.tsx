import React, {useEffect, useRef} from 'react';
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
};

type Props = {
  message: InAppMessage | null;
  onDismiss: () => void;
  onPress?: () => void;
  /** ms */
  duration?: number;
};

const DEFAULT_DURATION = 8000;

/**
 * 포그라운드 푸시 인앱 배너 — Android 헤드업 알림 느낌의 상단 슬라이드 토스트.
 *
 * - 시스템 알림은 앱이 백그라운드일 때만 자동 표시되므로 포그라운드에서는
 *   `messaging().onMessage()` 로 받은 알림을 이걸로 대신 띄워준다.
 * - 4.5초 후 자동 dismiss + 탭 시 즉시 닫힘 + 위로 swipe 도 dismiss(는 생략, 단순화).
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
    }, duration);

    return () => clearTimeout(t);
  }, [message, translateY, opacity, onDismiss, duration]);

  if (!message) return null;

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
          onDismiss();
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
        </View>
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
    paddingHorizontal: 14,
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
    fontSize: 15,
    fontWeight: '600',
    color: '#030712',
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    color: '#4A5565',
    lineHeight: 18,
  },
});
