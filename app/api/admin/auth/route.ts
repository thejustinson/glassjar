import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SESSION_COOKIE_NAME = "glassjar_admin_session";

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not configured");
  }
  return password;
}

function generateSessionToken(password: string): string {
  const timestamp = Math.floor(Date.now() / 1000 / 3600); // changes every hour
  return crypto
    .createHmac("sha256", password + "_salt_secret")
    .update(`glassjar_admin_${timestamp}`)
    .digest("hex");
}

function verifySessionToken(token: string, password: string): boolean {
  const currentHour = Math.floor(Date.now() / 1000 / 3600);
  // check current hour and past 24 hours to give a 24-hour session
  for (let i = 0; i <= 24; i++) {
    const expected = crypto
      .createHmac("sha256", password + "_salt_secret")
      .update(`glassjar_admin_${currentHour - i}`)
      .digest("hex");
    if (token === expected) return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
    }

    const token = generateSessionToken(ADMIN_PASSWORD);
    const response = NextResponse.json({ success: true, message: "Authenticated successfully" });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Authentication error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      })
    );

    const token = cookies[SESSION_COOKIE_NAME];
    if (!token || !verifySessionToken(token, ADMIN_PASSWORD)) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err?.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
