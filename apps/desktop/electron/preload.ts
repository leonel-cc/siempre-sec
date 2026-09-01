import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('open-file-dialog', options || {}),
  listUsbDevices: () => ipcRenderer.invoke('list-usb-devices'),
  getDesktopPreferences: () => ipcRenderer.invoke('desktop-preferences:get'),
  setDesktopPreferences: (updates: Record<string, boolean>) =>
    ipcRenderer.invoke('desktop-preferences:set', updates),
});
