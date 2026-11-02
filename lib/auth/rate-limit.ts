import "server-only";

type RateLimitEntry = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map<string, RateLimitEntry>();

function pruneExpired(now: number) {
  if (store.size < 500) return;
  for (const [key, entry] of store.entries()) {
    const expiredWindow = now - entry.firstAttemptAt > WINDOW_MS;
    const expiredLock = !entry.lockedUntil || now >= entry.lockedUntil;
    if (expiredWindow && expiredLock) {
      store.delete(key);
    }
  }
}

export function checkLoginRateLimit(
  key: string,
  now: number = Date.now()
): { allowed: boolean; retryAfterSeconds?: number } {
  pruneExpired(now);
  const entry = store.get(key);
  if (!entry) {
    return { allowed: true };
  }

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    store.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(
  key: string,
  now: number = Date.now()
): { locked: boolean; retryAfterSeconds?: number } {
  const existing = store.get(key);
  if (!existing || now - existing.firstAttemptAt > WINDOW_MS) {
    store.set(key, {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    });
    return { locked: false };
  }

  const attempts = existing.attempts + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null;
  store.set(key, {
    attempts,
    firstAttemptAt: existing.firstAttemptAt,
    lockedUntil,
  });

  if (lockedUntil) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }
  return { locked: false };
}

export function clearLoginRateLimit(key: string) {
  store.delete(key);
}

export function resetAllRateLimitsForTesting() {
  store.clear();
}

