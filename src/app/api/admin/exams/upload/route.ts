import { NextResponse } from "next/server";
import { createCanvas } from "@napi-rs/canvas";
import JSZip from "jszip";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";

import { getMongoUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const OCR_LANGUAGES = "eng+sin+tam";
const MAX_OCR_PAGES = 30;

export type ExtractedQuestion = {
  questionNumber: number;
  prompt: string;
  options: string[];
  correctAnswer: string | null;
};

function extractQuestions(text: string): ExtractedQuestion[] {
  const normalizedText = text.replace(/\r/g, "");
  const answerKeyStart = normalizedText.search(/(?:^|\n)\s*(?:answer\s+key|correct\s+answers?|answers?)\s*:?\s*(?=\n|$)/i);
  const questionText = answerKeyStart >= 0 ? normalizedText.slice(0, answerKeyStart) : normalizedText;
  const answerKeyText = answerKeyStart >= 0 ? normalizedText.slice(answerKeyStart) : "";
  const normalized = questionText.replace(/[ \t]+/g, " ").trim();
  const questionStart = /(?:^|\n)\s*(?:(?:question|q)\s*)?(\d{1,3})\s*[.,)\-:]+\s*/gi;
  const matches = [...normalized.matchAll(questionStart)];

  if (matches.length === 0) return [];

  const answerKey = new Map<string, string>();
  for (const match of answerKeyText.matchAll(/(?:^|\s)(\d{1,3})\s*[.,)\-:]?\s*([A-E]|[1-5])\b/gi)) {
    answerKey.set(match[1], match[2].toUpperCase());
  }

  return matches.map((match, index) => {
    const questionNumber = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const block = normalized.slice(start, end).replace(/\s+/g, " ").trim();
    const answerMatch = block.match(/(?:correct\s+answer|answer|ans)\s*[:\-]?\s*([A-E]|[1-5])\b/i);
    const withoutAnswer = block.replace(/\s*(?:correct\s+answer|answer|ans)\s*[:\-]?\s*(?:[A-E]|[1-5])\b.*$/i, "").trim();
    const optionMatches = [...withoutAnswer.matchAll(/(?:^|\s)(?:\(([1-5])\)|([A-E]))\s*[.)\-:]?\s*(.*?)(?=\s+(?:\([1-5]\)|[A-E])\s*[.)\-:]?\s+|$)/gi)];
    const firstOptionIndex = optionMatches[0]?.index;
    const prompt = (firstOptionIndex === undefined ? withoutAnswer : withoutAnswer.slice(0, firstOptionIndex)).trim();
    const options = optionMatches.map((option) => option[3].trim()).filter(Boolean);

    return { questionNumber: Number(questionNumber), prompt, options, correctAnswer: answerMatch?.[1].toUpperCase() ?? answerKey.get(questionNumber) ?? null };
  }).filter((question) => question.prompt && question.options.length >= 2);
}

function mergeQuestions(primary: ExtractedQuestion[], secondary: ExtractedQuestion[]) {
  const byNumber = new Map<number, { primary?: ExtractedQuestion; secondary?: ExtractedQuestion }>();
  for (const question of primary) byNumber.set(question.questionNumber, { ...byNumber.get(question.questionNumber), primary: question });
  for (const question of secondary) byNumber.set(question.questionNumber, { ...byNumber.get(question.questionNumber), secondary: question });

  return [...byNumber.entries()].sort(([firstNumber], [secondNumber]) => firstNumber - secondNumber).map(([questionNumber, pair]) => {
    const first = pair.primary;
    const second = pair.secondary;
    if (!first) return second;
    if (!second) return first;
    return {
      questionNumber,
      prompt: first.prompt.length >= second.prompt.length ? first.prompt : second.prompt,
      options: first.options.length >= second.options.length ? first.options : second.options,
      correctAnswer: first.correctAnswer ?? second.correctAnswer,
    };
  }).filter((question): question is ExtractedQuestion => Boolean(question && question.prompt && question.options.length >= 2));
}

async function recognizeImages(images: Buffer[]) {
  if (images.length === 0) return "";
  const worker = await createWorker(OCR_LANGUAGES);
  try {
    const results: string[] = [];
    for (const image of images) {
      const result = await worker.recognize(image);
      results.push(result.data.text);
    }
    return results.join("\n");
  } finally {
    await worker.terminate();
  }
}

async function recognizePdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const images: Buffer[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, MAX_OCR_PAGES); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D, viewport }).promise;
      images.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
  } finally {
    await document.cleanup();
  }
  return recognizeImages(images);
}

async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
      page.cleanup();
    }
    return pages.join("\n");
  } finally {
    await document.cleanup();
  }
}

async function recognizeDocxImages(buffer: Buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const images = await Promise.all(Object.values(archive.files)
    .filter((entry) => !entry.dir && entry.name.startsWith("word/media/"))
    .slice(0, MAX_OCR_PAGES)
    .map((entry) => entry.async("nodebuffer")));
  return recognizeImages(images);
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

  if (!allowedTypes.has(file.type) && !/\.(pdf|docx|png|jpe?g|webp)$/i.test(file.name)) {
    return NextResponse.json({ error: "Only PDF, DOCX, PNG, JPG, and WEBP files are supported." }, { status: 415 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "The exam paper must be smaller than 10 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";
  let ocrText = "";

  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        text = await extractPdfText(buffer);
      } catch {
        text = "";
      }
      ocrText = await recognizePdf(buffer);
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        text = "";
      }
      ocrText = await recognizeDocxImages(buffer);
    } else {
      ocrText = await recognizeImages([buffer]);
    }
  } catch (error) {
    console.error("Exam document processing failed:", error);
    return NextResponse.json({ error: "The file could not be read or OCR could not process it. Check that it is a valid PDF, DOCX, PNG, JPG, or WEBP file and try again." }, { status: 422 });
  }

  const questions = mergeQuestions(extractQuestions(text), extractQuestions(ocrText));
  if (questions.length === 0) {
    return NextResponse.json({ error: "No complete MCQ questions with at least two options were found. The document was scanned, so OCR ran, but the question or A-D option layout was not recognized." }, { status: 422 });
  }

  return NextResponse.json({
    fileName: file.name,
    extractedText: text.trim(),
    questions: questions.map(({ prompt, options, correctAnswer }) => ({ prompt, options, correctAnswer })),
  });
}
