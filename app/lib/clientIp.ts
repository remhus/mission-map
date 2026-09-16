import { NextRequest } from 'next/server';

/**
 * Resolves the caller's IP for rate limiting.
 *
 * Only trust headers the platform sets. Netlify overwrites
 * `x-nf-client-connection-ip` on every request, so a client cannot forge it —
 * verified by sending a spoofed value and watching the real IP win.
 *
 * `x-forwarded-for` is NOT safe to trust at the front: a client can send its own
 * value and the proxy appends the real IP after it, so the first entry is
 * attacker-controlled and the last is the one the edge observed. Keying a rate
 * limit on the first entry lets an attacker rotate it freely and bypass the limit
 * altogether — which is exactly what login brute-force protection depends on.
 */
export function clientIp(req: NextRequest): string {
  const platformIp = req.headers.get('x-nf-client-connection-ip')?.trim();
  if (platformIp) return platformIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map(h => h.trim()).filter(Boolean);
    // Last hop = closest to the edge that appended it.
    if (hops.length) return hops[hops.length - 1].slice(0, 64);
  }

  return req.headers.get('x-real-ip')?.trim().slice(0, 64) || 'unknown';
}
