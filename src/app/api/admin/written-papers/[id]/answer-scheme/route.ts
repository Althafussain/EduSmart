import { NextResponse } from "next/server";

import { getMongoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const maxFileSize = 10 * 1024 * 1024;
const allowedFile = /\.(pdf|docx)$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if ((await getMongoUser())?.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const { id } = await context.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload the answer scheme as a multipart form." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || !allowedFile.test(file.name)) {
    return NextResponse.json({ error: "Choose an answer scheme in PDF or DOCX format." }, { status: 415 });
  }
  if (file.size === 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: "The answer scheme must be larger than 0 bytes and no larger than 10 MB." }, { status: 413 });
  }

  const existingPaper = await prisma.writtenPaper.findUnique({ where: { id }, select: { id: true } });
  if (!existingPaper) return NextResponse.json({ error: "The written paper could not be found." }, { status: 404 });

  const paper = await prisma.writtenPaper.update({
    where: { id },
    data: {
      answerSchemeFileName: file.name,
      answerSchemeMimeType: file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      answerSchemeDocument: Buffer.from(await file.arrayBuffer()),
      answerSchemePublished: false,
    },
    select: { id: true, answerSchemeFileName: true, answerSchemePublished: true },
  });
  return NextResponse.json({ item: paper });
}
