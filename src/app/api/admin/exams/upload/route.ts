import { NextResponse } from "next/server";
import { normalizeOptionAnswer } from "@/lib/exam-answers";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import JSZip from "jszip";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";

import { getMongoUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const OCR_LANGUAGES = "eng+sin+tam";

export type ExtractedQuestion = {
  questionNumber: number;
  prompt: string;
  options: string[];
  correctAnswer: string | null;
};

function extractQuestions(text: string): ExtractedQuestion[] {
  const normalizedText = text.replace(/\r/g, "");
  const answerKeyStart = normalizedText.search(/(?:^|\n)\s*(?:answer\s+key|correct\s+answers?|marking\s+scheme)\s*:?\s*(?=\n|$)/i);
  const questionText = answerKeyStart >= 0 ? normalizedText.slice(0, answerKeyStart) : normalizedText;
  const answerKeyText = answerKeyStart >= 0 ? normalizedText.slice(answerKeyStart) : "";
  const normalized = questionText.replace(/[ \t]+/g, " ").trim();
  // Papers vary between `1.`, `1)`, `(1)`, `Q1`, `Q. 1`, and `Question 1`.
  // Accept these at line starts so later questions are not swallowed into the
  // first block when their numbering style differs from the first question.
  const questionStart = /(?:^|\n)\s*(?:(?:question|q)\.?\s*(?:no\.?\s*)?)?[\[(]?(\d{1,3})[\])]?(?:\s*[.,)\-:]+\s*|\s+(?=[A-Z0-9]))/gim;
  const lineMatches = [...normalized.matchAll(questionStart)];
  // Some PDFs flatten numbered questions onto the same line. Compare the
  // broader pass even when multiple line-start questions were found, otherwise
  // the parser quietly leaves inline questions inside their predecessor.
  const inlineMatches = [...normalized.matchAll(/(?:^|\s)(?:(?:question|q)\.?\s*(?:no\.?\s*)?)?[\[(]?(\d{1,3})[\])]?(?:\s*[.,)\-:]+\s*|\s+(?=[A-Z0-9]))/gi)];
  const matches = inlineMatches.length > lineMatches.length ? inlineMatches : lineMatches;

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
    let optionMatches = [...withoutAnswer.matchAll(/(?:^|\s)(?:\(([1-5A-E])\)|([A-E1-5])\s*[.)\-:])\s*(.*?)(?=\s+(?:\([1-5A-E]\)|[A-E1-5]\s*[.)\-:])\s+|$)/gi)];
    if (optionMatches.length < 2) {
      optionMatches = [...withoutAnswer.matchAll(/(?:^|\s)(?:\(([1-5A-E])\)|([A-E1-5])\s+)\s*(.*?)(?=\s+(?:\([1-5A-E]\)|[A-E1-5])\s+|$)/gi)];
    }
    const firstOptionIndex = optionMatches[0]?.index;
    const prompt = (firstOptionIndex === undefined ? withoutAnswer : withoutAnswer.slice(0, firstOptionIndex)).trim();
    const options = optionMatches.map((option) => option[3].trim()).filter(Boolean);

    return { questionNumber: Number(questionNumber), prompt, options, correctAnswer: normalizeOptionAnswer(answerMatch?.[1] ?? answerKey.get(questionNumber)) };
  // Keep the question block even if OCR misses one or more option labels. The
  // admin editor can correct the choices; dropping the block hid later questions.
  }).filter((question) => question.prompt);
}

function mergeQuestions(primary: ExtractedQuestion[], secondary: ExtractedQuestion[]) {
  // Question numbers commonly restart in each section or paper part. Merge the
  // text and OCR copies only when both the number and prompt identify the same
  // question; a number-only map silently discarded later questions.
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const similarity = (first: string, second: string) => {
    const a = normalize(first);
    const b = normalize(second);
    if (!a || !b) return 0;
    if (a === b || a.startsWith(b) || b.startsWith(a)) return 1;
    const firstWords = new Set(a.split(/\s+/).filter((word) => word.length > 2));
    const secondWords = new Set(b.split(/\s+/).filter((word) => word.length > 2));
    const shared = [...firstWords].filter((word) => secondWords.has(word)).length;
    return shared / Math.max(firstWords.size, secondWords.size, 1);
  };

  const merged = primary.map((question) => ({ ...question }));
  for (const scanned of secondary) {
    const matchIndex = merged.findIndex((question) =>
      question.questionNumber === scanned.questionNumber && similarity(question.prompt, scanned.prompt) >= 0.55,
    );
    if (matchIndex < 0) {
      merged.push({ ...scanned });
      continue;
    }

    const existing = merged[matchIndex];
    merged[matchIndex] = {
      ...existing,
      prompt: scanned.prompt.length > existing.prompt.length ? scanned.prompt : existing.prompt,
      options: scanned.options.join(" ").length > existing.options.join(" ").length ? scanned.options : existing.options,
      correctAnswer: existing.correctAnswer ?? scanned.correctAnswer,
    };
  }

  return merged.filter((question) => question.prompt);
}

