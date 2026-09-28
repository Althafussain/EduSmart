"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ExamQuestionEditor from "./admin/ExamQuestionEditor";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number }) => void;
        };
      };
    };
  }
}

type VideoCard = { id: string; title: string; subject: string; level: string; duration: string; color: string; image: string; videoUrl: string };
const recommendedVideos: VideoCard[] = [];

const streamSubjects: Record<string, string[]> = {
  "Biological Science": ["Biology", "Chemistry", "Physics"],
  "Physical Science": ["Combined Mathematics", "Physics", "Chemistry"],
  "Commerce": ["Accounting", "Business Studies", "Economics"],
  "Technology": ["Engineering Technology", "Science for Technology", "Information & Communication Technology"],
};

type BookCard = { id: string; title: string; author: string; subject: string; level: string; price: string; color: string; imageUrl: string };
type ExtractedExamQuestion = { prompt: string; options: string[]; correctAnswer: string | null };

const assistantReplies: Record<string, string> = {
  exams: "You have two upcoming examinations. Combined Mathematics is on 18 Sep at 09:00 AM, followed by Physics on 24 Sep at 02:00 PM.",
  learning: "Your current focus is Physics vectors. You are at 68% and have three lessons remaining in this learning path.",
  books: "Open Book shop from the sidebar to browse revision guides and practice papers. You can add books to your basket and checkout there.",
  account: "You can update your profile and learning preferences from Settings. Use your profile menu when you are ready to sign out.",
};

const translations = {
  English: { overview: "Overview", learning: "My learning", examinations: "Examinations", progress: "Progress", shop: "Book shop", settings: "Settings", signIn: "Sign in to your space", createSpace: "Create your student space", welcome: "WELCOME BACK", continue: "Continue your learning journey.", notifications: "Notifications", profile: "View profile", assistant: "EduSmart assistant", support: "Here to help", ask: "Ask for support...", saved: "Settings saved", save: "Save settings", account: "ACCOUNT", preferences: "PREFERENCES", language: "Language" },
  "සිංහල": { overview: "සමස්ත දසුන", learning: "මගේ ඉගෙනීම", examinations: "විභාග", progress: "ප්‍රගතිය", shop: "පොත් සාප්පුව", settings: "සැකසුම්", signIn: "ඔබේ අවකාශයට ඇතුළු වන්න", createSpace: "ඔබේ ශිෂ්‍ය අවකාශය සාදන්න", welcome: "ආයුබෝවන්", continue: "ඔබේ ඉගෙනුම් ගමන දිගටම කරගෙන යන්න.", notifications: "දැනුම්දීම්", profile: "පැතිකඩ බලන්න", assistant: "EduSmart සහායක", support: "උදව් කිරීමට සූදානම්", ask: "උදව් සඳහා විමසන්න...", saved: "සැකසුම් සුරකින ලදී", save: "සැකසුම් සුරකින්න", account: "ගිණුම", preferences: "මනාප", language: "භාෂාව" },
  "தமிழ்": { overview: "மேலோட்டம்", learning: "என் கற்றல்", examinations: "பரீட்சைகள்", progress: "முன்னேற்றம்", shop: "புத்தகக் கடை", settings: "அமைப்புகள்", signIn: "உங்கள் இடத்தில் உள்நுழையுங்கள்", createSpace: "உங்கள் மாணவர் இடத்தை உருவாக்குங்கள்", welcome: "மீண்டும் வரவேற்கிறோம்", continue: "உங்கள் கற்றல் பயணத்தைத் தொடருங்கள்.", notifications: "அறிவிப்புகள்", profile: "சுயவிவரத்தைக் காண்க", assistant: "EduSmart உதவியாளர்", support: "உதவ தயாராக உள்ளது", ask: "உதவி கேளுங்கள்...", saved: "அமைப்புகள் சேமிக்கப்பட்டன", save: "அமைப்புகளைச் சேமி", account: "கணக்கு", preferences: "விருப்பங்கள்", language: "மொழி" },
} as const;

