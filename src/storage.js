/**
 * Drop-in replacement for the artifact sandbox's `window.storage` API.
 *
 * The original board ran inside Claude's artifact iframe, which provides an
 * async key/value store. Out here we back it with localStorage, keeping the
 * same async shape so the component code is unchanged.
 *
 * Data is per-device and per-browser. Nothing leaves the phone.
 */

const MEMORY = new Map();

function available() {
  try {
    const k = "__care_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    // Private browsing / storage blocked — fall back to in-memory so the app
    // still works for the session rather than crashing.
    return false;
  }
}

const HAS_LS = typeof window !== "undefined" && available();

export const storage = {
  async get(key) {
    if (!HAS_LS) return MEMORY.has(key) ? { value: MEMORY.get(key) } : null;
    const value = window.localStorage.getItem(key);
    return value === null ? null : { value };
  },

  async set(key, value) {
    if (!HAS_LS) {
      MEMORY.set(key, value);
      return;
    }
    window.localStorage.setItem(key, value);
  },

  async remove(key) {
    if (!HAS_LS) {
      MEMORY.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
  },
};

export const storageIsPersistent = HAS_LS;
