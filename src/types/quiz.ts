
export interface McqQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface GeneratedQuizData {
  id: string; // Unique ID for the quiz
  topic: string;
  questions: McqQuestion[];
}

// Used for submitting answers and for AI analysis input
export interface QuestionAttempt {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  studentAnswerIndex: number | null; // null if unanswered
}

// For storing student's selected answers during the quiz
export type StudentAnswers = (number | null)[]; // Array index corresponds to question index, value is selected option index or null
