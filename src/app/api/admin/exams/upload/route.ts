import { NextResponse } from "next/server";
import { parseExamQuestions } from "@/lib/exam-question-text";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
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
  "image/gif",
]);
const OCR_LANGUAGES = "eng+sin+tam";

export type ExtractedQuestion = {
  questionNumber: number;
  prompt: string;
  options: string[];
  correctAnswer: string | null;
  imageUrl?: string | null;
  optionImages?: string[];
};

function extractQuestions(text: string): ExtractedQuestion[] {
  // The shared parser already separates question blocks from the answer key,
  // recognises labelled and unlabelled choices, and places each answer into its
  // option so nothing has to be entered by hand.
  return parseExamQuestions(text)
    .filter((question) => question.prompt)
    .map((question, index) => ({
      questionNumber: question.questionNumber ?? index + 1,
      prompt: question.prompt,
      options: question.options,
      correctAnswer: question.correctAnswer,
      imageUrl: question.imageUrl ?? null,
      optionImages: (question.optionImages ?? []).filter((image): image is string => typeof image === "string"),
    }));
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

async function makeQuestionImage(buffer: Buffer) {
  const image = await loadImage(buffer);
  // Keep diagrams crisp and preserve their original layout. Only large source
  // images are reduced, and a lossless PNG is preferred whenever it stays
  // within the per-image storage limit.
  const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
  const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  try {
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = canvas.toBuffer("image/png");
    if (png.byteLength <= 5 * 1024 * 1024) return `data:image/png;base64,${png.toString("base64")}`;
    const webp = canvas.toBuffer("image/webp", 95);
    return `data:image/webp;base64,${webp.toString("base64")}`;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function recognizePdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  let worker: Awaited<ReturnType<typeof createOcrWorker>> | undefined;
  try {
    worker = await createOcrWorker();
    const pages: { text: string; imageUrl: string | null }[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      let page: Awaited<ReturnType<typeof document.getPage>> | undefined;
      try {
        page = await document.getPage(pageNumber);
        const operators = await page.getOperatorList();
        const containsEmbeddedImage = operators.fnArray.some((operator) => operator === pdfjs.OPS.paintImageXObject || operator === pdfjs.OPS.paintImageMaskXObject || operator === pdfjs.OPS.paintInlineImageXObject);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        try {
          await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D, viewport }).promise;
          const image = canvas.toBuffer("image/png");
          const result = await worker.recognize(image);
          const pageImage = containsEmbeddedImage ? await makeQuestionImage(image) : null;
          pages.push({ text: result.data.text, imageUrl: pageImage });
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
    return { text: pages.map((page) => page.text).join("\n"), pagesScanned: document.numPages, pages };
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
    return pages;
  } finally {
    await document.cleanup();
  }
}

function docxHtmlText(html: string) {
  return html
    .replace(/<img\b[^>]*src=["']edusmart-image-(\d+)["'][^>]*>/gi, (_tag, index: string) => ` [DOC_IMAGE_${index}] `)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|h[1-6]|li|tr|div|table)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

async function extractDocxImages(buffer: Buffer) {
  const imageFiles: { buffer: Buffer; imageUrl: string }[] = [];
  const converted = await mammoth.convertToHtml({ buffer }, {
    convertImage: mammoth.images.imgElement(async (image) => {
      const imageBuffer = await image.read();
      const index = imageFiles.length;
      imageFiles.push({ buffer: imageBuffer, imageUrl: await makeQuestionImage(imageBuffer) });
      return { src: `edusmart-image-${index}` };
    }),
  });
  const textWithMarkers = docxHtmlText(converted.value);
  if (imageFiles.length === 0) return { text: "", imagesScanned: 0, images: [] as { text: string; imageUrl: string }[] };

  const worker = await createOcrWorker();
  try {
    const images: { text: string; imageUrl: string }[] = [];
    for (let index = 0; index < imageFiles.length; index += 1) {
      const image = imageFiles[index];
      const ocr = await worker.recognize(image.buffer);
      const marker = `[DOC_IMAGE_${index}]`;
      const markerPosition = textWithMarkers.indexOf(marker);
      const textBeforeImage = markerPosition >= 0 ? textWithMarkers.slice(0, markerPosition).replace(/\[DOC_IMAGE_\d+\]/g, " ") : "";
      const nearbyQuestion = extractQuestions(textBeforeImage).at(-1);
      const imageQuestion = extractQuestions(ocr.data.text)[0];
      const mappedQuestion = imageQuestion ?? nearbyQuestion;
      const imageText = mappedQuestion
        ? `Question ${mappedQuestion.questionNumber}. ${mappedQuestion.prompt}`
        : ocr.data.text;
      images.push({ text: imageText, imageUrl: image.imageUrl });
    }
    return { text: images.map((image) => image.text).join("\n"), imagesScanned: imageFiles.length, images };
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
  let textPages: string[] = [];
  let ocrText = "";
  let pagesScanned: number | null = null;
  let imagesScanned: number | null = null;
  let imageSources: { text: string; imageUrl: string }[] = [];
  let directImageUrl: string | null = null;

  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        textPages = await extractPdfText(buffer);
        text = textPages.join("\n");
      } catch {
        text = "";
      }
      const scan = await recognizePdf(buffer);
      ocrText = scan.text;
      pagesScanned = scan.pagesScanned;
      imageSources = scan.pages.flatMap((page, index) => page.imageUrl ? [{ text: `${textPages[index] ?? ""}\n${page.text}`, imageUrl: page.imageUrl }] : []);
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        text = "";
      }
      const scan = await extractDocxImages(buffer);
      ocrText = scan.text;
      imagesScanned = scan.imagesScanned;
      imageSources = scan.images;
    } else {
      ocrText = await recognizeImages([buffer]);
      imagesScanned = 1;
      directImageUrl = buffer.byteLength <= 5 * 1024 * 1024
        ? `data:${file.type};base64,${buffer.toString("base64")}`
        : await makeQuestionImage(buffer);
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
    if (directImageUrl) {
      return NextResponse.json({ fileName: file.name, pagesScanned, imagesScanned, extractedText: ocrText.trim(), imageUrl: directImageUrl, questions: [] });
    }
    const scanned = pagesScanned !== null
      ? `All ${pagesScanned} PDF pages were scanned. `
      : imagesScanned !== null
        ? `${imagesScanned} document images were scanned. `
        : "The document text was read. ";
    return NextResponse.json({ error: `${scanned}No numbered question blocks were recognized. Check that the paper has readable question numbers or labels such as Question 1 or Q1.` }, { status: 422 });
  }

  const normalizeWords = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const imageSourcesForQuestion = (question: ExtractedQuestion) => {
    if (directImageUrl) return [];
    const promptWords = new Set(normalizeWords(question.prompt).split(/\s+/).filter((word) => word.length > 2));
    return imageSources.filter((candidate) => extractQuestions(candidate.text).some((sourceQuestion) => {
      if (sourceQuestion.questionNumber !== question.questionNumber) return false;
      const sourceWords = new Set(normalizeWords(sourceQuestion.prompt).split(/\s+/).filter((word) => word.length > 2));
      const overlap = [...promptWords].filter((word) => sourceWords.has(word)).length / Math.max(promptWords.size, sourceWords.size, 1);
      return overlap >= 0.45 || normalizeWords(sourceQuestion.prompt) === normalizeWords(question.prompt);
    }));
  };
  const imageForQuestion = (question: ExtractedQuestion) => directImageUrl ?? imageSourcesForQuestion(question)[0]?.imageUrl ?? null;

  return NextResponse.json({
    fileName: file.name,
    pagesScanned,
    imagesScanned,
    extractedText: [text, ocrText].filter(Boolean).join("\n").trim(),
    imageUrl: directImageUrl,
    questions: questions.map((question) => {
      const sources = imageSourcesForQuestion(question);
      const isOptionImageSet = sources.length >= 2 && sources.length <= 5 && question.options.length <= sources.length;
      const options = isOptionImageSet && question.options.length < sources.length
        ? [...question.options, ...Array.from({ length: sources.length - question.options.length }, () => "")]
        : question.options;
      return {
        prompt: question.prompt,
        options,
        correctAnswer: question.correctAnswer,
        imageUrl: isOptionImageSet ? null : imageForQuestion(question),
        optionImages: isOptionImageSet ? sources.map((source) => source.imageUrl) : [],
      };
    }),
  });
}