async function createOcrWorker() {
  const worker = await createWorker(OCR_LANGUAGES, 1, {
    langPath: process.cwd(),
    cachePath: path.join(process.cwd(), ".tesseract-cache"),
    gzip: false,
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    return worker;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

async function recognizeImages(images: Buffer[]) {
  if (images.length === 0) return "";
  const worker = await createOcrWorker();
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
  let worker: Awaited<ReturnType<typeof createOcrWorker>> | undefined;
  try {
    worker = await createOcrWorker();
    const results: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      let page: Awaited<ReturnType<typeof document.getPage>> | undefined;
      try {
        page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        try {
          await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D, viewport }).promise;
          const image = canvas.toBuffer("image/png");
          const result = await worker.recognize(image);
          results.push(result.data.text);
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch (error) {
        console.error(`PDF OCR failed on page ${pageNumber} of ${document.numPages}:`, error);
        throw new Error(`Could not scan PDF page ${pageNumber} of ${document.numPages}. The document scan was stopped before completion.`);
      } finally {
        page?.cleanup();
      }
    }
    return { text: results.join("\n"), pagesScanned: document.numPages };
  } finally {
    if (worker) await worker.terminate();
    await document.cleanup();
  }
}

async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: { y: number; items: { x: number; text: string }[] }[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !("transform" in item) || !Array.isArray(item.transform)) continue;
        const y = Math.round(Number(item.transform[5] ?? 0));
        const x = Number(item.transform[4] ?? 0);
        const line = lines.find((candidate) => Math.abs(candidate.y - y) <= 4);
        if (line) line.items.push({ x, text: item.str });
        else lines.push({ y, items: [{ x, text: item.str }] });
      }
      pages.push(lines
        .sort((first, second) => second.y - first.y)
        .map(({ items }) => items.sort((first, second) => first.x - second.x).map((item) => item.text).join(" ").trim())
        .filter(Boolean)
        .join("\n"));
      page.cleanup();
    }
    return pages.join("\n");
  } finally {
    await document.cleanup();
  }
}

async function recognizeDocxImages(buffer: Buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const imageFiles = Object.values(archive.files)
    .filter((entry) => !entry.dir && entry.name.startsWith("word/media/"))
    .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }));
  if (imageFiles.length === 0) return { text: "", imagesScanned: 0 };

  const worker = await createOcrWorker();
  try {
    const results: string[] = [];
    for (const imageFile of imageFiles) {
      const image = await imageFile.async("nodebuffer");
      const result = await worker.recognize(image);
      results.push(result.data.text);
    }
    return { text: results.join("\n"), imagesScanned: imageFiles.length };
  } finally {
    await worker.terminate();
  }
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
  let pagesScanned: number | null = null;
  let imagesScanned: number | null = null;

  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        text = await extractPdfText(buffer);
      } catch {
        text = "";
      }
      const scan = await recognizePdf(buffer);
      ocrText = scan.text;
      pagesScanned = scan.pagesScanned;
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        text = "";
      }
      const scan = await recognizeDocxImages(buffer);
      ocrText = scan.text;
      imagesScanned = scan.imagesScanned;
    } else {
      ocrText = await recognizeImages([buffer]);
      imagesScanned = 1;
    }
  } catch (error) {
    console.error("Exam document processing failed:", error);
    const message = error instanceof Error ? error.message : "";
    const errorMessage = message.startsWith("Could not scan PDF page ")
      ? message
      : "The file could not be read or OCR could not process it. Check that it is a valid PDF, DOCX, PNG, JPG, or WEBP file and try again.";
    return NextResponse.json({ error: errorMessage }, { status: 422 });
  }

  const questions = mergeQuestions(extractQuestions(text), extractQuestions(ocrText));
  if (questions.length === 0) {
    const scanned = pagesScanned !== null
      ? `All ${pagesScanned} PDF pages were scanned. `
      : imagesScanned !== null
        ? `${imagesScanned} document images were scanned. `
        : "The document text was read. ";
    return NextResponse.json({ error: `${scanned}No numbered question blocks were recognized. Check that the paper has readable question numbers or labels such as Question 1 or Q1.` }, { status: 422 });
  }

  return NextResponse.json({
    fileName: file.name,
    pagesScanned,
    imagesScanned,
    extractedText: text.trim(),
    questions: questions.map(({ prompt, options, correctAnswer }) => ({ prompt, options, correctAnswer })),
  });
}
