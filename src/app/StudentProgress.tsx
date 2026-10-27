"use client";

import { useEffect, useState } from "react";

type ProgressData = {
  overallAverage: number | null;
  completedCount: number;
  subjects: { subject: string; averagePercentage: number; examsCompleted: number }[];
  recentResults: { id: string; title: string; subject: string; obtainedMarks: number; totalMarks: number; percentage: number; passed: boolean; submittedAt: string }[];
  recommendations: { subject: string; averagePercentage: number; message: string; resources: { id: string; title: string; type: "video" | "paper"; url: string }[] }[];
};

export default function StudentProgress({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/student/progress", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as ProgressData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load your progress.");
        if (active) { setData(result); setError(""); }
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load your progress."); });
    return () => { active = false; };
  }, [refreshKey]);

  if (error) return <section className="nav-page"><p className="admin-upload-error">{error}</p></section>;
  if (!data) return <section className="nav-page"><p className="admin-empty">Loading your exam progress...</p></section>;

  return <section className="nav-page student-progress-page">
    <div className="section-heading"><div><p className="eyebrow">YOUR LEARNING JOURNEY</p><h1>Progress</h1><p className="subtitle">Scores and practice suggestions based on your own completed exams.</p></div></div>
    <div className="stats-grid student-progress-stats">
      <div className="stat-card accent"><div className="stat-label">AVERAGE EXAM SCORE</div><div className="stat-value">{data.overallAverage === null ? "--" : data.overallAverage}<small>{data.overallAverage === null ? "" : "%"}</small></div><div className="stat-foot">Across your completed exams</div></div>
      <div className="stat-card"><div className="stat-label">EXAMS COMPLETED</div><div className="stat-value">{data.completedCount}</div><div className="stat-foot">Your submitted and marked exams</div></div>
      <div className="stat-card"><div className="stat-label">SUBJECTS TO PRACTISE</div><div className="stat-value">{data.recommendations.length}</div><div className="stat-foot">Based on subject averages below 70%</div></div>
    </div>

    <section className="progress-panel student-subject-panel"><div className="section-heading compact"><div><p className="eyebrow">BASED ON YOUR SCORES</p><h2>Subject performance</h2></div></div>
      {data.subjects.length === 0 ? <p className="student-progress-empty">Complete a marked exam to see your personal scores and practice suggestions here.</p> : <div className="student-subject-list">{data.subjects.map((item) => <article className="student-subject-row" key={item.subject}><div className="student-subject-label"><strong>{item.subject}</strong><span>{item.averagePercentage}% average · {item.examsCompleted} exam{item.examsCompleted === 1 ? "" : "s"}</span></div><div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, item.averagePercentage))}%`, background: item.averagePercentage < 50 ? "#c76d58" : item.averagePercentage < 70 ? "#dfa53e" : "#2a8c73" }} /></div></article>)}</div>}
    </section>

    <section className="student-recommendations"><div className="section-heading compact"><div><p className="eyebrow">PERSONALISED NEXT STEPS</p><h2>Practice suggestions</h2></div></div>
      {data.recommendations.length === 0 ? <article className="student-recommendation-card"><strong>{data.completedCount ? "Great progress" : "Your suggestions will appear here"}</strong><p>{data.completedCount ? "Your current subject averages are 70% or higher. Keep practising to maintain your progress." : "After you complete an exam, eminds will use your results to suggest subjects to practise."}</p></article> : <div className="student-recommendation-grid">{data.recommendations.map((item) => <article className="student-recommendation-card" key={item.subject}><div className="student-recommendation-score">{item.averagePercentage}%</div><div><span className="eyebrow">FOCUS SUBJECT</span><h3>{item.subject}</h3><p>{item.message}</p>{item.resources.length > 0 ? <ul>{item.resources.map((resource) => <li key={`${resource.type}-${resource.id}`}><a href={resource.url} target={resource.type === "video" ? "_blank" : undefined} rel={resource.type === "video" ? "noreferrer" : undefined}>{resource.type === "video" ? "Watch" : "Open paper"}: {resource.title}</a></li>)}</ul> : <p className="student-recommendation-hint">No published {item.subject} practice material is available yet. Check the examinations section again later.</p>}</div></article>)}</div>}
    </section>

    <section className="student-score-history"><div className="section-heading compact"><div><p className="eyebrow">YOUR RESULTS</p><h2>Recent exam scores</h2></div></div>
      {data.recentResults.length === 0 ? <p className="student-progress-empty">No completed exam scores yet.</p> : <div className="student-score-list">{data.recentResults.map((result) => <article className="student-score-row" key={result.id}><div><strong>{result.title}</strong><span>{result.subject} · {new Date(result.submittedAt).toLocaleDateString()}</span></div><strong className={result.percentage < 50 ? "student-score-low" : ""}>{result.obtainedMarks} / {result.totalMarks} ({result.percentage}%)</strong></article>)}</div>}
    </section>
  </section>;
}
