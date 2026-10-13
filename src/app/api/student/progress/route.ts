import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getMongoUser();
  if (!user || user.role !== "student") return NextResponse.json({ error: "Student access is required." }, { status: 403 });

  const [attempts, videos, papers] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { userId: user.id, status: { in: ["SUBMITTED", "EXPIRED"] } },
      include: { result: true, exam: { include: { subject: true } } },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.video.findMany({ where: { published: true }, select: { id: true, title: true, subject: true, videoUrl: true } }),
    prisma.writtenPaper.findMany({ where: { published: true }, select: { id: true, title: true, subject: true, fileName: true } }),
  ]);

  const completed = attempts.filter((attempt) => attempt.result && attempt.submittedAt).map((attempt) => ({
    id: attempt.id,
    title: attempt.exam.title,
    subject: attempt.exam.subject.name,
    obtainedMarks: attempt.result!.obtainedMarks,
    totalMarks: attempt.result!.totalMarks ?? attempt.exam.totalMarks,
    percentage: attempt.result!.percentage,
    passed: attempt.result!.passed,
    submittedAt: attempt.submittedAt!.toISOString(),
  }));

  const bySubject = new Map<string, { total: number; count: number; latest: number }>();
  for (const attempt of completed) {
    const key = attempt.subject;
    const current = bySubject.get(key) ?? { total: 0, count: 0, latest: attempt.percentage };
    current.total += attempt.percentage;
    current.count += 1;
    bySubject.set(key, current);
  }
  const subjects = [...bySubject.entries()].map(([subject, stats]) => ({ subject, averagePercentage: Number((stats.total / stats.count).toFixed(1)), examsCompleted: stats.count }))
    .sort((a, b) => a.averagePercentage - b.averagePercentage);
  const overallAverage = completed.length ? Number((completed.reduce((sum, attempt) => sum + attempt.percentage, 0) / completed.length).toFixed(1)) : null;

  const practiceSubjects = subjects.filter((item) => item.averagePercentage < 70).slice(0, 3);
  const recommendations = practiceSubjects.map((item) => {
    const matches = (resource: { subject: string }) => resource.subject.trim().toLocaleLowerCase() === item.subject.trim().toLocaleLowerCase();
    const resources = [
      ...videos.filter(matches).slice(0, 2).map((video) => ({ id: video.id, title: video.title, type: "video" as const, url: video.videoUrl })),
      ...papers.filter(matches).slice(0, 2).map((paper) => ({ id: paper.id, title: paper.title, type: "paper" as const, url: `/api/written-papers/${paper.id}/download` })),
    ].slice(0, 3);
    return { subject: item.subject, averagePercentage: item.averagePercentage, message: item.averagePercentage < 50 ? `Your recent ${item.subject} scores show this area needs extra practice.` : `A little more ${item.subject} practice can help strengthen your results.`, resources };
  });

  return NextResponse.json({ overallAverage, completedCount: completed.length, subjects, recentResults: completed.slice(0, 10), recommendations });
}
