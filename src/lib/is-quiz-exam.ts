const LEGACY_QUIZ_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export function isQuizExam(exam: { isQuiz: boolean; startsAt: Date; endsAt: Date }) {
  const duration = exam.endsAt.getTime() - exam.startsAt.getTime();
  // Older quizzes were stored as exams with a one-year availability window.
  return exam.isQuiz || Math.abs(duration - LEGACY_QUIZ_DURATION_MS) < 1000;
}
