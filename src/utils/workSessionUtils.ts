// Utility to check if any work session is currently active
const STORAGE_KEY_PREFIX = "work_session_";

interface WorkSessionState {
  isWorking: boolean;
  startTime: string | null;
}

export const isAnySessionActive = (): boolean => {
  // Iterate through all localStorage keys to find active work sessions
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const state: WorkSessionState = JSON.parse(value);
          if (state.isWorking && state.startTime) {
            return true;
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }
  return false;
};

// Storage key for last check-in timestamp
const LAST_CHECKIN_KEY = "last_checkin_timestamp";

export const getLastCheckInTimestamp = (): number | null => {
  const stored = localStorage.getItem(LAST_CHECKIN_KEY);
  return stored ? parseInt(stored, 10) : null;
};

export const setLastCheckInTimestamp = (timestamp: number): void => {
  localStorage.setItem(LAST_CHECKIN_KEY, timestamp.toString());
};

export const shouldShowCheckIn = (): boolean => {
  const lastCheckIn = getLastCheckInTimestamp();
  if (!lastCheckIn) return true;
  
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  
  return now - lastCheckIn >= oneHourMs;
};
