const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix @noble/hashes and @noble/curves subpath exports
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
