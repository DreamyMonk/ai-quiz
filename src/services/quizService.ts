
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
    const quizToSave: QuizDataToSave = {
      ...quizData,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, "quizzes"), quizToSave);
    return docRef.id;
  } catch (error) {
    console.error("Error saving quiz to Firestore: ", error);
    throw new Error("Failed to save quiz.");
  }
}

/**
 * Fetches a quiz by its ID from Firestore.
 * @param quizId The ID of the quiz document to fetch.
 * @returns The quiz data including its ID, or null if not found.
 */
export async function getQuizById(quizId: string): Promise<GeneratedQuizData | null> {
  try {
    const docRef = doc(db, "quizzes", quizId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as QuizDataToSave; // Assume data matches this structure
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
      console.log("No such quiz document!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching quiz from Firestore: ", error);
    throw new Error("Failed to fetch quiz.");
  }
}
