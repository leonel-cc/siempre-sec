/// <reference types="vite/client" />

export {};

declare global {
  interface ElectronAPI {
    platform: string;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
    listUsbDevices: () => Promise<{ devices: Array<{ index: number; name: string }>; count: number }>;
    cloudEnrollment: {
      status: () => Promise<CloudEnrollmentStatus>;
      request: (cloudUrl: string, installationName: string) => Promise<CloudEnrollmentStatus>;
      exchange: () => Promise<CloudEnrollmentStatus>;
      clear: () => Promise<CloudEnrollmentStatus>;
    };
  }

  interface CloudEnrollmentStatus {
    state: 'UNENROLLED' | 'PENDING' | 'ENROLLED';
    cloudUrl?: string;
    installationId?: string;
    userCode?: string;
    expiresAt?: string;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
