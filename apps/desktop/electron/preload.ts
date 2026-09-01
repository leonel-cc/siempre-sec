import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('open-file-dialog', options || {}),
  listUsbDevices: () => ipcRenderer.invoke('list-usb-devices'),
  cloudEnrollment: {
    status: () => ipcRenderer.invoke('cloud-enrollment-status'),
    request: (cloudUrl: string, installationName: string) =>
      ipcRenderer.invoke('cloud-enrollment-request', cloudUrl, installationName),
    exchange: () => ipcRenderer.invoke('cloud-enrollment-exchange'),
    clear: () => ipcRenderer.invoke('cloud-enrollment-clear'),
  },
});
