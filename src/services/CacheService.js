// src/services/CacheService.js

class CacheService {

  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttl = 300000) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    console.log(`Cache SET: ${key} (TTL: ${ttl / 1000}s)`);

    setTimeout(() => {
      this.delete(key);
    }, ttl);
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      console.log(`Cache MISS: ${key}`);
      return null;
    }

    const now = Date.now();
    const isExpired = (now - item.timestamp) > item.ttl;

    if (isExpired) {
      this.delete(key);
      console.log(`Cache EXPIRED: ${key}`);
      return null;
    }

    console.log(`Cache HIT: ${key}`);
    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
    console.log(`Cache DELETE: ${key}`);
  }

  clear() {
    this.cache.clear();
    console.log('Cache CLEARED');
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

}

module.exports = new CacheService();