
import { db } from '@/lib/firebase'; // db can be null
import { collection, addDoc, getDoc, doc, Timestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { McqQuestion, GeneratedQuizData } from '@/types/quiz';
import { subDays } from 'date-fns';

// Type for data being saved to Firestore (without the client-side 'id' which becomes the doc ID)
interface QuizDataToSave {
  topic: string;
  questions: McqQuestion[];
  durationMinutes: number;
  createdAt: Timestamp;
  userId: string | null; 
}

function formatFirebaseError(error: any): string {
  let message = error.message || 'Unknown Firestore error';
  if (error.code === 'permission-denied') {
    message = 'Missing or insufficient permissions. Please check your Firestore security rules in the Firebase console.';
  } else if (error.code === 'unavailable') {
    message = 'Firestore is currently unavailable. The service might be offline or experiencing issues.';
  }
  console.error("Detailed Firebase Error: ", {
    code: error.code,
    message: error.message,
    fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
  });
  return message;
}

export async function saveQuiz(quizData: Omit<GeneratedQuizData, 'id' | 'createdAt' | 'userId'>, userId: string | null): Promise<string> {
  if (!db) {
    console.error("Firestore Service Error: Firestore is not initialized (db instance is null). Cannot save quiz.");
    throw new Error("Failed to save quiz: Firestore not available. Check Firebase initialization logs.");
  }
  try {
    console.log("Attempting to save quiz to Firestore:", quizData, "for user:", userId);
    const quizToSave: QuizDataToSave = {
      ...quizData,
      userId: userId,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, "quizzes"), quizToSave);
    console.log("Quiz saved successfully to Firestore with ID:", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("Error saving quiz to Firestore: ", error);
    const formattedError = formatFirebaseError(error);
    throw new Error(`Failed to save quiz: ${formattedError}`);
  }
}

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
      console.log("Quiz fetched successfully from Firestore. ID:", docSnap.id, "Data:", data);
      if (!data.questions || !data.topic || typeof data.durationMinutes === 'undefined') {
        console.error("Firestore data for quiz", quizId, "is missing essential fields:", data);
        throw new Error("Fetched quiz data is incomplete or malformed.");
      }
      return {
        id: docSnap.id,
        topic: data.topic,
        questions: data.questions,
        durationMinutes: data.durationMinutes,
        userId: data.userId || null,
        createdAt: data.createdAt,
      } as GeneratedQuizData;
    } else {
      console.warn("No such quiz document in Firestore! ID:", quizId);
      return null;
    }
  } catch (error: any) {
    console.error("Error fetching quiz from Firestore: ", error);
    const formattedError = formatFirebaseError(error);
    throw new Error(`Failed to fetch quiz: ${formattedError}`);
  }
}

export async function getRecentQuizzesByUserId(userId: string, daysLimit: number = 15): Promise<GeneratedQuizData[]> {
  if (!db) {
    console.error("Firestore Service Error: Firestore is not initialized. Cannot get recent quizzes.");
    throw new Error("Failed to get quizzes: Firestore not available.");
  }
  try {
    const fifteenDaysAgo = subDays(new Date(), daysLimit);
    const fifteenDaysAgoTimestamp = Timestamp.fromDate(fifteenDaysAgo);

    const q = query(
      collection(db, "quizzes"),
      where("userId", "==", userId),
      where("createdAt", ">=", fifteenDaysAgoTimestamp),
      orderBy("createdAt", "desc"),
      limit(20) // Optionally limit the number of quizzes fetched
    );

    const querySnapshot = await getDocs(q);
    const quizzes: GeneratedQuizData[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as QuizDataToSave;
      if (data.questions && data.topic && typeof data.durationMinutes !== 'undefined') {
        quizzes.push({
          id: docSnap.id,
          topic: data.topic,
          questions: data.questions,
          durationMinutes: data.durationMinutes,
          userId: data.userId,
          createdAt: data.createdAt,
        });
      } else {
        console.warn("Skipping malformed quiz document in recent quizzes:", docSnap.id, data);
      }
    });
    console.log(`Fetched ${quizzes.length} recent quizzes for user ${userId}`);
    return quizzes;
  } catch (error: any) {
    console.error("Error fetching recent quizzes for user:", userId, error);
    const formattedError = formatFirebaseError(error);
    throw new Error(`Failed to fetch recent quizzes: ${formattedError}`);
  }
}
