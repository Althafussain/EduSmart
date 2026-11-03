import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getMongoUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Sign in as a student to download this answer scheme." }, { status: 401 });
  }

  const { id } = await context.params;
  const paper = await prisma.writtenPaper.findUnique({
    where: { id },
    select: {
      published: true,
      answerSchemePublished: true,
      answerSchemeFileName: true,
      answerSchemeMimeType: true,
      answerSchemeDocument: true,
    },
  });
  if (!paper?.published || !paper.answerSchemePublished) {
    return NextResponse.json({ error: "The answer scheme is not available yet." }, { status: 404 });
  }
  if (!paper.answerSchemeFileName || !paper.answerSchemeMimeType || !paper.answerSchemeDocument) {
    return NextResponse.json({ error: "The published answer scheme document could not be found." }, { status: 404 });
  }

  const safeFileName = paper.answerSchemeFileName.replace(/[\r\n"\\]/g, "_");
  return new Response(new Uint8Array(paper.answerSchemeDocument), {
    headers: {
      "Content-Type": paper.answerSchemeMimeType,
      "Content-Length": String(paper.answerSchemeDocument.byteLength),
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(paper.answerSchemeFileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
