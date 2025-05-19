
export interface McqQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface GeneratedQuizData {
  id: string; // Unique ID for the quiz
  topic: string;
  questions: McqQuestion[];
  durationMinutes: number; // Quiz duration in minutes
  userId?: string | null; // Optional: ID of the user who created/took the quiz
  createdAt?: any; // Firestore Timestamp
}

// Used for submitting answers and for AI analysis input
export interface QuestionAttempt extends McqQuestion { // Inherits McqQuestion fields
  studentAnswerIndex: number | null; // null if unanswered
}

// For storing student's selected answers during the quiz
export type StudentAnswers = (number | null)[]; // Array index corresponds to question index, value is selected option index or null


// For Revisit PDF Generation
export interface RevisitMaterialInput {
  topic: string;
  incorrectQuestions: Array<{
    question: string;
    options: string[];
    correctAnswerIndex: number;
    studentAnswerIndex: number | null; // Could be null if skipped
    // Added for easier templating
    studentAnswerText?: string;
    correctAnswerText?: string;
  }>;
}

export interface RevisitMaterialSection {
  question: string;
  correctAnswer: string; // Text of the correct answer
  studentAnswer?: string | null; // Text of student's answer, or "Skipped"
  detailedExplanation: string; // In-depth, book-like explanation
}

export interface RevisitMaterialOutput {
  title: string;
  introduction: string;
  sections: RevisitMaterialSection[];
}
