import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { isQuizExam } from "@/lib/is-quiz-exam";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ quizId: string; attemptId: string }> }) {
  const user = await getMongoUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const { quizId, attemptId } = await context.params;
  const quiz = await prisma.exam.findFirst({
    where: { id: quizId, published: true },
    select: { isQuiz: true, startsAt: true, endsAt: true },
  });
  if (!quiz || !isQuizExam(quiz)) {
    return NextResponse.json({ error: "This published quiz was not found." }, { status: 404 });
  }

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const attempt = await transaction.examAttempt.findFirst({
        where: { id: attemptId, examId: quizId },
        select: {
          id: true,
          userId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          expiresAt: true,
          result: { select: { obtainedMarks: true, totalMarks: true, percentage: true, passed: true } },
        },
      });
      if (!attempt) return "not-found";
      if (attempt.status === "IN_PROGRESS" && attempt.expiresAt > new Date()) return "in-progress";

      await transaction.quizAttemptHistory.create({
        data: {
          examId: quizId,
          userId: attempt.userId,
          status: attempt.status === "IN_PROGRESS" ? "EXPIRED" : attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          expiresAt: attempt.expiresAt,
          obtainedMarks: attempt.result?.obtainedMarks ?? null,
          totalMarks: attempt.result?.totalMarks ?? null,
          percentage: attempt.result?.percentage ?? null,
          passed: attempt.result?.passed ?? null,
        },
      });
      await transaction.studentAnswer.deleteMany({ where: { attemptId } });
      await transaction.result.deleteMany({ where: { attemptId } });
      await transaction.examAttempt.delete({ where: { id: attemptId } });
      return "success";
    });

    if (outcome === "not-found") {
      return NextResponse.json({ error: "This student attempt was not found for the quiz." }, { status: 404 });
    }
    if (outcome === "in-progress") {
      return NextResponse.json({ error: "A student cannot be given another attempt while their quiz is still in progress." }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student quiz attempt could not be reset:", error);
    return NextResponse.json({ error: "This student could not be given another attempt. Please try again." }, { status: 400 });
  }
}
