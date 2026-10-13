import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if ((await getMongoUser())?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json() as { published?: unknown };
  if (typeof body.published !== "boolean") return NextResponse.json({ error: "Choose whether this paper should be published." }, { status: 400 });
  try {
    const paper = await prisma.writtenPaper.update({ where: { id }, data: { published: body.published }, select: { id: true, published: true } });
    return NextResponse.json({ item: paper });
  } catch {
    return NextResponse.json({ error: "The paper could not be found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if ((await getMongoUser())?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await context.params;
  try {
    await prisma.writtenPaperAttempt.deleteMany({ where: { paperId: id } });
    await prisma.writtenPaper.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The paper could not be found." }, { status: 404 });
  }
}
