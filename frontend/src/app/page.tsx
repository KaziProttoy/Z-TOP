"use client";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Moon,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

import { api, apiFile } from '@/lib/api';
import type { Analytics, Asset, Citation, Course, Data, Doc, Message, OriginalFile, QuizResult, ReaderMaterial, StudentProfile, Task, User, View } from '@/lib/types';

const nav: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Courses", icon: BookOpen },
  { label: "Z-Chat", icon: MessageSquareText },
  { label: "Z-Study", icon: Sparkles },
  { label: "Planner", icon: CalendarDays },
  { label: "Progress", icon: BarChart3 },
];
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
const displayAssistantText = (text: string) =>
  text.replace(/^\s*\*{0,2}Answer:\*{0,2}\s*/i, "");

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [ready, setReady] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("z-top-dark-mode") === "true",
  );
  const [view, setView] = useState<View>("Overview");
  const [courseId, setCourseId] = useState<number | "">("");
  const [courseDetailId, setCourseDetailId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [readerMaterial, setReaderMaterial] = useState<ReaderMaterial | null>(null);
  const [readerOriginalUrl, setReaderOriginalUrl] = useState<string | null>(null);
  const [readerOriginalType, setReaderOriginalType] = useState("");
  const [readerElapsedSeconds, setReaderElapsedSeconds] = useState(0);
  const [readerLoading, setReaderLoading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const docxPreviewRef = useRef<HTMLDivElement>(null);
  const [courseModal, setCourseModal] = useState(false);
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [taskModal, setTaskModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("1.5");
  const [question, setQuestion] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatCourseId, setChatCourseId] = useState<number | "">("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [studyMode, setStudyMode] = useState<"flashcards" | "quiz" | "summary">(
    "flashcards",
  );
  const [studyDocumentSelection, setStudyDocumentSelection] = useState<{
    courseId: number;
    documentIds: number[];
  } | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem("z-top-dark-mode", String(darkMode));
  }, [darkMode]);

  async function refresh(authToken = token) {
    const result = await api<Data>("/api/dashboard", authToken);
    setData(result);
    if (result.courses.length && !courseId) setCourseId(result.courses[0].id);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => {
        const saved = localStorage.getItem("z-top-token") || sessionStorage.getItem("z-top-token");
        if (!saved) return null;
        setToken(saved);
        return Promise.all([
          api<User>("/api/auth/me", saved),
          api<Data>("/api/dashboard", saved),
        ]);
      })
      .then((result) => {
        if (result) {
          const [profile, dashboard] = result;
          setUser(profile);
          setData(dashboard);
          if (dashboard.courses.length) setCourseId(dashboard.courses[0].id);
        }
      })
      .catch(() => {
        localStorage.removeItem("z-top-token");
        sessionStorage.removeItem("z-top-token");
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!readerMaterial) return;
    const interval = window.setInterval(() => {
      setReaderElapsedSeconds((elapsed) => elapsed + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [readerMaterial]);

  useEffect(() => {
    if (!readerOriginalUrl || !readerOriginalType.includes("wordprocessingml.document")) return;
    const container = docxPreviewRef.current;
    if (!container) return;
    let cancelled = false;
    const renderDocx = async () => {
      try {
        const response = await fetch(readerOriginalUrl);
        const { renderAsync } = await import("docx-preview");
        if (!cancelled) await renderAsync(await response.blob(), container);
      } catch {
        if (!cancelled) setError("Could not preview this Word document.");
      }
    };
    void renderDocx();
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [readerOriginalUrl, readerOriginalType]);

  useEffect(() => {
    if (!readerOriginalUrl) return;
    return () => URL.revokeObjectURL(readerOriginalUrl);
  }, [readerOriginalUrl]);

  useEffect(() => {
    if (!profilePhotoUrl) return;
    return () => URL.revokeObjectURL(profilePhotoUrl);
  }, [profilePhotoUrl]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const loadProfilePhoto = async () => {
      setProfilePhotoUrl(null);
      try {
        const profile = await api<StudentProfile>("/api/profile", token);
        if (cancelled || !profile.photoAvailable) return;
        const photo = await apiFile("/api/profile/photo", token);
        if (cancelled) URL.revokeObjectURL(photo.url);
        else setProfilePhotoUrl(photo.url);
      } catch {
        return;
      }
    };
    void loadProfilePhoto();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!profilePanelRef.current?.contains(event.target as Node))
        setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  const fail = (reason: unknown) =>
    setError(
      reason instanceof Error
        ? reason.message
        : "The request could not be completed.",
    );

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token: string; user: User }>(
        `/api/auth/${authMode === "register" ? "register" : "login"}`,
        "",
        {
          method: "POST",
          body: JSON.stringify(
            authMode === "register"
              ? { name, email, password }
              : { email, password },
          ),
        },
      );
      if (rememberMe) {
        localStorage.setItem("z-top-token", result.token);
        sessionStorage.removeItem("z-top-token");
      } else {
        sessionStorage.setItem("z-top-token", result.token);
        localStorage.removeItem("z-top-token");
      }
      setToken(result.token);
      setUser(result.user);
      await refresh(result.token);
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function addCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const course = await api<Course>("/api/courses", token, {
        method: "POST",
        body: JSON.stringify({ code: courseCode, title: courseTitle }),
      });
      setCourseId(course.id);
      setCourseDetailId(null);
      setCourseCode("");
      setCourseTitle("");
      setCourseModal(false);
      setNotice("Course added to your workspace.");
      await refresh();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/tasks", token, {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle,
          due_date: new Date(dueDate).toISOString(),
          course_id: courseId || null,
        }),
      });
      setTaskTitle("");
      setDueDate("");
      setTaskModal(false);
      setNotice("Deadline added to your planner.");
      await refresh();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function moveTask(task: Task, status: Task["status"]) {
    try {
      await api(`/api/tasks/${task.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (reason) {
      fail(reason);
    }
  }

  async function upload(file?: File) {
    if (!file || !courseId) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    setError("");
    try {
      await api(`/api/courses/${courseId}/documents`, token, {
        method: "POST",
        body: form,
      });
      setNotice(`${file.name} added to course materials.`);
      await refresh();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setQuestion("");
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || chatSending) return;
    const text = question.trim();
    setQuestion("");
    setChatSending(true);
    setError("");
    setMessages((items) => [...items, { role: "user", text }]);
    try {
      const result = await api<{
        answer: string;
        citations: Citation[];
      }>("/api/general-chats", token, {
        method: "POST",
        body: JSON.stringify({
          question: text,
          course_id: chatCourseId || null,
          history: messages.slice(-12).map((message) => ({ role: message.role, content: message.text })),
        }),
      });
      setMessages((items) => [
        ...items,
        { role: "assistant", text: result.answer, citations: result.citations },
      ]);
    } catch (reason) {
      setMessages((items) => [
        ...items,
        { role: "assistant", text: "Sorry, I couldn't finish that reply just now. Please try again in a moment." },
      ]);
      setError(reason instanceof Error ? reason.message : "Z-Chat is temporarily unavailable.");
    } finally {
      setChatSending(false);
    }
  }

  async function loadAnalytics() {
    try {
      setAnalytics(await api<Analytics>("/api/analytics", token));
    } catch (reason) {
      fail(reason);
    }
  }

  async function uploadSyllabus(file?: File) {
    if (!file || !courseId) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        deadlinesFound: number;
        tasksCreated: Task[];
      }>(`/api/courses/${courseId}/syllabus`, token, {
        method: "POST",
        body: form,
      });
      setNotice(
        `${result.tasksCreated.length} deadline${result.tasksCreated.length === 1 ? "" : "s"} added from ${file.name}.`,
      );
      await refresh();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function createStudyPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId) return;
    setBusy(true);
    try {
      const result = await api<{
        tasks: Task[];
        baselineQuizScore: number | null;
      }>("/api/plans", token, {
        method: "POST",
        body: JSON.stringify({
          course_id: courseId,
          exam_date: examDate,
          hours_per_day: Number(hoursPerDay),
        }),
      });
      setPlanModal(false);
      setExamDate("");
      setNotice(
        `Study plan created with ${result.tasks.length} sessions${result.baselineQuizScore === null ? "." : `, adjusted for your ${result.baselineQuizScore}% quiz average.`}`,
      );
      await refresh();
      setView("Planner");
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  function openView(nextView: View) {
    setView(nextView);
    if (nextView === "Courses") setCourseDetailId(null);
    if (nextView === "Progress") void loadAnalytics();
    if (nextView === "Z-Chat") startNewChat();
  }

  async function generate() {
    if (!courseId || !selectedStudyDocumentIds.length) return;
    setBusy(true);
    setError("");
    try {
      setAsset(
        await api<Asset>(
          `/api/courses/${courseId}/${studyMode === "quiz" ? "quizzes" : studyMode}`,
          token,
          {
            method: "POST",
            body: JSON.stringify({ document_ids: selectedStudyDocumentIds }),
          },
        ),
      );
      await refresh();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function logSession() {
    if (!courseId) return;
    try {
      await api("/api/study-sessions", token, {
        method: "POST",
        body: JSON.stringify({ minutes: 25, course_id: courseId }),
      });
      setNotice("25-minute study session logged.");
      await refresh();
    } catch (reason) {
      fail(reason);
    }
  }

  async function openDocument(doc: Doc) {
    if (!courseId || readerLoading) return;
    setReaderLoading(true);
    setError("");
    try {
      const material = await api<ReaderMaterial>(
        `/api/courses/${courseId}/documents/${doc.id}`,
        token,
      );
      let original: OriginalFile | null = null;
      try {
        original = await apiFile(
          `/api/courses/${courseId}/documents/${doc.id}/file`,
          token,
        );
      } catch {
        setNotice("This older upload has no saved original. Re-upload it to view the original file.");
      }
      setReaderMaterial(material);
      setReaderOriginalUrl(original?.url ?? null);
      setReaderOriginalType(original?.contentType ?? "");
      setReaderElapsedSeconds(0);
    } catch (reason) {
      fail(reason);
    } finally {
      setReaderLoading(false);
    }
  }

  async function deleteDocument(doc: Doc) {
    if (!courseId || deletingDocumentId !== null) return;
    if (!window.confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
    setDeletingDocumentId(doc.id);
    setError("");
    try {
      await api(`/api/courses/${courseId}/documents/${doc.id}`, token, {
        method: "DELETE",
      });
      await refresh();
      setNotice(`${doc.fileName} deleted.`);
    } catch (reason) {
      fail(reason);
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function closeReader() {
    if (!readerMaterial) return;
    const minutes = Math.round(readerElapsedSeconds / 60);
    setReaderMaterial(null);
    setReaderOriginalUrl(null);
    setReaderOriginalType("");
    setReaderElapsedSeconds(0);
    if (minutes < 1) {
      setNotice("Reader time under 30 seconds was not added to study time.");
      return;
    }
    try {
      await api("/api/study-sessions", token, {
        method: "POST",
        body: JSON.stringify({ minutes, course_id: courseId }),
      });
      await refresh();
      setNotice(`${minutes} minute${minutes === 1 ? "" : "s"} of study time logged.`);
    } catch (reason) {
      fail(reason);
    }
  }

  function signOut() {
    setProfileOpen(false);
    localStorage.removeItem("z-top-token");
    sessionStorage.removeItem("z-top-token");
    setToken("");
    setUser(null);
    setData(null);
    setStudentProfile(null);
    setProfilePhotoUrl(null);
    setMessages([]);
    setView("Overview");
  }

  async function openStudentProfile() {
    setProfileOpen(false);
    setProfileBusy(true);
    setError("");
    try {
      const profile = await api<StudentProfile>("/api/profile", token);
      let photoUrl: string | null = null;
      if (profile.photoAvailable) {
        try {
          photoUrl = (await apiFile("/api/profile/photo", token)).url;
        } catch {
          profile.photoAvailable = false;
        }
      }
      setStudentProfile(profile);
      setProfilePhotoUrl(photoUrl);
      setProfileEditing(false);
      setView("Profile");
    } catch (reason) {
      fail(reason);
    } finally {
      setProfileBusy(false);
    }
  }

  async function changeStudentPhoto(file?: File) {
    if (!file || profilePhotoSaving) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }
    setProfilePhotoSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api<{ photoAvailable: boolean }>("/api/profile/photo", token, {
        method: "POST",
        body: form,
      });
      const photo = await apiFile("/api/profile/photo", token);
      setProfilePhotoUrl(photo.url);
      setStudentProfile((current) => current ? { ...current, photoAvailable: true } : current);
      setNotice("Profile photo updated.");
    } catch (reason) {
      fail(reason);
    } finally {
      setProfilePhotoSaving(false);
    }
  }

  async function removeStudentPhoto() {
    if (!studentProfile?.photoAvailable || profilePhotoSaving) return;
    if (!window.confirm("Remove your profile photo?")) return;
    setProfilePhotoSaving(true);
    setError("");
    try {
      await api<{ photoAvailable: boolean }>("/api/profile/photo", token, {
        method: "DELETE",
      });
      setProfilePhotoUrl(null);
      setStudentProfile((current) => current ? { ...current, photoAvailable: false } : current);
      setNotice("Profile photo removed.");
    } catch (reason) {
      fail(reason);
    } finally {
      setProfilePhotoSaving(false);
    }
  }

  async function saveStudentProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentProfile) return;
    setProfileSaving(true);
    setError("");
    try {
      const updated = await api<StudentProfile>("/api/profile", token, {
        method: "PUT",
        body: JSON.stringify({
          name: studentProfile.name,
          father_name: studentProfile.fatherName,
          mother_name: studentProfile.motherName,
          phone: studentProfile.phone,
          location: studentProfile.location,
          education_level: studentProfile.educationLevel,
          school_name: studentProfile.schoolName,
          school_qualification: studentProfile.schoolQualification,
          school_start_year: studentProfile.schoolStartYear,
          school_passout_year: studentProfile.schoolPassoutYear,
          college_name: studentProfile.collegeName,
          college_program: studentProfile.collegeProgram,
          college_start_year: studentProfile.collegeStartYear,
          college_passout_year: studentProfile.collegePassoutYear,
          institution: studentProfile.institution,
          university_department: studentProfile.universityDepartment,
          field_of_study: studentProfile.fieldOfStudy,
          university_start_year: studentProfile.universityStartYear,
          current_year: studentProfile.currentYear,
          expected_graduation_year: studentProfile.expectedGraduationYear,
        }),
      });
      setStudentProfile(updated);
      setUser((current) => current ? { ...current, name: updated.name } : current);
      setNotice("Student profile saved.");
    } catch (reason) {
      fail(reason);
    } finally {
      setProfileSaving(false);
    }
  }

  if (!ready)
    return (
      <main className="boot-screen">
        <Image className="brand-logo brand-logo-loading" src="/z-top-logo-purple.png" alt="Z-TOP" width={120} height={48} priority />
        <LoaderCircle className="spin" size={18} />
      </main>
    );

  if (!user)
    return (
      <main className={`auth-page ${darkMode ? "dark-mode" : ""}`}>
        <header className="auth-nav">
          <a className="auth-logo" href="#home" aria-label="Z-Top home">
            <Image className="brand-logo brand-logo-auth" src="/z-top-logo-purple.png" alt="Z-TOP" width={120} height={48} priority />
          </a>
          <div className="auth-nav-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setDarkMode((enabled) => !enabled)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className="auth-help" onClick={() => setHelpOpen(true)}>Help</button>
            <button className="auth-signup" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setError(""); }}>
              {authMode === "register" ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </header>
        <div className="auth-layout">
          <section className="auth-panel">
            <div className="auth-form-wrap">
              <h1>{authMode === "register" ? "Create your account" : "Welcome back"}</h1>
              <p className="auth-intro">{authMode === "register" ? "Start building a calmer, more connected study routine." : "Log in to your Z-TOP academic co-pilot"}</p>
              <form onSubmit={signIn} className="auth-form">
                {authMode === "register" && (
                  <label className="auth-field">
                    <span>Full name</span>
                    <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" />
                  </label>
                )}
                <label className="auth-field">
                  <span>Email address</span>
                  <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gmail.com" />
                </label>
                <label className="auth-field">
                  <span>Password</span>
                  <span className="auth-password-wrap">
                    <input required type={showPassword ? "text" : "password"} minLength={authMode === "register" ? 8 : undefined} autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={authMode === "register" ? "At least 8 characters" : "Enter your password"} />
                    <button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>
                {authMode === "login" && (
                  <label className="remember-option">
                    <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                    <span>Remember me</span>
                  </label>
                )}
                {error && <p className="form-error">{error}</p>}
                <button className="button auth-submit" disabled={busy}>
                  {busy && <LoaderCircle className="spin" size={17} />}
                  {authMode === "register" ? "Create account" : "Log In"}
                  {!busy && <ArrowUpRight size={16} />}
                </button>
              </form>
              <p className="auth-foot">
                {authMode === "register" ? (
                  <>Already have an account? <button onClick={() => { setAuthMode("login"); setError(""); }}>Sign in</button></>
                ) : (
                  <>Don&apos;t have an account? <button onClick={() => { setAuthMode("register"); setError(""); }}>Sign up free</button></>
                )}
              </p>
            </div>
          </section>
          <aside className="auth-visual" aria-label="Study workspace">
            <div className="auth-visual-note">
              <span className="note-stars"><Sparkles size={17} /> A NOTE FOR TODAY</span>
              <p>Small, focused sessions make difficult ideas easier to return to.</p>
              <span className="note-caption">YOUR STUDY SPACE, IN ONE PLACE</span>
            </div>
          </aside>
        </div>
        {helpOpen && (
          <Modal title="Sign-in help" close={() => setHelpOpen(false)}>
            <div className="auth-help-copy">
              <p>Use the email address and password you registered with.</p>
              <p>New to Z-TOP? Choose <strong>Sign Up</strong> to create an account. Passwords must contain at least 8 characters.</p>
              <p>For this local version, account data is saved in the app&apos;s local database.</p>
            </div>
          </Modal>
        )}
      </main>
    );

  const courses = data?.courses ?? [];
  const tasks = data?.tasks ?? [];
  const course = courses.find((item) => item.id === courseId);
  const courseDetail = courses.find((item) => item.id === courseDetailId);
  const chatCourse = courses.find((item) => item.id === chatCourseId);
  const selectedStudyDocumentIds = course
    ? studyDocumentSelection && studyDocumentSelection.courseId === course.id
      ? studyDocumentSelection.documentIds.filter((id) => course.documents.some((doc) => doc.id === id))
      : course.documents.map((doc) => doc.id)
    : [];
  const educationHistory = studentProfile
    ? [
        {
          level: "University",
          institution: studentProfile.institution ?? "",
          primary: studentProfile.universityDepartment ?? "",
          secondary: studentProfile.fieldOfStudy ?? "",
          startYear: studentProfile.universityStartYear ?? null,
          passoutYear: studentProfile.expectedGraduationYear ?? null,
          yearLabel: "Expected pass-out",
        },
        {
          level: "College",
          institution: studentProfile.collegeName ?? "",
          primary: studentProfile.collegeProgram ?? "",
          secondary: "",
          startYear: studentProfile.collegeStartYear ?? null,
          passoutYear: studentProfile.collegePassoutYear ?? null,
          yearLabel: "Pass-out",
        },
        {
          level: "School",
          institution: studentProfile.schoolName ?? "",
          primary: studentProfile.schoolQualification ?? "",
          secondary: "",
          startYear: studentProfile.schoolStartYear ?? null,
          passoutYear: studentProfile.schoolPassoutYear ?? null,
          yearLabel: "Pass-out",
        },
      ].filter((entry) => entry.institution.trim())
    : [];
  const pending = tasks.filter((task) => task.status !== "COMPLETED");
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const firstName = user.name.trim().split(/\s+/)[0];
  const scoredCourses = analytics?.courses.filter((item) => item.averageScore !== null) ?? [];
  const averageScore = scoredCourses.length
    ? Math.round(scoredCourses.reduce((sum, item) => sum + (item.averageScore ?? 0), 0) / scoredCourses.length)
    : null;

  return (
    <div className={`app-shell ${view !== "Overview" ? "feature-mode" : ""} ${darkMode ? "dark-mode" : ""}`}>
      <aside className="sidebar">
        <a className="wordmark" href="#home">
          <Image className="brand-logo brand-logo-sidebar" src="/z-top-logo-purple.png" alt="Z-TOP" width={150} height={60} priority />
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${view === label ? "active" : ""}`}
              onClick={() => openView(label)}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Planner" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-tip">
            <Clock3 size={17} />
            <span>
              Need a reset?
              <br />
              <strong>Log a 25-minute session.</strong>
            </span>
            <button
              onClick={logSession}
              title="Log a study session"
              aria-label="Log study session"
            >
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="profile-row">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-name">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <button onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            {view !== "Overview" && (
              <button
                className="back-to-overview"
                type="button"
                onClick={() => openView("Overview")}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            Workspace <span>/</span> <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setDarkMode((enabled) => !enabled)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <span className="today-label">
              <Clock3 size={15} />
              {today}
            </span>
            <div className="profile-menu-anchor" ref={profilePanelRef}>
              <button
                className="avatar top-avatar profile-trigger"
                type="button"
                style={profilePhotoUrl ? { backgroundImage: `url("${profilePhotoUrl}")` } : undefined}
                aria-label="Open student profile"
                aria-expanded={profileOpen}
                aria-controls="student-profile-menu"
                onClick={() => setProfileOpen((open) => !open)}
              >
                {!profilePhotoUrl && user.name.slice(0, 1).toUpperCase()}
              </button>
              {profileOpen && (
                <section
                  className="profile-menu"
                  id="student-profile-menu"
                  aria-label="Student profile"
                >
                  <div className="profile-menu-heading">
                    <span
                      className="avatar profile-menu-avatar"
                      style={profilePhotoUrl ? { backgroundImage: `url("${profilePhotoUrl}")` } : undefined}
                    >
                      {!profilePhotoUrl && user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="profile-identity">
                      <p className="eyebrow">STUDENT PROFILE</p>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <dl className="profile-overview">
                    <div>
                      <dt>Courses</dt>
                      <dd>{data?.stats.courseCount ?? courses.length}</dd>
                    </div>
                    <div>
                      <dt>Study notes</dt>
                      <dd>{data?.stats.documents ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Open tasks</dt>
                      <dd>{data?.stats.openTasks ?? pending.length}</dd>
                    </div>
                    <div>
                      <dt>Study this week</dt>
                      <dd>{Math.floor((data?.stats.studyMinutes ?? 0) / 60)}h {(data?.stats.studyMinutes ?? 0) % 60}m</dd>
                    </div>
                  </dl>
                  <button
                    className="profile-menu-manage"
                    type="button"
                    onClick={() => void openStudentProfile()}
                    disabled={profileBusy}
                  >
                    {profileBusy ? <LoaderCircle className="spin" size={15} /> : <UserRound size={15} />}
                    Open full profile
                    <ArrowUpRight size={14} />
                  </button>
                  <button
                    className="profile-menu-signout"
                    type="button"
                    onClick={signOut}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </section>
              )}
            </div>
          </div>
        </header>
        <div className="content-wrap">
          {(error || notice) && (
            <div
              className={`toast ${error ? "toast-error" : "toast-success"}`}
              role="status"
            >
              <span>{error || notice}</span>
              <button
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {view === "Profile" && (
            <section className="page-section student-profile-page">
              {studentProfile && !profileEditing && (
                <div className="profile-dossier">
                  <div className="dossier-breadcrumb">
                    <span>Workspace</span>
                    <span aria-hidden="true">/</span>
                    <span>Student profile</span>
                    <strong>Personal dossier</strong>
                  </div>
                  <header className="dossier-hero">
                    <div className="dossier-identity">
                      <div
                        className={`dossier-photo ${profilePhotoUrl ? "dossier-photo-image" : ""}`}
                        role={profilePhotoUrl ? "img" : undefined}
                        aria-label={profilePhotoUrl ? `${studentProfile.name} profile photo` : undefined}
                        style={profilePhotoUrl ? { backgroundImage: `url("${profilePhotoUrl}")` } : undefined}
                      >
                        {!profilePhotoUrl && studentProfile.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="dossier-title-block">
                        <p className="eyebrow">STUDENT DOSSIER</p>
                        <h1>{studentProfile.name}</h1>
                        <p className="dossier-subtitle">
                          {[studentProfile.fieldOfStudy, studentProfile.institution].filter(Boolean).join(" â€¢ ") || "Student profile"}
                        </p>
                        {(studentProfile.educationLevel || studentProfile.currentYear || studentProfile.expectedGraduationYear) && (
                          <div className="dossier-meta">
                            {studentProfile.educationLevel && <span>{studentProfile.educationLevel}</span>}
                            {studentProfile.currentYear && <span>{studentProfile.currentYear}</span>}
                            {studentProfile.expectedGraduationYear && <span>Expected graduation {studentProfile.expectedGraduationYear}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className="button button-dark dossier-edit-button"
                      type="button"
                      onClick={() => setProfileEditing(true)}
                    >
                      <Pencil size={15} />
                      Edit profile
                    </button>
                  </header>
                  <div className="dossier-grid">
                    <section className="dossier-card dossier-academics">
                      <div className="dossier-card-heading">
                        <GraduationCap size={18} />
                        <h2>Academic history</h2>
                      </div>
                      {educationHistory.length ? (
                        <div className="dossier-history-list">
                          {educationHistory.map((entry) => (
                            <article className="dossier-academic-entry" key={`${entry.level}-${entry.institution}`}>
                              <div className="dossier-entry-title">
                                <h3>{entry.institution}</h3>
                                <span>
                                  {entry.startYear && entry.passoutYear
                                    ? `${entry.startYear}â€“${entry.level === "University" ? "Expected " : ""}${entry.passoutYear}`
                                    : entry.passoutYear
                                      ? `${entry.yearLabel} ${entry.passoutYear}`
                                      : entry.startYear
                                        ? `Started ${entry.startYear}`
                                        : entry.level}
                                </span>
                              </div>
                              <p>{[entry.level, entry.primary, entry.secondary].filter(Boolean).join(" â€¢ ")}</p>
                              {(entry.primary || entry.secondary || (entry.level === "University" && studentProfile.currentYear)) && (
                                <div className="dossier-academic-facts">
                                  {entry.primary && (
                                    <span>
                                      <small>{entry.level === "University" ? "Department" : entry.level === "College" ? "Program" : "Qualification"}</small>
                                      <strong>{entry.primary}</strong>
                                    </span>
                                  )}
                                  {entry.secondary && (
                                    <span><small>Major / focus</small><strong>{entry.secondary}</strong></span>
                                  )}
                                  {entry.level === "University" && studentProfile.currentYear && (
                                    <span><small>Current year</small><strong>{studentProfile.currentYear}</strong></span>
                                  )}
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="dossier-empty">
                          <p>Add your school, college, or university to complete your academic profile.</p>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => setProfileEditing(true)}
                          >
                            Add education details <ArrowUpRight size={14} />
                          </button>
                        </div>
                      )}
                    </section>
                    <aside className="dossier-side">
                      <section className="dossier-card">
                        <div className="dossier-card-heading dossier-contact-heading">
                          <UserRound size={17} />
                          <h2>Personal &amp; contact</h2>
                        </div>
                        <dl className="dossier-details">
                          <div><dt>Name</dt><dd>{studentProfile.name}</dd></div>
                          <div><dt>Email</dt><dd>{studentProfile.email}</dd></div>
                          {studentProfile.phone && <div><dt>Phone</dt><dd>{studentProfile.phone}</dd></div>}
                          {studentProfile.location && <div><dt>Location</dt><dd>{studentProfile.location}</dd></div>}
                        </dl>
                      </section>
                      <section className="dossier-card">
                        <div className="dossier-card-heading dossier-guardians-heading">
                          <UsersRound size={17} />
                          <h2>Guardians</h2>
                        </div>
                        {studentProfile.fatherName || studentProfile.motherName ? (
                          <div className="dossier-guardians">
                            {studentProfile.fatherName && (
                              <div><strong>{studentProfile.fatherName}</strong><span>Father</span></div>
                            )}
                            {studentProfile.motherName && (
                              <div><strong>{studentProfile.motherName}</strong><span>Mother</span></div>
                            )}
                          </div>
                        ) : (
                          <div className="dossier-empty">
                            <p>Guardian names haven&apos;t been added.</p>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => setProfileEditing(true)}
                            >
                              Add guardian names <ArrowUpRight size={14} />
                            </button>
                          </div>
                        )}
                      </section>
                    </aside>
                  </div>
                </div>
              )}
              {studentProfile && profileEditing && (
                <>
              <PageTitle
                eyebrow="YOUR STUDENT DETAILS"
                title="Edit student profile"
                body="Keep your personal and educational information up to date."
              >
                <button className="button button-outline" onClick={() => setProfileEditing(false)}>
                  View dossier
                </button>
              </PageTitle>
                <div className="profile-editor profile-editor-unified">
                  <div className="profile-editor-heading">
                    <p className="eyebrow">PROFILE DETAILS</p>
                    <h2>Student information</h2>
                    <p className="muted">Update personal details and your complete academic history here.</p>
                  </div>
                  <div className="profile-photo-editor">
                    <div
                      className={`profile-photo-preview ${profilePhotoUrl ? "profile-photo-has-image" : ""}`}
                      role={profilePhotoUrl ? "img" : undefined}
                      aria-label={profilePhotoUrl ? `${studentProfile.name} profile photo` : undefined}
                      style={profilePhotoUrl ? { backgroundImage: `url("${profilePhotoUrl}")` } : undefined}
                    >
                      {!profilePhotoUrl && studentProfile.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="profile-photo-details">
                      <strong>Profile photo</strong>
                      <p>JPG, PNG, GIF, WebP, or BMP. Maximum 5 MB.</p>
                      <div className="profile-photo-actions">
                        <label className="button button-outline profile-photo-picker">
                          {profilePhotoSaving ? <LoaderCircle className="spin" size={15} /> : <Camera size={15} />}
                          {profilePhotoUrl ? "Change photo" : "Add photo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                            disabled={profilePhotoSaving}
                            onChange={(event) => {
                              void changeStudentPhoto(event.currentTarget.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {studentProfile.photoAvailable && (
                          <button
                            className="text-button profile-photo-remove"
                            type="button"
                            onClick={() => void removeStudentPhoto()}
                            disabled={profilePhotoSaving}
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <form className="profile-edit-form" onSubmit={saveStudentProfile}>
                    <section className="profile-form-section">
                      <div className="profile-form-section-heading">
                        <UserRound size={17} />
                        <div><h3>Personal &amp; contact</h3><p>Basic information and family contacts.</p></div>
                      </div>
                      <div className="profile-fields">
                        <label className="profile-field">
                          <span>Full name</span>
                          <input required maxLength={120} autoComplete="name" value={studentProfile.name} onChange={(event) => setStudentProfile({ ...studentProfile, name: event.target.value })} />
                        </label>
                        <label className="profile-field">
                          <span>Account email</span>
                          <input type="email" value={studentProfile.email} readOnly />
                          <small>Your sign-in email canâ€™t be changed here.</small>
                        </label>
                        <label className="profile-field">
                          <span>Father&apos;s name <small>Optional</small></span>
                          <input maxLength={120} autoComplete="off" value={studentProfile.fatherName} onChange={(event) => setStudentProfile({ ...studentProfile, fatherName: event.target.value })} placeholder="Add father's name" />
                        </label>
                        <label className="profile-field">
                          <span>Mother&apos;s name <small>Optional</small></span>
                          <input maxLength={120} autoComplete="off" value={studentProfile.motherName} onChange={(event) => setStudentProfile({ ...studentProfile, motherName: event.target.value })} placeholder="Add mother's name" />
                        </label>
                        <label className="profile-field">
                          <span>Phone number <small>Optional</small></span>
                          <input type="tel" maxLength={40} autoComplete="tel" value={studentProfile.phone} onChange={(event) => setStudentProfile({ ...studentProfile, phone: event.target.value })} placeholder="Add a phone number" />
                        </label>
                        <label className="profile-field">
                          <span>Location <small>Optional</small></span>
                          <input maxLength={160} autoComplete="address-level2" value={studentProfile.location} onChange={(event) => setStudentProfile({ ...studentProfile, location: event.target.value })} placeholder="City or campus area" />
                        </label>
                      </div>
                    </section>
                    <section className="profile-form-section profile-education-section">
                      <div className="profile-form-section-heading">
                        <GraduationCap size={18} />
                        <div><h3>Academic history</h3><p>Add your school, college, and university details with study dates.</p></div>
                      </div>
                      <div className="education-stage-list">
                        <section className="education-stage">
                          <div className="education-stage-heading"><h4>School</h4><span>Secondary education</span></div>
                          <div className="profile-fields">
                            <label className="profile-field">
                              <span>School name</span>
                              <input maxLength={160} value={studentProfile.schoolName} onChange={(event) => setStudentProfile({ ...studentProfile, schoolName: event.target.value })} placeholder="School name" />
                            </label>
                            <label className="profile-field">
                              <span>Qualification</span>
                              <input maxLength={120} value={studentProfile.schoolQualification} onChange={(event) => setStudentProfile({ ...studentProfile, schoolQualification: event.target.value })} placeholder="Diploma or certificate" />
                            </label>
                            <label className="profile-field">
                              <span>Study start year</span>
                              <input type="number" min={1900} max={2200} value={studentProfile.schoolStartYear ?? ""} onChange={(event) => setStudentProfile({ ...studentProfile, schoolStartYear: event.target.value ? Number(event.target.value) : null })} placeholder="Start year" />
                            </label>
                            <label className="profile-field">
                              <span>Pass-out year</span>
                              <input type="number" min={1900} max={2200} value={studentProfile.schoolPassoutYear ?? ""} onChange={(event) => setStudentProfile({ ...studentProfile, schoolPassoutYear: event.target.value ? Number(event.target.value) : null })} placeholder="Graduation year" />
                            </label>
                          </div>
                        </section>
                        <section className="education-stage">
                          <div className="education-stage-heading"><h4>College</h4><span>College or preparatory studies</span></div>
                          <div className="profile-fields">
                            <label className="profile-field">
                              <span>College name</span>
                              <input maxLength={160} value={studentProfile.collegeName} onChange={(event) => setStudentProfile({ ...studentProfile, collegeName: event.target.value })} placeholder="College name" />
                            </label>
                            <label className="profile-field">
                              <span>Program or department</span>
                              <input maxLength={120} value={studentProfile.collegeProgram} onChange={(event) => setStudentProfile({ ...studentProfile, collegeProgram: event.target.value })} placeholder="Program or department" />
                            </label>
                            <label className="profile-field">
                              <span>Study start year</span>
                              <input type="number" min={1900} max={2200} value={studentProfile.collegeStartYear ?? ""} onChange={(event) => setStudentProfile({ ...studentProfile, collegeStartYear: event.target.value ? Number(event.target.value) : null })} placeholder="Start year" />
                            </label>
                            <label className="profile-field">
                              <span>Pass-out year</span>
                              <input type="number" min={1900} max={2200} value={studentProfile.collegePassoutYear ?? ""} onChange={(event) => setStudentProfile({ ...studentProfile, collegePassoutYear: event.target.value ? Number(event.target.value) : null })} placeholder="Graduation year" />
                            </label>
                          </div>
                        </section>
                        <section className="education-stage">
                          <div className="education-stage-heading"><h4>University</h4><span>Current or most recent university</span></div>
                          <div className="profile-fields">
                            <label className="profile-field">
                              <span>University name</span>
                              <input maxLength={160} autoComplete="organization" value={studentProfile.institution} onChange={(event) => setStudentProfile({ ...studentProfile, institution: event.target.value })} placeholder="University name" />
                            </label>
                            <label className="profile-field">
                              <span>Education level</span>
                              <select value={studentProfile.educationLevel} onChange={(event) => setStudentProfile({ ...studentProfile, educationLevel: event.target.value })}>
                                <option value="">Choose a level</option>
                                <option value="College">College</option>
                                <option value="University">University</option>
                                <option value="Other">Other</option>
                              </select>
                            </label>
                            <label className="profile-field">
                              <span>Department</span>
                              <input maxLength={160} value={studentProfile.universityDepartment} onChange={(event) => setStudentProfile({ ...studentProfile, universityDepartment: event.target.value })} placeholder="Department" />
                            </label>
                            <label className="profile-field">
                              <span>Major / field of study</span>
                              <input maxLength={120} value={studentProfile.fieldOfStudy} onChange={(event) => setStudentProfile({ ...studentProfile, fieldOfStudy: event.target.value })} placeholder="Major or subject" />
                            </label>
                            <label className="profile-field">
                              <span>Study start year</span>
                              <input type="number" min={1900} max={2200} value={studentProfile.universityStartYear ?? ""} onChange={(event) => setStudentProfile({ ...studentProfile, universityStartYear: event.target.value ? Number(event.target.value) : null })} placeholder="Start year" />
                            </label>
                            <label className="profile-field">
                              <span>Current year or grade</span>
                              <input maxLength={80} value={studentProfile.currentYear} onChange={(event) => setStudentProfile({ ...studentProfile, currentYear: event.target.value })} placeholder="e.g. Year 2" />
                            </label>
                            <label className="profile-field">
                              <span>Pass-out / expected graduation year</span>
                              <input type="number" min={1900} max={2200} value={studentProfile.expectedGraduationYear ?? ""} onChange={(event) => setStudentProfile({ ...studentProfile, expectedGraduationYear: event.target.value ? Number(event.target.value) : null })} placeholder="Graduation year" />
                            </label>
                          </div>
                        </section>
                      </div>
                    </section>
                    <div className="profile-form-actions">
                      <span>Only you can see this information.</span>
                      <button className="button button-dark" type="submit" disabled={profileSaving}>
                        {profileSaving && <LoaderCircle className="spin" size={16} />}
                        Save changes
                      </button>
                    </div>
                  </form>
                </div>
                </>
              )}
            </section>
          )}
          {view === "Overview" && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">{today.toUpperCase()}</p>
                  <h1>
                    Good morning, {firstName}
                    <span className="period-dot">.</span>
                  </h1>
                  <p className="muted">
                    A little progress adds up. Here&apos;s your day at a glance.
                  </p>
                </div>
                <button
                  className="button button-dark"
                  onClick={() => setTaskModal(true)}
                >
                  <Plus size={16} />
                  Add a deadline
                </button>
              </section>
              <section className="stats-grid">
                <Stat
                  label="COURSES"
                  value={data?.stats.courseCount ?? 0}
                  note="in your workspace"
                  className="stat-green"
                  icon={<BookOpen size={17} />}
                />
                <Stat
                  label="OPEN TASKS"
                  value={data?.stats.openTasks ?? 0}
                  note="still on your list"
                  className="stat-lilac"
                  icon={<CheckCheck size={17} />}
                />
                <Stat
                  label="STUDY TIME"
                  value={`${Math.floor((data?.stats.studyMinutes ?? 0) / 60)}h ${(data?.stats.studyMinutes ?? 0) % 60}m`}
                  note="logged this week"
                  className="stat-peach"
                  icon={<Clock3 size={17} />}
                />
                <Stat
                  label="COURSE NOTES"
                  value={data?.stats.documents ?? 0}
                  note="ready to explore"
                  className="stat-blue"
                  icon={<FileText size={17} />}
                />
              </section>
              <div className="dashboard-grid">
                <section className="panel upcoming-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">KEEP YOUR MOMENTUM</p>
                      <h2>Coming up</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("Planner")}
                    >
                      Open planner <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {pending.length ? (
                    <div className="task-list">
                      {pending.slice(0, 5).map((task) => (
                        <div className="task-row" key={task.id}>
                          <button
                            className="task-check"
                            onClick={() => moveTask(task, "COMPLETED")}
                            aria-label={`Complete ${task.title}`}
                          >
                            <Check size={14} />
                          </button>
                          <span className="task-row-title">
                            {task.title}
                            <small>
                              {courses.find((item) => item.id === task.courseId)
                                ?.code ?? "Personal"}
                            </small>
                          </span>
                          <span
                            className="priority-pill"
                            data-priority={task.priority.toLowerCase()}
                          >
                            {task.priority.toLowerCase()}
                          </span>
                          <span className="task-date">
                            {dateLabel(task.dueDate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Nothing due just yet"
                      body="Add your next deadline and keep the week in view."
                      action="Add a deadline"
                      onClick={() => setTaskModal(true)}
                    />
                  )}
                </section>
                <section className="panel focus-panel">
                  <div className="focus-illustration">
                    <div className="sun-shape" />
                    <div className="focus-lines">
                      <span />
                      <span />
                      <span />
                    </div>
                    <BookOpen className="focus-book" size={26} />
                  </div>
                  <p className="eyebrow">A SMALL WIN</p>
                  <h2>Make 25 minutes count.</h2>
                  <p className="muted">
                    Pick a course, settle in, and give one thing your full
                    attention.
                  </p>
                  <CourseSelect
                    courses={courses}
                    value={courseId}
                    onChange={setCourseId}
                  />
                  <button
                    className="button button-green focus-button"
                    disabled={!courseId}
                    onClick={logSession}
                  >
                    <Check size={16} />
                    Log a study session
                  </button>
                </section>
              </div>
              <section className="section-block">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">YOUR SEMESTER, ORGANIZED</p>
                    <h2>Course spaces</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setView("Courses")}
                  >
                    All courses <ArrowUpRight size={15} />
                  </button>
                </div>
                <CourseGrid
                  courses={courses.slice(0, 3)}
                  onChoose={(id) => {
                    setCourseId(id);
                    setCourseDetailId(id);
                    setView("Courses");
                  }}
                  onAdd={() => setCourseModal(true)}
                />
              </section>
            </>
          )}

          {view === "Courses" && (
            <section className="page-section">
              <PageTitle
                eyebrow={courseDetail ? courseDetail.code : "YOUR MATERIALS, TOGETHER"}
                title={courseDetail ? courseDetail.title : "Course spaces"}
                body={
                  courseDetail
                    ? "Study materials and files for this course."
                    : "Keep your notes close to the work they support."
                }
              >
                {courseDetail ? (
                  <button
                    className="button button-outline"
                    onClick={() => setCourseDetailId(null)}
                  >
                    <ArrowDownLeft size={16} />
                    All courses
                  </button>
                ) : (
                  <button
                    className="button button-dark"
                    onClick={() => setCourseModal(true)}
                  >
                    <Plus size={16} />
                    New course
                  </button>
                )}
              </PageTitle>
              {courseDetail ? (
                <section className="panel course-detail">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">COURSE MATERIALS</p>
                      <h2>Study materials</h2>
                    </div>
                    <label className="button button-outline upload-label">
                      <Upload size={16} />
                      Upload notes
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                        onChange={(event) => upload(event.target.files?.[0])}
                      />
                    </label>
                    <label className="button button-outline upload-label">
                      <ClipboardList size={16} />
                      Parse syllabus
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md"
                        onChange={(event) => uploadSyllabus(event.target.files?.[0])}
                      />
                    </label>
                  </div>
                  <div className="document-list">
                    {courseDetail.documents.length ? (
                      courseDetail.documents.map((doc) => (
                        <div className="document-row" key={doc.id}>
                          <button
                            className="document-open"
                            type="button"
                            disabled={readerLoading || deletingDocumentId !== null}
                            onClick={() => void openDocument(doc)}
                          >
                            <span className="doc-icon">
                              <FileText size={17} />
                            </span>
                            <span>
                              <strong>{doc.fileName}</strong>
                              <small>
                                {doc.characters?.toLocaleString() ?? ""}{" "}
                                characters - added {dateLabel(doc.uploadedAt)}
                              </small>
                            </span>
                            <ArrowUpRight size={16} className="doc-open" />
                          </button>
                          <button
                            className="document-delete"
                            type="button"
                            disabled={deletingDocumentId !== null}
                            onClick={() => void deleteDocument(doc)}
                            aria-label={`Delete ${doc.fileName}`}
                            title={`Delete ${doc.fileName}`}
                          >
                            {deletingDocumentId === doc.id ? (
                              <LoaderCircle className="spin" size={16} />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No notes in this course"
                        body="Add lecture slides or notes to unlock grounded chat and study tools."
                        action="Upload notes"
                        onClick={() =>
                          document.getElementById("course-upload")?.click()
                        }
                      />
                    )}
                  </div>
                  <input
                    id="course-upload"
                    className="visually-hidden"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                    onChange={(event) => upload(event.target.files?.[0])}
                  />
                </section>
              ) : (
                <CourseGrid
                  courses={courses}
                  onChoose={(id) => {
                    setCourseId(id);
                    setCourseDetailId(id);
                  }}
                  onAdd={() => setCourseModal(true)}
                />
              )}
            </section>
          )}

          {view === "Z-Chat" && (
            <section className="page-section">
              <PageTitle
                eyebrow="GENERAL AI CHAT"
                title="Ask Z-Chat anything."
                body="Explore ideas, ask general questions, or add a course for notes-based context and web research."
              >
                <CourseSelect
                  label="OPTIONAL COURSE CONTEXT"
                  courses={courses}
                  value={chatCourseId}
                  onChange={(value) => {
                    setChatCourseId(value);
                    startNewChat();
                  }}
                />
              </PageTitle>
              <div className="chat-workspace">
                <div className="chat-head">
                  <span className="chat-status" />
                  <span>{chatCourse ? `${chatCourse.code} - ${chatCourse.title}` : "General conversation"}</span>
                  <span className="grounded-tag">
                    <Sparkles size={13} />
                    {chatCourse ? "COURSE NOTES" : "GROQ AI"}
                  </span>
                </div>
                <div className="chat-history-tools">
                  <span className="chat-unsaved-note">Messages are only kept while this page is open.</span>
                  <button className="button button-outline" onClick={startNewChat}>
                    <Plus size={14} /> New chat
                  </button>
                </div>
                <div className="chat-transcript">
                  {!messages.length ? (
                    <div className="chat-empty">
                      <div className="chat-mark">
                        <MessageSquareText size={23} />
                      </div>
                      <h2>What are you working through?</h2>
                      <p>
                        Ask anything. Select a course above to include your notes and receive source-based answers.
                      </p>
                      <div className="prompt-chips">
                        <button
                          onClick={() =>
                            setQuestion(
                              "Can you explain this idea in simple terms?",
                            )
                          }
                        >
                          Explain a difficult idea simply
                        </button>
                        <button
                          onClick={() =>
                            setQuestion(
                              "What are a few ways I could approach this?",
                            )
                          }
                        >
                          Help me brainstorm
                        </button>
                      </div>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`message message-${message.role}`}
                      >
                        <div className="message-avatar">
                          {message.role === "assistant" ? (
                            <Image src="/z-top-logo-purple.png" alt="Z-TOP assistant" width={26} height={26} />
                          ) : (
                            user.name.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="message-body">
                          <p>
                            {message.role === "assistant"
                              ? displayAssistantText(message.text)
                              : message.text}
                          </p>
                          {message.citations?.map((citation, i) => citation.url ? (
                            <article className="citation citation-web" key={`${citation.url}-${i}`}>
                              <div><Globe2 size={14} /><strong>Web source</strong></div>
                              <a href={citation.url} target="_blank" rel="noreferrer">{citation.title || citation.url}<ArrowUpRight size={12} /></a>
                            </article>
                          ) : (
                            <article className="citation" key={`${citation.fileName}-${i}`}>
                              <div><FileText size={14} /><strong>{citation.fileName}</strong><span>p. {citation.page}</span></div>
                              <p>{citation.snippet}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  {chatSending && (
                    <div className="message message-assistant chat-thinking" role="status" aria-live="polite">
                      <div className="message-avatar">
                        <Image src="/z-top-logo-purple.png" alt="Z-TOP assistant" width={26} height={26} />
                      </div>
                      <div className="message-body">
                        <p><LoaderCircle className="spin" size={14} /> {chatCourse ? "Checking your notes and searching the webâ€¦" : "Thinkingâ€¦"}</p>
                      </div>
                    </div>
                  )}
                </div>
                <form className="chat-compose" onSubmit={ask}>
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask Z-Chat anythingâ€¦"
                    aria-label="Ask Z-Chat a question"
                    disabled={chatSending}
                  />
                  <button
                    aria-label="Send question"
                    disabled={!question.trim() || chatSending}
                  >
                    {chatSending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
                  </button>
                </form>
              </div>
            </section>
          )}

          {view === "Z-Study" && (
            <section className="page-section">
              <PageTitle
                eyebrow="TURN NOTES INTO PRACTICE"
                title="Study, actively."
                body="Build a focused review set from your course materials."
              >
                <CourseSelect
                  courses={courses}
                  value={courseId}
                  onChange={(value) => {
                    setCourseId(value);
                    setStudyDocumentSelection(null);
                    setAsset(null);
                  }}
                />
              </PageTitle>
              <div className="study-layout">
                <div className="study-options">
                  <div
                    className="mode-tabs"
                    role="tablist"
                    aria-label="Study format"
                  >
                    {(
                      [
                        ["flashcards", "Flashcards"],
                        ["quiz", "Practice quiz"],
                        ["summary", "Key takeaways"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        role="tab"
                        aria-selected={studyMode === mode}
                        className={studyMode === mode ? "mode-active" : ""}
                        key={mode}
                        onClick={() => {
                          setStudyMode(mode);
                          setAsset(null);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <section className="study-sources" aria-label="Study source files">
                    <div className="study-sources-heading">
                      <div>
                        <p className="eyebrow">STUDY FROM</p>
                        <strong>Choose source files</strong>
                      </div>
                      <div className="study-source-actions">
                        <button
                          type="button"
                          onClick={() => setStudyDocumentSelection(null)}
                          disabled={!course?.documents.length || selectedStudyDocumentIds.length === course.documents.length}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (course) setStudyDocumentSelection({ courseId: course.id, documentIds: [] });
                          }}
                          disabled={!selectedStudyDocumentIds.length}
                        >
                          None
                        </button>
                      </div>
                    </div>
                    {course?.documents.length ? (
                      <div className="study-source-list">
                        {course.documents.map((doc) => (
                          <label className="study-source-option" key={doc.id}>
                            <input
                              type="checkbox"
                              checked={selectedStudyDocumentIds.includes(doc.id)}
                              onChange={(event) => {
                                const next = new Set(selectedStudyDocumentIds);
                                if (event.currentTarget.checked) next.add(doc.id);
                                else next.delete(doc.id);
                                setStudyDocumentSelection({ courseId: course.id, documentIds: [...next] });
                                setAsset(null);
                              }}
                            />
                            <span>{doc.fileName}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="study-sources-empty">Upload notes to choose study sources.</p>
                    )}
                    {!selectedStudyDocumentIds.length && course?.documents.length ? (
                      <p className="study-sources-empty">Select at least one file to generate study material.</p>
                    ) : null}
                  </section>
                  <div className="study-prompt">
                    <span className="study-spark">
                      <Sparkles size={20} />
                    </span>
                    <p className="eyebrow">SOURCE-BASED REVIEW</p>
                    <h2>
                      {studyMode === "flashcards"
                        ? "Recall the important bits."
                        : studyMode === "quiz"
                          ? "Check what has stuck."
                          : "See the big picture."}
                    </h2>
                    <p className="muted">
                      {studyMode === "flashcards"
                        ? "Turn key passages into a set of quick prompts and answers."
                        : studyMode === "quiz"
                          ? "Test yourself with review questions drawn from your notes."
                          : "Pull the central ideas into a concise review sheet."}
                    </p>
                    <button
                      className="button button-dark generate-button"
                      onClick={generate}
                      disabled={busy || !course?.documents.length || !selectedStudyDocumentIds.length}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {studyMode === "flashcards"
                        ? "Make flashcards"
                        : studyMode === "quiz"
                          ? "Build practice quiz"
                          : "Create key takeaways"}
                    </button>
                    {!course?.documents.length && (
                      <small className="under-button">
                        Add notes to this course first.
                      </small>
                    )}
                  </div>
                </div>
                <div className="asset-area">
                  {asset ? (
                    <StudyResult asset={asset} mode={studyMode} />
                  ) : (
                    <div className="asset-placeholder">
                      <div className="placeholder-pages">
                        <span />
                        <span />
                        <span />
                      </div>
                      <p className="eyebrow">YOUR STUDY SET WILL APPEAR HERE</p>
                      <h3>Practice beats rereading.</h3>
                      <p className=" muted">
                        Create a set from your notes, then work through it at
                        your own pace.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {view === "Planner" && (
            <section className="page-section">
              <PageTitle
                eyebrow="ONE THING AT A TIME"
                title="Your planner"
                body="A clear view of the next steps across your courses."
              >
                <div className="planner-header-actions">
                  <button
                    className="button button-outline"
                    disabled={!courseId}
                    onClick={() => setPlanModal(true)}
                  >
                    <Sparkles size={15} />
                    Build exam plan
                  </button>
                  <button
                    className="button button-dark"
                    onClick={() => setTaskModal(true)}
                  >
                    <Plus size={16} />
                    Add a deadline
                  </button>
                </div>
              </PageTitle>
              <div className="planner-board">
                {(
                  [
                    ["TODO", "To do"],
                    ["IN_PROGRESS", "In progress"],
                    ["COMPLETED", "Done"],
                  ] as const
                ).map(([status, label]) => (
                  <section
                    className="planner-column"
                    key={status}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const draggedTask = tasks.find((task) => task.id === draggedTaskId);
                      if (draggedTask) void moveTask(draggedTask, status);
                      setDraggedTaskId(null);
                    }}
                  >
                    <div className="column-heading">
                      <span>{label}</span>
                      <span>
                        {tasks.filter((task) => task.status === status).length}
                      </span>
                    </div>
                    {tasks
                      .filter((task) => task.status === status)
                      .map((task) => (
                        <article
                          className="planner-task"
                          key={task.id}
                          draggable={status !== "COMPLETED"}
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragEnd={() => setDraggedTaskId(null)}
                        >
                          <div
                            className="task-priority"
                            data-priority={task.priority.toLowerCase()}
                          />
                          <p>{task.title}</p>
                          <div className="planner-task-meta">
                            <span>
                              {courses.find((item) => item.id === task.courseId)
                                ?.code ?? "Personal"}
                            </span>
                            <span>
                              <CalendarDays size={13} />
                              {dateLabel(task.dueDate)}
                            </span>
                          </div>
                          <div className="task-actions">
                            {status !== "TODO" && (
                              <button onClick={() => moveTask(task, "TODO")}>
                                <ArrowDownLeft size={14} />
                                To do
                              </button>
                            )}
                            {status === "TODO" && (
                              <button
                                onClick={() => moveTask(task, "IN_PROGRESS")}
                              >
                                Start <ArrowUpRight size={14} />
                              </button>
                            )}
                            {status !== "COMPLETED" && (
                              <button
                                onClick={() => moveTask(task, "COMPLETED")}
                              >
                                <Check size={14} />
                                Done
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                  </section>
                ))}
              </div>
              {!tasks.length && (
                <div className="planner-empty">
                  <EmptyState
                    title="Your planner is clear"
                    body="Add an assignment or exam date to start building your week."
                    action="Add a deadline"
                    onClick={() => setTaskModal(true)}
                  />
                </div>
              )}
            </section>
          )}

          {view === "Progress" && (
            <section className="page-section">
              <PageTitle
                eyebrow="NOTICE THE WORK ADDING UP"
                title="Your progress"
                body="A steady view of your study time and quiz results."
              >
                <button className="button button-outline" onClick={() => void loadAnalytics()}>
                  <BarChart3 size={15} /> Refresh
                </button>
              </PageTitle>
              <section className="stats-grid progress-stats">
                <Stat label="STUDY STREAK" value={`${analytics?.streakDays ?? 0} days`} note="active consecutive days" className="stat-green" icon={<Sparkles size={17} />} />
                <Stat label="STUDY THIS WEEK" value={`${Math.floor((analytics?.studyMinutesWeek ?? 0) / 60)}h ${(analytics?.studyMinutesWeek ?? 0) % 60}m`} note="from logged sessions" className="stat-peach" icon={<Clock3 size={17} />} />
                <Stat label="QUIZ AVERAGE" value={averageScore === null ? "-" : `${averageScore}%`} note={`${scoredCourses.reduce((sum, item) => sum + item.quizAttempts, 0)} scored attempts`} className="stat-lilac" icon={<CheckCheck size={17} />} />
              </section>
              <div className="analytics-grid">
                <section className="panel analytics-panel">
                  <div className="panel-heading"><div><p className="eyebrow">LAST SEVEN DAYS</p><h2>Study rhythm</h2></div><span className="chart-total">{analytics?.studyMinutesTotal ?? 0} min total</span></div>
                  <div className="study-chart" role="img" aria-label="Study minutes logged for the last seven days">
                    {(analytics?.dailyStudy ?? []).map((day) => (
                      <div className="chart-day" key={day.date}>
                        <div className="chart-track"><span title={`${day.minutes} minutes`} style={{ height: `${day.minutes ? Math.max(8, Math.min(100, day.minutes / Math.max(1, ...(analytics?.dailyStudy.map((item) => item.minutes) ?? [1])) * 100)) : 0}%` }} /></div>
                        <strong>{day.minutes}</strong>
                        <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel analytics-panel">
                  <div className="panel-heading"><div><p className="eyebrow">BY COURSE</p><h2>Mastery signals</h2></div></div>
                  <div className="mastery-list">
                    {(analytics?.courses ?? []).map((item) => (
                      <article className="mastery-row" key={item.id}>
                        <div><strong>{item.code}</strong><span>{item.title}</span></div>
                        <div className="mastery-meter"><span style={{ width: `${item.averageScore ?? 0}%` }} /></div>
                        <strong className="mastery-score">{item.averageScore === null ? "-" : `${Math.round(item.averageScore)}%`}</strong>
                        <small>{item.quizAttempts} quizzes Â· {item.studyMinutes} study min</small>
                      </article>
                    ))}
                    {!analytics?.courses.length && <p className="muted analytics-empty">Add a course to start tracking study activity.</p>}
                  </div>
                </section>
              </div>
            </section>
          )}
        </div>
      </main>
      {readerMaterial && (
        <div
          className="reader-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) void closeReader();
          }}
        >
          <section
            className="reader-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Reading ${readerMaterial.fileName}`}
          >
            <header className="reader-heading">
              <div>
                <p className="eyebrow">STUDY MATERIAL</p>
                <h2>{readerMaterial.fileName}</h2>
              </div>
              <div className="reader-tools">
                {readerOriginalUrl && (
                  <a
                    className="reader-download"
                    href={readerOriginalUrl}
                    download={readerMaterial.fileName}
                    aria-label="Download original file"
                    title="Download original file"
                  >
                    <Download size={16} />
                  </a>
                )}
                <span className="reader-timer" aria-live="off">
                  <Clock3 size={16} />
                  {formatDuration(readerElapsedSeconds)}
                </span>
                <button
                  className="reader-close"
                  type="button"
                  onClick={() => void closeReader()}
                  aria-label="Close reader and log study time"
                  title="Close and log study time"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="reader-content">
              {readerOriginalType === "application/pdf" && readerOriginalUrl ? (
                <iframe
                  className="reader-pdf"
                  src={readerOriginalUrl}
                  title={readerMaterial.fileName}
                />
              ) : readerOriginalType.startsWith("image/") && readerOriginalUrl ? (
                <img className="reader-image" src={readerOriginalUrl} alt={readerMaterial.fileName} />
              ) : readerOriginalType.includes("wordprocessingml.document") && readerOriginalUrl ? (
                <div className="reader-docx-preview" ref={docxPreviewRef} />
              ) : (
                readerMaterial.pages.map((page) => (
                  <article className="reader-page" key={page.number}>
                    {readerMaterial.pages.length > 1 && (
                      <span className="reader-page-label">PAGE {page.number}</span>
                    )}
                    <p>{page.text}</p>
                  </article>
                ))
              )}
            </div>
            <footer className="reader-footer">
              <span>Time is logged when you close this reader.</span>
              <button
                className="button button-green"
                type="button"
                onClick={() => void closeReader()}
              >
                <Check size={16} />
                Finish reading
              </button>
            </footer>
          </section>
        </div>
      )}
      {courseModal && (
        <Modal title="Create a course" close={() => setCourseModal(false)}>
          <form className="stack-form" onSubmit={addCourse}>
            <label>
              Course code
              <input
                required
                value={courseCode}
                onChange={(event) => setCourseCode(event.target.value)}
                placeholder="BIO 204"
              />
            </label>
            <label>
              Course name
              <input
                required
                value={courseTitle}
                onChange={(event) => setCourseTitle(event.target.value)}
                placeholder="Cellular biology"
              />
            </label>
            <button className="button button-dark modal-submit" disabled={busy}>
              Create course <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {taskModal && (
        <Modal title="Add a deadline" close={() => setTaskModal(false)}>
          <form className="stack-form" onSubmit={addTask}>
            <label>
              What needs doing?
              <input
                required
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Submit lab report"
              />
            </label>
            <label>
              Due date
              <input
                required
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <label>
              Course
              <select
                value={courseId}
                onChange={(event) =>
                  setCourseId(Number(event.target.value) || "")
                }
              >
                <option value="">Personal / other</option>
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-dark modal-submit" disabled={busy}>
              Add to planner <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {planModal && (
        <Modal title="Plan for an exam" close={() => setPlanModal(false)}>
          <form className="stack-form" onSubmit={createStudyPlan}>
            <label>
              Course
              <select required value={courseId} onChange={(event) => setCourseId(Number(event.target.value) || "")}>
                <option value="">Choose a course</option>
                {courses.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.title}</option>)}
              </select>
            </label>
            <label>
              Exam date
              <input required type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
            </label>
            <label>
              Available study hours per day
              <input required type="number" min="0.5" max="8" step="0.5" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} />
            </label>
            <button className="button button-dark modal-submit" disabled={busy || !courseId}>
              {busy && <LoaderCircle className="spin" size={16} />}
              Create study plan <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  className,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  className: string;
  icon: ReactNode;
}) {
  return (
    <article className={`stat-card ${className}`}>
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function CourseSelect({
  courses,
  value,
  onChange,
  label = "COURSE",
}: {
  courses: Course[];
  value: number | "";
  onChange: (value: number | "") => void;
  label?: string;
}) {
  return (
    <label className="course-select">
      <span>{label}</span>
      <select
        aria-label="Choose course"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || "")}
      >
        <option value="">Choose a course</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.code} - {course.title}
          </option>
        ))}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}
function PageTitle({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{body}</p>
      </div>
      {children}
    </div>
  );
}
function EmptyState({
  title,
  body,
  action,
  onClick,
}: {
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <CalendarDays size={19} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      <button className="text-button" onClick={onClick}>
        {action} <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
function CourseGrid({
  courses,
  onChoose,
  onAdd,
}: {
  courses: Course[];
  onChoose: (id: number) => void;
  onAdd: () => void;
}) {
  if (!courses.length)
    return (
      <div className="course-empty">
        <div className="empty-icon">
          <BookOpen size={21} />
        </div>
        <h3>A fresh semester starts here.</h3>
        <p className="muted">
          Create a course, then add the materials you want to study.
        </p>
        <button className="button button-outline" onClick={onAdd}>
          <Plus size={15} />
          Create your first course
        </button>
      </div>
    );
  return (
    <div className="course-grid">
      {courses.map((course, index) => (
        <button
          className="course-card"
          key={course.id}
          onClick={() => onChoose(course.id)}
        >
          <div className={`course-card-banner banner-${index % 4}`}>
            <span className="course-code">{course.code}</span>
            <BookOpen size={22} strokeWidth={1.5} />
          </div>
          <div className="course-card-body">
            <h3>{course.title}</h3>
            <div className="course-card-meta">
              <span>
                <FileText size={14} />
                {course.documents.length} notes
              </span>
              <span>{course.deckCount} sets</span>
            </div>
            <span className="course-card-arrow">
              <ArrowUpRight size={16} />
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button onClick={close} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function StudyResult({
  asset,
  mode,
}: {
  asset: Asset;
  mode: "flashcards" | "quiz" | "summary";
}) {
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  function submitQuiz() {
    const questions = asset.questions ?? [];
    const results = questions.map((item, index) => ({
      isCorrect: (selections[index] ?? -1) === item.correctIndex,
      correctIndex: item.correctIndex,
      explanation: item.explanation,
    }));
    const correct = results.filter((result) => result.isCorrect).length;
    setQuizResult({
      score: questions.length ? (correct * 100) / questions.length : 0,
      correct,
      total: questions.length,
      results,
    });
  }
  if (mode === "summary")
    return (
      <div className="study-result">
        <p className="eyebrow">KEY TAKEAWAYS</p>
        <h3>{asset.title ?? "From your course notes"}</h3>
        <div className="summary-bullets">
          {(asset.cards ?? []).map((card, index) => (
            <div key={index}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{card.answer}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (mode === "quiz")
    return (
      <div className="study-result">
        <p className="eyebrow">PRACTICE QUIZ</p>
        <h3>{asset.title ?? "Course review"}</h3>
        {quizResult && (
          <div className="quiz-score">
            {quizResult.correct} / {quizResult.total} correct{" "}
            <strong>{Math.round(quizResult.score)}%</strong>
          </div>
        )}
        {(asset.questions ?? []).map((item, index) => (
          <article className="quiz-question" key={index}>
            <strong>
              {index + 1}. {item.question}
            </strong>
            <div className="quiz-options">
              {item.options.map((option, optionIndex) => (
                <button
                  type="button"
                  key={optionIndex}
                  className={
                    selections[index] === optionIndex
                      ? "quiz-option selected"
                      : "quiz-option"
                  }
                  aria-pressed={selections[index] === optionIndex}
                  disabled={Boolean(quizResult)}
                  onClick={() =>
                    setSelections((current) => ({
                      ...current,
                      [index]: optionIndex,
                    }))
                  }
                >
                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                  {option}
                </button>
              ))}
            </div>
            {quizResult && (
              <small
                className={
                  quizResult.results[index]?.isCorrect
                    ? "quiz-feedback correct"
                    : "quiz-feedback incorrect"
                }
              >
                {quizResult.results[index]?.isCorrect
                  ? "Correct. "
                  : `Not quite. Correct answer: ${item.options[quizResult.results[index]?.correctIndex]}. `}
                {quizResult.results[index]?.explanation}
              </small>
            )}
          </article>
        ))}
        {!quizResult && (
          <>
            <button
              className="button button-dark quiz-submit"
              onClick={submitQuiz}
            >
              Check answers <ArrowUpRight size={15} />
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className="study-result">
      <p className="eyebrow">{asset.cards?.length ?? 0} FLASHCARDS</p>
      <h3>{asset.topic ?? "Key ideas"}</h3>
      <div className="flashcard-list">
        {(asset.cards ?? []).slice(0, 8).map((card, index) => (
          <details className="flashcard" key={index}>
            <summary>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {card.question}
              <ChevronDown size={16} />
            </summary>
            <p>{card.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
