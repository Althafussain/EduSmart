"use client";

import { useState } from "react";
import { parsePastedExamQuestions, type ParsedExamQuestion } from "@/lib/exam-question-text";

export default function ExamQuestionEditor({ questions, onChange, onAdd }: {
  questions: ParsedExamQuestion[];
  onChange: (questions: ParsedExamQuestion[]) => void;
  onAdd: () => void;
}) {
  const [pastedText, setPastedText] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [pasteError, setPasteError] = useState("");

  function splitPastedQuestions() {
    const parsed = parsePastedExamQuestions(pastedText);
    if (parsed.length === 0) {
      setPasteMessage("");
      setPasteError("No complete numbered MCQs found. Use numbered questions with A-D choices, such as 1. Question text, A) choice, B) choice.");
      return;
    }

    onChange([...questions, ...parsed]);
    setPastedText("");
    setPasteError("");
    setPasteMessage(`Separated ${parsed.length} question${parsed.length === 1 ? "" : "s"}. Review each prompt, option, and correct answer below.`);
  }

  return <section className="question-preview"><div><strong>{questions.length} questions</strong><button type="button" className="secondary-button" onClick={onAdd}>+ Add question manually</button></div>
    <label className="bulk-question-paste">Paste multiple questions<textarea rows={7} value={pastedText} placeholder={"Paste numbered questions and choices here, for example:\n1. What is 2 + 2?\nA) 3\nB) 4\n\n2. Which is a planet?\nA) Moon\nB) Mars"} onChange={(event) => { setPastedText(event.target.value); setPasteError(""); setPasteMessage(""); }} /><button type="button" className="secondary-button" onClick={splitPastedQuestions} disabled={!pastedText.trim()}>Split and add questions</button>{pasteError && <small className="admin-upload-error">{pasteError}</small>}{pasteMessage && <small className="admin-upload-status">{pasteMessage}</small>}</label>
    {questions.length === 0 ? <p>Add questions manually, paste a question block above, or extract them from an uploaded paper.</p> : <ol>{questions.map((question, index) => <li key={`question-${index}`}><label>Question<textarea rows={3} value={question.prompt} placeholder="Type the question" onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} /></label><div className="admin-question-options">{question.options.map((option, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); return <label key={key}>Option {key}<input value={option} placeholder={`Type option ${key}`} onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((choice, choiceIndex) => choiceIndex === optionIndex ? event.target.value : choice) } : item))} /></label>; })}</div><button type="button" className="secondary-button" onClick={() => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, options: [...item.options, ""] } : item))}>+ Add option</button><label>Correct answer<select value={question.correctAnswer ?? ""} onChange={(event) => onChange(questions.map((item, itemIndex) => itemIndex === index ? { ...item, correctAnswer: event.target.value || null } : item))}><option value="">Select answer</option>{question.options.map((_, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); return <option key={key} value={key}>{key}</option>; })}</select></label><button type="button" className="danger-button" onClick={() => onChange(questions.filter((_, questionIndex) => questionIndex !== index))}>Remove question</button></li>)}</ol>}
  </section>;
}
