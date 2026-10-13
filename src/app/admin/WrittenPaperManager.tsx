"use client";

import { useEffect, useState, type FormEvent } from "react";

type Submission = { id: string; fileName: string | null; submittedAt: string | null; student?: { fullName: string; email: string } };
type WrittenPaper = { id: string; title: string; subject: string; educationLevel: string; grade: number | null; stream: string | null; fileName: string; durationMins: number; published: boolean; createdAt: string; submissions: Submission[] };

const levelLabels: Record<string, string> = { GRADE: "Grade 1-13", O_LEVEL: "O Level", A_LEVEL: "A Level" };

export default function WrittenPaperManager() {
  const [papers, setPapers] = useState<WrittenPaper[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState("A_LEVEL");
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [durationMins, setDurationMins] = useState("60");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function loadPapers() {
    try {
      const response = await fetch("/api/admin/written-papers", { cache: "no-store" });
      const result = await response.json() as { items?: WrittenPaper[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load written papers.");
      setPapers(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load written papers.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/written-papers", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { items?: WrittenPaper[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load written papers.");
        if (!cancelled) setPapers(result.items ?? []);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load written papers.");
      });
    return () => { cancelled = true; };
  }, []);

  async function savePaper(event: FormEvent<HTMLFormElement>, published: boolean) {
    event.preventDefault();
    if (!file) { setError("Choose the PDF or DOCX paper you want students to download."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("The paper must be smaller than 10 MB."); return; }
    setLoading(true); setError(""); setStatus("");
    const form = new FormData();
    form.set("file", file); form.set("title", title); form.set("subject", subject);
    form.set("educationLevel", educationLevel); form.set("grade", grade); form.set("stream", stream);
    form.set("durationMins", durationMins); form.set("published", String(published));
    try {
      const response = await fetch("/api/admin/written-papers", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save the written paper.");
      setStatus(published ? "Paper published and available for students." : "Paper saved as a draft.");
      setTitle(""); setSubject(""); setGrade(""); setStream(""); setDurationMins("60"); setFile(null);
      const picker = document.getElementById("written-paper-file") as HTMLInputElement | null;
      if (picker) picker.value = "";
      await loadPapers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the written paper.");
    } finally { setLoading(false); }
  }

  async function togglePublished(paper: WrittenPaper) {
    setError(""); setStatus("");
    const response = await fetch(`/api/admin/written-papers/${paper.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !paper.published }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error ?? "Could not update publication status."); return; }
    setStatus(paper.published ? "Paper moved back to drafts." : "Paper published and available for students.");
    await loadPapers();
  }

  async function deletePaper(paper: WrittenPaper) {
    if (!window.confirm(`Delete "${paper.title}" and its uploaded document?`)) return;
    const response = await fetch(`/api/admin/written-papers/${paper.id}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error ?? "Could not delete the paper."); return; }
    setStatus("Written paper deleted."); await loadPapers();
  }

  return <section className="written-paper-manager">
    <div className="admin-page-heading"><div><p className="eyebrow">ESSAY AND STRUCTURED ASSESSMENTS</p><h2>Essay &amp; structured papers</h2><p>Upload the original paper and publish it with a time limit for students.</p></div></div>
    {status && <p className="admin-upload-status">{status}</p>}{error && <p className="admin-upload-error">{error}</p>}
    <form className="admin-editor" onSubmit={(event) => void savePaper(event, (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-published") === "true")}>
      <div className="admin-editor-fields">
        <label>Paper title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Grade 11 Science Structured Paper" /></label>
        <label>Subject<input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Biology" /></label>
        <label>Exam duration (minutes)<input type="number" required min="1" max="600" value={durationMins} onChange={(event) => setDurationMins(event.target.value)} /><small>Students receive this time after they start.</small></label>
        <label>Education level<select value={educationLevel} onChange={(event) => { setEducationLevel(event.target.value); setGrade(""); setStream(""); }}><option value="GRADE">Grade</option><option value="O_LEVEL">O Level</option><option value="A_LEVEL">A Level</option></select></label>
        {educationLevel === "GRADE" && <label>Grade<input type="number" min="1" max="13" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="e.g. 11" /></label>}
        {educationLevel === "A_LEVEL" && <label>Stream<input value={stream} onChange={(event) => setStream(event.target.value)} placeholder="e.g. Biological Science" /></label>}
        <label className="written-paper-file">Question paper (PDF or DOCX)<input id="written-paper-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); setStatus(""); }} /><small>Up to 10 MB.</small></label>
      </div>
      <div className="admin-editor-footer"><span>{file ? `Ready to upload: ${file.name}` : "Choose the question paper document to upload."}</span><div><button type="submit" data-published="false" className="secondary-button" disabled={loading || !file}>{loading ? "Saving..." : "Save as draft"}</button><button type="submit" data-published="true" className="primary-button" disabled={loading || !file}>Publish to students</button></div></div>
    </form>
    <section className="admin-record-list"><div className="admin-record-list-head"><strong>{papers.length} written papers</strong><button className="secondary-button" onClick={() => void loadPapers()}>Refresh</button></div>
      {papers.length === 0 ? <p className="admin-empty">No essay or structured papers yet.</p> : papers.map((paper) => <article className="admin-record written-paper-record" key={paper.id}><div><strong>{paper.title} - {paper.subject}</strong><small>{paper.published ? "Published" : "Draft"} - {paper.durationMins} minutes - {levelLabels[paper.educationLevel] ?? paper.educationLevel}{paper.grade ? ` ${paper.grade}` : ""}{paper.stream ? ` - ${paper.stream}` : ""} - {paper.fileName}</small>{paper.submissions.length > 0 && <details><summary>{paper.submissions.length} submitted answer paper{paper.submissions.length === 1 ? "" : "s"}</summary><ul>{paper.submissions.map((submission) => <li key={submission.id}>{submission.student?.fullName ?? "Student"} ({submission.student?.email ?? ""}) - {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ""} - <a href={`/api/admin/written-papers/${paper.id}/submissions/${submission.id}`}>Download {submission.fileName ?? "answer paper"}</a></li>)}</ul></details>}</div><div className="admin-record-actions"><a href={`/api/written-papers/${paper.id}/download`} className="secondary-button">Download paper</a><button onClick={() => void togglePublished(paper)}>{paper.published ? "Unpublish" : "Publish"}</button><button className="danger-button" onClick={() => void deletePaper(paper)}>Delete</button></div></article>)}
    </section>
  </section>;
}
