const crypto = require('crypto');
const redis = require('#configs/redis.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

const EXTEND_LEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_LEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

function generateLeaderId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function createLeaderElection({
  key,
  ttlMs,
  renewMs,
  leaderId = generateLeaderId(),
  onLeader,
  onFollower,
  logContext = { traceId: 'leader-election' },
} = {}) {
  if (!key) {
    throw new Error('Leader election key is required');
  }

  let isLeader = false;
  let stopped = false;
  let tickTimer = null;
  const tickIntervalMs = Math.max(1000, Math.min(renewMs || 5000, 10000));

  const log = (message, data) => {
    try {
      logWithTrace(message, logContext, data || null);
    } catch (_) {
      /* intentionally ignored: logging must not break election */
    }
  };

  const releaseLease = async () => {
    try {
      await redis.eval(RELEASE_LEASE_SCRIPT, 1, key, leaderId);
    } catch (_) {
      /* intentionally ignored: best-effort release */
    }
  };

  const promote = async () => {
    if (isLeader || stopped) return;
    isLeader = true;
    log('Leader election acquired', { key, leaderId, ttlMs });
    if (typeof onLeader === 'function') {
      try {
        await onLeader();
      } catch (error) {
        log('Leader election onLeader failed', { error: error?.message });
        await releaseLease();
        await demote('on-leader-failed');
      }
    }
  };

  const demote = async (reason) => {
    if (!isLeader) return;
    isLeader = false;
    log('Leader election lost', { key, leaderId, reason });
    if (typeof onFollower === 'function') {
      try {
        await onFollower();
      } catch (error) {
        log('Leader election onFollower failed', { error: error?.message });
      }
    }
  };

  const tryAcquire = async () => {
    const result = await redis.set(key, leaderId, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      await promote();
    }
  };

  const extendLease = async () => {
    const extended = await redis.eval(
      EXTEND_LEASE_SCRIPT,
      1,
      key,
      leaderId,
      ttlMs
    );
    if (!extended) {
      await demote('lease-extension-failed');
    }
  };

  const tick = async () => {
    if (stopped) return;
    try {
      if (isLeader) {
        await extendLease();
        return;
      }
      await tryAcquire();
    } catch (error) {
      log('Leader election tick error', { error: error?.message });
    }
  };

  const start = async () => {
    if (stopped) return;
    await tick();
    tickTimer = setInterval(() => {
      tick().catch(() => null);
    }, tickIntervalMs);
  };

  const stop = async () => {
    stopped = true;
    if (tickTimer) clearInterval(tickTimer);
    if (isLeader) {
      await releaseLease();
      await demote('stopped');
    }
  };

  const isLeaderNow = () => isLeader;

  return {
    start,
    stop,
    isLeader: isLeaderNow,
    leaderId,
  };
}

module.exports = {
  createLeaderElection,
};
