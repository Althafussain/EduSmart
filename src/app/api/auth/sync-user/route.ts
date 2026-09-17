import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      fullName?: string;
      role?: "student" | "admin";
    };

    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() || "Student";
    const role = body.role === "admin" ? "ADMIN" : "STUDENT";

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        role,
      },
      create: {
        email,
        fullName,
        role,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.toLowerCase(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync the user account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
