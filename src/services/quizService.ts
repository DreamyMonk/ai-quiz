
import { db } from '@/lib/firebase';
import { collection, addDoc, getDoc, doc, Timestamp } from 'firebase/firestore';
import type { McqQuestion, GeneratedQuizData } from '@/types/quiz';

// Type for data being saved to Firestore (without the client-side 'id' which becomes the doc ID)
interface QuizDataToSave {
  topic: string;
  questions: McqQuestion[];
  durationMinutes: number;
  createdAt: Timestamp;
}

/**
 * Saves a new quiz to Firestore.
 * @param quizData The quiz data to save (topic, questions, duration).
 * @returns The ID of the newly created quiz document in Firestore.
 */
export async function saveQuiz(quizData: Omit<GeneratedQuizData, 'id' | 'createdAt'>): Promise<string> {
  try {
    console.log("Attempting to save quiz to Firestore:", quizData);
    const quizToSave: QuizDataToSave = {
      ...quizData,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, "quizzes"), quizToSave);
    console.log("Quiz saved successfully to Firestore with ID:", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("Error saving quiz to Firestore: ", error);
    console.error("Firebase error code:", error.code);
    console.error("Firebase error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log full error
    throw new Error("Failed to save quiz."); // Re-throw the generic error for the toast
  }
}

/**
 * Fetches a quiz by its ID from Firestore.
 * @param quizId The ID of the quiz document to fetch.
 * @returns The quiz data including its ID, or null if not found.
 */
export async function getQuizById(quizId: string): Promise<GeneratedQuizData | null> {
  try {
    console.log("Attempting to fetch quiz from Firestore. ID:", quizId);
    const docRef = doc(db, "quizzes", quizId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as QuizDataToSave; // Assume data matches this structure
      console.log("Quiz fetched successfully from Firestore. ID:", docSnap.id);
      return {
        id: docSnap.id,
        topic: data.topic,
        questions: data.questions,
        durationMinutes: data.durationMinutes,
        // Note: createdAt is a Firestore Timestamp. If you need it as a Date object on client:
        // createdAt: data.createdAt.toDate() 
        // For GeneratedQuizData, we might not strictly need createdAt, so omitting for simplicity unless specified.
      } as GeneratedQuizData; // Ensure all fields of GeneratedQuizData are mapped
    } else {
      console.warn("No such quiz document in Firestore! ID:", quizId);
      return null;
    }
  } catch (error: any) {
    console.error("Error fetching quiz from Firestore: ", error);
    console.error("Firebase error code:", error.code);
    console.error("Firebase error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log full error
    throw new Error("Failed to fetch quiz."); // Re-throw the generic error for the toast
  }
}
