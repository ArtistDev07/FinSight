import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile as updateFirebaseProfile,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserPreferences } from '../types';
import { apiFetch, registerUnauthorizedHandler } from '../utils/api';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  preferences: UserPreferences | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<UserProfile>;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<UserProfile>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<UserProfile | null>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (data: Partial<UserPreferences>) => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  id: 'pref-default',
  ownerId: '',
  financialYear: '2025-26',
  currency: 'INR',
  language: 'English',
  numberFormat: 'INDIAN',
  experienceLevel: 'Intermediate',
  explanationLevel: 'Balanced',
  selectedFeatures: ['Budgeting', 'Investments', 'Markets', 'Tax', 'Fraud', 'Business'],
  notificationPreferences: {
    budgetAlerts: true,
    spendingAlerts: true,
    securityAlerts: true,
    taxReminders: true,
    businessReminders: true,
    productUpdates: false,
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function formatFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 10 characters with letters and numbers.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing authentication.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console. Please use "Continue with Google" or enable Email/Password under Authentication > Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorized in Firebase Authentication settings.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Clean up any legacy untrusted localStorage credentials
  useEffect(() => {
    try {
      localStorage.removeItem('finsight_user_id');
    } catch {
      // Ignore storage access restrictions
    }
  }, []);

  const syncProfileFromBackend = useCallback(async (fbUser: FirebaseUser): Promise<UserProfile> => {
    let token = await fbUser.getIdToken();
    let res = await globalThis.fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 401) {
      token = await fbUser.getIdToken(true);
      res = await globalThis.fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json?.error?.message || 'Unable to verify authenticated session.');
    }
    const verifiedProfile = json.data as UserProfile;
    const verifiedPreferences = (json.preferences as UserPreferences) || {
      ...defaultPreferences,
      ownerId: verifiedProfile.uid,
    };
    setUser(verifiedProfile);
    setPreferences(verifiedPreferences);
    return verifiedProfile;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (auth.currentUser) {
        await apiFetch('/api/v1/auth/revoke', { method: 'POST' }).catch(() => undefined);
      }
      await signOut(auth);
    } finally {
      setFirebaseUser(null);
      setUser(null);
      setPreferences(null);
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      setAuthError('Your session expired or was revoked. Please sign in again.');
      await signOut(auth);
      setFirebaseUser(null);
      setUser(null);
      setPreferences(null);
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsLoading(true);
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setPreferences(null);
        setIsLoading(false);
        return;
      }
      try {
        await syncProfileFromBackend(fbUser);
        setAuthError(null);
      } catch (err) {
        console.error('Session verification failed:', err);
        setUser(null);
        setPreferences(null);
        setAuthError(err instanceof Error ? err.message : 'Unable to verify session.');
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncProfileFromBackend]);

  const signInWithGoogle = async (): Promise<UserProfile> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(credential.user);
      const profile = await syncProfileFromBackend(credential.user);
      return profile;
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setFirebaseUser(credential.user);
      const profile = await syncProfileFromBackend(credential.user);
      return profile;
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (fullName: string, email: string, password: string): Promise<UserProfile> => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (fullName.trim()) {
        await updateFirebaseProfile(credential.user, { displayName: fullName.trim() });
      }
      await sendEmailVerification(credential.user).catch(() => undefined);
      // Force token refresh so displayName is reflected in claims
      await credential.user.getIdToken(true);
      setFirebaseUser(credential.user);
      await syncProfileFromBackend(credential.user);
      if (fullName.trim()) {
        const res = await apiFetch('/api/v1/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: fullName.trim() }),
        });
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setUser(json.data);
          return json.data as UserProfile;
        }
      }
      return await syncProfileFromBackend(credential.user);
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const sendResetEmail = async (email: string): Promise<void> => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerificationEmail = async (): Promise<void> => {
    setAuthError(null);
    if (!auth.currentUser) {
      throw new Error('Please sign in first to resend your verification email.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const refreshUserProfile = async (): Promise<UserProfile | null> => {
    if (!auth.currentUser) return null;
    return await syncProfileFromBackend(auth.currentUser);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !auth.currentUser) return;
    const res = await apiFetch('/api/v1/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setUser(json.data);
    }
  };

  const updatePreferences = async (data: Partial<UserPreferences>) => {
    if (!auth.currentUser) {
      setPreferences(prev => (prev ? { ...prev, ...data } : { ...defaultPreferences, ...data, ownerId: user?.uid || '' }));
      return;
    }
    const res = await apiFetch('/api/v1/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setPreferences(json.data as UserPreferences);
    } else {
      throw new Error(json?.error?.message || 'Failed to save preferences.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        preferences,
        isAuthenticated: !!firebaseUser && !!user,
        isAdmin: user?.role === 'ADMIN',
        isLoading,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendResetEmail,
        resendVerificationEmail,
        logout,
        refreshUserProfile,
        updateProfile,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
