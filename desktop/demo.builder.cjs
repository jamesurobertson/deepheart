/**
 * The Steam demo: the demo build (../dist-demo) packed as its own app, Deepheart Demo, with its own saves beside the
 * full game's. `npm run steam:demo` writes unpacked apps for Steam's depots to release-demo/.
 */
const { build } = require('./package.json');

module.exports = {
  ...build,
  appId: 'com.jamesurobertson.deepheart.demo',
  productName: 'Deepheart Demo',
  extraMetadata: { productName: 'Deepheart Demo', demo: true },
  directories: { output: 'release-demo' },
  extraResources: [{ from: '../dist-demo', to: 'game' }],
  // One universal Mac app: steamworks.js already ships its Mac libraries for both chips.
  mac: { ...build.mac, x64ArchFiles: '**/steamworks.js/dist/osx/*.node' },
  artifactName: 'Deepheart-Demo-${version}-${os}-${arch}.${ext}',
};
