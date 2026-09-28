import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { isValidOptionAnswer, resolveOptionAnswer } from "@/lib/exam-answers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SubmittedAnswer = { questionId?: unknown; answer?: unknown };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getMongoUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Student access is required." }, { status: 403 });
  }

  const { id: examId } = await context.params;
  let body: { answers?: unknown };
  try {
    body = await request.json() as { answers?: unknown };
  } catch {
    return NextResponse.json({ error: "Submit the exam answers as JSON." }, { status: 400 });
  }

  const submittedAnswers = Array.isArray(body.answers) ? body.answers as SubmittedAnswer[] : [];
  const exam = await prisma.exam.findFirst({
    where: { id: examId, published: true },
    include: { questions: { orderBy: { id: "asc" } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const totalMarks = exam.questions.reduce((total, question) => total + question.marks, 0);
  const invalidAnswerKey = exam.questions.some((question) => {
    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    return !Number.isFinite(question.marks) || question.marks <= 0 || !isValidOptionAnswer(question.correctAnswer, options);
  });
  if (exam.questions.length === 0 || totalMarks <= 0 || invalidAnswerKey) {
    return NextResponse.json({ error: "This exam has an invalid answer key or marks. Ask an administrator to review it before submitting." }, { status: 409 });
  }

  const answerByQuestion = new Map(submittedAnswers.map((item) => [String(item.questionId ?? ""), item.answer]));
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const attempt = await transaction.examAttempt.upsert({
        where: { examId_userId: { examId, userId: user.id } },
        update: {},
        create: { examId, userId: user.id, startedAt: now, expiresAt: new Date(now.getTime() + exam.durationMins * 60 * 1000) },
      });

      if (attempt.status === "SUBMITTED") {
        return transaction.result.findUnique({ where: { attemptId: attempt.id } });
      }

      const gradedAnswers = exam.questions.map((question) => {
        const options = Array.isArray(question.options) ? question.options.map(String) : [];
        const correctAnswer = resolveOptionAnswer(question.correctAnswer, options);
        const submittedAnswer = resolveOptionAnswer(answerByQuestion.get(question.id), options);
        const correct = submittedAnswer !== null && submittedAnswer === correctAnswer;
        return { attemptId: attempt.id, questionId: question.id, answer: submittedAnswer, awardedMarks: correct ? question.marks : 0, evaluationStatus: "REVIEWED" as const };
      });
      const obtainedMarks = gradedAnswers.reduce((total, answer) => total + answer.awardedMarks, 0);
      const percentage = Number(((obtainedMarks / totalMarks) * 100).toFixed(2));

      await transaction.studentAnswer.deleteMany({ where: { attemptId: attempt.id } });
      await transaction.studentAnswer.createMany({ data: gradedAnswers });
      await transaction.examAttempt.update({ where: { id: attempt.id }, data: { status: now > attempt.expiresAt ? "EXPIRED" : "SUBMITTED", submittedAt: now } });
      await transaction.result.deleteMany({ where: { attemptId: attempt.id } });
      return transaction.result.create({ data: { attemptId: attempt.id, obtainedMarks, percentage, passed: percentage >= 50 } });
    });

    if (!result) return NextResponse.json({ error: "The exam result could not be created." }, { status: 500 });
    return NextResponse.json({ obtainedMarks: result.obtainedMarks, totalMarks, percentage: result.percentage, passed: result.passed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The exam could not be submitted.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
