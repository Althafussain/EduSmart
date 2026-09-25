import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resources = new Set(["users", "books", "videos", "exams"]);

async function isAdmin() {
  return (await getMongoUser())?.role === "admin";
}

type ExamQuestionInput = { prompt: string; options: string[]; correctAnswer: string | null };

function examQuestions(value: unknown): ExamQuestionInput[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const question = item as { prompt?: unknown; options?: unknown; correctAnswer?: unknown };
    return {
      prompt: String(question.prompt ?? "").trim(),
      options: Array.isArray(question.options) ? question.options.map((option) => String(option).trim()).filter(Boolean) : [],
      correctAnswer: question.correctAnswer ? String(question.correctAnswer).trim().toUpperCase() : null,
    };
  }).filter((question) => question.prompt && question.options.length >= 2 && (!question.correctAnswer || /^[A-E1-5]$/.test(question.correctAnswer)));
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { resource, id } = await context.params;
  if (!resources.has(resource)) return NextResponse.json({ error: "Unknown admin resource." }, { status: 404 });

  try {
    const body = await request.json() as Record<string, unknown>;
    if (resource === "users") {
      const data: { fullName?: string; role?: "STUDENT" | "ADMIN" | "TEACHER"; educationLevel?: string | null; stream?: string | null; passwordHash?: string } = {};
      if (body.fullName !== undefined) data.fullName = String(body.fullName);
      if (body.role === "STUDENT" || body.role === "ADMIN" || body.role === "TEACHER") data.role = body.role;
      if (body.educationLevel !== undefined) data.educationLevel = body.educationLevel ? String(body.educationLevel) : null;
      if (body.stream !== undefined) data.stream = body.stream ? String(body.stream) : null;
      if (body.password) {
        const { hashPassword } = await import("@/lib/auth");
        data.passwordHash = await hashPassword(String(body.password));
      }
      return NextResponse.json({ item: await prisma.user.update({ where: { id }, data, select: { id: true, email: true, fullName: true, role: true, educationLevel: true, stream: true } }) });
    }
    if (resource === "books") return NextResponse.json({ item: await prisma.book.update({ where: { id }, data: { ...body, price: body.price === undefined ? undefined : Number(body.price) } }) });
    if (resource === "videos") return NextResponse.json({ item: await prisma.video.update({ where: { id }, data: body }) });

    const data: Record<string, unknown> = { ...body };
    if (body.startsAt) data.startsAt = new Date(String(body.startsAt));
    if (body.endsAt) data.endsAt = new Date(String(body.endsAt));
    if (body.durationMins !== undefined) data.durationMins = Number(body.durationMins);
    if (body.totalMarks !== undefined) data.totalMarks = Number(body.totalMarks);
    delete data.subject;
    if (resource === "exams" && body.questions !== undefined) {
      const questions = examQuestions(body.questions);
      if (questions.length === 0) return NextResponse.json({ error: "Add at least one complete MCQ with two or more options." }, { status: 400 });
      data.questions = { deleteMany: {}, create: questions.map((question) => ({ type: "MCQ", prompt: question.prompt, marks: 1, options: question.options, correctAnswer: question.correctAnswer })) };
    } else {
      delete data.questions;
    }
    return NextResponse.json({ item: await prisma.exam.update({ where: { id }, data }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The item could not be updated.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { resource, id } = await context.params;
  if (!resources.has(resource)) return NextResponse.json({ error: "Unknown admin resource." }, { status: 404 });

  try {
    if (resource === "users") {
      await prisma.studentProfile.deleteMany({ where: { userId: id } });
      await prisma.performanceAnalytics.deleteMany({ where: { userId: id } });
      await prisma.learningHistory.deleteMany({ where: { userId: id } });
      await prisma.studentSubject.deleteMany({ where: { studentProfileId: id } });
      await prisma.examAttempt.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
    } else if (resource === "books") await prisma.book.delete({ where: { id } });
    else if (resource === "videos") await prisma.video.delete({ where: { id } });
    else await prisma.exam.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The item could not be deleted.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
