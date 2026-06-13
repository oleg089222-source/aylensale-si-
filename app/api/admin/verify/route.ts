import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD не задан на сервере" },
      { status: 500 }
    );
  }

  const { password } = (await request.json()) as { password?: string };
  const isValidPassword =
    Boolean(password) &&
    (password === adminPassword || password === `${adminPassword}@`);

  if (!isValidPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
