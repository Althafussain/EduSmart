import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function documentResponse(document: Uint8Array | null, fileName: string | null, mimeType: string | null) {
  if (!document || !fileName || !mimeType) {
    return NextResponse.json({ error: "This answer sheet could not be found." }, { status: 404 });
  }
  const safeFileName = fileName.replace(/[\r\n"\\]/g, "_");
  return new Response(new Uint8Array(document), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(document.byteLength),
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ examId: string; attemptId: string }> }) {
  if ((await getMongoUser())?.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const { examId, attemptId } = await context.params;
  if (attemptId.startsWith("history-")) {
    const historyId = attemptId.slice("history-".length);
    const attempt = await prisma.quizAttemptHistory.findFirst({
      where: { id: historyId, examId },
      select: { answerDocument: true, answerFileName: true, answerMimeType: true },
    });
    if (!attempt) return NextResponse.json({ error: "This answer sheet could not be found." }, { status: 404 });
    return documentResponse(attempt.answerDocument, attempt.answerFileName, attempt.answerMimeType);
  }

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, examId },
    select: { answerDocument: true, answerFileName: true, answerMimeType: true },
  });
  if (!attempt) return NextResponse.json({ error: "This answer sheet could not be found." }, { status: 404 });
  return documentResponse(attempt.answerDocument, attempt.answerFileName, attempt.answerMimeType);
}
