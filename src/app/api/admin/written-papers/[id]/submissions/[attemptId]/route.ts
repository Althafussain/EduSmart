import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; attemptId: string }> }) {
  if ((await getMongoUser())?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id: paperId, attemptId } = await context.params;
  const attempt = await prisma.writtenPaperAttempt.findFirst({ where: { id: attemptId, paperId, submittedAt: { not: null } }, select: { fileName: true, mimeType: true, document: true } });
  if (!attempt?.document || !attempt.fileName || !attempt.mimeType) return NextResponse.json({ error: "This answer paper could not be found." }, { status: 404 });
  const safeFileName = attempt.fileName.replace(/[\r\n"\\]/g, "_");
  return new Response(new Uint8Array(attempt.document), { headers: { "Content-Type": attempt.mimeType, "Content-Length": String(attempt.document.byteLength), "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(attempt.fileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
