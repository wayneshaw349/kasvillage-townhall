// app.config.js — reads app.json and, for the second test wallet, installs as a
// separate app (own ID + own storage) next to the main dev build on one phone.
//   APP_VARIANT=wallet2  ->  "KasVillage W2", com.kasvillage.mobile.wallet2
// Everything else (SDK, plugins, code) is identical; JS still loads from Metro.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'wallet2') return config;
  return {
    ...config,
    name: 'KasVillage W2',
    ios: { ...(config.ios || {}), bundleIdentifier: 'com.kasvillage.mobile.wallet2' },
    android: { ...(config.android || {}), package: 'com.kasvillage.mobile.wallet2' },
  };
};
