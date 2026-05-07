// middlewares/rateLimiter.js
// -------------------------------------------------------
// Upstash Redis REST API — Rate Limiting
// @upstash/redis use karta hai — HTTP-based, works on Railway/Vercel
// .env mein chahiye:
//   UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=AXxx...
// -------------------------------------------------------

const { Redis } = require("@upstash/redis");

let redis = null;

function getRedis() {
  if (redis) return redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("⚠️  Upstash env vars missing — rate limiting disabled");
    return null;
  }
  try {
    redis = new Redis({ url, token });
    console.log("✅ Upstash Redis connected — Rate limiting active");
    return redis;
  } catch (err) {
    console.warn("⚠️  Upstash Redis init failed:", err.message);
    return null;
  }
}

function createRateLimiter({ windowSec, maxHits, keyPrefix, message }) {
  return async function (req, res, next) {
    const client = getRedis();
    if (!client) return next();

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${keyPrefix}${ip}`;

    try {
      const pipeline = client.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSec);
      const [hits] = await pipeline.exec();

      res.setHeader("X-RateLimit-Limit", maxHits);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxHits - hits));

      if (hits > maxHits) {
        const ttl = await client.ttl(key);
        res.setHeader("Retry-After", ttl > 0 ? ttl : windowSec);
        return res.status(429).json({
          success: false,
          message: message || "Bahut zyada requests! Thodi der baad try karo.",
          retryAfter: ttl > 0 ? ttl : windowSec,
        });
      }
      next();
    } catch (err) {
      console.warn("Rate limiter error (allowing):", err.message);
      next();
    }
  };
}

const generalLimiter = createRateLimiter({
  windowSec: 60, maxHits: 100,
  keyPrefix: "rl:general:",
  message: "Bahut zyada requests. 1 minute baad try karo.",
});

const authLimiter = createRateLimiter({
  windowSec: 15 * 60, maxHits: 10,
  keyPrefix: "rl:auth:",
  message: "Bahut saare login attempts. 15 minute baad try karo.",
});

const uploadLimiter = createRateLimiter({
  windowSec: 10 * 60, maxHits: 20,
  keyPrefix: "rl:upload:",
  message: "Upload limit reach ho gayi. 10 minute baad try karo.",
});

const strictLimiter = createRateLimiter({
  windowSec: 60 * 60, maxHits: 5,
  keyPrefix: "rl:strict:",
  message: "Bahut saare attempts. 1 ghante baad try karo.",
});

module.exports = { generalLimiter, authLimiter, uploadLimiter, strictLimiter, createRateLimiter };
