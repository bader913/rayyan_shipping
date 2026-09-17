/**
 * غلاف سطح المكتب — Electron
 * ---------------------------------------------------------------
 * مصمّم بحيث يكون سطح المكتب "اختيارياً بالكامل":
 * نفس بناء الويب يعمل في المتصفح وداخل Electron دون أي فرق.
 *
 * ثلاثة أوضاع تشغيل:
 *   dev      → يتصل بخادم Vite التطويري
 *   bundled  → يشغّل الخادم محلياً ويقدّم الويب المبني
 *   remote   → يفتح نشراً سحابياً قائماً (غلاف رقيق فقط)
 * ---------------------------------------------------------------
 */

const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const brand = JSON.parse(fs.readFileSync(path.join(__dirname, 'brand.json'), 'utf8'));

const MODE = process.env.APP_SHELL_MODE || (app.isPackaged ? 'bundled' : 'dev');
const REMOTE_URL = process.env.APP_REMOTE_URL || '';
const WEB_PORT = Number(process.env.WEB_PORT || brand.defaultWebPort || 5173);
const API_PORT = Number(process.env.API_PORT || brand.defaultApiPort || 3000);

let mainWindow = null;
let serverProcess = null;

// ─── الخادم المضمّن ───────────────────────────────────────────────
function startBundledServer() {
  if (MODE !== 'bundled') return;
  const { fork } = require('node:child_process');
  const entry = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
  if (!fs.existsSync(entry)) {
    console.warn('[shell] الخادم المضمّن غير موجود — تخطٍّ:', entry);
    return;
  }
  serverProcess = fork(entry, [], {
    env: { ...process.env, PORT: String(API_PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[api] ${d}`));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(`[api] ${d}`));
  serverProcess.on('exit', (code) => {
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox(brand.productName, `توقّف الخادم الداخلي (رمز ${code}).`);
    }
  });
}

function stopBundledServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// ─── تحديد العنوان ────────────────────────────────────────────────
function resolveAppUrl() {
  if (MODE === 'remote') {
    if (!REMOTE_URL) throw new Error('APP_REMOTE_URL مطلوب في وضع remote');
    return REMOTE_URL;
  }
  if (MODE === 'dev') return `http://localhost:${WEB_PORT}`;
  return `file://${path.join(__dirname, '..', 'client', 'dist', 'index.html')}`;
}

// ─── النافذة ──────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: brand.primary || '#ffffff',
    title: brand.productName,
    icon: path.join(__dirname, '..', brand.icon || 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  // الروابط الخارجية تُفتح في المتصفح، لا داخل التطبيق
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = resolveAppUrl();
    try {
      if (new URL(url).origin !== new URL(current).origin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch { /* file:// */ }
  });

  mainWindow.loadURL(resolveAppUrl());
  if (MODE === 'dev') mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ─── القائمة (عربية) ──────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: brand.shortName || brand.productName,
      submenu: [
        { role: 'reload', label: 'تحديث' },
        { role: 'forceReload', label: 'تحديث كامل' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'أدوات المطوّر' },
        { type: 'separator' },
        { role: 'quit', label: 'خروج' },
      ],
    },
    {
      label: 'تحرير',
      submenu: [
        { role: 'undo', label: 'تراجع' },
        { role: 'redo', label: 'إعادة' },
        { type: 'separator' },
        { role: 'cut', label: 'قص' },
        { role: 'copy', label: 'نسخ' },
        { role: 'paste', label: 'لصق' },
        { role: 'selectAll', label: 'تحديد الكل' },
      ],
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'resetZoom', label: 'حجم أصلي' },
        { role: 'zoomIn', label: 'تكبير' },
        { role: 'zoomOut', label: 'تصغير' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'ملء الشاشة' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── دورة الحياة ──────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startBundledServer();
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    stopBundledServer();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', stopBundledServer);
}
