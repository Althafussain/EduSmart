import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import { getMongoUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function extractQuestions(text: string) {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  const questionStart = /(?:^|\n)\s*(?:(?:question|q)\s*)?(\d{1,3})\s*[.)\-:]+\s*/gi;
  const matches = [...normalized.matchAll(questionStart)];

  if (matches.length === 0) {
    return normalized ? [normalized] : [];
  }

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    return normalized.slice(start, end).replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

export async function POST(request: Request) {
  const user = await getMongoUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the exam paper as a multipart file upload." }, { status: 400 });
  }
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF or DOCX exam paper." }, { status: 400 });
  }

  if (!allowedTypes.has(file.type) && !/\.(pdf|docx)$/i.test(file.name)) {
    return NextResponse.json({ error: "Only PDF and DOCX files are supported." }, { status: 415 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "The exam paper must be smaller than 10 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
      await parser.destroy();
    } else {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    }
  } catch {
    return NextResponse.json({ error: "The file could not be read. Check that it is a valid PDF or DOCX." }, { status: 422 });
  }

  const questions = extractQuestions(text);
  if (questions.length === 0) {
    return NextResponse.json({ error: "No readable question text was found in this file." }, { status: 422 });
  }

  return NextResponse.json({
    fileName: file.name,
    extractedText: text.trim(),
    questions,
  });
}
