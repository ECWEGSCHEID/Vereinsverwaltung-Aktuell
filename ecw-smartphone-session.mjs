import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, updateCurrentUser
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig={
  apiKey:"AIzaSyDmK54G30_JK8ma8tJ7YWyza-OrdrUC24I",
  authDomain:"ec-wegscheid-verwaltung-neu.firebaseapp.com",
  projectId:"ec-wegscheid-verwaltung-neu",
  storageBucket:"ec-wegscheid-verwaltung-neu.firebasestorage.app",
  messagingSenderId:"558472054725",
  appId:"1:558472054725:web:10145e2d8d6f168b056dac"
};

const migrationKey = 'ecw-smartphone-session-migrated-v1';
let memberSession;

export function getMemberSession() {
  if (!memberSession) {
    const app = initializeApp(firebaseConfig, 'ecw-smartphone-mitglieder');
    const auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
    memberSession = {app, auth};
  }
  return memberSession;
}

export async function restoreMemberSession(auth) {
  await auth.authStateReady();
  try {
    if (localStorage.getItem(migrationKey)) return;
    // Only migrate once, so an explicit logout cannot restore an old session.
    localStorage.setItem(migrationKey, '1');
    if (auth.currentUser) return;

    const previousAuth = getAuth(initializeApp(firebaseConfig));
    await previousAuth.authStateReady();
    const user = previousAuth.currentUser;
    const isMember = /^ecw-mobile-[a-f0-9]{32}$/.test(user?.uid || '') ||
      user?.uid === 'n9MpiKXZNLap8wsbRcP4fVjrT4D2';
    if (isMember && !auth.currentUser) await updateCurrentUser(auth, user);
  } catch (error) {
    console.warn('Bisherige Smartphone-Sitzung konnte nicht übernommen werden:', error);
  }
}
