"use client";

import { useEffect, useState, type FormEvent } from "react";

const recommendedVideos = [
  { title: "Mastering quadratic equations", subject: "Mathematics", level: "O/L • Intermediate", duration: "18 min", color: "#d6e8e1", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=900&q=80" },
  { title: "Electric circuits: the essentials", subject: "Physics", level: "A/L • Foundation", duration: "24 min", color: "#f4e1c1", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80" },
  { title: "Cell division explained visually", subject: "Biology", level: "A/L • Advanced", duration: "31 min", color: "#e4d8e8", image: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=900&q=80" },
];

const exams = [
  { subject: "Combined Mathematics", title: "Term 02 · Functions & Graphs", date: "18 Sep 2026", time: "09:00 AM", duration: "90 min", tone: "mint" },
  { subject: "Physics", title: "Unit 04 · Mechanics", date: "24 Sep 2026", time: "02:00 PM", duration: "60 min", tone: "gold" },
];

const questions = [
  "If f(x) = 2x + 3, what is the value of f(4)?",
  "Which statement best describes the gradient of a straight-line graph?",
  "A particle starts from rest and accelerates at 2 ms⁻². Find its speed after 5 seconds.",
];

const streamSubjects: Record<string, string[]> = {
  "Biological Science": ["Biology", "Chemistry", "Physics"],
  "Physical Science": ["Combined Mathematics", "Physics", "Chemistry"],
  "Commerce": ["Accounting", "Business Studies", "Economics"],
  "Technology": ["Engineering Technology", "Science for Technology", "Information & Communication Technology"],
};

const books = [
  { title: "GCE A/L Biology Complete Revision", author: "EduSmart Press", subject: "Biology", level: "A/L", price: "LKR 2,450", color: "mint" },
  { title: "Combined Mathematics Practice Papers", author: "S. Perera", subject: "Combined Mathematics", level: "A/L", price: "LKR 2,800", color: "gold" },
  { title: "Physics Concepts and Questions", author: "R. Fernando", subject: "Physics", level: "A/L", price: "LKR 2,250", color: "lilac" },
  { title: "O/L Science Master Guide", author: "EduSmart Press", subject: "Science", level: "O/L", price: "LKR 1,850", color: "blue" },
];

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

function ProfileModal({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  return <div className="modal-backdrop"><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="profile-modal-head"><div className="profile-hero"><div className="profile-large-avatar">NS</div><div><span className="eyebrow">STUDENT PROFILE</span><h2 id="profile-title">Nethmi Silva</h2><p>Grade 13 · Biological Science</p></div></div><button className="close-button" onClick={onClose} aria-label="Close profile">×</button></div><div className="profile-form"><label>Full name<input defaultValue="Nethmi Silva" /></label><label>Email address<input defaultValue="nethmi.silva@example.com" type="email" /></label><div className="profile-two-col"><label>District<select defaultValue="Colombo"><option>Colombo</option><option>Kandy</option><option>Galle</option><option>Jaffna</option></select></label><label>Province<select defaultValue="Western"><option>Western</option><option>Central</option><option>Southern</option><option>Northern</option></select></label></div><div className="profile-two-col"><label>Education level<select defaultValue="GCE Advanced Level (A/L)"><option>Grade 6–11</option><option>GCE Ordinary Level (O/L)</option><option>GCE Advanced Level (A/L)</option></select></label><label>Preferred language<select defaultValue="English"><option>English</option><option>සිංහල</option><option>தமிழ்</option></select></label></div></div><div className="profile-modal-foot"><button className="signout-button" onClick={onSignOut}>Sign out</button><div><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onClose}>Save changes <span>✓</span></button></div></div></section></div>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [portal, setPortal] = useState<"student" | "admin">("student");
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [activeNav, setActiveNav] = useState("Overview");
  const [examOpen, setExamOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [question, setQuestion] = useState(0);
  const [seconds, setSeconds] = useState(42 * 60 + 18);
  const [answer, setAnswer] = useState("");
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
  const [assistantMessages, setAssistantMessages] = useState<{ from: "assistant" | "user"; text: string }[]>([
    { from: "assistant", text: "Hi Nethmi. I can help with your exams, learning plan, books, or account settings." },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const text = translations[language as keyof typeof translations];
  const languageOptions = ["English", "සිංහල", "தமிழ்"];
  const cycleLanguage = () => setLanguage((current) => languageOptions[(languageOptions.indexOf(current) + 1) % languageOptions.length]);

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
        <section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><p className="eyebrow">WELCOME BACK</p><h2>{authView === "login" ? "Sign in to your space" : "Create your student space"}</h2><p>{portal === "student" ? "Continue your learning journey." : "Manage learning and examinations securely."}</p></div><div className="portal-switch" role="tablist" aria-label="Choose portal"><button className={portal === "student" ? "selected" : ""} onClick={() => { setPortal("student"); setAuthView("login"); }} role="tab" aria-selected={portal === "student"}>Student portal</button><button className={portal === "admin" ? "selected" : ""} onClick={() => { setPortal("admin"); setAuthView("login"); }} role="tab" aria-selected={portal === "admin"}>Admin portal</button></div><form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (authView === "signup" && educationLevel === "GCE Advanced Level (A/L)" && subjects.length === 0) { setSubjectError(true); return; } setAuthenticated(true); }}>{authView === "signup" && <label>Full name<input type="text" placeholder="e.g. Nethmi Silva" required /></label>}<label>Email address<input type="email" placeholder={portal === "admin" ? "admin@school.lk" : "you@example.com"} required /></label><label>Password<input type="password" placeholder="Enter your password" minLength={8} required /></label>{authView === "signup" && <label>Education level<select value={educationLevel} onChange={(event) => { setEducationLevel(event.target.value); setStream(""); setSubjects([]); setSubjectError(false); }} required><option value="" disabled>Select your level</option><option>Grade 6–11</option><option>GCE Ordinary Level (O/L)</option><option>GCE Advanced Level (A/L)</option></select></label>}{authView === "signup" && educationLevel === "GCE Advanced Level (A/L)" && <div className="academic-details"><label>Advanced Level stream<select value={stream} onChange={(event) => { setStream(event.target.value); setSubjects([]); setSubjectError(false); }} required><option value="" disabled>Select your stream</option>{Object.keys(streamSubjects).map((item) => <option key={item}>{item}</option>)}</select></label>{stream && <fieldset className={subjectError ? "subjects-error" : ""}><legend>Subjects</legend><div className="subject-options">{availableSubjects.map((subject) => <label key={subject}><input type="checkbox" checked={subjects.includes(subject)} onChange={() => toggleSubject(subject)} />{subject}</label>)}</div>{subjectError && <p className="field-error">Select at least one subject.</p>}</fieldset>}</div>}{authView === "login" && <button type="button" className="forgot-link">Forgot password?</button>}<button className="auth-submit" type="submit">{authView === "login" ? `Sign in as ${portal === "student" ? "student" : "admin"}` : "Create student account"}<span>→</span></button></form>{portal === "student" && <div className="auth-toggle">{authView === "login" ? "New to EduSmart?" : "Already have an account?"} <button onClick={() => setAuthView(authView === "login" ? "signup" : "login")}>{authView === "login" ? "Create an account" : "Sign in"}</button></div>}{portal === "admin" && <p className="admin-hint">Admin accounts are provisioned by your institution. Use your authorised school credentials to continue.</p>}</div><p className="auth-legal">By continuing, you agree to EduSmart&apos;s terms and privacy policy.</p></section>
      </main>
    );
  }

  return (
    <main className="app-shell">
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
          <button className="mini-profile" onClick={() => setProfileOpen(true)}><div className="avatar">NS</div><div><strong>Nethmi Silva</strong><span>Grade 13 · Biology</span></div><span className="more">•••</span></button>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="mobile-brand">edusmart<span>.</span></div><div className="breadcrumb">Workspace <span>/</span> {activeNav === "Overview" ? text.overview : activeNav === "My learning" ? text.learning : activeNav === "Examinations" ? text.examinations : activeNav === "Progress" ? text.progress : activeNav === "Book shop" ? text.shop : text.settings}</div><div className="top-actions"><div className="notification-wrap"><button className="icon-button" aria-label={text.notifications} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧{unreadNotifications > 0 && <span className="notification-dot" />}</button>{notificationsOpen && <section className="notification-panel" role="dialog" aria-label={text.notifications}><div className="notification-head"><div><span className="eyebrow">YOUR UPDATES</span><h2>{text.notifications}</h2></div><button className="notification-close" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">×</button></div><div className="notification-list"><article className={unreadNotifications > 0 ? "notification-item unread" : "notification-item"}><span className="notification-symbol">◷</span><div><strong>Physics exam reminder</strong><p>Your Unit 04 examination is on 24 Sep at 02:00 PM.</p><small>Today</small></div></article><article className={unreadNotifications > 1 ? "notification-item unread" : "notification-item"}><span className="notification-symbol">✦</span><div><strong>New learning insight</strong><p>You are close to mastering Physics. Keep practising vectors.</p><small>Yesterday</small></div></article></div><button className="mark-read-button" onClick={() => setUnreadNotifications(0)}>{unreadNotifications > 0 ? "Mark all as read" : "All caught up"}</button></section>}</div><button className="top-avatar" onClick={() => setProfileOpen(true)} aria-label="Open profile">NS</button></div></header>
        <div className="page-content">
          {activeNav === "Overview" && <>
          <section className="welcome-row"><div><p className="eyebrow">THURSDAY, 10 SEPTEMBER 2026</p><h1>Good morning, Nethmi <span>✦</span></h1><p className="subtitle">A little progress every day adds up to big results.</p></div><button className="outline-button" onClick={() => setProfileOpen(true)}>View profile <span>↗</span></button></section>

          <section className="stats-grid">
            <div className="stat-card accent"><div className="stat-label">LEARNING STREAK <span>↗</span></div><div className="stat-value">12 <small>days</small></div><div className="stat-foot"><span className="sparkline">╱╲╱╲╱╱╲</span> +3 from last week</div></div>
            <div className="stat-card"><div className="stat-label">AVG. PERFORMANCE <span>↗</span></div><div className="stat-value">78<small>%</small></div><div className="stat-foot"><span className="up">↑ 6.4%</span> from last month</div></div>
            <div className="stat-card"><div className="stat-label">HOURS LEARNED <span>↗</span></div><div className="stat-value">24<small>h</small> <em>18m</em></div><div className="stat-foot">Goal: 30h this month</div></div>
          </section>

          <section className="section-heading"><div><p className="eyebrow">CURATED FOR YOUR PROFILE</p><h2>Keep learning</h2></div><button className="text-button">See all recommendations <span>→</span></button></section>
          <section className="video-grid">{recommendedVideos.map((video) => <article className="video-card" key={video.title}><div className="video-art" style={{ backgroundImage: `url(${video.image})`, backgroundColor: video.color }}><span className="video-duration">{video.duration}</span><button className="play-button" aria-label={`Play ${video.title}`}>▶</button></div><div className="video-copy"><div className="video-meta"><span>{video.subject}</span><span>{video.level}</span></div><h3>{video.title}</h3><button className="watch-button">Start watching <span>↗</span></button></div></article>)}</section>

          <div className="lower-grid"><section><div className="section-heading compact"><div><p className="eyebrow">STAY ON TRACK</p><h2>Upcoming examinations</h2></div><button className="text-button">View calendar <span>→</span></button></div><div className="exam-list">{exams.map((exam) => <article className={`exam-row ${exam.tone}`} key={exam.title}><div className="date-block"><strong>{exam.date.split(" ")[0]}</strong><span>{exam.date.split(" ")[1]}</span></div><div className="exam-info"><span className="subject-tag">{exam.subject}</span><h3>{exam.title}</h3><p>{exam.time} <span>·</span> {exam.duration}</p></div><button className="arrow-button" onClick={() => setExamOpen(true)} aria-label={`Open ${exam.title}`}>↗</button></article>)}</div></section><section className="progress-panel"><div className="section-heading compact"><div><p className="eyebrow">YOUR PROGRESS</p><h2>Subject strengths</h2></div><button className="more-button">•••</button></div><div className="progress-bars"><div className="progress-item"><div><span>Biology</span><strong>84%</strong></div><div className="bar"><i style={{ width: "84%", background: "#2a8c73" }} /></div></div><div className="progress-item"><div><span>Chemistry</span><strong>76%</strong></div><div className="bar"><i style={{ width: "76%", background: "#dfa53e" }} /></div></div><div className="progress-item"><div><span>Physics</span><strong>68%</strong></div><div className="bar"><i style={{ width: "68%", background: "#9b6eaa" }} /></div></div></div><div className="insight"><span>✦</span><p><strong>AI insight</strong><br />You&apos;re close to mastering Physics. Focus on <u>vectors</u> next.</p></div></section></div>
          </>}

          {activeNav === "My learning" && <section className="nav-page"><div className="section-heading"><div><p className="eyebrow">YOUR PERSONALISED LIBRARY</p><h1>My learning</h1><p className="subtitle">Pick up where you left off and keep your momentum going.</p></div></div><div className="learning-summary"><div><span className="eyebrow">CURRENT FOCUS</span><h2>Physics · Vectors</h2><p>68% complete · 3 lessons remaining</p></div><button className="primary-button">Continue learning <span>→</span></button></div><div className="video-grid">{recommendedVideos.map((video) => <article className="video-card" key={video.title}><div className="video-art" style={{ backgroundImage: `url(${video.image})`, backgroundColor: video.color }}><span className="video-duration">{video.duration}</span><button className="play-button" aria-label={`Play ${video.title}`}>▶</button></div><div className="video-copy"><div className="video-meta"><span>{video.subject}</span><span>{video.level}</span></div><h3>{video.title}</h3><button className="watch-button">Start watching <span>↗</span></button></div></article>)}</div></section>}

          {activeNav === "Examinations" && <section className="nav-page"><div className="section-heading"><div><p className="eyebrow">ASSESSMENTS AND DEADLINES</p><h1>Examinations</h1><p className="subtitle">Stay prepared for every upcoming assessment.</p></div></div><div className="exam-list nav-exam-list">{exams.map((exam) => <article className={`exam-row ${exam.tone}`} key={exam.title}><div className="date-block"><strong>{exam.date.split(" ")[0]}</strong><span>{exam.date.split(" ")[1]}</span></div><div className="exam-info"><span className="subject-tag">{exam.subject}</span><h3>{exam.title}</h3><p>{exam.time} <span>·</span> {exam.duration}</p></div><button className="primary-button" onClick={() => setExamOpen(true)}>Open exam <span>→</span></button></article>)}</div></section>}

          {activeNav === "Progress" && <section className="nav-page"><div className="section-heading"><div><p className="eyebrow">YOUR LEARNING JOURNEY</p><h1>Progress</h1><p className="subtitle">See where your effort is turning into results.</p></div></div><div className="stats-grid"><div className="stat-card accent"><div className="stat-label">AVG. PERFORMANCE <span>↗</span></div><div className="stat-value">78<small>%</small></div><div className="stat-foot"><span className="up">↑ 6.4%</span> from last month</div></div><div className="stat-card"><div className="stat-label">LEARNING STREAK <span>↗</span></div><div className="stat-value">12 <small>days</small></div><div className="stat-foot">+3 from last week</div></div><div className="stat-card"><div className="stat-label">HOURS LEARNED <span>↗</span></div><div className="stat-value">24<small>h</small> <em>18m</em></div><div className="stat-foot">Goal: 30h this month</div></div></div><section className="progress-panel progress-page-panel"><div className="section-heading compact"><div><p className="eyebrow">SUBJECT BREAKDOWN</p><h2>Subject strengths</h2></div></div><div className="progress-bars"><div className="progress-item"><div><span>Biology</span><strong>84%</strong></div><div className="bar"><i style={{ width: "84%", background: "#2a8c73" }} /></div></div><div className="progress-item"><div><span>Chemistry</span><strong>76%</strong></div><div className="bar"><i style={{ width: "76%", background: "#dfa53e" }} /></div></div><div className="progress-item"><div><span>Physics</span><strong>68%</strong></div><div className="bar"><i style={{ width: "68%", background: "#9b6eaa" }} /></div></div></div><div className="insight"><span>✦</span><p><strong>AI insight</strong><br />You&apos;re close to mastering Physics. Focus on <u>vectors</u> next.</p></div></section></section>}

          {activeNav === "Book shop" && <section className="nav-page shop-page"><div className="section-heading"><div><p className="eyebrow">STUDY MATERIALS FOR YOUR JOURNEY</p><h1>Book shop</h1><p className="subtitle">Get trusted revision guides and practice papers delivered to you.</p></div><button className="basket-button" onClick={() => setBasket([])} aria-label="Clear basket">Basket <span>{basket.length}</span></button></div><div className="book-grid">{books.map((book) => { const inBasket = basket.includes(book.title); return <article className={`book-card ${book.color}`} key={book.title}><div className="book-cover"><span>{book.level}</span><strong>{book.subject}</strong><i>EduSmart<br />Study Series</i></div><div className="book-copy"><div className="book-meta"><span>{book.subject}</span><span>{book.level}</span></div><h2>{book.title}</h2><p>by {book.author}</p><div className="book-purchase"><strong>{book.price}</strong><button className={inBasket ? "added-button" : "primary-button"} onClick={() => setBasket((current) => inBasket ? current.filter((title) => title !== book.title) : [...current, book.title])}>{inBasket ? "Added ✓" : "Add to basket"}</button></div></div></article>; })}</div>{basket.length > 0 && <div className="basket-bar"><div><strong>{basket.length} {basket.length === 1 ? "book" : "books"} in your basket</strong><span>Ready for checkout</span></div><button className="primary-button" onClick={() => { setBasket([]); window.alert("Your order has been placed successfully."); }}>Checkout <span>→</span></button></div>}</section>}

          {activeNav === "Settings" && <section className="nav-page settings-page"><div className="section-heading"><div><p className="eyebrow">PERSONALISE YOUR SPACE</p><h1>Settings</h1><p className="subtitle">Manage your learning preferences and account experience.</p></div></div><div className="settings-grid"><section className="settings-card"><div className="settings-card-heading"><div><p className="eyebrow">ACCOUNT</p><h2>Profile details</h2></div><span className="settings-avatar">NS</span></div><label>Full name<input defaultValue="Nethmi Silva" /></label><label>Email address<input defaultValue="nethmi.silva@example.com" type="email" /></label><div className="profile-two-col"><label>District<select defaultValue="Colombo"><option>Colombo</option><option>Kandy</option><option>Galle</option><option>Jaffna</option></select></label><label>Language<select value={language} onChange={(event) => { setLanguage(event.target.value); setSettingsSaved(false); }}><option>English</option><option>සිංහල</option><option>தமிழ்</option></select></label></div></section><section className="settings-card"><div className="settings-card-heading"><div><p className="eyebrow">PREFERENCES</p><h2>Learning experience</h2></div></div><label className="setting-toggle"><span><strong>Study reminders</strong><small>Receive notifications about upcoming exams and goals.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => { setNotificationsEnabled(event.target.checked); setSettingsSaved(false); }} /></label><label className="setting-toggle"><span><strong>Compact layout</strong><small>Fit more learning information on your dashboard.</small></span><input type="checkbox" checked={compactLayout} onChange={(event) => { setCompactLayout(event.target.checked); setSettingsSaved(false); }} /></label><div className="settings-actions"><span>{settingsSaved ? "Settings saved" : "Changes are saved for this session"}</span><button className="primary-button" onClick={() => setSettingsSaved(true)}>Save settings <span>✓</span></button></div></section></div></section>}
        </div>
      </section>

      {examOpen && <div className="modal-backdrop"><section className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="exam-title"><div className="exam-modal-top"><div><span className="subject-tag">COMBINED MATHEMATICS · TERM 02</span><h2 id="exam-title">Functions &amp; Graphs</h2></div><button className="close-button" onClick={() => setExamOpen(false)} aria-label="Close examination">×</button></div><div className="timer-strip"><span>TIME REMAINING</span><strong>{formattedTime}</strong><span>QUESTION {question + 1} OF {questions.length}</span></div><div className="question-body"><div className="question-number">0{question + 1}</div><div className="question-content"><h3>{questions[question]}</h3><label><input type="radio" name="answer" checked={answer === "A"} onChange={() => setAnswer("A")} /> <span>A</span> 11</label><label><input type="radio" name="answer" checked={answer === "B"} onChange={() => setAnswer("B")} /> <span>B</span> 8</label><label><input type="radio" name="answer" checked={answer === "C"} onChange={() => setAnswer("C")} /> <span>C</span> 5</label><label><input type="radio" name="answer" checked={answer === "D"} onChange={() => setAnswer("D")} /> <span>D</span> 6</label></div></div><div className="exam-modal-bottom"><span>Answers save automatically</span><div><button className="secondary-button" onClick={() => setQuestion(Math.max(question - 1, 0))}>Previous</button>{question < questions.length - 1 ? <button className="primary-button" onClick={() => { setQuestion(question + 1); setAnswer(""); }}>Next question <span>→</span></button> : <button className="primary-button" onClick={() => setExamOpen(false)}>Submit exam <span>✓</span></button>}</div></div></section></div>}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onSignOut={() => { setProfileOpen(false); setAuthenticated(false); }} />}
      {authenticated && <div className="assistant-widget"><button className="assistant-launcher" onClick={() => setAssistantOpen((open) => !open)} aria-label={assistantOpen ? "Close EduSmart assistant" : "Open EduSmart assistant"}>{assistantOpen ? "×" : "✦"}<span className="assistant-pulse" /></button>{assistantOpen && <section className="assistant-panel" role="dialog" aria-label="EduSmart support assistant"><div className="assistant-head"><div><span className="assistant-avatar">✦</span><div><strong>EduSmart assistant</strong><small>Here to help</small></div></div><button onClick={() => setAssistantOpen(false)} aria-label="Close assistant">×</button></div><div className="assistant-messages">{assistantMessages.map((message, index) => <p className={`assistant-message ${message.from}`} key={`${message.from}-${index}`}>{message.text}</p>)}</div><div className="assistant-quick-actions"><button onClick={() => askAssistant("exams", "Show my exams")}>My exams</button><button onClick={() => askAssistant("learning", "Help with learning")}>Learning help</button><button onClick={() => askAssistant("books", "Where are the books?")}>Book shop</button></div><form className="assistant-form" onSubmit={submitAssistantMessage}><input value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="Ask for support..." aria-label="Ask the assistant" /><button type="submit" aria-label="Send message">↑</button></form></section>}</div>}
    </main>
  );
}
