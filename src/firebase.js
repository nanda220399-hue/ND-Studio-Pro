import { initializeApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase (Only for Hosting context if needed)
const app = initializeApp(firebaseConfig);

export { app };
