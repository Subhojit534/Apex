import { contextBridge, ipcRenderer } from 'electron';

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

const api: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  log: (message: string) => ipcRenderer.send('app:log', message)
};

contextBridge.exposeInMainWorld('electronAPI', api);

