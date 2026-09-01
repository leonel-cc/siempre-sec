/// <reference types="vite/client" />

interface ElectronAPI {
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  listUsbDevices: () => Promise<unknown[]>;
  getDesktopPreferences: () => Promise<DesktopPreferences>;
  setDesktopPreferences: (updates: Partial<DesktopPreferences>) => Promise<DesktopPreferences>;
}

interface DesktopPreferences {
  startWithWindows: boolean;
  keepRunningInBackground: boolean;
  preventSleep: boolean;
}

interface Window {
  electronAPI?: ElectronAPI;
}
