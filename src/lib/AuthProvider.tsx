import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirebaseError, OperationType } from './firebase-error';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Bootstrap Admin user only if not already present in Firestore
    const tryBootstrap = async () => {
      try {
        if (auth.currentUser) return;

        const existingAdmin = await getDocs(
          query(collection(db, 'users'), where('username', '==', 'admin'), limit(1))
        );
        if (!existingAdmin.empty) return;

        try {
          const cred = await signInWithEmailAndPassword(auth, 'admin@chronosabc.com', '121517');
          const adminRef = doc(db, 'users', cred.user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              username: 'admin',
              role: 'ADMIN',
              name: 'Administrador Principal',
              isActive: true,
              hasBiometric: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } catch (e: any) {
          if (e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential') {
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, 'admin@chronosabc.com', '121517');
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                username: 'admin',
                role: 'ADMIN',
                name: 'Administrador Principal',
                isActive: true,
                hasBiometric: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            } catch (err: any) {
              if (err?.code !== 'auth/email-already-in-use') {
                console.error("Bootstrap error:", err);
              }
            }
          }
        }
      } catch {
        // Ignore bootstrap check failures when offline or unconfigured
      }
    };
    
    tryBootstrap();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (error) {
          handleFirebaseError(error, OperationType.GET, 'users');
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
