import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MediaItem } from '../types';

export enum OperationType {
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

const MEDIA_COLLECTION = 'media';

export const mediaService = {
  /**
   * Upload a media item metadata to Firestore.
   * Note: In a real app, the file would be uploaded to Firebase Storage first,
   * and the resulting URL would be stored here. For this demo, we'll store
   * the base64 data as the URL.
   */
  async uploadMedia(file: File, base64Data: string): Promise<string> {
    if (!auth.currentUser) throw new Error('User must be authenticated to upload media.');

    const mediaData = {
      name: file.name,
      type: file.type,
      size: file.size,
      url: base64Data,
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const docRef = await addDoc(collection(db, MEDIA_COLLECTION), mediaData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, MEDIA_COLLECTION);
      return '';
    }
  },

  /**
   * Subscribe to the user's media library.
   */
  subscribeToMedia(callback: (media: MediaItem[]) => void) {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, MEDIA_COLLECTION),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const mediaItems: MediaItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MediaItem));
      callback(mediaItems);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, MEDIA_COLLECTION);
    });
  },

  /**
   * Delete a media item.
   */
  async deleteMedia(mediaId: string): Promise<void> {
    const path = `${MEDIA_COLLECTION}/${mediaId}`;
    try {
      await deleteDoc(doc(db, MEDIA_COLLECTION, mediaId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