const pageTranslationRows = [
  ["LEARNING, IN MOTION", "ඉගෙනීම, චලනයේ", "கற்றல், இயக்கத்தில்"], ["Your next breakthrough starts here.", "ඔබේ ඊළඟ ජයග්‍රහණය මෙතැනින් ආරම්භ වේ.", "உங்கள் அடுத்த முன்னேற்றம் இங்கே தொடங்குகிறது."], ["One focused space for Sri Lankan students to learn with purpose, practise with confidence, and see their progress clearly.", "ශ්‍රී ලාංකික සිසුන්ට අරමුණකින් ඉගෙනීමට, විශ්වාසයෙන් පුහුණු වීමට සහ ප්‍රගතිය පැහැදිලිව දැකීමට එක් ස්ථානයක්.", "இலங்கை மாணவர்கள் நோக்கத்துடன் கற்கவும், நம்பிக்கையுடன் பயிற்சி செய்யவும், முன்னேற்றத்தைத் தெளிவாகக் காணவும் ஒரே இடம்."], ["Built around your goals", "ඔබේ ඉලක්ක වටා ගොඩනගා ඇත", "உங்கள் இலக்குகளைச் சுற்றி உருவாக்கப்பட்டது"], ["Personalised learning paths for every subject, stream, and stage.", "සෑම විෂයකටම, ධාරාවකටම සහ අදියරකටම පුද්ගලීකරණය කළ ඉගෙනුම් මාර්ග.", "ஒவ்வொரு பாடம், பிரிவு மற்றும் நிலையிற்கும் தனிப்பயன் கற்றல் பாதைகள்."], ["STUDENT SPACE", "ශිෂ්‍ය අවකාශය", "மாணவர் இடம்"], ["WELCOME BACK", "නැවත සාදරයෙන් පිළිගනිමු", "மீண்டும் வரவேற்கிறோம்"], ["Sign in as student", "ශිෂ්‍යයෙකු ලෙස ඇතුළු වන්න", "மாணவராக உள்நுழைக"], ["Create an account", "ගිණුමක් සාදන්න", "கணக்கை உருவாக்கு"], ["Forgot password?", "මුරපදය අමතකද?", "கடவுச்சொல்லை மறந்துவிட்டீர்களா?"], ["Good morning, Nethmi", "සුභ උදෑසනක්, නෙත්මි", "காலை வணக்கம், நேத்மி"], ["Keep learning", "ඉගෙනීම දිගටම කරගෙන යන්න", "தொடர்ந்து கற்றுக்கொள்ளுங்கள்"], ["Upcoming examinations", "ඉදිරි විභාග", "வரவிருக்கும் பரீட்சைகள்"], ["Subject strengths", "විෂය ශක්තීන්", "பாட வலிமைகள்"], ["See all recommendations", "සියලු නිර්දේශ බලන්න", "அனைத்து பரிந்துரைகளையும் காண்க"], ["View calendar", "දින දර්ශනය බලන්න", "நாட்காட்டியைக் காண்க"], ["Stay on track", "මාර්ගයේ රැඳී සිටින්න", "பாதையில் தொடருங்கள்"], ["YOUR PROGRESS", "ඔබේ ප්‍රගතිය", "உங்கள் முன்னேற்றம்"], ["Book shop", "පොත් සාප්පුව", "புத்தகக் கடை"], ["Get trusted revision guides and practice papers delivered to you.", "විශ්වාසදායක පුනරීක්ෂණ මාර්ගෝපදේශ සහ පුහුණු ප්‍රශ්න පත්‍ර ලබා ගන්න.", "நம்பகமான மீளாய்வு வழிகாட்டிகள் மற்றும் பயிற்சி வினாத்தாள்களைப் பெறுங்கள்."], ["Add to basket", "බාස්කට්ටුවට එක් කරන්න", "கூடையில் சேர்"], ["Checkout", "ගෙවීම", "செலுத்துதல்"], ["Settings", "සැකසුම්", "அமைப்புகள்"], ["Profile details", "පැතිකඩ විස්තර", "சுயவிவர விவரங்கள்"], ["Learning experience", "ඉගෙනුම් අත්දැකීම", "கற்றல் அனுபவம்"], ["Study reminders", "අධ්‍යයන මතක් කිරීම්", "படிப்பு நினைவூட்டல்கள்"], ["Compact layout", "සංක්ෂිප්ත පිරිසැලසුම", "சுருக்கமான அமைப்பு"], ["Save settings", "සැකසුම් සුරකින්න", "அமைப்புகளைச் சேமி"], ["Notifications", "දැනුම්දීම්", "அறிவிப்புகள்"], ["Mark all as read", "සියල්ල කියවූ ලෙස සලකුණු කරන්න", "அனைத்தையும் படித்ததாகக் குறிக்கவும்"], ["All caught up", "සියල්ල යාවත්කාලීනයි", "அனைத்தும் படிக்கப்பட்டது"], ["Here to help", "උදව් කිරීමට සූදානම්", "உதவ தயாராக உள்ளது"], ["Ask for support...", "සහාය සඳහා විමසන්න...", "ஆதரவைக் கேளுங்கள்..."], ["My exams", "මගේ විභාග", "என் பரீட்சைகள்"], ["Learning help", "ඉගෙනුම් උදව්", "கற்றல் உதவி"], ["Where are the books?", "පොත් කොහේද?", "புத்தகங்கள் எங்கே?"], ["Send message", "පණිවිඩය යවන්න", "செய்தியை அனுப்பு"] ,
] as const;

type ExamQuestion = { id: string; prompt: string; options: string[]; marks: number; type: string };
type ExamResult = { obtainedMarks: number; totalMarks: number; percentage: number; passed: boolean };
type PublishedExam = { id: string; title: string; subject: string; date: string; time: string; duration: string; tone: string; questions: ExamQuestion[]; fileName: string };

function VideoPlayerModal({ video, onClose }: { video: VideoCard; onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="video-player-modal" role="dialog" aria-modal="true" aria-labelledby="video-player-title" onClick={(event) => event.stopPropagation()}><div className="video-player-head"><div><span className="eyebrow">NOW PLAYING · {video.subject}</span><h2 id="video-player-title">{video.title}</h2></div><button className="close-button" onClick={onClose} aria-label="Close video player">×</button></div><video className="video-player" controls autoPlay playsInline poster={video.image} src={video.videoUrl}>Your browser does not support video playback.</video><div className="video-player-foot"><span>{video.level}</span><span>{video.duration} lesson</span></div></section></div>;
}

function ExamUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("60 min");
  const [questions, setQuestions] = useState<ExtractedExamQuestion[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const addManualQuestion = () => setQuestions((current) => [...current, { prompt: "", options: ["", ""], correctAnswer: null }]);

  const extractQuestions = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) { setError("Choose a PDF or DOCX exam paper first."); return; }
    setUploading(true); setError(""); setStatus("Scanning every page for questions and answer keys...");
    const formData = new FormData(); formData.append("file", file);
    try {
      const response = await fetch("/api/admin/exams/upload", { method: "POST", body: formData });
      const result = await response.json() as { questions?: ExtractedExamQuestion[]; error?: string; fileName?: string; pagesScanned?: number | null; imagesScanned?: number | null };
      if (!response.ok || !result.questions) throw new Error(result.error ?? "The file could not be read.");
      const scanSummary = result.pagesScanned ? `All ${result.pagesScanned} PDF pages scanned. ` : result.imagesScanned ? `${result.imagesScanned} document image${result.imagesScanned === 1 ? "" : "s"} scanned. ` : "";
      setQuestions(result.questions); setStatus(`${scanSummary}${result.questions.length} questions extracted from ${result.fileName}. Review the options and fill in any missing choices or answers before publishing.`);
    } catch (uploadError) { setStatus(""); setError(uploadError instanceof Error ? uploadError.message : "The upload failed."); }
    finally { setUploading(false); }
  };

  const publishExam = async () => {
    const incompleteQuestion = questions.some((question) => { const options = question.options.map((option) => option.trim()); const firstEmpty = options.indexOf(""); return !question.prompt.trim() || options.filter(Boolean).length < 2 || (firstEmpty >= 0 && options.slice(firstEmpty).some(Boolean)) || !question.correctAnswer || !options[question.correctAnswer.charCodeAt(0) - 65]; });
    if (!title || !subject || !date || questions.length === 0 || incompleteQuestion) { setError("Add the exam details and complete every question with at least two consecutive options and a correct answer before publishing."); return; }
    setUploading(true); setError("");
    try {
      const startsAt = `${date}T09:00:00`;
      const response = await fetch("/api/admin/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, subject, educationLevel: "GRADE", durationMins: Number.parseInt(duration, 10), totalMarks: questions.length, startsAt, endsAt: `${date}T23:59:00`, published: true, questions }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The exam could not be published.");
      setStatus("Published to MongoDB and the student portal.");
    } catch (publishError) { setError(publishError instanceof Error ? publishError.message : "The exam could not be published."); }
    finally { setUploading(false); }
  };

  return <section className="admin-form-page"><div className="admin-page-heading"><div><p className="eyebrow">ADMIN ONLY · PDF / DOCX EXTRACTION</p><h2>Exam paper manager</h2><p>Upload a paper, review the extracted questions, then publish it to students.</p></div><span className={status.includes("Published") ? "publish-status live" : "publish-status"}>{status.includes("Published") ? "Published" : "Draft"}</span></div><form className="admin-editor" onSubmit={extractQuestions}><div className="admin-editor-fields"><label>Paper title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Term 03 Biology Paper" /></label><label>Subject<input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Biology" /></label><label>Exam date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Duration<select value={duration} onChange={(event) => setDuration(event.target.value)}><option>60 min</option><option>90 min</option><option>120 min</option><option>180 min</option></select></label><label className="admin-upload-field">Exam paper file<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>Optional when entering questions manually. Every PDF page is scanned. Text-based files work best.</small></label></div>{error && <p className="admin-upload-error">{error}</p>}{status && !status.includes("Published") && <p className="admin-upload-status">{status}</p>}<ExamQuestionEditor questions={questions} onChange={setQuestions} onAdd={addManualQuestion} /><div className="admin-editor-footer"><span>{questions.length > 0 ? "Review the extracted questions and answers before publishing." : "Questions remain private until you publish this paper."}</span><div><button type="submit" className="secondary-button" disabled={uploading}>{uploading ? "Reading file..." : "Extract questions"}</button><button type="button" className="primary-button" disabled={questions.length === 0} onClick={publishExam}>Publish to students →</button></div></div></form></section>;
}

