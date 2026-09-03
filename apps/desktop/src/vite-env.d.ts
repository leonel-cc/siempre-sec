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
    phoneRecipients: {
      list: () => Promise<PhoneRecipientView[]>;
      requestVerification: (contactName: string, phone: string) => Promise<PhoneRecipientView[]>;
      confirmVerification: (challengeId: string, code: string) => Promise<PhoneRecipientView[]>;
      setEnabled: (recipientId: string, enabled: boolean) => Promise<PhoneRecipientView[]>;
      sendTest: (recipientId: string) => Promise<{ sent: true; messageId: string | null }>;
      delete: (recipientId: string) => Promise<PhoneRecipientView[]>;
    };
    getDesktopPreferences: () => Promise<DesktopPreferences>;
    setDesktopPreferences: (updates: Partial<DesktopPreferences>) => Promise<DesktopPreferences>;
  }

  interface CloudEnrollmentStatus {
    state: 'UNENROLLED' | 'PENDING' | 'ENROLLED';
    cloudUrl?: string;
    installationId?: string;
    userCode?: string;
    expiresAt?: string;
  }

  interface DesktopPreferences {
    startWithWindows: boolean;
    keepRunningInBackground: boolean;
    preventSleep: boolean;
  }

  interface PhoneRecipientView {
    state: 'pending' | 'verified';
    challengeId?: string;
    recipientId?: string;
    contactName: string;
    phoneMask: string;
    expiresAt?: string;
    enabled?: boolean;
    verifiedAt?: string;
    requiresReverification?: boolean;
    developmentCode?: string;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
