import type { ExpoConfig } from 'expo/config';

/**
 * Expo 設定。
 * 識別子・バージョンは src/config/appConfig.json が単一ソース。
 * (app.config は CJS にトランスパイルされてから読み込まれるため TS モジュールを
 *  import できず、同じ JSON を require して共有する)
 * EAS project ID は `eas init` 実行時に extra.eas.projectId へ自動反映される。
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_CONFIG: {
  appName: string;
  slug: string;
  scheme: string;
  version: string;
  iosBundleIdentifier: string;
  androidPackageName: string;
} = require('./src/config/appConfig.json');

const config: ExpoConfig = {
  name: APP_CONFIG.appName,
  slug: APP_CONFIG.slug,
  version: APP_CONFIG.version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: APP_CONFIG.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APP_CONFIG.iosBundleIdentifier,
    icon: './assets/expo.icon',
    infoPlist: {
      // バックグラウンド再生 (ロック画面コントロールとセットで利用)
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: APP_CONFIG.androidPackageName,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'server',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-audio',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      // `eas init` で自動設定される。未設定のままでもローカル開発は可能。
      projectId: '',
    },
  },
};

export default config;
