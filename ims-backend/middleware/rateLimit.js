const rateLimit = require('express-rate-limit');

// Basic brute-force protection on login: caps attempts per IP rather than
// per-account, so it can't be used to lock a real user out by hammering
// their username from elsewhere, and it still blocks a script trying many
// passwords (or many usernames) from one source. 10 attempts per 15
// minutes is generous enough for a staff member mistyping a password a
// few times, tight enough to make brute-forcing impractical.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a few minutes.' },
});

module.exports = { loginRateLimiter };