function AdminForm({ title, description, fields, published, onPublish }: { title: string; description: string; fields: string[]; published: boolean; onPublish: () => void }) {
  if (title === "Exam paper manager") return <ExamUploadForm />;
  return <section className="admin-form-page"><div className="admin-page-heading"><div><p className="eyebrow">ADMIN ONLY</p><h2>{title}</h2><p>{description}</p></div><span className={published ? "publish-status live" : "publish-status"}>{published ? "Published" : "Draft"}</span></div><form className="admin-editor" onSubmit={(event) => { event.preventDefault(); onPublish(); }}><div className="admin-editor-fields">{fields.map((field) => <label key={field}>{field}<input required placeholder={`Enter ${field.toLowerCase()}`} /></label>)}<label>Description<textarea rows={4} placeholder="Add a short description for students" /></label></div><div className="admin-editor-footer"><span>{published ? "This content is live in the student portal." : "Save as a draft or publish when ready."}</span><div><button type="button" className="secondary-button">Save draft</button><button type="submit" className="primary-button">{published ? "Published ✓" : "Publish to students →"}</button></div></div></form></section>;
}

export function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [activeSection, setActiveSection] = useState<"overview" | "exams" | "books" | "videos">("overview");
  const [examPublished, setExamPublished] = useState(false);
  const [bookPublished, setBookPublished] = useState(false);
  const [videoPublished, setVideoPublished] = useState(false);
  const sections = [["overview", "Overview", "⌂"], ["exams", "Exam papers", "▣"], ["books", "Books", "▤"], ["videos", "Videos", "▶"]] as const;

  return <main className="admin-shell"><aside className="admin-sidebar"><div className="brand"><span className="brand-mark">e</span><span>edusmart<span className="brand-dot">.</span></span></div><div className="admin-label">ADMIN CONSOLE</div><nav className="admin-nav" aria-label="Admin navigation">{sections.map(([section, label, icon]) => <button key={section} className={activeSection === section ? "active" : ""} onClick={() => setActiveSection(section)}><span>{icon}</span>{label}</button>)}</nav><button className="admin-signout" onClick={onSignOut}>Sign out <span>↗</span></button></aside><section className="admin-content"><header className="admin-topbar"><div><span className="eyebrow">EDUSMART SRI LANKA</span><h1>Content administration</h1></div><div className="admin-identity"><span className="admin-avatar">AD</span><div><strong>EduSmart Admin</strong><small>Full publishing access</small></div></div></header><div className="admin-page-content">{activeSection === "overview" && <><section className="admin-welcome"><div><p className="eyebrow">CONTROL CENTRE</p><h2>Keep the learning library moving.</h2><p>Only administrators can publish exam papers, books, and video lessons for students.</p></div><span className="admin-lock">⌘</span></section><section className="admin-stats"><div><span>LIVE EXAM PAPERS</span><strong>12</strong><small>2 drafts waiting</small></div><div><span>PUBLISHED BOOKS</span><strong>28</strong><small>4 added this month</small></div><div><span>VIDEO LESSONS</span><strong>46</strong><small>6 pending review</small></div></section><div className="admin-section-grid"><button className="admin-action-card" onClick={() => setActiveSection("exams")}><span className="admin-action-icon">▣</span><strong>Manage exam papers</strong><small>Upload papers, set schedules, and publish assessments.</small><span className="admin-action-link">Open manager →</span></button><button className="admin-action-card" onClick={() => setActiveSection("books")}><span className="admin-action-icon">▤</span><strong>Publish books</strong><small>Add trusted revision guides to the student book shop.</small><span className="admin-action-link">Open manager →</span></button><button className="admin-action-card" onClick={() => setActiveSection("videos")}><span className="admin-action-icon">▶</span><strong>Add video lessons</strong><small>Publish curated lessons to student learning spaces.</small><span className="admin-action-link">Open manager →</span></button></div></>}{activeSection === "exams" && <AdminForm title="Exam paper manager" description="Create and publish an assessment. Students can only see papers after you publish them." published={examPublished} onPublish={() => setExamPublished(true)} fields={["Paper title", "Subject", "Start date and time", "Duration"]} />}{activeSection === "books" && <AdminForm title="Book publishing" description="Add a revision guide to the student book shop when its details are ready." published={bookPublished} onPublish={() => setBookPublished(true)} fields={["Book title", "Author or publisher", "Subject", "Price"]} />}{activeSection === "videos" && <AdminForm title="Video lesson manager" description="Add a lesson link and publish it to the student learning library." published={videoPublished} onPublish={() => setVideoPublished(true)} fields={["Video title", "Video URL", "Subject", "Duration"]} />}</div></section></main>;
}

type StudentProfile = {
  fullName: string;
  email: string;
  educationLevel: string;
  stream: string;
  subjects: string[];
};

type AuthResponseUser = {
  email?: string | null;
  fullName?: string;
  educationLevel?: string | null;
  stream?: string | null;
  subjects?: string[];
  role?: string;
};

