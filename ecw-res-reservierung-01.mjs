
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDenrIxdKTt7cB4DrdoRJCYsVD7kf6sLhY",
            authDomain: "reservierungssystem-wegscheid.firebaseapp.com",
            projectId: "reservierungssystem-wegscheid",
            storageBucket: "reservierungssystem-wegscheid.firebasestorage.app",
            messagingSenderId: "170549358955",
            appId: "1:170549358955:web:889bc5ee9b5384afbedc2e"
        };

        try {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);
            window.db = db;
            window.collection = collection;
            window.getDocs = getDocs;
            window.setDoc = setDoc;
            window.doc = doc;
            window.deleteDoc = deleteDoc;
            window.firebaseReady = true;
        } catch(e) {
            console.warn("Firebase konnte nicht initialisiert werden:", e);
            window.firebaseReady = false;
        }
    