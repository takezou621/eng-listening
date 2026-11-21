import type { ExpoConfig } from 'expo/config';

/**
 * Expo 設定。
 * 識別子・バージョンは src/config/appConfig.json が単一ソース。
 * (app.config は CJS にトランスパイルされてから読み込まれるため TS モジュールを
 *  import できず、同じ JSON を require して共有する)
 * EAS project ID は手動設定: `eas init` はこの形式 (オブジェクト返し) の config を
 * 自動書き換えできないため、出力された ID を extra.eas.projectId に手動で記入する
 * (手順は docs/dev-setup.md §5)。未設定でもローカル開発は可能。
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

// require の戻り値は any なので、識別子が欠けたままビルドされないよう起動時に検証する
for (const key of [
  'appName',
  'slug',
  'scheme',
  'version',
  'iosBundleIdentifier',
  'androidPackageName',
] as const) {
  if (typeof APP_CONFIG[key] !== 'string' || APP_CONFIG[key] === '') {
    throw new Error(`src/config/appConfig.json の ${key} が不正です`);
  }
}

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
    icon: './assets/images/icon.png',
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
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    '@bacons/apple-targets',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B1220',
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
      // 手動設定 (手順は docs/dev-setup.md §5)。未設定のままでもローカル開発は可能。
      projectId: '',
    },
  },
};

export default config;
