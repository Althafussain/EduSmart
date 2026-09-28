import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { resolveOptionAnswer } from "@/lib/exam-answers";
import { prisma } from "@/lib/prisma";

type Resource = "users" | "books" | "videos" | "exams";

function resourceName(value: string): Resource | null {
  return ["users", "books", "videos", "exams"].includes(value) ? value as Resource : null;
}

async function requireAdmin() {
  const user = await getMongoUser();
  return user?.role === "admin" ? user : null;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

type ExamQuestionInput = {
  prompt: string;
  options: string[];
  correctAnswer: string | null;
};

function examQuestions(value: unknown): ExamQuestionInput[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { prompt: item.trim(), options: [], correctAnswer: null };
    const question = item as { prompt?: unknown; options?: unknown; correctAnswer?: unknown };
    return {
      prompt: String(question.prompt ?? "").trim(),
      options: Array.isArray(question.options) ? question.options.map((option) => String(option).trim()).filter(Boolean) : [],
      correctAnswer: resolveOptionAnswer(question.correctAnswer, Array.isArray(question.options) ? question.options.map((option) => String(option).trim()).filter(Boolean) : []),
    };
  });
}

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const resource = resourceName((await context.params).resource);
  if (!resource) return NextResponse.json({ error: "Unknown admin resource." }, { status: 404 });

  if (resource === "users") return NextResponse.json({ items: await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, email: true, fullName: true, role: true, educationLevel: true, stream: true, createdAt: true } }) });
  if (resource === "books") return NextResponse.json({ items: await prisma.book.findMany({ orderBy: { createdAt: "desc" } }) });
  if (resource === "videos") return NextResponse.json({ items: await prisma.video.findMany({ orderBy: { createdAt: "desc" } }) });
  return NextResponse.json({ items: await prisma.exam.findMany({ orderBy: { startsAt: "desc" }, include: { subject: true, questions: true } }) });
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const resource = resourceName((await context.params).resource);
  if (!resource) return NextResponse.json({ error: "Unknown admin resource." }, { status: 404 });

  try {
    const body = await request.json() as Record<string, unknown>;
    if (resource === "users") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email || !body.password) return NextResponse.json({ error: "Email and password are required for new users." }, { status: 400 });
      const { hashPassword } = await import("@/lib/auth");
      const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(String(body.password)), fullName: String(body.fullName ?? "Student"), role: body.role === "ADMIN" || body.role === "TEACHER" ? body.role : "STUDENT", educationLevel: body.educationLevel ? String(body.educationLevel) : null, stream: body.stream ? String(body.stream) : null, subjects: Array.isArray(body.subjects) ? body.subjects : [] } });
      return NextResponse.json({ item: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } }, { status: 201 });
    }
    if (resource === "books") return NextResponse.json({ item: await prisma.book.create({ data: { title: String(body.title), author: String(body.author), subject: String(body.subject), level: String(body.level), price: Number(body.price), imageUrl: body.imageUrl ? String(body.imageUrl) : null, coverColor: String(body.coverColor ?? "mint"), description: body.description ? String(body.description) : null, published: Boolean(body.published) } }) }, { status: 201 });
    if (resource === "videos") return NextResponse.json({ item: await prisma.video.create({ data: { title: String(body.title), subject: String(body.subject), level: String(body.level), duration: String(body.duration), videoUrl: String(body.videoUrl), thumbnail: body.thumbnail ? String(body.thumbnail) : null, description: body.description ? String(body.description) : null, published: Boolean(body.published) } }) }, { status: 201 });

    const subjectName = String(body.subject ?? "").trim();
    const subject = await prisma.subject.upsert({ where: { name: subjectName }, update: {}, create: { name: subjectName } });
    const questions = examQuestions(body.questions);
    if (questions.length === 0 || questions.some((question) => !question.prompt || question.options.length < 2 || !question.correctAnswer)) {
      return NextResponse.json({ error: "Every exam question must have a prompt, at least two options, and a correct answer that matches one of those options." }, { status: 400 });
    }
    const exam = await prisma.exam.create({ data: { title: String(body.title), description: body.description ? String(body.description) : null, educationLevel: body.educationLevel === "A_LEVEL" || body.educationLevel === "O_LEVEL" ? body.educationLevel : "GRADE", grade: body.grade ? Number(body.grade) : null, stream: body.stream ? String(body.stream) : null, durationMins: Number(body.durationMins), totalMarks: questions.length, startsAt: new Date(String(body.startsAt)), endsAt: new Date(String(body.endsAt)), published: Boolean(body.published), subjectId: subject.id, questions: { create: questions.map((question) => ({ type: "MCQ", prompt: question.prompt, marks: 1, options: question.options, correctAnswer: question.correctAnswer })) } }, include: { subject: true, questions: true } });
    return NextResponse.json({ item: exam }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
