import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(authCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
