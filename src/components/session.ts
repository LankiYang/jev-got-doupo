/** Browser-local identity and preference, both tolerant of a blocked localStorage. */

const SESSION_KEY = "story-effect:session";
const MUTED_KEY = "story-effect:muted";

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
};

/** Reads the stored session id, minting and persisting one on first visit. */
export const loadSessionId = (): string => {
  const stored = read(SESSION_KEY);
  if (stored) return stored;
  return newSessionId();
};

/** Mints a fresh session id and makes it the stored one. */
/** `crypto.randomUUID` is missing from older browsers and insecure contexts; `getRandomValues` is not. */
const randomUuid = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const newSessionId = (): string => {
  const id = randomUuid();
  write(SESSION_KEY, id);
  return id;
};

export const readMuted = (): boolean => read(MUTED_KEY) === "true";

export const writeMuted = (muted: boolean): void => write(MUTED_KEY, String(muted));
