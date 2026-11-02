// Polyfill defensivo para entornos de desarrollo (como Expo Go en SDK 58)
// donde el módulo nativo 'ExpoApplication' no está compilado en el cliente nativo.
// Remind no utiliza push tokens ni expo-application directamente, pero
// expo-notifications lo importa de forma estática en su punto de entrada.

if (typeof globalThis !== 'undefined') {
  const g = globalThis as unknown as {
    expo?: {
      modules?: Record<string, unknown>;
    };
  };

  g.expo = g.expo || {};
  g.expo.modules = g.expo.modules || {};

  if (!g.expo.modules.ExpoApplication) {
    g.expo.modules.ExpoApplication = {
      applicationName: 'Remind',
      applicationId: 'com.remind.app',
      nativeApplicationVersion: '1.0.0',
      nativeBuildVersion: '1',
      getInstallReferrerAsync: async () => null,
      getIosIdForVendorAsync: async () => null,
      getAndroidId: () => null,
    };
  }
}

export {};
