export interface SystemInfo {
  platform: string;
  arch: string;
  totalMemoryMb: number;
  freeMemoryMb: number;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo>;
  log: (message: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

