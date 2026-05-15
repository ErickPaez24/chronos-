import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    // Bootstrap Admin user if not exists
    const tryBootstrap = async () => {
      try {
        await signInWithEmailAndPassword(auth, 'admin@chronosabc.com', '121517');
      } catch (e: any) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          // Attempt to create it
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, 'admin@chronosabc.com', '121517');
            // Write to users collection
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              username: 'admin',
              role: 'ADMIN',
              name: 'Administrador Principal',
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch(err) {
            console.error("Bootstrap error:", err);
          }
        }
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
