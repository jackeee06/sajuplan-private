import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import KakaoSDKCommon
import KakaoSDKAuth
import NaverThirdPartyLogin
import FirebaseCore
import RNBootSplash

@main
class AppDelegate: RCTAppDelegate {
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    // Firebase 초기화 — GoogleService-Info.plist 자동 로드. RN 측
    // @react-native-firebase/messaging 도 이걸 통해 동작한다.
    FirebaseApp.configure()

    self.moduleName = "Sajumoon"
    self.dependencyProvider = RCTAppDependencyProvider()

    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    self.initialProps = [:]

    // Kakao SDK 초기화 — Native App Key 는 Info.plist 의 KAKAO_APP_KEY 에서 읽음
    if let appKey = Bundle.main.object(forInfoDictionaryKey: "KAKAO_APP_KEY") as? String, !appKey.isEmpty {
      KakaoSDK.initSDK(appKey: appKey)
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // BootSplash — JS 가 hide() 호출할 때까지 splash 유지. Android 의
  // RNBootSplash.init 와 대응. RN 0.77+ 부터 시그니처가 RCTRootView! 라서
  // `!` 없이 override 하면 base 메서드 매칭이 안 돼 super 가 안 뛰고
  // 결과적으로 BootSplash 가 초기화 안 됨 → splash 가 영원히 안 사라짐.
  override func customize(_ rootView: RCTRootView!) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  // 카카오톡 / 네이버 앱으로 점프 후 콜백 처리.
  override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    // kakao{APP_KEY}://oauth
    if AuthApi.isKakaoTalkLoginUrl(url) {
      return AuthController.handleOpenUrl(url: url)
    }
    // naverlogin://... — NaverThirdPartyLoginConnection 이 URL 을 가로채면 true 반환
    if NaverThirdPartyLoginConnection.getSharedInstance()?.application(app, open: url, options: options) == true {
      return true
    }
    return super.application(app, open: url, options: options)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
