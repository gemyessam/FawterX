import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// إعدادات الربط الحقيقية لمشروع FawterX
const firebaseConfig = {
  apiKey: "AIzaSyAHXP9dCYVjCjuJ53UCoYhN4oRjvf0T06k",
  authDomain: "fawterx.firebaseapp.com",
  projectId: "fawterx",
  storageBucket: "fawterx.firebasestorage.app",
  messagingSenderId: "584730659246",
  appId: "1:584730659246:web:b1ab9f35d60c23db24203f",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged };
