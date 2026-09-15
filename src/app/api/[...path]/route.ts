import { NextRequest } from "next/server";
import { getSessionUser, can, err, json, rateLimit } from "@/server/core";
import { routes } from "@/server/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function dispatch(req: NextRequest, segments: string[]) {
  const path = segments.join("/");
  // Match exact keys first, then :id patterns
  let key = `${req.method} ${path}`;
  let def = routes[key];
  if (!def) {
    const pattern = path.replace(/[^/]+(?=\/|$)/, ":id");
    key = `${req.method} ${pattern}`;
    def = routes[key];
  }
  if (!def) return json({ error: `Unknown endpoint: ${req.method} /api/${path}` }, 404);

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`${ip}:${key}`, 300, 60000)) return err("Too many requests. Please slow down.", 429, "rate_limited");

  const authUser = await getSessionUser();

  if (!def.public && !authUser) return err("Please sign in to continue.", 401, "unauthenticated");

  let ctx = null;
  if (authUser) {
    if (authUser.businessId && authUser.role) {
      ctx = { user: authUser, businessId: authUser.businessId, role: authUser.role as any };
      if (def.cap && !can(authUser.role, def.cap)) {
        return err("You don't have permission to do that.", 403, "forbidden");
      }
    } else if (!def.public && !authUser.isPlatformAdmin && !["GET auth/me", "POST demo", "POST auth/login", "POST auth/register", "POST auth/logout", "POST onboarding", "GET admin/overview"].includes(key)) {
      return err("Your account is not attached to a business yet. Complete onboarding first.", 409, "no_business");
    }
  }

  const q = req.nextUrl.searchParams;
  let body: any = {};
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) body = await req.json().catch(() => ({}));
    }
  } catch {
    /* empty body is fine */
  }

  try {
    return await def.fn(req, ctx as any, q, body, segments);
  } catch (e: any) {
    console.error(`[api] ${key} failed:`, e?.message ?? e);
    return err("Something went wrong on our side. Please try again.", 500, "internal");
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path);
}
