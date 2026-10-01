"use client";

import { useState } from "react";
import { parsePastedExamQuestions, type ParsedExamQuestion } from "@/lib/exam-question-text";

export default function ExamQuestionEditor({ questions, onChange, onAdd, locked = false, lockedCount = 0 }: {
  questions: ParsedExamQuestion[];
  onChange: (questions: ParsedExamQuestion[]) => void;
  onAdd: () => void;
  locked?: boolean;
  lockedCount?: number;
}) {
  const [pastedText, setPastedText] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [pasteError, setPasteError] = useState("");

  function splitPastedQuestions() {
    const parsed = parsePastedExamQuestions(pastedText);
    if (parsed.length === 0) {
      setPasteMessage("");
      setPasteError("No numbered questions with selectable answers were found. Add question numbers and label choices A, B, C, or D.");
      return;
    }

    onChange([...questions, ...parsed]);
    setPastedText("");
    setPasteError("");
    const identifiedOptions = parsed.filter((question) => question.options.length >= 2).length;
    setPasteMessage(`Identified ${parsed.length} question${parsed.length === 1 ? "" : "s"} and selectable answers for ${identifiedOptions}. Review the options and any detected correct answers below.`);
  }

  return <section className="question-preview"><div><strong>{questions.length} questions{locked ? " · locked while students are taking the exam" : lockedCount > 0 ? " · existing questions locked" : ""}</strong><button type="button" className="secondary-button" onClick={onAdd} disabled={locked}>+ Add question manually</button></div>
    <label className="bulk-question-paste">Paste multiple questions<textarea rows={7} disabled={locked} value={pastedText} placeholder={"Paste numbered questions and labeled choices here, for example:\n1. What is 2 + 2?\n1) 3\n2) 4\nAnswer: 2\n\n2. Which is a planet?\n(i) Moon\n(ii) Mars\nCorrect answer: ii"} onChange={(event) => { setPastedText(event.target.value); setPasteError(""); setPasteMessage(""); }} /><small>Choices labeled A-E, 1-5, or (i)-(v) are recognized. Put each choice on its own line.</small><button type="button" className="secondary-button" onClick={splitPastedQuestions} disabled={locked || !pastedText.trim()}>Identify and add questions</button>{pasteError && <small className="admin-upload-error">{pasteError}</small>}{pasteMessage && <small className="admin-upload-status">{pasteMessage}</small>}</label>
    {questions.length === 0 ? <p>Add questions manually, paste a question block above, or extract them from an uploaded paper.</p> : <ol>{questions.map((question, index) => { const questionLocked = locked || index < lockedCount; return <li key={`question-${index}`}><label>Question<textarea rows={3} disabled={questionLocked} value={question.prompt} placeholder="Type the question" onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} /></label><div className="admin-question-options">{question.options.map((option, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); return <label key={key}>Option {key}<input disabled={questionLocked} value={option} placeholder={`Type option ${key}`} onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((choice, choiceIndex) => choiceIndex === optionIndex ? event.target.value : choice) } : item))} /></label>; })}</div><button type="button" className="secondary-button" disabled={questionLocked} onClick={() => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, options: [...item.options, ""] } : item))}>+ Add option</button><label>Correct answer<select disabled={questionLocked} value={question.correctAnswer ?? ""} onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, correctAnswer: event.target.value || null } : item))}><option value="">Select answer</option>{question.options.map((_, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); return <option key={key} value={key}>{key}</option>; })}</select></label><button type="button" className="danger-button" disabled={questionLocked} onClick={() => onChange(questions.filter((_, questionIndex) => questionIndex !== index))}>Remove question</button></li>; })}</ol>}
  </section>;
}
