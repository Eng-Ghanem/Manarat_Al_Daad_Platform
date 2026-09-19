// Global In-Memory & Session Storage Cache for Instant Navigation
const memoryCache = new Map();
const DEFAULT_TTL_SECONDS = 300; // 5 minutes default

/**
 * Retrieve cached data by key
 * @param {string} key 
 * @returns {any|null}
 */
export const getCache = (key) => {
  try {
    const item = memoryCache.get(key);
    if (!item) {
      // Check sessionStorage fallback
      const sessionItem = sessionStorage.getItem(`mad_cache_${key}`);
      if (sessionItem) {
        const parsed = JSON.parse(sessionItem);
        if (parsed && (!parsed.expiry || parsed.expiry > Date.now())) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
      return null;
    }

    if (item.expiry && item.expiry < Date.now()) {
      memoryCache.delete(key);
      try { sessionStorage.removeItem(`mad_cache_${key}`); } catch (_) {}
      return null;
    }

    return item.data;
  } catch (e) {
    return null;
  }
};

/**
 * Save data to memory cache and session storage
 * @param {string} key 
 * @param {any} data 
 * @param {number} ttlSeconds 
 */
export const setCache = (key, data, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  try {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    const cacheObject = { data, expiry };
    memoryCache.set(key, cacheObject);

    try {
      sessionStorage.setItem(`mad_cache_${key}`, JSON.stringify(cacheObject));
    } catch (_) {
      // Ignore quota exceeded or DOM exceptions
    }
  } catch (e) {
    console.warn('Error setting cache:', e);
  }
};

/**
 * Clear cached items by key or prefix
 * @param {string} prefix 
 */
export const invalidateCache = (prefix = '') => {
  try {
    if (!prefix) {
      memoryCache.clear();
      try {
        Object.keys(sessionStorage).forEach(k => {
          if (k.startsWith('mad_cache_')) sessionStorage.removeItem(k);
        });
      } catch (_) {}
      return;
    }

    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix) || key.includes(prefix)) {
        memoryCache.delete(key);
        try { sessionStorage.removeItem(`mad_cache_${key}`); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('Error invalidating cache:', e);
  }
};
