import crypto from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";

/**
 * Single-passphrase gate for running on the public internet (cloud). Off when ACCESS_PASSPHRASE is unset (local).
 *
 * - The web shell (HTML/JS/CSS) stays public; it holds nothing private (the repo is public). What's gated is
 *   everything that reads learning data or spends the Claude subscription: `/api/*` and `/session-assets/*`.
 * - Logging in sets a long-lived HttpOnly cookie holding an HMAC of the passphrase, never the passphrase itself.
 *   Changing the passphrase logs every device out.
 * - Failed logins are rate-limited per client IP.
 */
const ACCESS_COOKIE_NAME = "study_access";
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAXIMUM_FAILED_LOGINS_PER_WINDOW = 10;

const LoginRequestSchema = z.object({ passphrase: z.string().min(1).max(500) });

export class AccessGate {
  private readonly expectedCookieValue: string | null;
  private readonly failedLoginsByClient = new Map<string, { windowStartedAtMs: number; failureCount: number }>();

  public constructor(private readonly passphrase: string | undefined) {
    this.expectedCookieValue = passphrase ? crypto.createHmac("sha256", passphrase).update("self-learning-access-v1").digest("hex") : null;
  }

  public isEnabled(): boolean {
    return this.expectedCookieValue !== null;
  }

  /** Rejects requests without a valid access cookie (401 JSON, which the web app turns into the login page). */
  public requireAccess(): MiddlewareHandler {
    return async (context, next) => {
      if (!this.isEnabled() || this.hasValidAccessCookie(context)) return next();
      return context.json({ error: "Passphrase required", loginRequired: true }, 401);
    };
  }

  /** `/api/access/status` and `/api/access/login`; mount before the gated API routes. */
  public createRoutes(): Hono {
    const routes = new Hono();

    routes.get("/access/status", (context) =>
      context.json({ gateEnabled: this.isEnabled(), hasAccess: !this.isEnabled() || this.hasValidAccessCookie(context) }),
    );

    routes.post("/access/login", async (context) => {
      if (!this.isEnabled()) return context.json({ ok: true });
      const clientKey = clientIdentifier(context);
      if (this.isRateLimited(clientKey)) return context.json({ error: "Too many attempts. Try again in 15 minutes." }, 429);

      const parsed = LoginRequestSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success || !this.passphraseMatches(parsed.data.passphrase)) {
        this.recordFailedLogin(clientKey);
        return context.json({ error: "That passphrase isn't right." }, 401);
      }

      this.failedLoginsByClient.delete(clientKey);
      setCookie(context, ACCESS_COOKIE_NAME, this.expectedCookieValue!, {
        httpOnly: true,
        secure: isHttpsRequest(context),
        sameSite: "Lax",
        path: "/",
        maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
      });
      return context.json({ ok: true });
    });

    return routes;
  }

  private hasValidAccessCookie(context: Context): boolean {
    const cookieValue = getCookie(context, ACCESS_COOKIE_NAME);
    return Boolean(cookieValue && this.expectedCookieValue && constantTimeEquals(cookieValue, this.expectedCookieValue));
  }

  private passphraseMatches(candidate: string): boolean {
    return Boolean(this.passphrase) && constantTimeEquals(candidate.trim(), this.passphrase!);
  }

  private isRateLimited(clientKey: string): boolean {
    const record = this.failedLoginsByClient.get(clientKey);
    if (!record) return false;
    if (Date.now() - record.windowStartedAtMs > FAILED_LOGIN_WINDOW_MS) {
      this.failedLoginsByClient.delete(clientKey);
      return false;
    }
    return record.failureCount >= MAXIMUM_FAILED_LOGINS_PER_WINDOW;
  }

  private recordFailedLogin(clientKey: string): void {
    const record = this.failedLoginsByClient.get(clientKey);
    if (!record || Date.now() - record.windowStartedAtMs > FAILED_LOGIN_WINDOW_MS) {
      this.failedLoginsByClient.set(clientKey, { windowStartedAtMs: Date.now(), failureCount: 1 });
    } else {
      record.failureCount += 1;
    }
  }
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

/** Fly puts the real client address in Fly-Client-IP; fall back to the proxy chain, then a shared bucket. */
function clientIdentifier(context: Context): string {
  return context.req.header("fly-client-ip") ?? context.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "direct";
}

function isHttpsRequest(context: Context): boolean {
  return context.req.header("x-forwarded-proto") === "https" || new URL(context.req.url).protocol === "https:";
}
