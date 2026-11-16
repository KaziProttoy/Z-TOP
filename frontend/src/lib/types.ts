export type { ReactNode } from 'react';

export type User = { id: number; name: string; email: string };
export type StudentProfile = {
  name: string;
  email: string;
  photoAvailable: boolean;
  fatherName: string;
  motherName: string;
  phone: string;
  location: string;
  educationLevel: string;
  schoolName: string;
  schoolQualification: string;
  schoolStartYear: number | null;
  schoolPassoutYear: number | null;
  collegeName: string;
  collegeProgram: string;
  collegeStartYear: number | null;
  collegePassoutYear: number | null;
  institution: string;
  universityDepartment: string;
  fieldOfStudy: string;
  universityStartYear: number | null;
  currentYear: string;
  expectedGraduationYear: number | null;
};
export type Doc = {
  id: number;
  fileName: string;
  uploadedAt: string;
  characters?: number;
};
export type ReaderMaterial = {
  id: number;
  fileName: string;
  pages: { number: number; text: string }[];
};
export type OriginalFile = { url: string; contentType: string };
export type Course = {
  id: number;
  code: string;
  title: string;
  color: string;
  documents: Doc[];
  deckCount: number;
  quizCount: number;
};
export type Task = {
  id: number;
  title: string;
  dueDate: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  courseId: number | null;
};
export type Data = {
  courses: Course[];
  tasks: Task[];
  stats: {
    courseCount: number;
    openTasks: number;
    studyMinutes: number;
    documents: number;
  };
};
export type Citation = {
  fileName?: string;
  page?: number;
  snippet?: string;
  title?: string;
  url?: string;
  sourceType?: "course" | "web";
};
export type Message = {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
};
export type Asset = {
  id?: number;
  title?: string;
  topic?: string;
  cards?: { question: string; answer: string }[];
  questions?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
};
export type QuizResult = {
  score: number;
  correct: number;
  total: number;
  results: { isCorrect: boolean; correctIndex: number; explanation: string }[];
};
export type Analytics = {
  courses: {
    id: number;
    code: string;
    title: string;
    averageScore: number | null;
    quizAttempts: number;
    studyMinutes: number;
  }[];
  streakDays: number;
  studyMinutesTotal: number;
  studyMinutesWeek: number;
  dailyStudy: { date: string; minutes: number }[];
};
export type View =
  "Overview" | "Courses" | "Z-Chat" | "Z-Study" | "Planner" | "Progress" | "Profile";

