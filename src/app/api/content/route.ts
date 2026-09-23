import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const [books, videos, exams] = await Promise.all([
    prisma.book.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.video.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.exam.findMany({ where: { published: true }, orderBy: { startsAt: "asc" }, include: { subject: true, questions: { orderBy: { id: "asc" } } } }),
  ]);

  return NextResponse.json({ books, videos, exams });
}
