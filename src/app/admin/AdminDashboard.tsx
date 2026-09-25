"use client";

import { useEffect, useState, type FormEvent } from "react";

type Resource = "users" | "books" | "videos" | "exams";
type Item = Record<string, unknown> & { id: string };
type ExamQuestion = { prompt: string; options: string[]; correctAnswer: string | null };

const labels: Record<Resource, string> = { users: "Users", books: "Books", videos: "Videos", exams: "Exams" };
const fieldNames: Record<Resource, string[]> = {
  users: ["fullName", "email", "password", "role", "educationLevel", "stream"],
  books: ["title", "author", "subject", "level", "price", "imageUrl", "description"],
  videos: ["title", "subject", "level", "duration", "videoUrl", "thumbnail", "description"],
  exams: ["title", "subject", "educationLevel", "durationMins", "totalMarks", "startsAt", "endsAt", "questions"],
};

function readMediaFile(file: File, setValue: (value: string) => void) {
  if (file.size > 12 * 1024 * 1024) {
    window.alert("Uploaded media must be smaller than 12 MB. Use a web URL for larger files.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => setValue(typeof reader.result === "string" ? reader.result : "");
  reader.readAsDataURL(file);
}

function itemTitle(item: Item, resource: Resource) {
  if (resource === "users") return `${String(item.fullName)} · ${String(item.email)} · ${String(item.role)}`;
  if (resource === "exams") return `${String(item.title)} · ${String((item.subject as { name?: string })?.name ?? item.subject)}`;
  return `${String(item.title)} · ${String(item.subject ?? "")}`;
}

export default function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [active, setActive] = useState<Resource>("exams");
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [extractingQuestions, setExtractingQuestions] = useState(false);

  async function loadItems(resource: Resource) {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/${resource}`);
      const result = await response.json() as { items?: Item[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load records.");
      setItems(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  }

  // The active tab selects the external database collection shown here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadItems(active); }, [active]);

  function openCreate() {
    setEditing(null);
    setForm({ role: "STUDENT", published: "false", educationLevel: "A_LEVEL" });
    setExamFile(null); setExamQuestions([]); setStatus(""); setError("");
  }

  function openEdit(item: Item) {
    const next: Record<string, string> = {};
    fieldNames[active].forEach((key) => {
      const value = key === "subject" && typeof item[key] === "object" ? (item[key] as { name?: string }).name : item[key];
      next[key] = String(value ?? "");
    });
    next.published = String(item.published ?? "false");
    const savedQuestions = Array.isArray(item.questions) ? item.questions as ExamQuestion[] : [];
    setEditing(item); setForm(next); setExamQuestions(savedQuestions.filter((question) => question && typeof question.prompt === "string")); setExamFile(null); setStatus(""); setError("");
  }

  async function extractExamQuestions() {
    if (!examFile) {
      setError("Choose a PDF exam paper first.");
      return;
    }

    setExtractingQuestions(true); setError(""); setStatus("Extracting questions from the PDF...");
    const formData = new FormData();
    formData.append("file", examFile);
    try {
      const response = await fetch("/api/admin/exams/upload", { method: "POST", body: formData });
      const result = await response.json() as { questions?: ExamQuestion[]; fileName?: string; error?: string };
      if (!response.ok || !result.questions) throw new Error(result.error ?? "The PDF could not be read.");
      setExamQuestions(result.questions);
      setForm((current) => ({ ...current, questions: result.questions?.map((question) => question.prompt).join("\n") ?? "" }));
      setStatus(`${result.questions.length} question${result.questions.length === 1 ? "" : "s"} extracted from ${result.fileName ?? examFile.name}. Review them before saving.`);
    } catch (extractError) {
      setStatus("");
      setError(extractError instanceof Error ? extractError.message : "The PDF could not be read.");
    } finally {
      setExtractingQuestions(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const payload: Record<string, unknown> = { ...form };
    if (active === "books") payload.price = Number(form.price);
    if (active === "exams") {
      payload.durationMins = Number(form.durationMins); payload.totalMarks = Number(form.totalMarks);
      payload.questions = examQuestions;
      if (examQuestions.length === 0) {
        setError("Extract an MCQ paper before saving the exam."); setLoading(false); return;
      }
    }
    payload.published = form.published === "true";
    if (active === "users") delete payload.published;
    if (editing && active === "users") delete payload.email;
    try {
      const response = await fetch(`/api/admin/${active}${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save record.");
      setStatus(editing ? "Updated in MongoDB." : "Created in MongoDB."); setEditing(null); setForm({}); setExamFile(null); setExamQuestions([]); await loadItems(active);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save record.");
    } finally { setLoading(false); }
  }

  async function remove(item: Item) {
    if (!window.confirm(`Delete ${itemTitle(item, active)}?`)) return;
    const response = await fetch(`/api/admin/${active}/${item.id}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error ?? "Could not delete record."); return; }
    setStatus("Deleted from MongoDB."); await loadItems(active);
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar"><div className="brand"><span className="brand-mark">e</span><span>edusmart<span className="brand-dot">.</span></span></div><div className="admin-label">ADMIN CONSOLE</div><nav className="admin-nav" aria-label="Admin navigation">{(Object.keys(labels) as Resource[]).map((resource) => <button key={resource} className={active === resource ? "active" : ""} onClick={() => { setActive(resource); setEditing(null); setForm({}); }}>{labels[resource]}</button>)}</nav><button className="admin-signout" onClick={onSignOut}>Sign out <span>↗</span></button></aside>
    <section className="admin-content"><header className="admin-topbar"><div><span className="eyebrow">EDUSMART SRI LANKA</span><h1>Content administration</h1></div><div className="admin-identity"><span className="admin-avatar">AD</span><div><strong>EduSmart Admin</strong><small>MongoDB-backed management</small></div></div></header>
      <div className="admin-page-content"><div className="admin-page-heading"><div><p className="eyebrow">FULL CRUD ACCESS</p><h2>Manage {labels[active].toLowerCase()}</h2><p>Add, edit, publish, and delete records stored in MongoDB.</p></div><button className="primary-button" onClick={openCreate}>+ Add {labels[active].slice(0, -1)}</button></div>
        {status && <p className="admin-upload-status">{status}</p>}{error && <p className="admin-upload-error">{error}</p>}
        {(editing || Object.keys(form).length > 0) && <form className="admin-editor admin-crud-form" onSubmit={submit}><div className="admin-editor-fields">{fieldNames[active].map((key) => <label key={key}>{key === "questions" ? "Extracted MCQ prompts" : key === "imageUrl" ? "Book image URL or upload" : key === "videoUrl" ? "Video URL or upload" : key}{key === "questions" || key === "description" ? <textarea rows={key === "questions" ? 5 : 3} readOnly={key === "questions"} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : key === "role" ? <select value={form[key] ?? "STUDENT"} onChange={(event) => setForm({ ...form, [key]: event.target.value })}><option>STUDENT</option><option>TEACHER</option><option>ADMIN</option></select> : <><input required={!((editing && key === "password") || key === "thumbnail")} type={key === "password" ? "password" : key.includes("At") ? "datetime-local" : key === "price" || key.includes("Mins") || key === "totalMarks" ? "number" : "text"} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />{(key === "imageUrl" || key === "videoUrl") && <input type="file" accept={key === "imageUrl" ? "image/*" : "video/*"} onChange={(event) => { const file = event.target.files?.[0]; if (file) readMediaFile(file, (value) => setForm((current) => ({ ...current, [key]: value }))); }} />}</>}</label>)}{active === "exams" && <label>Question paper PDF, DOCX, or image<input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp" onChange={(event) => setExamFile(event.target.files?.[0] ?? null)} /><button type="button" className="secondary-button" onClick={() => void extractExamQuestions()} disabled={!examFile || extractingQuestions}>{extractingQuestions ? "Extracting..." : "Extract MCQ questions"}</button><small>Scanned English, Sinhala, and Tamil papers are supported.</small></label>}{active !== "users" && <label>Published<select value={form.published ?? "false"} onChange={(event) => setForm({ ...form, published: event.target.value })}><option value="false">Draft</option><option value="true">Published</option></select></label>}</div>{active === "exams" && examQuestions.length > 0 && <div className="question-preview"><strong>{examQuestions.length} MCQs ready</strong><ol>{examQuestions.map((question, index) => <li key={`${question.prompt}-${index}`}>{question.prompt}<small>{question.options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`).join("  ")}{question.correctAnswer ? ` · Answer: ${question.correctAnswer}` : ""}</small></li>)}</ol></div>}<div className="admin-editor-footer"><span>{status || (editing ? "Update this MongoDB record." : "Create a new MongoDB record.")}</span><div><button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({}); setExamFile(null); setExamQuestions([]); }}>Cancel</button><button type="submit" className="primary-button" disabled={loading || extractingQuestions}>{editing ? "Save changes" : "Create record"}</button></div></div></form>}
        <section className="admin-record-list"><div className="admin-record-list-head"><strong>{items.length} {labels[active].toLowerCase()}</strong><button className="secondary-button" onClick={() => void loadItems(active)}>Refresh</button></div>{loading ? <p className="admin-empty">Loading records...</p> : items.length === 0 ? <p className="admin-empty">No records yet.</p> : items.map((item) => <article className="admin-record" key={item.id}><div><strong>{itemTitle(item, active)}</strong><small>{item.published ? "Published" : "Draft"}</small></div><div className="admin-record-actions"><button onClick={() => openEdit(item)}>Edit</button><button className="danger-button" onClick={() => void remove(item)}>Delete</button></div></article>)}</section>
      </div></section>
  </main>;
}
