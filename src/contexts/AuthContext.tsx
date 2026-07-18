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
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
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

      // Super admins always get admin access
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

      // Enforce deactivation: si un admin desactivo la cuenta, no puede entrar
      if (!data.active) {
        setError('Tu cuenta esta desactivada. Contacta a un administrador.');
        await signOut(auth);
        return null;
      }

      return { ...data, id: user.uid };
    }

    // New user - all @hca.edu.uy users are auto-activated
    const role = isSA ? 'admin' as const : 'usuario' as const;

    const newUser: AppUser = {
      id: user.uid,
      uid: user.uid,
      email: user.email!,
      displayName: user.displayName || user.email!,
      role,
      assignedSectors: [],
      permissions: { ...defaultPerms[role] },
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, newUser);
    return newUser;
  }

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      unsubUserDoc?.();
      unsubUserDoc = null;

      if (user) {
        setError(null);
        try {
          const appUserData = await fetchOrCreateUser(user);
          setFirebaseUser(user);
          setAppUser(appUserData);

          if (appUserData) {
            // Suscripcion al documento del usuario: los cambios de rol,
            // permisos o desactivacion aplican sin necesidad de re-login.
            const userRef = doc(db, 'users', user.uid);
            unsubUserDoc = onSnapshot(userRef, (snap) => {
              if (!snap.exists()) return;
              const data = snap.data() as AppUser;
              if (!data.active && !SUPER_ADMINS.includes(data.email)) {
                setError('Tu cuenta fue desactivada. Contacta a un administrador.');
                signOut(auth);
                return;
              }
              setAppUser({ ...data, id: snap.id });
            });
          }
        } catch (err) {
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

    return () => {
      unsubUserDoc?.();
      unsub();
    };
  }, []);

  async function signInWithGoogle() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      const message = err instanceof Error ? err.message : String(err);
      if (code === 'auth/popup-closed-by-user') return;
      if (code === 'auth/cancelled-popup-request') return;

      const errorMessages: Record<string, string> = {
        'auth/unauthorized-domain': 'Este dominio no esta autorizado en Firebase. Agrega este dominio en Authentication > Settings > Authorized domains.',
        'auth/operation-not-allowed': 'El proveedor de Google no esta habilitado en Firebase.',
        'auth/popup-blocked': 'El navegador bloqueo la ventana emergente. Permite las ventanas emergentes e intenta de nuevo.',
        'auth/internal-error': 'Error interno de Firebase. Verifica la configuracion del proyecto.',
      };

      setError(errorMessages[code] || `Error al iniciar sesion (${code || message})`);
      console.error('Auth error:', code, message);
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
