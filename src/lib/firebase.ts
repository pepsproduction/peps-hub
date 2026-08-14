import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth, type User } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import type { AppState } from '../types';
import { normalizeAppState, recoverIncompleteCloudState } from './storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.storageBucket
  && firebaseConfig.messagingSenderId
  && firebaseConfig.appId,
);

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestore: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

if (firebaseEnabled) {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
  firebaseStorage = getStorage(firebaseApp);

  if (import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true') {
    connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199);
  }
}

export const auth = firebaseAuth;
export const cloudDb = firestore;
export const storage = firebaseStorage;
export const cloudStateRef = firestore ? doc(firestore, 'appState', 'pepshub-v2') : null;
const legacyCloudStateRef = firestore ? doc(firestore, 'appState', 'pepshub') : null;
export let cloudStateNeedsBootstrap = false;

export function observeAuth(onUser: (user: User | null) => void): Unsubscribe {
  if (!firebaseAuth) return () => undefined;
  return onAuthStateChanged(firebaseAuth, onUser);
}

export function observeCloudState(onState: (state: AppState | null) => void, onError: (error: Error) => void): Unsubscribe {
  if (!cloudStateRef || !legacyCloudStateRef) return () => undefined;
  let fallbackRequest = 0;
  const unsubscribe = onSnapshot(cloudStateRef, (snapshot) => {
    if (snapshot.exists()) {
      fallbackRequest += 1;
      cloudStateNeedsBootstrap = false;
      onState(normalizeAppState(snapshot.data()));
      return;
    }
    const requestId = ++fallbackRequest;
    void getDoc(legacyCloudStateRef).then((legacySnapshot) => {
      if (requestId !== fallbackRequest) return;
      const legacyState = legacySnapshot.exists() ? normalizeAppState(legacySnapshot.data()) : null;
      const recoveredState = legacyState ? recoverIncompleteCloudState(legacyState) : null;
      cloudStateNeedsBootstrap = true;
      onState(recoveredState);
    }).catch((error: unknown) => onError(error instanceof Error ? error : new Error('อ่านข้อมูล Firebase ไม่สำเร็จ')));
  }, (error) => onError(error));
  return () => {
    fallbackRequest += 1;
    unsubscribe();
  };
}

export async function persistCloudState(state: AppState): Promise<void> {
  if (!cloudStateRef) throw new Error('Firebase ยังไม่ได้ตั้งค่า');
  await setDoc(cloudStateRef, {
    events: state.events,
    teams: state.teams,
    photoEvents: state.photoEvents,
    photos: state.photos,
    matchPairs: state.matchPairs,
    promoSlides: state.promoSlides,
    updatedAt: serverTimestamp(),
  });
}

export async function signInAdmin(email: string, password: string): Promise<User> {
  if (!firebaseAuth) throw new Error('Firebase ยังไม่ได้ตั้งค่า');
  const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  if (firebaseAuth) await signOut(firebaseAuth);
}

export async function persistImage(image: string, path: string): Promise<string> {
  if (!firebaseStorage || !image.startsWith('data:')) return image;
  const imageRef = ref(firebaseStorage, path);
  await uploadString(imageRef, image, 'data_url');
  return getDownloadURL(imageRef);
}
