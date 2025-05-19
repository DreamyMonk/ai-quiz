
import { db } from '@/lib/firebase'; // db can be null
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
  if (!db) {
    console.error("Firestore Service Error: Firestore is not initialized (db instance is null). Cannot save quiz.");
    throw new Error("Failed to save quiz: Firestore not available. Check Firebase initialization logs.");
  }
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
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw new Error(`Failed to save quiz: ${error.message || 'Unknown Firestore error'}`);
  }
}

/**
 * Fetches a quiz by its ID from Firestore.
 * @param quizId The ID of the quiz document to fetch.
 * @returns The quiz data including its ID, or null if not found.
 */
export async function getQuizById(quizId: string): Promise<GeneratedQuizData | null> {
  if (!db) {
    console.error("Firestore Service Error: Firestore is not initialized (db instance is null). Cannot get quiz by ID.");
    throw new Error("Failed to get quiz: Firestore not available. Check Firebase initialization logs.");
  }
  try {
    console.log("Attempting to fetch quiz from Firestore. ID:", quizId);
    const docRef = doc(db, "quizzes", quizId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as QuizDataToSave;
      console.log("Quiz fetched successfully from Firestore. ID:", docSnap.id);
      return {
        id: docSnap.id,
        topic: data.topic,
        questions: data.questions,
        durationMinutes: data.durationMinutes,
      } as GeneratedQuizData;
    } else {
      console.warn("No such quiz document in Firestore! ID:", quizId);
      return null;
    }
  } catch (error: any) {
    console.error("Error fetching quiz from Firestore: ", error);
    console.error("Firebase error code:", error.code);
    console.error("Firebase error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw new Error(`Failed to fetch quiz: ${error.message || 'Unknown Firestore error'}`);
  }
}
