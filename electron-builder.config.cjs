/**
 * إعداد البناء لسطح المكتب.
 * كل قيم الهوية تُقرأ من electron/brand.json المولَّد من brand.config.json.
 * لا تكتب اسم التطبيق هنا يدوياً.
 */
const fs = require('node:fs');
const path = require('node:path');

const brand = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'electron', 'brand.json'), 'utf8')
);

module.exports = {
  appId: brand.appId,
  productName: brand.productName,
  copyright: `© ${new Date().getFullYear()}`,
  directories: { output: 'release', buildResources: 'assets' },
  files: [
    'electron/**/*',
    'client/dist/**/*',
    'brand.config.json',
    '!**/*.map',
  ],
  extraResources: [
    { from: 'server/dist', to: 'server/dist' },
    { from: 'server/node_modules', to: 'server/node_modules' },
    { from: 'migrations', to: 'migrations' },
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: brand.iconIco || 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    shortcutName: brand.shortName || brand.productName,
  },
  mac: { target: ['dmg'], icon: brand.icon, category: 'public.app-category.business' },
  linux: { target: ['AppImage', 'deb'], icon: brand.icon, category: 'Office' },
};
