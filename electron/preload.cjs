/**
 * جسر آمن بين الغلاف والواجهة.
 * لا يُمرَّر أي وصول لنظام الملفات أو Node إلى صفحة الويب.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  print: () => ipcRenderer.invoke('app:print'),
});
