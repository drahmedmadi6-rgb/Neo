// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// مفاتيح الربط الخاصة بمشروعك (friends-clinic)
const firebaseConfig = {
  apiKey: "AIzaSyDJ2PMemkLDrVWS2PMH9z7glG-yK0QDNsg",
  authDomain: "friends-clinic.firebaseapp.com",
  projectId: "friends-clinic",
  storageBucket: "friends-clinic.firebasestorage.app",
  messagingSenderId: "741063199735",
  appId: "1:741063199735:web:d191a36a4c1900a38bbcf2",
  measurementId: "G-CKMCE2QRHG"
};

// تهيئة خدمات فايربيز
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// تصدير المتغيرات للاستخدام في باقي الملفات
export { app, db };
