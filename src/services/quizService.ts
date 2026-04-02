import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Quiz } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to remove undefined values for Firestore
function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

export const quizService = {
  async saveQuiz(quiz: Quiz): Promise<void> {
    if (!auth.currentUser) throw new Error('User must be authenticated to save quizzes');
    
    const path = `quizzes/${quiz.id}`;
    try {
      const now = new Date().toISOString();
      const quizToSave = cleanForFirestore({
        ...quiz,
        userId: auth.currentUser.uid,
        createdAt: quiz.createdAt || now,
        updatedAt: now
      });
      await setDoc(doc(db, 'quizzes', quiz.id), quizToSave);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getQuiz(id: string): Promise<Quiz | null> {
    const path = `quizzes/${id}`;
    try {
      const docRef = doc(db, 'quizzes', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as Quiz;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async deleteQuiz(id: string): Promise<void> {
    const path = `quizzes/${id}`;
    console.log(`Attempting to delete quiz: ${id}`);
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      console.log(`Successfully deleted quiz: ${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeToUserQuizzes(callback: (quizzes: Quiz[]) => void) {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }

    const path = 'quizzes';
    const q = query(
      collection(db, 'quizzes'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const quizzes = snapshot.docs.map(doc => doc.data() as Quiz);
      callback(quizzes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
};
