import { create } from 'zustand';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SYSTEM';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  source?: string;
  hexPrefix?: string;
}

interface LoggerStore {
  logs: LogEntry[];
  maxLogs: number;
  addLog: (level: LogLevel, message: string, source?: string) => void;
  clearLogs: () => void;
  setMaxLogs: (max: number) => void;
}

function generateHexPrefix(): string {
  const chars = '0123456789ABCDEF';
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += chars[Math.floor(Math.random() * 16)];
  }
  return `0x${hex}`;
}

export const useLoggerStore = create<LoggerStore>((set) => ({
  logs: [],
  maxLogs: 50, // Keep last 50 logs

  addLog: (level: LogLevel, message: string, source?: string) => {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      message,
      source,
      hexPrefix: generateHexPrefix(),
    };

    set((state) => {
      const newLogs = [...state.logs, logEntry];
      // Keep only the last maxLogs entries
      if (newLogs.length > state.maxLogs) {
        return { logs: newLogs.slice(-state.maxLogs) };
      }
      return { logs: newLogs };
    });
  },

  clearLogs: () => set({ logs: [] }),

  setMaxLogs: (max: number) => set({ maxLogs: max }),
}));

// Helper functions for easy logging
export const logger = {
  info: (message: string, source?: string) => 
    useLoggerStore.getState().addLog('INFO', message, source),
  
  warn: (message: string, source?: string) => 
    useLoggerStore.getState().addLog('WARN', message, source),
  
  error: (message: string, source?: string) => 
    useLoggerStore.getState().addLog('ERROR', message, source),
  
  debug: (message: string, source?: string) => 
    useLoggerStore.getState().addLog('DEBUG', message, source),
  
  system: (message: string, source?: string) => 
    useLoggerStore.getState().addLog('SYSTEM', message, source),
};