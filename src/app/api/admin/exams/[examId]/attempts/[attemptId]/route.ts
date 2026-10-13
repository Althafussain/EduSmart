import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ examId: string; attemptId: string }> }) {
  const user = await getMongoUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const { examId, attemptId } = await context.params;
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId, examId }, select: { id: true } });
  if (!attempt) return NextResponse.json({ error: "This student attempt was not found for the exam." }, { status: 404 });

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.studentAnswer.deleteMany({ where: { attemptId } });
      await transaction.result.deleteMany({ where: { attemptId } });
      await transaction.examAttempt.delete({ where: { id: attemptId } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student exam attempt could not be removed:", error);
    return NextResponse.json({ error: "This student attempt could not be removed. Please try again." }, { status: 400 });
  }
}
