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
  phoneRecipients: {
    list: () => ipcRenderer.invoke('phone-recipients:list'),
    requestVerification: (contactName: string, phone: string) =>
      ipcRenderer.invoke('phone-recipients:request', contactName, phone),
    confirmVerification: (challengeId: string, code: string) =>
      ipcRenderer.invoke('phone-recipients:confirm', challengeId, code),
    setEnabled: (recipientId: string, enabled: boolean) =>
      ipcRenderer.invoke('phone-recipients:set-enabled', recipientId, enabled),
    sendTest: (recipientId: string) => ipcRenderer.invoke('phone-recipients:test', recipientId),
    delete: (recipientId: string) => ipcRenderer.invoke('phone-recipients:delete', recipientId),
  },
  getDesktopPreferences: () => ipcRenderer.invoke('desktop-preferences:get'),
  setDesktopPreferences: (updates: Record<string, boolean>) =>
    ipcRenderer.invoke('desktop-preferences:set', updates),
});