function profileFromUser(user: AuthResponseUser | null): StudentProfile {
  const email = user?.email ?? "";
  const emailName = email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Student";

  return {
    fullName: user?.fullName?.trim() || emailName,
    email,
    educationLevel: user?.educationLevel || "Not provided",
    stream: user?.stream || "Not provided",
    subjects: user?.subjects ?? [],
  };
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ST";
}

function ProfileModal({ profile, onClose, onSignOut }: { profile: StudentProfile; onClose: () => void; onSignOut: () => void }) {
  const academicDetails = [profile.educationLevel, profile.stream !== "Not provided" ? profile.stream : "", profile.subjects.length ? profile.subjects.join(", ") : ""].filter(Boolean).join(" · ");

  return <div className="modal-backdrop"><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="profile-modal-head"><div className="profile-hero"><div className="profile-large-avatar">{getInitials(profile.fullName)}</div><div><span className="eyebrow">STUDENT PROFILE</span><h2 id="profile-title">{profile.fullName}</h2><p>{academicDetails || "Student account"}</p></div></div><button className="close-button" onClick={onClose} aria-label="Close profile">×</button></div><div className="profile-form"><label>Full name<input value={profile.fullName} readOnly /></label><label>Email address<input value={profile.email} readOnly type="email" /></label><div className="profile-two-col"><label>Education level<input value={profile.educationLevel} readOnly /></label><label>Stream<input value={profile.stream} readOnly /></label></div><label>Subjects<input value={profile.subjects.length ? profile.subjects.join(", ") : "Not provided"} readOnly /></label></div><div className="profile-modal-foot"><button className="signout-button" onClick={onSignOut}>Sign out</button><div><button className="secondary-button" onClick={onClose}>Close</button></div></div></section></div>;
}

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [portal, setPortal] = useState<"student" | "admin">("student");
  const [selectedVideo, setSelectedVideo] = useState<(typeof recommendedVideos)[number] | null>(null);
  const [publishedExam] = useState<PublishedExam | null>(null);
  const [contentVideos, setContentVideos] = useState<VideoCard[]>([]);
  const [contentBooks, setContentBooks] = useState<BookCard[]>([]);
  const [contentExams, setContentExams] = useState<PublishedExam[]>([]);
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<StudentProfile>({ fullName: "Student", email: "", educationLevel: "Not provided", stream: "Not provided", subjects: [] });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [userRole, setUserRole] = useState<"student" | "admin" | null>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [examOpen, setExamOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [question, setQuestion] = useState(0);
  const [seconds, setSeconds] = useState(42 * 60 + 18);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [examError, setExamError] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [stream, setStream] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectError, setSubjectError] = useState(false);
  const [basket, setBasket] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [compactLayout, setCompactLayout] = useState(false);
  const [language, setLanguage] = useState("English");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(2);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<{ from: "assistant" | "user"; text: string }[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const text = translations[language as keyof typeof translations];
  const activeExam = publishedExam ?? contentExams[0] ?? null;
  const questions = activeExam?.questions ?? [];
  const exams = publishedExam ? [publishedExam, ...contentExams] : contentExams;
  const languageOptions = ["English", "සිංහල", "தமிழ்"];
  const currentPortal = userRole === "admin" ? "admin" : "student";
  const cycleLanguage = () => setLanguage((current) => languageOptions[(languageOptions.indexOf(current) + 1) % languageOptions.length]);

  const submitExam = async () => {
    if (!activeExam) return;
    setExamError("");
    try {
      const response = await fetch(`/api/exams/${activeExam.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({ questionId, answer: selectedAnswer })) }) });
      const payload = await response.json() as ExamResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The exam could not be submitted.");
      setExamResult(payload);
      setExamOpen(false);
    } catch (submitError) {
      setExamError(submitError instanceof Error ? submitError.message : "The exam could not be submitted.");
    }
  };

  const updateProfileFromUser = (user: AuthResponseUser | null) => {
    const nextProfile = profileFromUser(user);
    setProfile(nextProfile);
    setFullName(nextProfile.fullName);
    setEmail(nextProfile.email);
    setEducationLevel(nextProfile.educationLevel === "Not provided" ? "" : nextProfile.educationLevel);
    setStream(nextProfile.stream === "Not provided" ? "" : nextProfile.stream);
    setSubjects(nextProfile.subjects);
    setAssistantMessages([{ from: "assistant", text: `Hi ${nextProfile.fullName}. I can help with your exams, learning plan, books, or account settings.` }]);
  };

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticated(false);
    setUserRole(null);
    setAuthError("");
    setAuthMessage("");
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (authView === "signup" && educationLevel === "GCE Advanced Level (A/L)" && subjects.length === 0) {
      setSubjectError(true);
      return;
    }

    setAuthLoading(true);

    try {
      if (authView === "signup") {
        const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signup", email, password, fullName, educationLevel, stream, subjects }) });
        const payload = (await response.json()) as { error?: string; user?: AuthResponseUser };
        if (!response.ok || !payload.user) throw new Error(payload.error ?? "Unable to create the account.");
        setAuthenticated(true);
        setUserRole("student");
        updateProfileFromUser(payload.user);
        setAuthMessage("Registration successful. You are now signed in.");
        return;
      }

      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signin", email, password }) });
      const payload = (await response.json()) as { error?: string; user?: AuthResponseUser };
      if (!response.ok || !payload.user) throw new Error(payload.error ?? "Authentication failed.");
      const sessionRole = payload.user.role === "admin" ? "admin" : "student";
      updateProfileFromUser(payload.user);
      setAuthenticated(true);
      setUserRole(sessionRole);
      setAuthMessage("Signed in successfully.");
      if (sessionRole === "admin") router.push("/admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "google", credential }) });
      const payload = (await response.json()) as { error?: string; user?: AuthResponseUser };
      if (!response.ok || !payload.user) throw new Error(payload.error ?? "Google sign-in failed.");
      const sessionRole = payload.user.role === "admin" ? "admin" : "student";
      updateProfileFromUser(payload.user);
      setAuthenticated(true);
      setUserRole(sessionRole);
      setAuthMessage("Signed in successfully with Google.");
      if (sessionRole === "admin") router.push("/admin");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const googleCredentialHandler = useRef(handleGoogleCredential);
  const googleInitialized = useRef(false);
  useEffect(() => {
    googleCredentialHandler.current = handleGoogleCredential;
  });

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const toggle = document.querySelector<HTMLElement>(".auth-toggle");
    if (authenticated || authView !== "login" || !clientId || !toggle) return;

    const button = document.createElement("div");
    button.className = "google-signin";
    toggle.append(button);
    const renderButton = () => {
      if (!window.google) return;
      if (!googleInitialized.current) {
        window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => googleCredentialHandler.current(credential) });
        googleInitialized.current = true;
      }
      window.google.accounts.id.renderButton(button, { theme: "outline", size: "large", width: 350 });
    };
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = renderButton;
    document.head.append(script);
    if (window.google) renderButton();
    return () => { button.remove(); script.remove(); };
  }, [authenticated, authView]);

  useEffect(() => {
    fetch("/api/auth").then((response) => response.json()).then((payload: { user?: AuthResponseUser | null }) => {
      setAuthenticated(Boolean(payload.user));
      setUserRole(payload.user?.role === "admin" ? "admin" : payload.user ? "student" : null);
      if (payload.user) updateProfileFromUser(payload.user);
    });
  }, []);

  useEffect(() => {
    fetch("/api/content").then((response) => response.json()).then((payload: { books?: { id: string; title: string; author: string; subject: string; level: string; price: number; coverColor: string; imageUrl: string | null }[]; videos?: { id: string; title: string; subject: string; level: string; duration: string; thumbnail: string | null; videoUrl: string }[]; exams?: { id: string; title: string; startsAt: string; durationMins: number; subject: { name: string }; questions: ExamQuestion[] }[] }) => {
      setContentBooks((payload.books ?? []).map((book) => ({ ...book, price: `LKR ${book.price.toLocaleString("en-LK")}`, color: book.coverColor, imageUrl: book.imageUrl ?? "" })));
      setContentVideos((payload.videos ?? []).map((video) => ({ ...video, color: "#d6e8e1", image: video.thumbnail ?? "" })));
      setContentExams((payload.exams ?? []).map((exam) => { const start = new Date(exam.startsAt); return { id: exam.id, title: exam.title, subject: exam.subject.name, date: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), time: start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), duration: `${exam.durationMins} min`, tone: "mint", questions: exam.questions, fileName: "database exam" }; }));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!examOpen || seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [examOpen, seconds]);

  useEffect(() => {
    const handleProfileTrigger = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      if (button && (button.textContent?.includes("View profile") || button.textContent?.trim() === "NS")) setProfileOpen(true);
    };
    document.addEventListener("click", handleProfileTrigger);
    return () => document.removeEventListener("click", handleProfileTrigger);
  }, []);

  useEffect(() => {
    const handleVideoTrigger = (event: MouseEvent) => {
      const card = (event.target as HTMLElement).closest(".video-card");
      if (!card) return;
      const title = card.querySelector("h3")?.textContent;
      const video = recommendedVideos.find((item) => item.title === title);
      if (video) setSelectedVideo(video);
    };
    document.addEventListener("click", handleVideoTrigger);
    return () => document.removeEventListener("click", handleVideoTrigger);
  }, []);

  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    const languageIndex = language === "English" ? 0 : language === "සිංහල" ? 1 : 2;
    const replacements = new Map<string, string>();
    pageTranslationRows.forEach((row) => row.forEach((value, index) => { replacements.set(value, row[languageIndex]); if (index === 0) replacements.set(value.toUpperCase(), row[languageIndex]); }));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) { textNodes.push(node as Text); node = walker.nextNode(); }
    textNodes.forEach((textNode) => {
      const trimmed = textNode.nodeValue?.trim();
      if (!trimmed || !replacements.has(trimmed)) return;
      const translated = replacements.get(trimmed);
      if (translated) textNode.nodeValue = textNode.nodeValue?.replace(trimmed, translated) ?? translated;
    });
  }, [language, activeNav, authenticated, authView, notificationsOpen, assistantOpen]);

  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const availableSubjects = streamSubjects[stream] ?? [];
  const toggleSubject = (subject: string) => {
    setSubjects((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]);
    setSubjectError(false);
  };
  const askAssistant = (topic: keyof typeof assistantReplies, label: string) => {
    setAssistantMessages((messages) => [...messages, { from: "user", text: label }, { from: "assistant", text: assistantReplies[topic] }]);
  };
  const submitAssistantMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = assistantInput.trim();
    if (!message) return;
    const lowerMessage = message.toLowerCase();
    const topic = lowerMessage.includes("exam") ? "exams" : lowerMessage.includes("book") ? "books" : lowerMessage.includes("setting") || lowerMessage.includes("account") ? "account" : "learning";
    setAssistantMessages((messages) => [...messages, { from: "user", text: message }, { from: "assistant", text: assistantReplies[topic] }]);
    setAssistantInput("");
  };

  if (!authenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-story">
          <div className="brand auth-brand"><span className="brand-mark">e</span><span>edusmart<span className="brand-dot">.</span></span></div>
          <div className="story-copy"><p className="eyebrow">LEARNING, IN MOTION</p><h1>Your next breakthrough starts here.</h1><p>One focused space for Sri Lankan students to learn with purpose, practise with confidence, and see their progress clearly.</p><div className="story-note"><span>✦</span><div><strong>Built around your goals</strong><br />Personalised learning paths for every subject, stream, and stage.</div></div></div>
          <div className="story-footer">EduSmart Sri Lanka <span>·</span> English <span>·</span> Sinhala <span>·</span> Tamil</div>
        </section>
        <section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><p className="eyebrow">WELCOME BACK</p><h2>{authView === "login" ? "Sign in to your space" : "Create your student space"}</h2><p>{portal === "student" ? "Continue your learning journey." : "Manage learning and examinations securely."}</p></div><div className="portal-switch" role="tablist" aria-label="Choose portal"><button className={portal === "student" ? "selected" : ""} onClick={() => { setPortal("student"); setAuthView("login"); setAuthError(""); setAuthMessage(""); }} role="tab" aria-selected={portal === "student"}>Student portal</button><button className={portal === "admin" ? "selected" : ""} onClick={() => { setPortal("admin"); setAuthView("login"); setAuthError(""); setAuthMessage(""); }} role="tab" aria-selected={portal === "admin"}>Admin portal</button></div><form className="auth-form" onSubmit={handleAuthSubmit}>{authView === "signup" && <label>Full name<input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Nethmi Silva" required /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={portal === "admin" ? "admin@school.lk" : "you@example.com"} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" minLength={8} required /></label>{authView === "signup" && <label>Education level<select value={educationLevel} onChange={(event) => { setEducationLevel(event.target.value); setStream(""); setSubjects([]); setSubjectError(false); }} required><option value="" disabled>Select your level</option><option>Grade 6–11</option><option>GCE Ordinary Level (O/L)</option><option>GCE Advanced Level (A/L)</option></select></label>}{authView === "signup" && educationLevel === "GCE Advanced Level (A/L)" && <div className="academic-details"><label>Advanced Level stream<select value={stream} onChange={(event) => { setStream(event.target.value); setSubjects([]); setSubjectError(false); }} required><option value="" disabled>Select your stream</option>{Object.keys(streamSubjects).map((item) => <option key={item}>{item}</option>)}</select></label>{stream && <fieldset className={subjectError ? "subjects-error" : ""}><legend>Subjects</legend><div className="subject-options">{availableSubjects.map((subject) => <label key={subject}><input type="checkbox" checked={subjects.includes(subject)} onChange={() => toggleSubject(subject)} /> {subject}</label>)}</div>{subjectError && <p className="field-error">Select at least one subject.</p>}</fieldset>}</div>}{authError && <p className="field-error">{authError}</p>}{authMessage && <p className="admin-upload-status">{authMessage}</p>}{authView === "login" && <button type="button" className="forgot-link">Forgot password?</button>}<button className="auth-submit" type="submit" disabled={authLoading}>{authView === "login" ? (authLoading ? "Signing in..." : `Sign in as ${portal === "student" ? "student" : "admin"}`) : (authLoading ? "Creating account..." : "Create student account")}<span>→</span></button></form>{portal === "student" && <div className="auth-toggle">{authView === "login" ? "New to EduSmart?" : "Already have an account?"} <button onClick={() => { setAuthView(authView === "login" ? "signup" : "login"); setAuthError(""); setAuthMessage(""); }}>{authView === "login" ? "Create an account" : "Sign in"}</button></div>}{portal === "admin" && <p className="admin-hint">Admin accounts are provisioned by your institution. Use your authorised school credentials to continue.</p>}</div><p className="auth-legal">By continuing, you agree to EduSmart&apos;s terms and privacy policy.</p></section>
      </main>
    );
  }

  if (currentPortal === "admin") return <AdminDashboard onSignOut={handleSignOut} />;

  return (
    <main className="app-shell">
      {selectedVideo && <VideoPlayerModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">e</span><span>edusmart<span className="brand-dot">.</span></span></div>
        <div className="school-label">STUDENT SPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          { ["Overview", "My learning", "Examinations", "Progress", "Book shop"].map((item, index) => (
            <button key={item} className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => setActiveNav(item)}>
              <span className="nav-icon">{["⌂", "▣", "◷", "↗", "▤"][index]}</span>{[text.overview, text.learning, text.examinations, text.progress, text.shop][index]}
              {item === "Examinations" && <span className="nav-count">2</span>}
              {item === "Book shop" && basket.length > 0 && <span className="nav-count">{basket.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${activeNav === "Settings" ? "active" : ""}`} onClick={() => setActiveNav("Settings")}><span className="nav-icon">⚙</span>{text.settings}</button>
          <button className="language-switch" onClick={cycleLanguage} aria-label="Change language"><span>◉</span> {language} <span className="chevron">⌄</span></button>
          <button className="mini-profile" onClick={() => setProfileOpen(true)}><div className="avatar">{getInitials(profile.fullName)}</div><div><strong>{profile.fullName}</strong><span>{profile.stream !== "Not provided" ? profile.stream : profile.educationLevel}</span></div><span className="more">•••</span></button>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="mobile-brand">edusmart<span>.</span></div><div className="breadcrumb">Workspace <span>/</span> {activeNav === "Overview" ? text.overview : activeNav === "My learning" ? text.learning : activeNav === "Examinations" ? text.examinations : activeNav === "Progress" ? text.progress : activeNav === "Book shop" ? text.shop : text.settings}</div><div className="top-actions"><div className="notification-wrap"><button className="icon-button" aria-label={text.notifications} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧{unreadNotifications > 0 && <span className="notification-dot" />}</button>{notificationsOpen && <section className="notification-panel" role="dialog" aria-label={text.notifications}><div className="notification-head"><div><span className="eyebrow">YOUR UPDATES</span><h2>{text.notifications}</h2></div><button className="notification-close" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">×</button></div><div className="notification-list"><article className={unreadNotifications > 0 ? "notification-item unread" : "notification-item"}><span className="notification-symbol">◷</span><div><strong>Physics exam reminder</strong><p>Your Unit 04 examination is on 24 Sep at 02:00 PM.</p><small>Today</small></div></article><article className={unreadNotifications > 1 ? "notification-item unread" : "notification-item"}><span className="notification-symbol">✦</span><div><strong>New learning insight</strong><p>You are close to mastering Physics. Keep practising vectors.</p><small>Yesterday</small></div></article></div><button className="mark-read-button" onClick={() => setUnreadNotifications(0)}>{unreadNotifications > 0 ? "Mark all as read" : "All caught up"}</button></section>}</div><button className="top-avatar" onClick={() => setProfileOpen(true)} aria-label="Open profile">{getInitials(profile.fullName)}</button></div></header>
        <div className="page-content">
          {activeNav === "Overview" && <>
          <section className="welcome-row"><div><p className="eyebrow">THURSDAY, 10 SEPTEMBER 2026</p><h1>Good morning, {profile.fullName} <span>✦</span></h1><p className="subtitle">A little progress every day adds up to big results.</p></div><button className="outline-button" onClick={() => setProfileOpen(true)}>View profile <span>↗</span></button></section>

          <section className="stats-grid">
            <div className="stat-card accent"><div className="stat-label">LEARNING STREAK <span>↗</span></div><div className="stat-value">12 <small>days</small></div><div className="stat-foot"><span className="sparkline">╱╲╱╲╱╱╲</span> +3 from last week</div></div>
            <div className="stat-card"><div className="stat-label">AVG. PERFORMANCE <span>↗</span></div><div className="stat-value">78<small>%</small></div><div className="stat-foot"><span className="up">↑ 6.4%</span> from last month</div></div>
            <div className="stat-card"><div className="stat-label">HOURS LEARNED <span>↗</span></div><div className="stat-value">24<small>h</small> <em>18m</em></div><div className="stat-foot">Goal: 30h this month</div></div>
          </section>

          <section className="section-heading"><div><p className="eyebrow">CURATED FOR YOUR PROFILE</p><h2>Keep learning</h2></div><button className="text-button">See all recommendations <span>→</span></button></section>
          <section className="video-grid">{contentVideos.map((video) => <article className="video-card" key={video.id}><div className="video-art" style={{ backgroundImage: `url(${video.image})`, backgroundColor: video.color }}><span className="video-duration">{video.duration}</span><button className="play-button" aria-label={`Play ${video.title}`}>▶</button></div><div className="video-copy"><div className="video-meta"><span>{video.subject}</span><span>{video.level}</span></div><h3>{video.title}</h3><button className="watch-button">Start watching <span>↗</span></button></div></article>)}</section>

          <div className="lower-grid"><section><div className="section-heading compact"><div><p className="eyebrow">STAY ON TRACK</p><h2>Upcoming examinations</h2></div><button className="text-button">View calendar <span>→</span></button></div><div className="exam-list">{exams.map((exam) => <article className={`exam-row ${exam.tone}`} key={exam.title}><div className="date-block"><strong>{exam.date.split(" ")[0]}</strong><span>{exam.date.split(" ")[1]}</span></div><div className="exam-info"><span className="subject-tag">{exam.subject}</span><h3>{exam.title}</h3><p>{exam.time} <span>·</span> {exam.duration}</p></div><button className="arrow-button" onClick={() => setExamOpen(true)} aria-label={`Open ${exam.title}`}>↗</button></article>)}</div></section><section className="progress-panel"><div className="section-heading compact"><div><p className="eyebrow">YOUR PROGRESS</p><h2>Subject strengths</h2></div><button className="more-button">•••</button></div><div className="progress-bars"><div className="progress-item"><div><span>Biology</span><strong>84%</strong></div><div className="bar"><i style={{ width: "84%", background: "#2a8c73" }} /></div></div><div className="progress-item"><div><span>Chemistry</span><strong>76%</strong></div><div className="bar"><i style={{ width: "76%", background: "#dfa53e" }} /></div></div><div className="progress-item"><div><span>Physics</span><strong>68%</strong></div><div className="bar"><i style={{ width: "68%", background: "#9b6eaa" }} /></div></div></div><div className="insight"><span>✦</span><p><strong>AI insight</strong><br />You&apos;re close to mastering Physics. Focus on <u>vectors</u> next.</p></div></section></div>
          </>}

          {activeNav === "My learning" && <section className="nav-page"><div className="section-heading"><div><p className="eyebrow">YOUR PERSONALISED LIBRARY</p><h1>My learning</h1><p className="subtitle">Pick up where you left off and keep your momentum going.</p></div></div><div className="learning-summary"><div><span className="eyebrow">CURRENT FOCUS</span><h2>Physics · Vectors</h2><p>68% complete · 3 lessons remaining</p></div><button className="primary-button">Continue learning <span>→</span></button></div><div className="video-grid">{contentVideos.map((video) => <article className="video-card" key={video.id}><div className="video-art" style={{ backgroundImage: `url(${video.image})`, backgroundColor: video.color }}><span className="video-duration">{video.duration}</span><button className="play-button" aria-label={`Play ${video.title}`}>▶</button></div><div className="video-copy"><div className="video-meta"><span>{video.subject}</span><span>{video.level}</span></div><h3>{video.title}</h3><button className="watch-button">Start watching <span>↗</span></button></div></article>)}</div></section>}

          {activeNav === "Examinations" && <section className="nav-page"><div className="section-heading"><div><p className="eyebrow">ASSESSMENTS AND DEADLINES</p><h1>Examinations</h1><p className="subtitle">Stay prepared for every upcoming assessment.</p></div></div><div className="exam-list nav-exam-list">{exams.map((exam) => <article className={`exam-row ${exam.tone}`} key={exam.title}><div className="date-block"><strong>{exam.date.split(" ")[0]}</strong><span>{exam.date.split(" ")[1]}</span></div><div className="exam-info"><span className="subject-tag">{exam.subject}</span><h3>{exam.title}</h3><p>{exam.time} <span>·</span> {exam.duration}</p></div><button className="primary-button" onClick={() => setExamOpen(true)}>Open exam <span>→</span></button></article>)}</div></section>}

          {activeNav === "Progress" && <section className="nav-page"><div className="section-heading"><div><p className="eyebrow">YOUR LEARNING JOURNEY</p><h1>Progress</h1><p className="subtitle">See where your effort is turning into results.</p></div></div><div className="stats-grid"><div className="stat-card accent"><div className="stat-label">AVG. PERFORMANCE <span>↗</span></div><div className="stat-value">78<small>%</small></div><div className="stat-foot"><span className="up">↑ 6.4%</span> from last month</div></div><div className="stat-card"><div className="stat-label">LEARNING STREAK <span>↗</span></div><div className="stat-value">12 <small>days</small></div><div className="stat-foot">+3 from last week</div></div><div className="stat-card"><div className="stat-label">HOURS LEARNED <span>↗</span></div><div className="stat-value">24<small>h</small> <em>18m</em></div><div className="stat-foot">Goal: 30h this month</div></div></div><section className="progress-panel progress-page-panel"><div className="section-heading compact"><div><p className="eyebrow">SUBJECT BREAKDOWN</p><h2>Subject strengths</h2></div></div><div className="progress-bars"><div className="progress-item"><div><span>Biology</span><strong>84%</strong></div><div className="bar"><i style={{ width: "84%", background: "#2a8c73" }} /></div></div><div className="progress-item"><div><span>Chemistry</span><strong>76%</strong></div><div className="bar"><i style={{ width: "76%", background: "#dfa53e" }} /></div></div><div className="progress-item"><div><span>Physics</span><strong>68%</strong></div><div className="bar"><i style={{ width: "68%", background: "#9b6eaa" }} /></div></div></div><div className="insight"><span>✦</span><p><strong>AI insight</strong><br />You&apos;re close to mastering Physics. Focus on <u>vectors</u> next.</p></div></section></section>}

          {activeNav === "Book shop" && <section className="nav-page shop-page"><div className="section-heading"><div><p className="eyebrow">STUDY MATERIALS FOR YOUR JOURNEY</p><h1>Book shop</h1><p className="subtitle">Get trusted revision guides and practice papers delivered to you.</p></div><button className="basket-button" onClick={() => setBasket([])} aria-label="Clear basket">Basket <span>{basket.length}</span></button></div><div className="book-grid">{contentBooks.map((book) => { const inBasket = basket.includes(book.title); return <article className={`book-card ${book.color}`} key={book.id}><div className="book-cover" style={book.imageUrl ? { backgroundImage: `url(${book.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}><span>{book.level}</span><strong>{book.subject}</strong><i>EduSmart<br />Study Series</i></div><div className="book-copy"><div className="book-meta"><span>{book.subject}</span><span>{book.level}</span></div><h2>{book.title}</h2><p>by {book.author}</p><div className="book-purchase"><strong>{book.price}</strong><button className={inBasket ? "added-button" : "primary-button"} onClick={() => setBasket((current) => inBasket ? current.filter((title) => title !== book.title) : [...current, book.title])}>{inBasket ? "Added ✓" : "Add to basket"}</button></div></div></article>; })}</div>{basket.length > 0 && <div className="basket-bar"><div><strong>{basket.length} {basket.length === 1 ? "book" : "books"} in your basket</strong><span>Ready for checkout</span></div><button className="primary-button" onClick={() => { setBasket([]); window.alert("Your order has been placed successfully."); }}>Checkout <span>→</span></button></div>}</section>}

          {activeNav === "Settings" && <section className="nav-page settings-page"><div className="section-heading"><div><p className="eyebrow">PERSONALISE YOUR SPACE</p><h1>Settings</h1><p className="subtitle">Manage your learning preferences and account experience.</p></div></div><div className="settings-grid"><section className="settings-card"><div className="settings-card-heading"><div><p className="eyebrow">ACCOUNT</p><h2>Profile details</h2></div><span className="settings-avatar">NS</span></div><label>Full name<input defaultValue="Nethmi Silva" /></label><label>Email address<input defaultValue="nethmi.silva@example.com" type="email" /></label><div className="profile-two-col"><label>District<select defaultValue="Colombo"><option>Colombo</option><option>Kandy</option><option>Galle</option><option>Jaffna</option></select></label><label>Language<select value={language} onChange={(event) => { setLanguage(event.target.value); setSettingsSaved(false); }}><option>English</option><option>සිංහල</option><option>தமிழ்</option></select></label></div></section><section className="settings-card"><div className="settings-card-heading"><div><p className="eyebrow">PREFERENCES</p><h2>Learning experience</h2></div></div><label className="setting-toggle"><span><strong>Study reminders</strong><small>Receive notifications about upcoming exams and goals.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => { setNotificationsEnabled(event.target.checked); setSettingsSaved(false); }} /></label><label className="setting-toggle"><span><strong>Compact layout</strong><small>Fit more learning information on your dashboard.</small></span><input type="checkbox" checked={compactLayout} onChange={(event) => { setCompactLayout(event.target.checked); setSettingsSaved(false); }} /></label><div className="settings-actions"><span>{settingsSaved ? "Settings saved" : "Changes are saved for this session"}</span><button className="primary-button" onClick={() => setSettingsSaved(true)}>Save settings <span>✓</span></button></div></section></div></section>}
        </div>
      </section>

      {examOpen && activeExam && questions[question] && <div className="modal-backdrop"><section className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="exam-title"><div className="exam-modal-top"><div><span className="subject-tag">{activeExam.subject}</span><h2 id="exam-title">{activeExam.title}</h2></div><button className="close-button" onClick={() => setExamOpen(false)} aria-label="Close examination">×</button></div><div className="timer-strip"><span>TIME REMAINING</span><strong>{formattedTime}</strong><span>QUESTION {question + 1} OF {questions.length}</span></div><div className="question-body"><div className="question-number">{String(question + 1).padStart(2, "0")}</div><div className="question-content"><h3>{questions[question].prompt}</h3>{questions[question].options.map((option, optionIndex) => { const key = String.fromCharCode(65 + optionIndex); return <label key={key}><input type="radio" name={`answer-${questions[question].id}`} checked={answers[questions[question].id] === key} onChange={() => setAnswers((current) => ({ ...current, [questions[question].id]: key }))} /> <span>{key}</span> {option}</label>; })}</div></div><div className="exam-modal-bottom"><span>{examError || "Answers save automatically"}</span><div><button className="secondary-button" onClick={() => setQuestion(Math.max(question - 1, 0))}>Previous</button>{question < questions.length - 1 ? <button className="primary-button" onClick={() => setQuestion(question + 1)}>Next question <span>→</span></button> : <button className="primary-button" onClick={() => void submitExam()}>Submit exam <span>✓</span></button>}</div></div></section></div>}
      {examResult && <div className="modal-backdrop"><section className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div className="exam-modal-top"><div><span className="subject-tag">EXAM RESULT</span><h2 id="result-title">{activeExam?.title}</h2></div><button className="close-button" onClick={() => setExamResult(null)} aria-label="Close result">×</button></div><div className="question-body"><div className="question-number">{Math.round(examResult.percentage)}%</div><div className="question-content"><h3>{examResult.passed ? "Congratulations, you passed." : "Keep practising and try again."}</h3><p>You scored {examResult.obtainedMarks} of {examResult.totalMarks} marks ({examResult.percentage}%).</p></div></div><div className="exam-modal-bottom"><span>Saved to your examination results.</span><button className="primary-button" onClick={() => setExamResult(null)}>Done</button></div></section></div>}
      {profileOpen && <ProfileModal profile={profile} onClose={() => setProfileOpen(false)} onSignOut={async () => { setProfileOpen(false); await handleSignOut(); }} />}
      {authenticated && <div className="assistant-widget"><button className="assistant-launcher" onClick={() => setAssistantOpen((open) => !open)} aria-label={assistantOpen ? "Close EduSmart assistant" : "Open EduSmart assistant"}>{assistantOpen ? "×" : "✦"}<span className="assistant-pulse" /></button>{assistantOpen && <section className="assistant-panel" role="dialog" aria-label="EduSmart support assistant"><div className="assistant-head"><div><span className="assistant-avatar">✦</span><div><strong>EduSmart assistant</strong><small>Here to help</small></div></div><button onClick={() => setAssistantOpen(false)} aria-label="Close assistant">×</button></div><div className="assistant-messages">{assistantMessages.map((message, index) => <p className={`assistant-message ${message.from}`} key={`${message.from}-${index}`}>{message.text}</p>)}</div><div className="assistant-quick-actions"><button onClick={() => askAssistant("exams", "Show my exams")}>My exams</button><button onClick={() => askAssistant("learning", "Help with learning")}>Learning help</button><button onClick={() => askAssistant("books", "Where are the books?")}>Book shop</button></div><form className="assistant-form" onSubmit={submitAssistantMessage}><input value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="Ask for support..." aria-label="Ask the assistant" /><button type="submit" aria-label="Send message">↑</button></form></section>}</div>}
    </main>
  );
}
