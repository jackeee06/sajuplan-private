import {Alert, Platform} from 'react-native';
import type {ImageSource} from './bridge';

type PickedImage = {
  uri: string;
  mime: string;
  fileName?: string;
  width?: number;
  height?: number;
  fileSize?: number;
};

type PickResult =
  | {ok: true; image: PickedImage}
  | {ok: false; error: string};

/**
 * Lazy-loads react-native-image-picker so the app boots even if the native
 * module hasn't been linked yet (e.g. before pod install on iOS).
 */
async function loadImagePicker() {
  try {
    const mod = await import('react-native-image-picker');
    return mod;
  } catch (e) {
    return null;
  }
}

export async function pickImage(source: ImageSource = 'auto'): Promise<PickResult> {
  const picker = await loadImagePicker();
  if (!picker) {
    return {ok: false, error: 'image-picker not installed'};
  }

  const options = {
    mediaType: 'photo' as const,
    includeBase64: false,
    quality: 0.85 as const,
    selectionLimit: 1,
    saveToPhotos: false,
  };

  let resolvedSource: ImageSource = source;
  if (source === 'auto') {
    resolvedSource = await new Promise<ImageSource>(resolve => {
      Alert.alert(
        '이미지 선택',
        '어디에서 가져올까요?',
        [
          {text: '카메라', onPress: () => resolve('camera')},
          {text: '갤러리', onPress: () => resolve('gallery')},
          {text: '취소', style: 'cancel', onPress: () => resolve('gallery')},
        ],
        {cancelable: true, onDismiss: () => resolve('gallery')},
      );
    });
  }

  const response =
    resolvedSource === 'camera'
      ? await picker.launchCamera(options)
      : await picker.launchImageLibrary(options);

  if (response.didCancel) {
    return {ok: false, error: 'canceled'};
  }
  if (response.errorCode) {
    return {ok: false, error: `${response.errorCode}: ${response.errorMessage ?? ''}`};
  }
  const asset = response.assets?.[0];
  if (!asset?.uri) {
    return {ok: false, error: 'no asset'};
  }
  return {
    ok: true,
    image: {
      uri: asset.uri,
      mime: asset.type ?? (Platform.OS === 'ios' ? 'image/jpeg' : 'image/*'),
      fileName: asset.fileName,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    },
  };
}
