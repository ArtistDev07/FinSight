import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId;
  if (typeof window === 'undefined') {
    return getFirestore(app, databaseId);
  }
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      databaseId
    );
  } catch {
    return getFirestore(app, databaseId);
  }
}

export const auth = getAuth(app);
export const db = createFirestoreInstance();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function waitForAuthReady(): Promise<void> {
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
}

async function testFirestoreConnection() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Retry once after a short delay to avoid false-positive offline errors during initial page boot
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (retryError) {
        if (retryError instanceof Error && retryError.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration: client is offline.');
        }
      }
    }
  }
}

if (typeof window !== 'undefined') {
  void testFirestoreConnection();
}

export default app;
