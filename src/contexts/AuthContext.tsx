import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import type { AppUser } from '../types';
import { DEFAULT_PERMISSIONS as defaultPerms } from '../types';

const SUPER_ADMINS = ['martinferreira@hca.edu.uy', 'stem@hca.edu.uy'];
const ALLOWED_DOMAIN = 'hca.edu.uy';

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = appUser
    ? SUPER_ADMINS.includes(appUser.email)
    : false;

  async function fetchOrCreateUser(user: User): Promise<AppUser | null> {
    if (!user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError('Solo se permiten cuentas del dominio @hca.edu.uy');
      await signOut(auth);
      return null;
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const isSA = SUPER_ADMINS.includes(user.email!);

    if (userSnap.exists()) {
      const data = userSnap.data() as AppUser;

      // Super admins always get access - fix their doc if needed
      if (isSA && (!data.active || data.role !== 'admin')) {
        const fixed = {
          ...data,
          role: 'admin' as const,
          active: true,
          permissions: { ...defaultPerms.admin },
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userRef, fixed, { merge: true });
        return { ...fixed, id: user.uid };
      }

      if (!data.active) {
        setError('Tu cuenta esta pendiente de activacion. Contacta al administrador.');
        await signOut(auth);
        return null;
      }
      return { ...data, id: user.uid };
    }

    // New user - create document
    const role = isSA ? 'admin' as const : 'usuario' as const;

    const newUser: AppUser = {
      id: user.uid,
      uid: user.uid,
      email: user.email!,
      displayName: user.displayName || user.email!,
      role,
      assignedSectors: [],
      permissions: { ...defaultPerms[role] },
      active: isSA, // Only super admins are auto-activated
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, newUser);

    if (!isSA) {
      setError('Tu cuenta ha sido creada pero está pendiente de activación. Contacta al administrador.');
      await signOut(auth);
      return null;
    }

    return newUser;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setError(null);
        try {
          const appUserData = await fetchOrCreateUser(user);
          setFirebaseUser(user);
          setAppUser(appUserData);
        } catch (err: any) {
          console.error('Error fetching user data:', err);
          setError('Error al cargar los datos del usuario.');
          setFirebaseUser(null);
          setAppUser(null);
        }
      } else {
        setFirebaseUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      if (err.code === 'auth/cancelled-popup-request') return;

      const errorMessages: Record<string, string> = {
        'auth/unauthorized-domain': 'Este dominio no esta autorizado en Firebase. Agrega este dominio en Authentication > Settings > Authorized domains.',
        'auth/operation-not-allowed': 'El proveedor de Google no esta habilitado en Firebase.',
        'auth/popup-blocked': 'El navegador bloqueo la ventana emergente. Permite las ventanas emergentes e intenta de nuevo.',
        'auth/internal-error': 'Error interno de Firebase. Verifica la configuracion del proyecto.',
      };

      setError(errorMessages[err.code] || `Error al iniciar sesion (${err.code || err.message})`);
      console.error('Auth error:', err.code, err.message);
    }
  }

  async function logout() {
    await signOut(auth);
    setAppUser(null);
    setFirebaseUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        loading,
        error,
        signInWithGoogle,
        logout,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
