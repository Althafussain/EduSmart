"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { parsePastedExamQuestions, type ParsedExamQuestion } from "@/lib/exam-question-text";

type PastedQuestionImage = { id: string; name: string; imageUrl: string; text: string };

export default function ExamQuestionEditor({ questions, onChange, onAdd, onProcessingChange, locked = false, lockedCount = 0 }: {
  questions: ParsedExamQuestion[];
  onChange: (questions: ParsedExamQuestion[]) => void;
  onAdd: () => void;
  onProcessingChange?: (processing: boolean) => void;
  locked?: boolean;
  lockedCount?: number;
}) {
  const [pastedText, setPastedText] = useState("");
  const [pastedImages, setPastedImages] = useState<PastedQuestionImage[]>([]);
  const [pasteMessage, setPasteMessage] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [imageOcrText, setImageOcrText] = useState("");
  const pasteBoxRef = useRef<HTMLDivElement>(null);

  async function pasteQuestionBlock(event: React.ClipboardEvent<HTMLDivElement>) {
    const clipboard = event.clipboardData;
    const clipboardItems = Array.from(clipboard.items).filter((item) => item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
    const imageFiles = clipboardItems.length ? clipboardItems : Array.from(clipboard.files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    if (locked || processingImage) return;

    const plainText = clipboard.getData("text/plain");
    const html = clipboard.getData("text/html");
    const htmlText = html ? new DOMParser().parseFromString(html, "text/html").body.innerText : "";
    const pastedContent = plainText || htmlText;
    const editor = pasteBoxRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : (() => { const endRange = document.createRange(); endRange.selectNodeContents(editor); endRange.collapse(false); return endRange; })();
    range.deleteContents();
    if (pastedContent) {
      const textNode = document.createTextNode(pastedContent);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
    }
    const placeholders: HTMLSpanElement[] = [];
    for (const [index] of imageFiles.entries()) {
      const lineBreak = document.createTextNode("\n");
      range.insertNode(lineBreak);
      range.setStartAfter(lineBreak);
      range.collapse(true);
      const marker = document.createElement("span");
      marker.dataset.imagePending = String(index);
      marker.className = "paste-image-pending";
      marker.textContent = "Scanning image...";
      range.insertNode(marker);
      placeholders.push(marker);
      range.setStartAfter(marker);
      range.collapse(true);
    }
    selection?.removeAllRanges(); selection?.addRange(range);
    setPastedText(editor.innerText);

    setProcessingImage(true); onProcessingChange?.(true); setPasteError(""); setPasteMessage("Adding the pasted image(s) and scanning text...");
    const added: PastedQuestionImage[] = [];
    const ocrText: string[] = [];
    try {
      for (const [index, file] of imageFiles.entries()) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Pasted question images must be 5 MB or smaller.");
        const formData = new FormData();
        formData.append("file", file, file.name || `pasted-question-${index + 1}.png`);
        const response = await fetch("/api/admin/exams/upload", { method: "POST", body: formData });
        const result = await response.json() as { error?: string; imageUrl?: string | null; extractedText?: string; questions?: ParsedExamQuestion[] };
        if (!response.ok || !result.imageUrl) throw new Error(result.error ?? "A pasted image could not be added.");
        const recognized = (result.extractedText ?? "").trim();
        const marker = placeholders[index];
        const imageRecord = { id: `${Date.now()}-${index}`, name: file.name || `Pasted image ${index + 1}`, imageUrl: result.imageUrl, text: recognized };
        const image = document.createElement("img");
        image.src = result.imageUrl;
        image.alt = "";
        image.title = imageRecord.name;
        image.className = "pasted-question-inline-image";
        image.dataset.pastedId = imageRecord.id;
        image.contentEditable = "false";
        marker?.replaceWith(image);
        added.push(imageRecord);
        if (recognized) ocrText.push(recognized);
      }
      setPastedImages((current) => [...current, ...added]);
      setImageOcrText(ocrText.join("\n\n"));
      if (!pastedContent && ocrText.length) {
        const recognizedContent = ocrText.join("\n\n");
        const tail = document.createTextNode(`\n${recognizedContent}`);
        editor.appendChild(tail);
      }
      setPastedText(editor.innerText);
      setPasteMessage(`${added.length} image${added.length === 1 ? "" : "s"} added with the pasted question content. Images will be attached to questions in order when you identify them.`);
    } catch (error) {
      placeholders.forEach((marker) => marker.remove());
      if (added.length) setPastedImages((current) => [...current, ...added]);
      setPastedText(editor.innerText);
      setPasteError(error instanceof Error ? error.message : "The pasted image could not be added.");
      setPasteMessage(added.length ? `${added.length} image${added.length === 1 ? "" : "s"} added. The remaining pasted images could not be processed.` : "");
    } finally { setProcessingImage(false); onProcessingChange?.(false); }
  }

  async function uploadRichEditorImages(editor: HTMLDivElement) {
    const unprocessed = Array.from(editor.querySelectorAll<HTMLImageElement>("img:not([data-pasted-id])"));
    if (!unprocessed.length) return;
    setProcessingImage(true); onProcessingChange?.(true);
    try {
      for (const [index, image] of unprocessed.entries()) {
        const pendingId = `pending-${Date.now()}-${index}`;
        image.dataset.pastedId = pendingId;
        const blobResponse = await fetch(image.src);
        if (!blobResponse.ok) throw new Error("A pasted image could not be read. Try copying it into the question box again.");
        const blob = await blobResponse.blob();
        const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : blob.type === "image/gif" ? "gif" : "png";
        const file = new File([blob], `pasted-question.${extension}`, { type: blob.type || "image/png" });
        if (file.size > 5 * 1024 * 1024) throw new Error("Pasted question images must be 5 MB or smaller.");
        const formData = new FormData(); formData.append("file", file);
        const response = await fetch("/api/admin/exams/upload", { method: "POST", body: formData });
        const result = await response.json() as { error?: string; imageUrl?: string | null; extractedText?: string };
        if (!response.ok || !result.imageUrl) throw new Error(result.error ?? "A pasted image could not be saved.");
        const record = { id: `${Date.now()}-${index}`, name: image.title || `Pasted image ${index + 1}`, imageUrl: result.imageUrl, text: (result.extractedText ?? "").trim() };
        image.src = result.imageUrl;
        image.dataset.pastedId = record.id;
        image.className = "pasted-question-inline-image";
        image.contentEditable = "false";
        setPastedImages((current) => [...current, record]);
        if (record.text) setImageOcrText((current) => [current, record.text].filter(Boolean).join("\n\n"));
      }
      setPasteMessage("Pasted image added inline with the question and scanned for text.");
    } catch (error) {
      unprocessed.forEach((image) => { if (image.dataset.pastedId?.startsWith("pending-")) delete image.dataset.pastedId; });
      setPasteError(error instanceof Error ? error.message : "A pasted image could not be processed.");
    } finally { setProcessingImage(false); onProcessingChange?.(false); }
  }

  function handleRichEditorInput(editor: HTMLDivElement) {
    setPastedText(editor.innerText);
    setPasteError(""); setPasteMessage("");
    void uploadRichEditorImages(editor);
  }

  async function processManualImage(file: File, questionIndex: number, optionIndex?: number) {
    if (locked) return;
    if (file.size > 5 * 1024 * 1024) { setPasteError("Question and option images must be 5 MB or smaller."); return; }
    setProcessingImage(true); onProcessingChange?.(true); setPasteError(""); setPasteMessage("Reading the text while preserving the uploaded image..."); setImageOcrText("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/exams/upload", { method: "POST", body: formData });
      const result = await response.json() as { error?: string; imageUrl?: string | null; extractedText?: string; questions?: ParsedExamQuestion[] };
      if (!response.ok) throw new Error(result.error ?? "The image could not be scanned.");
      const current = questions[questionIndex];
      if (!current) return;
      const recognizedText = (result.extractedText ?? "").trim();
      const recognized = result.questions?.[0];
      const imageUrl = result.imageUrl ?? recognized?.imageUrl ?? null;
      if (optionIndex !== undefined) {
        const optionText = (recognizedText || recognized?.prompt || "").replace(/\s+/g, " ").trim();
        onChange(questions.map((question, index) => index !== questionIndex ? question : {
          ...question,
          options: question.options.map((option, choiceIndex) => choiceIndex === optionIndex && !option.trim() && optionText ? optionText : option),
          optionImages: question.options.map((_, choiceIndex) => choiceIndex === optionIndex ? imageUrl : question.optionImages?.[choiceIndex] ?? null),
        }));
        setPasteMessage(optionText ? `Option ${String.fromCharCode(65 + optionIndex)} image added; OCR text was filled in for review.` : `Option ${String.fromCharCode(65 + optionIndex)} image added. Enter the recognized wording in the option field if needed.`);
      } else {
        onChange(questions.map((question, index) => index !== questionIndex ? question : {
          ...question,
          prompt: !question.prompt.trim() && recognized?.prompt ? recognized.prompt : question.prompt,
          options: Array.from({ length: Math.max(question.options.length, recognized?.options.length ?? 0) }, (_, choiceIndex) => {
            const option = question.options[choiceIndex] ?? "";
            return !option.trim() && recognized?.options[choiceIndex] ? recognized.options[choiceIndex] : option;
          }),
          optionImages: Array.from({ length: Math.max(question.options.length, recognized?.options.length ?? 0) }, (_, choiceIndex) => question.optionImages?.[choiceIndex] ?? null),
          correctAnswer: question.correctAnswer ?? recognized?.correctAnswer ?? null,
          imageUrl,
        }));
        setPasteMessage(recognized ? "Question image added. OCR filled in the detected question and choices; review them before publishing." : "Question image added and OCR scanned. Check the recognized text below and enter or correct the prompt and choices.");
      }
      setImageOcrText(recognizedText);
    } catch (error) {
      setPasteError(error instanceof Error ? error.message : "The image could not be scanned.");
      setPasteMessage("");
    } finally { setProcessingImage(false); onProcessingChange?.(false); }
  }

  async function pasteClipboardImage(event: React.ClipboardEvent<HTMLElement>, questionIndex?: number, optionIndex?: number) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const imageFile = imageItem?.getAsFile() ?? Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;

    event.preventDefault();
    if (locked) return;
    if (imageFile.size > 5 * 1024 * 1024) {
      setPasteError("Pasted question images must be 5 MB or smaller.");
      setPasteMessage("");
      return;
    }

    setProcessingImage(true); onProcessingChange?.(true);
    setPasteError("");
    setPasteMessage("Reading the pasted image and recognizing its questions...");
    try {
      const localImageUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the pasted image."));
        reader.onerror = () => reject(new Error("Could not read the pasted image."));
        reader.readAsDataURL(imageFile);
      });
      if (questionIndex !== undefined) {
        onChange(questions.map((question, index) => index === questionIndex ? optionIndex === undefined
          ? { ...question, imageUrl: localImageUrl }
          : { ...question, optionImages: question.options.map((_, choiceIndex) => choiceIndex === optionIndex ? localImageUrl : question.optionImages?.[choiceIndex] ?? null) }
          : question));
      }
      const formData = new FormData();
      const extension = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
      formData.append("file", imageFile, `pasted-question.${extension}`);
      const response = await fetch("/api/admin/exams/upload", { method: "POST", body: formData });
      const result = await response.json() as { error?: string; imageUrl?: string | null; extractedText?: string; questions?: ParsedExamQuestion[] };
      if (!response.ok) throw new Error(result.error ?? "The image could not be scanned.");
      const extracted = Array.isArray(result.questions) ? result.questions : [];
      setImageOcrText((result.extractedText ?? "").trim());
      if (questionIndex !== undefined && optionIndex !== undefined) {
        const identified = extracted[0];
        onChange(questions.map((question, index) => index === questionIndex ? {
          ...question,
          options: question.options.map((choice, choiceIndex) => choiceIndex === optionIndex && !choice.trim() && (result.extractedText?.trim() || identified?.prompt) ? (result.extractedText?.trim() || identified?.prompt || "") : choice),
          optionImages: question.options.map((_, choiceIndex) => choiceIndex === optionIndex ? result.imageUrl || identified?.imageUrl || localImageUrl : question.optionImages?.[choiceIndex] ?? null),
        } : question));
        setPasteMessage(`Image added to option ${String.fromCharCode(65 + optionIndex)}${identified || result.extractedText?.trim() ? " and its text was recognized for review." : "."}`);
      } else if (questionIndex !== undefined) {
        const identified = extracted[0];
        onChange(questions.map((question, index) => index === questionIndex ? {
          ...question,
          ...(identified ? {
            prompt: question.prompt.trim() ? question.prompt : identified.prompt || question.prompt,
            options: Array.from({ length: Math.max(question.options.length, identified.options.length) }, (_, choiceIndex) => {
              const option = question.options[choiceIndex] ?? "";
              return !option.trim() && identified.options[choiceIndex] ? identified.options[choiceIndex] : option;
            }),
            correctAnswer: question.correctAnswer ?? identified.correctAnswer,
          } : {}),
          imageUrl: result.imageUrl || identified?.imageUrl || localImageUrl,
        } : question));
        setPasteMessage(identified ? "Image added and its question text was recognized. Review the question and options." : "Image added to this question. Enter or correct the question text and choices below.");
      } else if (extracted.length) {
        onChange([...questions, ...extracted]);
        setPastedText("");
        setPasteMessage(`Recognized ${extracted.length} question${extracted.length === 1 ? "" : "s"} from the pasted image. Review the text and image below.`);
      } else {
        onChange([...questions, { prompt: "", options: ["", "", "", ""], correctAnswer: null, imageUrl: result.imageUrl || localImageUrl }]);
        setPastedText("");
        setPasteMessage("Image added as a new question. Enter the question text and choices below.");
      }
    } catch (error) {
      setPasteMessage("");
        if (questionIndex === undefined) setPasteError(error instanceof Error ? error.message : "Could not read the pasted image.");
        else setPasteMessage(optionIndex === undefined ? "Image added to this question, but its text could not be recognized. Enter the question text and choices below." : `Image added to option ${String.fromCharCode(65 + optionIndex)}. Enter its text if needed.`);
    } finally {
      setProcessingImage(false); onProcessingChange?.(false);
    }
  }

  function splitPastedQuestions() {
    const parsed = parsePastedExamQuestions(pastedText);
    if (parsed.length === 0) {
      setPasteMessage("");
      setPasteError("No numbered questions were found. Add question numbers such as 1. or Question 1, and label choices A, B, C, or D or list them on separate lines.");
      return;
    }

    const inlineImageIds = pasteBoxRef.current ? Array.from(pasteBoxRef.current.querySelectorAll<HTMLImageElement>("img[data-pasted-id]")).map((image) => image.dataset.pastedId) : [];
    const includedImages = pasteBoxRef.current ? inlineImageIds.map((id) => pastedImages.find((image) => image.id === id)).filter((image): image is PastedQuestionImage => Boolean(image)) : pastedImages;
    const questionsWithImages = parsed.map((question, index) => includedImages[index] ? { ...question, imageUrl: includedImages[index].imageUrl } : question);
    onChange([...questions, ...questionsWithImages]);
    setPastedText("");
    if (pasteBoxRef.current) {
      pasteBoxRef.current.innerHTML = "";
      for (const image of includedImages.slice(parsed.length)) {
        const element = document.createElement("img");
        element.src = image.imageUrl; element.alt = ""; element.title = image.name;
        element.className = "pasted-question-inline-image"; element.dataset.pastedId = image.id; element.contentEditable = "false";
        pasteBoxRef.current.append(element, document.createTextNode("\n"));
      }
    }
    setPasteError("");
    setPastedImages((current) => current.filter((image) => !includedImages.includes(image)));
    const withChoices = parsed.filter((question) => question.options.length >= 2).length;
    const withAnswers = parsed.filter((question) => question.correctAnswer).length;
    const attachedImageCount = Math.min(parsed.length, includedImages.length);
    setPasteMessage(`Identified ${parsed.length} question${parsed.length === 1 ? "" : "s"}: choices were filled in for ${withChoices} and answers were placed in their options for ${withAnswers}${attachedImageCount ? `; attached ${attachedImageCount} pasted image${attachedImageCount === 1 ? "" : "s"} in order` : ""}. Nothing needs to be entered by hand - review below.`);
  }

  return <section className="question-preview"><div><strong>{questions.length} questions{locked ? " · locked while students are taking the exam" : lockedCount > 0 ? " · existing questions locked" : ""}</strong><button type="button" className="secondary-button" onClick={onAdd} disabled={locked || processingImage}>+ Add question manually</button></div>
    <label className="bulk-question-paste">Paste multiple questions<div ref={pasteBoxRef} className="bulk-question-rich-editor" contentEditable={!locked && !processingImage} suppressContentEditableWarning role="textbox" aria-label="Paste multiple questions and images" aria-multiline="true" data-placeholder="Paste questions here. Images stay inline with the question paper." onPaste={(event) => void pasteQuestionBlock(event)} onInput={(event) => handleRichEditorInput(event.currentTarget)} /><small>Paste text or an image of a question paper here. Images are OCR-scanned automatically. Statement labels such as A-, B-, C- stay in the question; answer choices (A-E, 1-5, (i)-(v), or one per line) and answers are identified separately.</small><button type="button" className="secondary-button" onClick={splitPastedQuestions} disabled={locked || processingImage || !pastedText.trim()}>{processingImage ? "Reading pasted image..." : "Identify and add questions"}</button>{pasteError && <small className="admin-upload-error">{pasteError}</small>}{pasteMessage && <small className="admin-upload-status">{pasteMessage}</small>}</label>
    {imageOcrText && <details className="question-image-ocr"><summary>Recognized image text - review before publishing</summary><pre>{imageOcrText}</pre></details>}
    {questions.length === 0 ? <p>Add questions manually, paste a question block above, or extract them from an uploaded paper.</p> : <ol>{questions.map((question, index) => { const questionLocked = locked || index < lockedCount; const updateQuestion = (update: Partial<ParsedExamQuestion>) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item)); return <li key={`question-${index}`}><label>Question<textarea rows={3} disabled={questionLocked || processingImage} value={question.prompt} placeholder="Type the question or paste an image here" onPaste={(event) => void pasteClipboardImage(event, index)} onChange={(event) => updateQuestion({ prompt: event.target.value })} /></label>{question.imageUrl && <figure className="admin-question-image-preview"><Image unoptimized width={1200} height={800} src={question.imageUrl} alt={`Image for question ${index + 1}`} /><button type="button" className="danger-button" disabled={questionLocked || processingImage} onClick={() => updateQuestion({ imageUrl: null })}>Remove question image</button></figure>}<label className="admin-question-image-field">Question image (optional)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={questionLocked || processingImage} onChange={(event) => { const file = event.target.files?.[0]; if (file) void processManualImage(file, index); event.target.value = ""; }} /></label><div className="admin-question-options">{question.options.map((option, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); const optionImage = question.optionImages?.[optionIndex]; return <div className="admin-option-editor" key={key}><label>Option {key}<input disabled={questionLocked || processingImage} value={option} placeholder={`Type option ${key} or paste its image`} onPaste={(event) => void pasteClipboardImage(event, index, optionIndex)} onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((choice, choiceIndex) => choiceIndex === optionIndex ? event.target.value : choice) } : item))} /></label>{optionImage && <figure className="admin-question-image-preview"><Image unoptimized width={800} height={600} src={optionImage} alt={`Image for option ${key} of question ${index + 1}`} /><button type="button" className="danger-button" disabled={questionLocked || processingImage} onClick={() => updateQuestion({ optionImages: question.options.map((_, choiceIndex) => choiceIndex === optionIndex ? null : question.optionImages?.[choiceIndex] ?? null) })}>Remove option image</button></figure>}<label className="admin-question-image-field">Option {key} image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={questionLocked || processingImage} onChange={(event) => { const file = event.target.files?.[0]; if (file) void processManualImage(file, index, optionIndex); event.target.value = ""; }} /></label></div>; })}</div><button type="button" className="secondary-button" disabled={questionLocked || processingImage} onClick={() => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, options: [...item.options, ""], optionImages: [...(item.optionImages ?? []), null] } : item))}>+ Add option</button><label>Correct answer<select disabled={questionLocked || processingImage} value={question.correctAnswer ?? ""} onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, correctAnswer: event.target.value || null } : item))}><option value="">Select answer</option>{question.options.map((_, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); return <option key={key} value={key}>{key}</option>; })}</select></label><button type="button" className="danger-button" disabled={questionLocked || processingImage} onClick={() => onChange(questions.filter((_, questionIndex) => questionIndex !== index))}>Remove question</button></li>; })}</ol>}
  </section>;
}
