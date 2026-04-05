import { NextRequest, NextResponse } from "next/server";
import { authCookie, verifySessionCookie } from "@/lib/auth";

const protectedPaths = ["/dashboard", "/records", "/planner", "/settings"];

function isProtectedPath(pathname: string) {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionCookie(request.cookies.get(authCookie.name)?.value);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/records/:path*", "/planner/:path*", "/settings/:path*", "/login"],
};
