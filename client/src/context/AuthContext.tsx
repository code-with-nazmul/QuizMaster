import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  totalQuizzes: number;
  averageScore: number;
  isAdmin?: boolean;
  categoryPerformance?: {
    [key: string]: { correct: number; total: number };
  };
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileData: (displayName: string, photoURL: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase Auth state change
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Setup a real-time listener for user profile document
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        const unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Profile doesn't exist yet, create one
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Guest User',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || 'https://api.dicebear.com/7.x/bottts/png?seed=' + currentUser.uid,
              totalQuizzes: 0,
              averageScore: 0,
              isAdmin: currentUser.email === 'admin@quizmaster.com', // Set admin@quizmaster.com as admin by default
              createdAt: new Date(),
              categoryPerformance: {}
            };
            
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile snapshot:", error);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Update firebase user display name
      await firebaseUpdateProfile(userCredential.user, { displayName });
      
      // Initialize firestore document
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        displayName,
        email,
        photoURL: 'https://api.dicebear.com/7.x/bottts/png?seed=' + userCredential.user.uid,
        totalQuizzes: 0,
        averageScore: 0,
        isAdmin: email === 'admin@quizmaster.com',
        createdAt: new Date(),
        categoryPerformance: {}
      };
      await setDoc(userDocRef, newProfile);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    await firebaseSignOut(auth);
  };

  const updateProfileData = async (displayName: string, photoURL: string) => {
    if (!user) throw new Error("No user is signed in.");
    
    // Update Firebase Auth details
    await firebaseUpdateProfile(user, { displayName, photoURL });
    
    // Update Firestore details
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { displayName, photoURL }, { merge: true });
  };

  const isAdmin = profile?.isAdmin || false;

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin,
      signIn, 
      signUp, 
      signOut, 
      updateProfileData 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
