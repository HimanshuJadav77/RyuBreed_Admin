/**
 * In-memory IP rate limiter for login protection.
 * Restricts brute-force authentication attacks without third-party dependencies (e.g. Redis).
 * 
 * Lifecycle & Behavior:
 * 1. Track failed attempts per client IP in a 15-minute sliding window.
 * 2. On 5 failed attempts, immediately block further requests with HTTP 429 Too Many Requests.
 * 3. On successful authentication (HTTP 302 redirect), the counter for that IP is deleted immediately.
 * 
 * Architectural Characteristics & Limitations:
 * - Single-Instance Storage: Records are stored in process memory. Process restarts or redeploys reset the map.
 * - Horizontal Multi-Replica Scaling: In a multi-container cluster without sticky sessions, each container
 *   maintains its own isolated counter. For RyuBreed's single-instance deployment, this is optimal and cost-free.
 * - Reverse Proxy Resolution: Relies on `app.set('trust proxy', 1)` in `app.js` to read the real client IP
 *   from `X-Forwarded-For` rather than internal proxy IP addresses.
 */
const loginAttempts = new Map();

export function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15-minute window
  const maxAttempts = 5;

  const record = loginAttempts.get(ip) || { count: 0, resetTime: now + windowMs };

  // Reset window if expired
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }

  if (record.count >= maxAttempts) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    return res.status(429).render('login', {
      error: `Too many failed login attempts. Please wait ${minutesLeft} minute(s) before trying again.`,
      csrfToken: req.session?.csrfToken,
    });
  }

  // Attach record to response for incrementing on failure
  res.on('finish', () => {
    // If response was not a redirect (meaning login failed or re-rendered with error)
    if (res.statusCode >= 400 || (res.statusCode === 200 && req.method === 'POST')) {
      record.count += 1;
      loginAttempts.set(ip, record);
    } else if (res.statusCode === 302) {
      // Login succeeded, clear rate limit record
      loginAttempts.delete(ip);
    }
  });

  next();
}

export function _clearRateLimitsForTesting() {
  loginAttempts.clear();
}
