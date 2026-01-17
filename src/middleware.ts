// src/middleware.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

// TAMBAHKAN BARIS INI:
export const runtime = "nodejs"; 

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  if (nextUrl.pathname.startsWith("/dashboard") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/ais/:path*"],
};