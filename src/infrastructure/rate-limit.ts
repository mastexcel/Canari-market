/**
 * Limitation de débit à fenêtre glissante, en mémoire.
 * Suffisant pour une instance unique ; en multi-instance, brancher une
 * implémentation Redis derrière la même interface (REDIS_URL).
 */
export interface RateLimiter {
  hit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number };
  reset(key?: string): void;
}

class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterMs: windowMs - (now - recent[0]) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 50_000) this.gc(now, windowMs);
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(key?: string) {
    if (key) this.hits.delete(key);
    else this.hits.clear();
  }

  private gc(now: number, windowMs: number) {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
  }
}

const g = globalThis as unknown as { rateLimiter?: RateLimiter };
export const rateLimiter: RateLimiter = g.rateLimiter ?? (g.rateLimiter = new MemoryRateLimiter());
