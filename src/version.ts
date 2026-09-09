// __APP_VERSION__ is injected into SEA builds from package.json by scripts/build-sea.js.
// npm exposes npm_package_version during normal development runs.
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : process.env.npm_package_version || '0.0.0';
