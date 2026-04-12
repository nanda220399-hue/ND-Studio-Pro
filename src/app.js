import { auth, db, googleProvider } from './firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, query, where, serverTimestamp, getDocFromServer } from 'firebase/firestore';

/**
 * ND Studio Pro - Core Logic (Fixed Functionality)
 * Vanilla JS State-Driven Architecture
 */

// --- STATE MANAGEMENT ---
let state = {
    apiKey: '',
    activeGenerator: 'kling-v3-std',
    uploadedFiles: { image: null, video: null },
    uploadedUrls: { image: '', video: '' },
    uploading: { image: false, video: false },
    generatorUploads: {}, // Per-generator upload state
    generatorPrompts: {}, // Per-generator prompt state
    currentPrompt: '',
    settings: {
        orientation: 'video',
        cfg_scale: 0.5,
        aspect_ratio: '16:9',
        resolution: '360p',
        duration: '5',
        motion: 5,
        negative_prompt: 'blur, distort, and low quality',
        strength: 0.5,
        guidance_scale: 7.5,
        steps: 25,
        seed: '',
        style: 'Realistic',
        voice: 'URAuwR59OqCASDVp35yi',
        stability: 0.5,
        similarity_boost: 0.2,
        speed: 1,
        use_speaker_boost: true,
        music_duration: '30'
    },
    activeTasks: [],
    completedResults: [],
    generationHistory: [], // Tracks timestamps of generated tasks for queue limit
    cooldownUntil: 0, // Tracks when the user can generate again
    taskLimit: 10,
    queueLimit: 10,
    toasts: [],
    showSetup: false,
    globalError: null,
    currentUser: null,
    userDoc: null,
    isAuthLoading: true,
    allUsers: [], // For admin dashboard
    isAdmin: false,
    showAdminDashboard: false,
    showApiKey: false,
    musicSelections: {
        genre: '',
        mood: '',
        instruments: [],
        tempo: ''
    }
};

// --- FIRESTORE ERROR HANDLING ---

const OperationType = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    if (errInfo.error.includes('the client is offline')) {
        showToast("❌ Koneksi Database Gagal. Silakan hubungi Admin.", "error");
    } else if (errInfo.error.includes('insufficient permissions')) {
        showToast("❌ Akses Ditolak. Anda tidak memiliki izin.", "error");
    } else {
        showToast("❌ Terjadi kesalahan database.", "error");
    }
    
    throw new Error(JSON.stringify(errInfo));
}

async function testFirestoreConnection() {
    try {
        // Test connection to a dummy path
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection test successful.");
    } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("CRITICAL: Firestore configuration is incorrect or client is offline.");
            state.globalError = "Koneksi database gagal. Silakan hubungi Admin untuk perbaikan konfigurasi.";
            renderContent();
        }
    }
}

// --- CONFIG & GENERATORS ---
const GENERATORS = [
    {
        id: 'kling-v2-6-motion-control-std',
        name: 'Kling 2.6 Motion Control (Std)',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V2.6',
        description: 'Kling 2.6 Standard - Motion Control: Transfer gerakan dari video ke gambar.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { orientation: true, cfg: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v2-6-motion-control-std',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6',
        pollingType: 'path'
    },
    {
        id: 'kling-v2-6-motion-control-pro',
        name: 'Kling 2.6 Motion Control (Pro)',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V2.6 PRO',
        description: 'Kling 2.6 Pro - Motion Control: Kualitas lebih tinggi dan gerakan lebih presisi.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { orientation: true, cfg: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v2-6-motion-control-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6',
        pollingType: 'path'
    },
    {
        id: 'kling-v3-motion-control-std',
        name: 'Kling 3 Motion Control (Std)',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V3 MC',
        description: 'Kling 3 Standard - Motion control video: Transfer motion from a reference video to a character image.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { orientation: true, cfg: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-motion-control-std',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-motion-control-std',
        pollingType: 'path'
    },
    {
        id: 'kling-v3-motion-control-pro',
        name: 'Kling 3 Motion Control (Pro)',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V3 MC PRO',
        description: 'Kling 3 Pro - Motion control video: Transfer motion from a reference video to a character image.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { orientation: true, cfg: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro',
        pollingType: 'path'
    },
    {
        id: 'pixverse-v5',
        name: 'Pixverse V5',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V5',
        description: 'Pixverse V5 - Image to Video: High-quality video generation with advanced motion control.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { resolution: true, duration: 'pixverse', negative_prompt: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5',
        pollingType: 'path'
    },
    {
        id: 'seedance-1-5-pro',
        name: 'Seedance 1.5 Pro',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'PRO',
        description: 'Seedance 1.5 Pro - High-quality AI video generation with audio and camera control.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: 'seedance', duration: 'seedance', generate_audio: true, camera_fixed: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/seedance-1-5-pro-720p',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/seedance-1-5-pro-720p',
        pollingType: 'path'
    },
    {
        id: 'flux-2-pro',
        name: 'Flux 2 Pro',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'PRO',
        description: 'Flux 2 Pro - High-quality image generation with realistic, cinematic, and ultra-detailed styles.',
        inputs: ['prompt'],
        outputType: 'image',
        settings: { style: true, aspect_ratio: 'flux', cfg: true, steps: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro',
        pollingType: 'path'
    },
    {
        id: 'flux-2-turbo',
        name: 'Flux 2 Turbo',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'TURBO',
        description: 'Flux 2 Turbo - Speed-optimized version of Flux 2 for fast, high-quality image generation.',
        inputs: ['prompt'],
        outputType: 'image',
        settings: { aspect_ratio: 'flux', guidance_scale: true, seed: true, safety_checker: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/flux-2-turbo',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/flux-2-turbo',
        pollingType: 'path'
    },
    {
        id: 'kling-v3-std',
        name: 'Kling 3 Standard',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V3 STD',
        description: 'Kling 3 Standard - Generate video: AI video generation with text or image guidance.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: true, duration: true, cfg: true, negative_prompt: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-std',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-v3',
        pollingType: 'path'
    },
    {
        id: 'kling-v3-omni-pro',
        name: 'Kling 3 Omni Pro',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'OMNI PRO',
        description: 'Kling 3 Omni Pro - Generate video from text or image with advanced multi-modal capabilities.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: true, duration: true, generate_audio: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-omni-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-omni',
        pollingType: 'path'
    },
    {
        id: 'kling-v3-pro',
        name: 'Kling 3 Pro',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V3 PRO',
        description: 'Kling 3 Pro - High Quality: AI video generation with superior quality and longer duration.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: true, duration: true, cfg: true, negative_prompt: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-v3',
        pollingType: 'path'
    },
    {
        id: 'seedream-4-5-edit',
        name: 'SeeDream 4.5 Edit',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'V4.5',
        description: 'SeeDream 4.5 Edit: High-fidelity Text-to-Image generation with reference images. Preserves subject details and style while editing.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'image',
        settings: { aspect_ratio: 'seedream', seed: true, safety_checker: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit',
        pollingType: 'path'
    },
    {
        id: 'runway',
        name: 'Runway',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Runway - High-quality text-to-image generation.',
        inputs: ['prompt'],
        outputType: 'image',
        settings: { aspect_ratio: 'runway', seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/runway',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/runway',
        pollingType: 'path'
    },
    {
        id: 'elevenlabs-turbo-v2-5',
        name: 'Voice Over',
        icon: '<div class="tool-icon-container tool-icon-audio"><i data-lucide="mic" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Voice Over - High-quality AI voice generation using ElevenLabs Turbo v2.5.',
        inputs: ['prompt'],
        outputType: 'audio',
        settings: { voice: true, stability: true, similarity_boost: true, speed: true, use_speaker_boost: true },
        endpoint: 'https://api.freepik.com/v1/ai/voiceover/elevenlabs-turbo-v2-5',
        statusEndpoint: 'https://api.freepik.com/v1/ai/voiceover/elevenlabs-turbo-v2-5',
        pollingType: 'path'
    },
    {
        id: 'music-generation',
        name: 'Music Generation',
        icon: '<div class="tool-icon-container tool-icon-audio"><i data-lucide="music" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Music Generation - Create high-quality AI music from text prompts.',
        inputs: ['prompt'],
        outputType: 'audio',
        settings: { music_duration: true },
        endpoint: 'https://api.freepik.com/v1/ai/music-generation',
        statusEndpoint: 'https://api.freepik.com/v1/ai/music-generation',
        pollingType: 'path'
    }
];


// --- AUTH FUNCTIONS ---

function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        state.currentUser = user;
        state.isAuthLoading = false;
        
        if (user) {
            // Check if user is admin based on email
            state.isAdmin = user.email === "nanda220399@gmail.com";
            
            // Get or create user document
            const userRef = doc(db, 'users', user.uid);
            let userSnap;
            try {
                userSnap = await getDoc(userRef);
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, 'users/' + user.uid);
            }
            
            if (!userSnap.exists()) {
                const newUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isApproved: state.isAdmin, // Admin is auto-approved
                    role: state.isAdmin ? 'admin' : 'user',
                    apiKey: '',
                    createdAt: serverTimestamp()
                };
                try {
                    await setDoc(userRef, newUser);
                } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, 'users/' + user.uid);
                }
                state.userDoc = newUser;
            } else {
                state.userDoc = userSnap.data();
                // If user is admin but role is not set, update it
                if (state.isAdmin && (state.userDoc.role !== 'admin' || !state.userDoc.isApproved)) {
                    try {
                        await updateDoc(userRef, { role: 'admin', isApproved: true });
                    } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, 'users/' + user.uid);
                    }
                }
            }

            // Listen for changes to user document (e.g. approval)
            onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                    state.userDoc = doc.data();
                    state.apiKey = state.userDoc.apiKey || '';
                    renderContent();
                }
            }, (error) => {
                handleFirestoreError(error, OperationType.GET, 'users/' + user.uid);
            });

            // If admin, listen for all users
            if (state.isAdmin) {
                onSnapshot(collection(db, 'users'), (snapshot) => {
                    state.allUsers = snapshot.docs.map(doc => doc.data());
                    renderContent();
                }, (error) => {
                    handleFirestoreError(error, OperationType.LIST, 'users');
                });
            }
        } else {
            state.userDoc = null;
            state.isAdmin = false;
        }
        
        renderContent();
    });
}

async function login() {
    try {
        await signInWithPopup(auth, googleProvider);
        showToast("✅ Berhasil login!", "success");
    } catch (error) {
        console.error("Login Error:", error);
        showToast("❌ Gagal login: " + error.message, "error");
    }
}

async function logout() {
    try {
        await signOut(auth);
        showToast("👋 Berhasil logout!", "info");
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

async function approveUser(uid) {
    if (!state.isAdmin) return;
    try {
        await updateDoc(doc(db, 'users', uid), { isApproved: true });
        showToast("✅ Pengguna disetujui!", "success");
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'users/' + uid);
    }
}

async function rejectUser(uid) {
    if (!state.isAdmin) return;
    try {
        await updateDoc(doc(db, 'users', uid), { isApproved: false });
        showToast("⚠️ Akses pengguna dicabut.", "warning");
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'users/' + uid);
    }
}

async function deleteUserAccount(uid) {
    if (!state.isAdmin) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
        showToast("🗑️ Akun pengguna berhasil dihapus.", "success");
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'users/' + uid);
    }
}

async function clearCloudinaryStorage() {
    if (!state.isAdmin) return;
    const btn = document.getElementById('btn-clear-cloudinary');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Menghapus...';
        if (window.lucide) lucide.createIcons();
    }
    
    try {
        const response = await fetch('/api/admin/clear-cloudinary', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showToast("✅ Berhasil mengosongkan storage Cloudinary.", "success");
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error("Clear Cloudinary error:", error);
        showToast("❌ Gagal menghapus storage: " + error.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="trash-2"></i> Kosongkan Storage Cloudinary';
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function toggleApiKeyVisibility() {
    state.showApiKey = !state.showApiKey;
    renderContent();
}

async function saveApiKey() {
    if (!state.currentUser) return;
    const input = document.getElementById('api-key-input');
    const key = input ? input.value.trim() : '';
    
    try {
        await updateDoc(doc(db, 'users', state.currentUser.uid), { apiKey: key });
        state.apiKey = key;
        state.showSetup = false;
        
        if (key) {
            showToast("✅ API Key tersimpan aman!", "success");
        } else {
            showToast("ℹ️ API Key telah dihapus.", "info");
        }
        renderContent();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'users/' + state.currentUser.uid);
    }
}

async function fetchWithProxy(url, options = {}) {
    const proxies = [
        // Path 1: Direct (Might work if Freepik updates CORS)
        { type: 'direct', url: url },
        // Path 2: ThingProxy (Good for POST with headers)
        { type: 'thingproxy', url: `https://thingproxy.freeboard.io/fetch/${url}` },
        // Path 3: CorsProxy.io
        { type: 'corsproxy', url: `https://corsproxy.io/?${encodeURIComponent(url)}` },
        // Path 4: Cloudflare Worker Proxy (Generic fallback)
        { type: 'worker', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }
    ];

    let lastError = null;

    for (const proxy of proxies) {
        try {
            console.log(`Trying ${proxy.type} fetch to: ${url}`);
            
            // For allorigins, we can only do GET reliably
            if (proxy.type === 'worker' && options.method === 'POST') continue;

            const response = await fetch(proxy.url, options);
            
            // If we get a valid response (even if it's an API error like 400/401), return it
            // We only want to retry on network errors or 5xx errors
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }
            
            lastError = new Error(`Proxy ${proxy.type} returned status ${response.status}`);
        } catch (e) {
            console.warn(`${proxy.type} fetch failed:`, e.message);
            lastError = e;
        }
    }

    throw lastError || new Error("Gagal menghubungi server API. Silakan coba gunakan VPN atau ganti koneksi internet.");
}

function getUploadState() {
    if (!state.generatorUploads[state.activeGenerator]) {
        state.generatorUploads[state.activeGenerator] = {
            files: { image: null, video: null },
            urls: { image: '', video: '' },
            uploading: { image: false, video: false },
            autoUploaded: { image: false, video: false }
        };
    }
    // Ensure autoUploaded exists for older states
    if (!state.generatorUploads[state.activeGenerator].autoUploaded) {
        state.generatorUploads[state.activeGenerator].autoUploaded = { image: false, video: false };
    }
    return state.generatorUploads[state.activeGenerator];
}

// --- INITIALIZATION ---
function init() {
    console.log("ND Studio Pro: Initializing...");
    testFirestoreConnection();
    renderContent();
    
    // Start real-time progress simulation
    startProgressSimulation();
    
    // Global Listeners for Modal (if still in HTML)
    const btnAgree = document.getElementById('btn-agree');
    if (btnAgree) btnAgree.addEventListener('click', acceptDisclaimer);
    
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => toggleModal('modal-disclaimer', false));

    // Listen for authentication completion from popup
    window.addEventListener('message', (event) => {
        if (event.data === 'auth_complete') {
            showToast("✅ Autentikasi berhasil! Silakan coba upload kembali.", "success");
        }
    });

    checkDisclaimer();
    console.log("ND Studio Pro: Initialization complete.");
}

function startProgressSimulation() {
    setInterval(() => {
        let changed = false;
        state.activeTasks.forEach(task => {
            if (task.progress < 98) {
                // Random small increment to feel real-time
                const inc = Math.random() * 2.5; // Faster increment
                task.progress = Math.min(98, task.progress + inc);
                changed = true;
            }
        });
        if (changed) {
            updateTasksAndResultsDOM();
        }
    }, 1000);
}

// --- CORE FUNCTIONS ---

function renderContent() {
    try {
        const app = document.getElementById('app');
        if (!app) {
            console.error("Element #app not found!");
            return;
        }

        // 1. Loading State
        if (state.isAuthLoading) {
            app.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 20px; background: #0a0a0a;">
                    <div class="spinner" style="width: 40px; height: 40px; border: 4px solid rgba(212, 175, 55, 0.1); border-top: 4px solid var(--accent-gold); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="color: var(--text-muted); font-size: 14px; font-weight: 500;">Menghubungkan ke ND STUDIO...</p>
                    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                </div>
            `;
            return;
        }

        // 2. Login Page
        if (!state.currentUser) {
            app.innerHTML = `
                ${renderHeader()}
                <main>
                    ${renderLoginPage()}
                </main>
                ${renderFooter()}
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // 3. Pending Approval Page
        if (!state.userDoc?.isApproved) {
            app.innerHTML = `
                ${renderHeader()}
                <main>
                    ${renderPendingPage()}
                </main>
                ${renderFooter()}
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // 4. Admin Dashboard
        if (state.isAdmin && state.showAdminDashboard) {
            app.innerHTML = `
                ${renderHeader()}
                <main>
                    ${renderUsageStats()}
                    ${renderAdminDashboard()}
                </main>
                ${renderFooter()}
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // 5. Setup Page (API Key)
        if (!state.apiKey || state.showSetup) {
            app.innerHTML = `
                ${renderHeader()}
                <main>
                    ${renderGlobalError()}
                    ${renderUsageStats()}
                    ${renderSetupPage()}
                </main>
                ${renderFooter()}
            `;
        } else {
            const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
            app.innerHTML = `
                ${renderHeader()}
                <main>
                    ${renderGlobalError()}
                    ${renderUsageStats()}
                    ${renderModelSelector()}
                    ${renderModelInfo(activeGen)}
                    <div class="upload-section-wrapper">${renderUploadSection(activeGen)}</div>
                    ${renderPromptSection()}
                    ${renderSettings(activeGen)}
                    ${renderGenerateButton(activeGen)}
                    <div id="active-tasks-container">${renderActiveTasks()}</div>
                    <div id="results-container">${renderResults()}</div>
                </main>
                ${renderFooter()}
            `;
        }

        // Re-initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    } catch (error) {
        console.error("Render Error:", error);
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
                <h3>Critical Render Error</h3>
                <p>${error.message}</p>
                <pre style="font-size: 10px; opacity: 0.7;">${error.stack}</pre>
            </div>`;
        }
    }
}

// --- UI COMPONENTS ---

function renderLoginPage() {
    return `
        <div class="setup-page" style="max-width: 450px; margin: 40px auto; animation: fadeIn 0.5s ease-out;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background: var(--primary-gradient); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #000; box-shadow: 0 8px 16px rgba(212, 175, 55, 0.2);">
                    <i data-lucide="user-check" style="width: 40px; height: 40px;"></i>
                </div>
                <h2 style="font-size: 28px; font-weight: 800; color: var(--accent-gold); margin-bottom: 8px; letter-spacing: -0.5px; font-family: var(--font-premium);">Selamat Datang</h2>
                <p style="color: var(--text-muted); font-size: 15px; line-height: 1.6;">Masuk dengan akun Google Anda untuk mengakses ND STUDIO PRO.</p>
            </div>

            <div class="setup-card" style="background: #151515; padding: 40px; border-radius: 28px; border: 1px solid var(--border-color); box-shadow: var(--shadow); text-align: center;">
                <button onclick="login()" style="width: 100%; padding: 16px; border-radius: 16px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; border: 1px solid var(--border-color); background: #1a1a1a; color: var(--text-main); transition: all 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 24px; height: 24px;">
                    Masuk dengan Google
                </button>
                
                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                        Dengan masuk, Anda menyetujui Syarat & Ketentuan kami. Akun Anda akan diverifikasi oleh Admin sebelum dapat digunakan.
                    </p>
                </div>
            </div>
        </div>
    `;
}

function renderPendingPage() {
    return `
        <div class="setup-page" style="max-width: 500px; margin: 40px auto; animation: fadeIn 0.5s ease-out;">
            <div class="setup-card" style="background: #151515; padding: 48px; border-radius: 32px; border: 1px solid var(--border-color); box-shadow: var(--shadow); text-align: center;">
                <div style="width: 100px; height: 100px; background: rgba(212, 175, 55, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; color: var(--accent-gold); animation: pulse 2s infinite;">
                    <i data-lucide="clock" style="width: 50px; height: 50px;"></i>
                </div>
                <h2 style="font-size: 26px; font-weight: 800; color: var(--accent-gold); margin-bottom: 12px; font-family: var(--font-premium);">Menunggu Persetujuan</h2>
                <p style="color: var(--text-main); font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
                    Halo <strong>${state.currentUser.displayName}</strong>, akun Anda telah terdaftar. <br>
                    Silakan hubungi Admin untuk mengaktifkan akses Anda ke ND STUDIO PRO.
                </p>
                
                <div style="background: #1a1a1a; padding: 20px; border-radius: 16px; margin-bottom: 32px; text-align: left; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <i data-lucide="mail" style="width: 18px; height: 18px; color: var(--accent-gold);"></i>
                        <span style="font-size: 14px; color: var(--text-main);">${state.currentUser.email}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i data-lucide="shield-alert" style="width: 18px; height: 18px; color: var(--accent-gold);"></i>
                        <span style="font-size: 14px; font-weight: 600; color: var(--accent-gold);">Status: Pending</span>
                    </div>
                </div>

                <button onclick="logout()" style="width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; border: 1px solid var(--border-color); background: #1a1a1a; color: #fa5252; transition: all 0.2s;">
                    <i data-lucide="log-out" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>
                    Keluar Akun
                </button>
            </div>
            <style>
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        </div>
    `;
}

function renderAdminDashboard() {
    const pendingUsers = state.allUsers.filter(u => !u.isApproved);
    const approvedUsers = state.allUsers.filter(u => u.isApproved && u.role !== 'admin');
    
    return `
        <div class="admin-dashboard" style="max-width: 900px; margin: 20px auto; padding: 0 20px; animation: fadeIn 0.4s ease-out;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h1 style="font-size: 28px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-premium);">Admin Dashboard</h1>
                    <p style="color: var(--text-muted); font-size: 14px;">Kelola akses pengguna ND STUDIO PRO.</p>
                </div>
                <button onclick="state.showAdminDashboard = false; renderContent();" style="padding: 10px 20px; border-radius: 12px; background: #1a1a1a; border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="arrow-left" style="width: 18px; height: 18px;"></i>
                    Kembali ke App
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
                <!-- Section: Pending Approval -->
                <div class="setup-card" style="background: #151515; padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                    <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 18px; color: var(--accent-gold);">
                        <i data-lucide="user-plus"></i>
                        Menunggu Persetujuan (${pendingUsers.length})
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${pendingUsers.length === 0 ? '<p style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px;">Tidak ada permintaan baru.</p>' : ''}
                        ${pendingUsers.map(user => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(212, 175, 55, 0.05); border-radius: 16px; border: 1px solid var(--border-color);">
                                <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName}" style="width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--border-color);">
                                <div style="flex-grow: 1; overflow: hidden;">
                                    <div style="font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${user.displayName}</div>
                                    <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="approveUser('${user.uid}')" style="background: var(--accent-green); color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer;" title="Setujui">
                                        <i data-lucide="check" style="width: 18px; height: 18px;"></i>
                                    </button>
                                    <button onclick="deleteUserAccount('${user.uid}')" style="background: #fa5252; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer;" title="Hapus Akun">
                                        <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Section: Approved Users -->
                <div class="setup-card" style="background: #151515; padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                    <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 18px; color: var(--accent-gold);">
                        <i data-lucide="users"></i>
                        Pengguna Aktif (${approvedUsers.length})
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${approvedUsers.length === 0 ? '<p style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px;">Belum ada pengguna aktif.</p>' : ''}
                        ${approvedUsers.map(user => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #1a1a1a; border-radius: 16px; border: 1px solid var(--border-color);">
                                <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName}" style="width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--border-color);">
                                <div style="flex-grow: 1; overflow: hidden;">
                                    <div style="font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${user.displayName}</div>
                                    <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="rejectUser('${user.uid}')" style="background: var(--accent-red); color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer;" title="Cabut Akses">
                                        <i data-lucide="user-minus" style="width: 18px; height: 18px;"></i>
                                    </button>
                                    <button onclick="deleteUserAccount('${user.uid}')" style="background: #fa5252; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer;" title="Hapus Akun">
                                        <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Section: Storage Management -->
                <div class="setup-card" style="background: #151515; padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--shadow); grid-column: 1 / -1;">
                    <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 18px; color: var(--accent-gold);">
                        <i data-lucide="hard-drive"></i>
                        Manajemen Penyimpanan (Cloudinary)
                    </h3>
                    <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">
                        Hapus semua gambar dan video referensi yang pernah diunggah oleh pengguna ke server Cloudinary untuk mengosongkan kuota penyimpanan. (File hasil generate AI dari Freepik tidak akan terhapus).
                    </p>
                    <button id="btn-clear-cloudinary" onclick="clearCloudinaryStorage()" style="background: #fa5252; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="trash-2"></i> Kosongkan Storage Cloudinary
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderGlobalError() {
    if (!state.globalError) return '';
    
    const isLimit = state.globalError.includes('Limit') || state.globalError.includes('Kuota') || state.globalError.includes('429');
    const isRateLimit = state.globalError.includes('Too Many Requests') || state.globalError.includes('429');
    
    return `
        <div class="global-error-alert" style="background: ${isLimit ? '#fff9db' : '#fff5f5'}; border: 2px solid ${isLimit ? '#fab005' : '#ffc9c9'}; color: ${isLimit ? '#856404' : '#fa5252'}; padding: 16px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 12px; animation: slideDown 0.3s ease-out; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <i data-lucide="${isLimit ? 'clock' : 'alert-triangle'}" style="flex-shrink: 0; margin-top: 2px;"></i>
            <div style="flex-grow: 1; font-size: 13px; line-height: 1.5;">
                <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${isLimit ? '⚠️ API Rate Limit / Quota' : '❌ Error Terjadi'}</strong>
                ${state.globalError}
                ${isLimit ? `<div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">Tips: Tunggu 1-2 menit atau gunakan API Key Freepik lainnya di menu Setup.</div>` : ''}
                ${isRateLimit ? `
                    <button onclick="clearGlobalError(); generate();" style="margin-top: 10px; background: #856404; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Coba Lagi Sekarang
                    </button>
                ` : ''}
            </div>
            <button onclick="clearGlobalError()" style="background: ${isLimit ? '#fab005' : '#fa5252'}; border: none; color: white; cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s;">
                <i data-lucide="x" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
        <style>
            @keyframes slideDown {
                from { transform: translateY(-10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .global-error-alert button:hover { opacity: 0.8; }
        </style>
    `;
}

function clearGlobalError() {
    state.globalError = null;
    renderContent();
}

function renderUsageStats() {
    const activeCount = state.activeTasks.length;
    const taskLimit = state.taskLimit || 10;
    const queueLimit = state.queueLimit || 10;
    
    // Calculate queue usage (tasks generated in the last 60 seconds)
    const now = Date.now();
    state.generationHistory = (state.generationHistory || []).filter(t => now - t < 60000);
    const queueCount = state.generationHistory.length;
    
    return `
        <div class="usage-stats-bar">
            <div class="stat-item">
                <i data-lucide="layers"></i>
                <span>Task <strong>${activeCount}/${taskLimit}</strong> - <strong>${queueCount}/${queueLimit}/min</strong></span>
            </div>
        </div>
    `;
}

function renderHeader() {
    let pendingUsersCount = 0;
    if (state.isAdmin && state.allUsers) {
        pendingUsersCount = state.allUsers.filter(u => !u.isApproved && u.role !== 'admin').length;
    }

    return `
        <header>
            <div class="header-left">
                <div class="premium-logo">
                    <div class="logo-diamond"></div>
                    <div class="logo-text">ND</div>
                </div>
                <div class="brand-name">ND STUDIO PRO</div>
            </div>
            <div class="header-actions">
                ${state.isAdmin ? `
                    <button class="btn-icon-action ${state.showAdminDashboard ? 'active' : ''}" onclick="state.showAdminDashboard = !state.showAdminDashboard; renderContent();" title="Admin Dashboard" style="background: #fff9db; color: #fab005; border-color: #ffec99; position: relative;">
                        <i data-lucide="shield-check"></i>
                        ${pendingUsersCount > 0 ? `
                            <span class="notification-badge">${pendingUsersCount}</span>
                        ` : ''}
                    </button>
                ` : ''}
                
                ${state.currentUser && state.userDoc?.isApproved ? `
                    <button class="api-settings-btn ${state.apiKey ? 'active' : ''}" onclick="handleStatusClick()">
                        <div class="api-settings-icon">
                            <i data-lucide="key"></i>
                        </div>
                        <div class="api-settings-text">
                            <span class="api-label">API SETTINGS</span>
                            <span class="api-status">${state.apiKey ? 'CONNECTED' : 'NOT CONNECTED'}</span>
                        </div>
                    </button>
                ` : ''}

                ${state.currentUser ? `
                    <div class="user-profile-mini" style="display: flex; align-items: center; gap: 6px; padding: 4px; padding-right: 8px; background: #1a1a1a; border-radius: 20px; border: 1px solid var(--border-color);">
                        <img src="${state.currentUser.photoURL}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color);">
                        <button onclick="logout()" title="Logout" style="display: flex; align-items: center; justify-content: center; padding: 4px; border: none; background: transparent; color: #fa5252; cursor: pointer; border-radius: 50%; transition: background 0.2s;" onmouseover="this.style.background='rgba(250, 82, 82, 0.1)'" onmouseout="this.style.background='transparent'">
                            <i data-lucide="log-out" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                ` : ''}

                <button class="btn-icon-action" onclick="toggleModal('modal-disclaimer', true)" title="Info">
                    <i data-lucide="info"></i>
                </button>
            </div>
        </header>
    `;
}

function renderFooter() {
    return `
        <footer class="app-footer">
            <div class="app-footer-content">
                <div class="app-footer-links">
                    <a href="#" onclick="toggleModal('modal-disclaimer', true); return false;" class="app-footer-link">Terms of Service</a>
                    <span class="footer-dot">•</span>
                    <span class="footer-privacy">Local API Storage</span>
                </div>
                <div class="app-footer-copyright">©Nanda Studio Pro</div>
                <div class="app-footer-powered">POWERED BY <a href="https://freepik.com" target="_blank" class="app-footer-link">FREEPIK API</a></div>
            </div>
        </footer>
    `;
}

function renderSetupPage() {
    return `
        <div class="setup-page">
            <div class="setup-hero">
                <div class="setup-logo-large" style="background: transparent; box-shadow: none;">
                    <div class="premium-logo" style="width: 80px; height: 80px;">
                        <div class="logo-diamond" style="width: 60px; height: 60px; box-shadow: 0 0 30px rgba(212, 175, 55, 0.5);"></div>
                        <div class="logo-text" style="font-size: 32px;">ND</div>
                    </div>
                </div>
                <h1 style="font-size: 24px; line-height: 1.3; margin-top: 16px;">Selamat Datang di<br><span style="color: var(--accent-gold); font-weight: 900; font-family: var(--font-premium);">ND STUDIO PRO</span></h1>
                <p>AI Video Generator dengan 10+ model AI</p>
            </div>

            <div class="step-card">
                <div class="step-header">
                    <div class="step-number">1</div>
                    <div class="step-title-group">
                        <div class="step-title">Daftar Akun Freepik (Gratis)</div>
                        <div class="step-desc">Dapatkan $5 kredit gratis</div>
                    </div>
                </div>
                <a href="https://www.freepik.com/auth/register" target="_blank" class="btn-step-action">
                    📝 Buka Halaman Daftar →
                </a>
            </div>

            <div class="step-card">
                <div class="step-header">
                    <div class="step-number">2</div>
                    <div class="step-title-group">
                        <div class="step-title">Ambil API Key</div>
                        <div class="step-desc">Developer Dashboard → copy key</div>
                    </div>
                </div>
                <a href="https://www.freepik.com/developers" target="_blank" class="btn-step-action">
                    🔑 Buka Dashboard →
                </a>
            </div>

            <div class="step-card active">
                <div class="step-header">
                    <div class="step-number">3</div>
                    <div class="step-title-group">
                        <div class="step-title">Paste API Key</div>
                        <div class="step-desc">Tersimpan aman</div>
                    </div>
                </div>
                <div class="api-input-group">
                    <div class="api-input-wrapper">
                        <input type="${state.showApiKey ? 'text' : 'password'}" id="api-key-input" class="api-input" placeholder="fpk-xxxxxxxxxxxxxxx" value="${state.apiKey}">
                        <button class="btn-toggle-visibility" onclick="toggleApiKeyVisibility()" title="${state.showApiKey ? 'Sembunyikan' : 'Tampilkan'}">
                            <i data-lucide="${state.showApiKey ? 'eye-off' : 'eye'}" style="width: 18px; height: 18px;"></i>
                        </button>
                    </div>
                    <button class="btn-save-api" onclick="saveApiKey()">Simpan</button>
                </div>
            </div>

            ${state.apiKey ? `
                <div class="info-box success" style="background: #e7fcf3; border: 1px solid #b7f2d7; color: #0d6832; padding: 12px; border-radius: 12px; font-size: 12px; margin-top: 12px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
                    <span>API Key Anda sudah terhubung dan siap digunakan.</span>
                </div>
            ` : ''}
        </div>
    `;
}

function renderModelSelector() {
    return `
        <div class="model-selector">
            ${GENERATORS.map(gen => `
                <div class="model-item ${state.activeGenerator === gen.id ? 'active' : ''}" onclick="setActiveGenerator('${gen.id}')">
                    <div class="model-icon-wrapper">
                        <div class="model-icon-inner">${gen.icon}</div>
                        ${gen.badge ? `<div class="model-badge">${gen.badge}</div>` : ''}
                    </div>
                    <div class="model-name-label">${gen.name}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderModelInfo(gen) {
    return `
        <div class="model-info-card">
            <div class="model-info-icon-wrapper">
                <div class="model-info-icon-inner">${gen.icon}</div>
            </div>
            <div class="model-info-text">
                <h4>${gen.name}</h4>
                <p>${gen.description}</p>
            </div>
        </div>
    `;
}

function renderUploadSection(gen) {
    if (!gen.inputs.includes('image') && !gen.inputs.includes('video')) return '';

    const showUrlInput = state.showUrlInput || false;
    const isKling3Std = gen.id === 'kling-v3-std';
    const isKling3Pro = gen.id === 'kling-v3-pro';
    const isKling3OmniPro = gen.id === 'kling-v3-omni-pro';
    const isSeeDream45 = gen.id === 'seedream-4-5-edit';
    const hasTwoInputs = gen.inputs.includes('video') || (isKling3Std && gen.inputs.includes('image')) || (isSeeDream45 && gen.inputs.includes('video')) || (isKling3OmniPro && gen.inputs.includes('video'));

    const uploadState = getUploadState();

    return `
        <div class="upload-section ${!hasTwoInputs ? 'single-input' : ''}">
            ${gen.inputs.includes('image') ? `
                <div class="upload-card ${uploadState.files.image || uploadState.urls.image ? 'has-file' : ''} ${uploadState.uploading.image ? 'uploading' : ''}" 
                     onclick="${showUrlInput ? '' : "triggerUpload('image')"}">
                    ${uploadState.uploading.image ? `
                        <div class="upload-loader">
                            <div class="spinner"></div>
                            <span>Uploading...</span>
                        </div>
                    ` : uploadState.files.image ? `
                        <img src="${uploadState.files.image}" class="upload-preview">
                        <button class="btn-remove" onclick="removeFile(event, 'image')"><i data-lucide="x"></i></button>
                    ` : uploadState.urls.image ? `
                        <div class="upload-placeholder">
                            <i data-lucide="check-circle" style="color: #40c057;"></i>
                            <span style="font-size: 10px; color: #40c057; font-weight: 700;">URL TERPASANG</span>
                            <span style="font-size: 9px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; width: 80%; white-space: nowrap;">${uploadState.autoUploaded.image ? 'File siap digunakan' : uploadState.urls.image}</span>
                            <button class="btn-remove" onclick="removeFile(event, 'image')"><i data-lucide="x"></i></button>
                        </div>
                    ` : `
                        <div class="upload-placeholder">
                            <i data-lucide="image"></i>
                            <span>${gen.id === 'kling-v3-std' || gen.id === 'kling-v3-omni-pro' ? 'Start Image<br>(Awal)' : (gen.id === 'kling-v3-pro' ? 'Upload Gambar' : (gen.id === 'seedream-4-5-edit' ? 'Reference Image 1' : (gen.id === 'seedance-1-5-pro' ? 'Upload Image<br>(Optional)' : 'Gambar<br>Karakter')))}</span>
                        </div>
                    `}
                </div>
            ` : ''}
            
            ${hasTwoInputs ? `
                <div class="upload-card ${uploadState.files.video || uploadState.urls.video ? 'has-file' : ''} ${uploadState.uploading.video ? 'uploading' : ''}" 
                     onclick="${showUrlInput ? '' : "triggerUpload('video')"}">
                    ${uploadState.uploading.video ? `
                        <div class="upload-loader">
                            <div class="spinner"></div>
                            <span>Uploading...</span>
                        </div>
                    ` : uploadState.files.video ? `
                        ${(isKling3Std || isKling3OmniPro || gen.id === 'seedream-4-5-edit') ? `<img src="${uploadState.files.video}" class="upload-preview">` : `<video src="${uploadState.files.video}" class="upload-preview" muted autoplay loop playsinline></video>`}
                        <button class="btn-remove" onclick="removeFile(event, 'video')"><i data-lucide="x"></i></button>
                    ` : uploadState.urls.video ? `
                        <div class="upload-placeholder">
                            <i data-lucide="check-circle" style="color: #40c057;"></i>
                            <span style="font-size: 10px; color: #40c057; font-weight: 700;">URL TERPASANG</span>
                            <span style="font-size: 9px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; width: 80%; white-space: nowrap;">${uploadState.autoUploaded.video ? 'File siap digunakan' : uploadState.urls.video}</span>
                            <button class="btn-remove" onclick="removeFile(event, 'video')"><i data-lucide="x"></i></button>
                        </div>
                    ` : `
                        <div class="upload-placeholder">
                            <i data-lucide="${(isKling3Std || isKling3OmniPro || gen.id === 'seedream-4-5-edit') ? 'image' : 'video'}"></i>
                            <span>${(isKling3Std || isKling3OmniPro) ? 'End Image<br>(Akhir)' : (gen.id === 'seedream-4-5-edit' ? 'Reference Image 2' : 'Video<br>Referensi')}</span>
                        </div>
                    `}
                </div>
            ` : ''}

            <div class="url-toggle" onclick="toggleUrlInput()">
                ${showUrlInput ? '<i data-lucide="arrow-left"></i> Kembali ke Upload File' : '<i data-lucide="link"></i> Atau masukkan URL manual'}
            </div>

            ${showUrlInput ? `
                <div class="url-input-group">
                    <input type="text" class="url-input" placeholder="${isKling3Std ? 'https://... (Start Image URL)' : 'https://... (URL Gambar)'}" 
                           value="${uploadState.autoUploaded.image ? '' : uploadState.urls.image}" oninput="updateUrl('image', this.value)">
                    ${hasTwoInputs ? `
                        <input type="text" class="url-input" placeholder="${isKling3Std ? 'https://... (End Image URL)' : 'https://... (URL Video)'}" 
                               value="${uploadState.autoUploaded.video ? '' : uploadState.urls.video}" oninput="updateUrl('video', this.value)">
                    ` : ''}
                </div>
            ` : ''}
        </div>
        <input type="file" id="file-input-image" hidden accept="image/*" onchange="handleFileChange('image', this)">
        <input type="file" id="file-input-video" hidden accept="${(isKling3Std || isKling3OmniPro || isSeeDream45) ? 'image/*' : 'video/*'}" onchange="handleFileChange('video', this)">
    `;
}

function renderPromptSection() {
    const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
    let placeholder = "Masukkan prompt deskripsi di sini...";
    if (activeGen.id === 'flux-2-pro') {
        placeholder = "Describe your image (e.g. cinematic portrait, ultra realistic, 4k, soft lighting)";
    } else if (activeGen.id === 'seedance-1-5-pro') {
        placeholder = "Describe your video (e.g. cinematic scene, person talking, realistic motion)";
    } else if (activeGen.id === 'elevenlabs-turbo-v2-5') {
        placeholder = "Enter text for voice over (supports multiple languages)";
    } else if (activeGen.id === 'music-generation') {
        placeholder = "Describe your music... (e.g. upbeat electronic track with synth and fast tempo)";
    }

    const maxChars = activeGen.id === 'elevenlabs-turbo-v2-5' ? 40000 : 2500;

    if (activeGen.id === 'music-generation') {
        const genres = ['Cinematic', 'EDM', 'Lofi', 'Jazz', 'Rock', 'Classical'];
        const moods = ['Happy', 'Sad', 'Chill', 'Dark', 'Epic', 'Romantic'];
        const instruments = ['Piano', 'Guitar', 'Drums', 'Violin', 'Synth', 'Bass'];
        const tempos = ['Slow', 'Medium', 'Fast'];
        const suggestions = [
            { text: "epic cinematic trailer music", label: "Epic Cinematic" },
            { text: "lofi chill beat for studying", label: "Lofi Chill" },
            { text: "happy upbeat edm festival track", label: "Happy EDM" },
            { text: "sad emotional piano solo", label: "Sad Piano" }
        ];

        return `
            <div class="prompt-section music-pro-section">
                <div class="music-selectors">
                    <div class="music-selector-group">
                        <label>Genre</label>
                        <select class="music-select" onchange="updateMusicSelection('genre', this.value)">
                            <option value="">Select Genre</option>
                            ${genres.map(g => `<option value="${g}" ${state.musicSelections.genre === g ? 'selected' : ''}>${g}</option>`).join('')}
                        </select>
                    </div>
                    <div class="music-selector-group">
                        <label>Mood</label>
                        <select class="music-select" onchange="updateMusicSelection('mood', this.value)">
                            <option value="">Select Mood</option>
                            ${moods.map(m => `<option value="${m}" ${state.musicSelections.mood === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div class="music-selector-group">
                        <label>Tempo</label>
                        <select class="music-select" onchange="updateMusicSelection('tempo', this.value)">
                            <option value="">Select Tempo</option>
                            ${tempos.map(t => `<option value="${t}" ${state.musicSelections.tempo === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="music-selector-group full-width">
                    <label>Instruments</label>
                    <div class="instrument-chips">
                        ${instruments.map(inst => `
                            <div class="instrument-chip ${state.musicSelections.instruments.includes(inst) ? 'active' : ''}" 
                                 onclick="toggleMusicInstrument('${inst}')">
                                ${inst}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="music-suggestions">
                    ${suggestions.map(s => `
                        <button class="music-suggestion-btn" onclick="setMusicSuggestion('${s.text}')">
                            ${s.label}
                        </button>
                    `).join('')}
                </div>

                <div style="position: relative;">
                    <textarea class="prompt-textarea" placeholder="${placeholder}" 
                              oninput="updatePrompt(this.value)" maxlength="${maxChars}">${state.currentPrompt}</textarea>
                    <div class="prompt-counter">${state.currentPrompt.length}/${maxChars}</div>
                </div>

                <div class="music-prompt-preview">
                    <div class="preview-label">Generated Prompt Preview:</div>
                    <div class="music-prompt-preview-text">${buildMusicPrompt()}</div>
                </div>
            </div>
        `;
    }

    return `
        <div class="prompt-section">
            <textarea class="prompt-textarea" placeholder="${placeholder}" 
                      oninput="updatePrompt(this.value)" maxlength="${maxChars}">${state.currentPrompt}</textarea>
            <div class="prompt-counter">${state.currentPrompt.length}/${maxChars}</div>
        </div>
    `;
}

function renderSettings(gen) {
    if (!gen.settings) return '';
    
    return `
        <div class="settings-section">
            ${gen.settings.orientation ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Character Orientation</span></div>
                    <select class="setting-select" onchange="updateSetting('orientation', this.value)">
                        <option value="video" ${state.settings.orientation === 'video' ? 'selected' : ''}>Video (Matches Reference)</option>
                        <option value="image" ${state.settings.orientation === 'image' ? 'selected' : ''}>Image (Matches Character)</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.style ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Style Preset</span></div>
                    <div class="style-grid">
                        ${['Realistic', 'Cinematic', 'Anime', 'Portrait', 'Product', 'Fantasy', 'None'].map(style => `
                            <button class="style-btn ${state.settings.style === style ? 'active' : ''}" 
                                    onclick="updateSetting('style', '${style}')">${style}</button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${gen.settings.resolution ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Resolution</span></div>
                    <select class="setting-select" onchange="updateSetting('resolution', this.value)">
                        <option value="360p" ${state.settings.resolution === '360p' ? 'selected' : ''}>360p</option>
                        <option value="540p" ${state.settings.resolution === '540p' ? 'selected' : ''}>540p</option>
                        <option value="720p" ${state.settings.resolution === '720p' ? 'selected' : ''}>720p</option>
                        <option value="1080p" ${state.settings.resolution === '1080p' ? 'selected' : ''}>1080p</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.aspect_ratio ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Aspect Ratio</span></div>
                    <select class="setting-select" onchange="updateSetting('aspect_ratio', this.value)">
                        ${gen.settings.aspect_ratio === 'seedream' ? `
                            <option value="square_1_1" ${state.settings.aspect_ratio === 'square_1_1' ? 'selected' : ''}>Square (1:1)</option>
                            <option value="widescreen_16_9" ${state.settings.aspect_ratio === 'widescreen_16_9' ? 'selected' : ''}>Widescreen (16:9)</option>
                            <option value="social_story_9_16" ${state.settings.aspect_ratio === 'social_story_9_16' ? 'selected' : ''}>Social Story (9:16)</option>
                            <option value="portrait_2_3" ${state.settings.aspect_ratio === 'portrait_2_3' ? 'selected' : ''}>Portrait (2:3)</option>
                            <option value="traditional_3_4" ${state.settings.aspect_ratio === 'traditional_3_4' ? 'selected' : ''}>Traditional (3:4)</option>
                            <option value="standard_3_2" ${state.settings.aspect_ratio === 'standard_3_2' ? 'selected' : ''}>Standard (3:2)</option>
                            <option value="classic_4_3" ${state.settings.aspect_ratio === 'classic_4_3' ? 'selected' : ''}>Classic (4:3)</option>
                            <option value="cinematic_21_9" ${state.settings.aspect_ratio === 'cinematic_21_9' ? 'selected' : ''}>Cinematic (21:9)</option>
                        ` : gen.settings.aspect_ratio === 'flux' ? `
                            <option value="1:1" ${state.settings.aspect_ratio === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
                            <option value="9:16" ${state.settings.aspect_ratio === '9:16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="16:9" ${state.settings.aspect_ratio === '16:9' ? 'selected' : ''}>16:9 (Landscape)</option>
                        ` : gen.settings.aspect_ratio === 'seedance' ? `
                            <option value="widescreen_16_9" ${state.settings.aspect_ratio === 'widescreen_16_9' ? 'selected' : ''}>16:9 (Widescreen)</option>
                            <option value="social_story_9_16" ${state.settings.aspect_ratio === 'social_story_9_16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="square_1_1" ${state.settings.aspect_ratio === 'square_1_1' ? 'selected' : ''}>1:1 (Square)</option>
                        ` : gen.settings.aspect_ratio === 'pixverse' ? `
                            <option value="16:9" ${state.settings.aspect_ratio === '16:9' ? 'selected' : ''}>16:9 (Landscape)</option>
                            <option value="9:16" ${state.settings.aspect_ratio === '9:16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="1:1" ${state.settings.aspect_ratio === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
                            <option value="4:3" ${state.settings.aspect_ratio === '4:3' ? 'selected' : ''}>4:3 (Classic)</option>
                            <option value="3:4" ${state.settings.aspect_ratio === '3:4' ? 'selected' : ''}>3:4 (Portrait)</option>
                        ` : gen.settings.aspect_ratio === 'runway' ? `
                            <option value="1920:1080" ${state.settings.aspect_ratio === '1920:1080' ? 'selected' : ''}>16:9 (Landscape)</option>
                            <option value="1080:1920" ${state.settings.aspect_ratio === '1080:1920' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="1024:1024" ${state.settings.aspect_ratio === '1024:1024' ? 'selected' : ''}>1:1 (Square)</option>
                            <option value="1280:720" ${state.settings.aspect_ratio === '1280:720' ? 'selected' : ''}>HD Landscape (1280x720)</option>
                            <option value="720:1280" ${state.settings.aspect_ratio === '720:1280' ? 'selected' : ''}>HD Portrait (720x1280)</option>
                        ` : `
                            <option value="16:9" ${state.settings.aspect_ratio === '16:9' ? 'selected' : ''}>16:9 (Landscape)</option>
                            <option value="9:16" ${state.settings.aspect_ratio === '9:16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="1:1" ${state.settings.aspect_ratio === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
                        `}
                    </select>
                </div>
            ` : ''}

            ${gen.settings.motion ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Motion Intensity</span>
                        <span class="setting-value" id="motion-val">${state.settings.motion}</span>
                    </div>
                    <input type="range" class="setting-slider" min="1" max="10" step="1" value="${state.settings.motion}" 
                           oninput="updateSetting('motion', parseInt(this.value)); document.getElementById('motion-val').innerText = this.value">
                </div>
            ` : ''}

            ${gen.settings.music_duration ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Music Duration</span></div>
                    <select class="setting-select" onchange="updateSetting('music_duration', this.value)">
                        <option value="30" ${state.settings.music_duration == 30 ? 'selected' : ''}>30 Seconds</option>
                        <option value="60" ${state.settings.music_duration == 60 ? 'selected' : ''}>60 Seconds</option>
                        <option value="120" ${state.settings.music_duration == 120 ? 'selected' : ''}>120 Seconds</option>
                        <option value="240" ${state.settings.music_duration == 240 ? 'selected' : ''}>240 Seconds</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.duration ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Duration (Seconds)</span></div>
                    <select class="setting-select" onchange="updateSetting('duration', this.value)">
                        ${gen.settings.duration === 'seedance' ? [5,10,12].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('') : gen.settings.duration === 'pixverse' ? [5,10].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('') : [3,4,5,6,7,8,9,10,11,12,13,14,15].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('')}
                    </select>
                </div>
            ` : ''}
            
            ${gen.settings.cfg ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>CFG Scale</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Menentukan seberapa ketat AI mengikuti prompt Anda. Nilai tinggi = lebih kaku pada prompt, nilai rendah = AI lebih kreatif.</span>
                            </div>
                        </div>
                        <span class="setting-value" id="cfg-val">${state.settings.cfg_scale}</span>
                    </div>
                    <input type="range" class="setting-slider" min="0" max="1" step="0.1" value="${state.settings.cfg_scale}" 
                           oninput="updateCfgValue(this.value)">
                </div>
            ` : ''}

            ${gen.settings.strength ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Strength</span>
                        <span class="setting-value" id="strength-val">${state.settings.strength}</span>
                    </div>
                    <input type="range" class="setting-slider" min="0" max="1" step="0.05" value="${state.settings.strength}" 
                           oninput="updateStrengthValue(this.value)">
                </div>
            ` : ''}

            ${gen.settings.guidance_scale ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Guidance</span>
                        <span class="setting-value" id="guidance-val">${state.settings.guidance_scale}</span>
                    </div>
                    <input type="range" class="setting-slider" min="1" max="20" step="0.5" value="${state.settings.guidance_scale}" 
                           oninput="updateGuidanceValue(this.value)">
                </div>
            ` : ''}

            ${gen.settings.steps ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Steps</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Jumlah iterasi untuk menghasilkan gambar. Steps lebih tinggi menghasilkan detail lebih baik tapi proses lebih lama.</span>
                            </div>
                        </div>
                        <span class="setting-value" id="steps-val">${state.settings.steps}</span>
                    </div>
                    <input type="range" class="setting-slider" min="1" max="50" step="1" value="${state.settings.steps}" 
                           oninput="updateStepsValue(this.value)">
                </div>
            ` : ''}

            ${gen.settings.seed ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Seed</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Angka acak untuk reproduksi hasil. Gunakan angka yang sama untuk mendapatkan hasil yang konsisten.</span>
                            </div>
                        </div>
                    </div>
                    <input type="number" class="setting-input" placeholder="Random" value="${state.settings.seed || ''}" 
                           oninput="updateSetting('seed', parseInt(this.value) || 0)">
                </div>
            ` : ''}

            ${gen.settings.safety_checker ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Safety Checker</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Filter keamanan untuk mencegah konten yang tidak pantas atau melanggar kebijakan.</span>
                            </div>
                        </div>
                    </div>
                    <select class="setting-select" onchange="updateSetting('safety_checker', this.value === 'true')">
                        <option value="true" ${state.settings.safety_checker !== false ? 'selected' : ''}>Enabled</option>
                        <option value="false" ${state.settings.safety_checker === false ? 'selected' : ''}>Disabled</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.generate_audio ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Generate Audio</span>
                    </div>
                    <select class="setting-select" onchange="updateSetting('generate_audio', this.value === 'true')">
                        <option value="true" ${state.settings.generate_audio !== false ? 'selected' : ''}>Enabled</option>
                        <option value="false" ${state.settings.generate_audio === false ? 'selected' : ''}>Disabled</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.camera_fixed ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Camera Mode</span>
                    </div>
                    <select class="setting-select" onchange="updateSetting('camera_fixed', this.value === 'true')">
                        <option value="false" ${state.settings.camera_fixed !== true ? 'selected' : ''}>Dynamic Camera</option>
                        <option value="true" ${state.settings.camera_fixed === true ? 'selected' : ''}>Fixed Camera</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.voice ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Voice Selector</span></div>
                    <select class="setting-select" onchange="if(this.value === 'custom'){ document.getElementById('custom-voice-container').style.display = 'block'; } else { document.getElementById('custom-voice-container').style.display = 'none'; updateSetting('voice', this.value); }">
                        <option value="URAuwR59OqCASDVp35yi" ${state.settings.voice === 'URAuwR59OqCASDVp35yi' ? 'selected' : ''}>Ibnu (Calm & Clear Entertainment)</option>
                        <option value="ZF5uWKM2iVvSId3tBCYt" ${state.settings.voice === 'ZF5uWKM2iVvSId3tBCYt' ? 'selected' : ''}>Lyly (Calm, Clear & Witty Educational)</option>
                        <option value="LxiqOV1uxBCgYTeitAHf" ${state.settings.voice === 'LxiqOV1uxBCgYTeitAHf' ? 'selected' : ''}>Bowo (Intimidating Character)</option>
                        <option value="MSsKJV9ZON0v7tZR6NlP" ${state.settings.voice === 'MSsKJV9ZON0v7tZR6NlP' ? 'selected' : ''}>Solana (Expresif Social media)</option>
                        <option value="TIXYCOMzK2Vw9OZovSLs" ${state.settings.voice === 'TIXYCOMzK2Vw9OZovSLs' ? 'selected' : ''}>Janu (Calm Narration)</option>
                        <option value="ffTJE9l3Kt2ipEM32UOc" ${state.settings.voice === 'ffTJE9l3Kt2ipEM32UOc' ? 'selected' : ''}>Aita (Youthfull Social media)</option>
                        <option value="iWydkXKoiVtvdn4vLKp9" ${state.settings.voice === 'iWydkXKoiVtvdn4vLKp9' ? 'selected' : ''}>Cahaya (Youthfull social media)</option>
                        <option value="custom" ${!['URAuwR59OqCASDVp35yi', 'ZF5uWKM2iVvSId3tBCYt', 'LxiqOV1uxBCgYTeitAHf', 'MSsKJV9ZON0v7tZR6NlP', 'TIXYCOMzK2Vw9OZovSLs', 'ffTJE9l3Kt2ipEM32UOc', 'iWydkXKoiVtvdn4vLKp9'].includes(state.settings.voice) ? 'selected' : ''}>Custom Voice ID...</option>
                    </select>
                </div>
                <div id="custom-voice-container" class="setting-item" style="display: ${!['URAuwR59OqCASDVp35yi', 'ZF5uWKM2iVvSId3tBCYt', 'LxiqOV1uxBCgYTeitAHf', 'MSsKJV9ZON0v7tZR6NlP', 'TIXYCOMzK2Vw9OZovSLs', 'ffTJE9l3Kt2ipEM32UOc', 'iWydkXKoiVtvdn4vLKp9'].includes(state.settings.voice) ? 'block' : 'none'}; margin-top: -8px;">
                    <input type="text" class="setting-input" placeholder="Masukkan Voice ID ElevenLabs..." value="${state.settings.voice}" onchange="updateSetting('voice', this.value)">
                </div>
            ` : ''}

            ${gen.settings.stability ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Stability</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Mengatur seberapa stabil suara yang dihasilkan. Nilai tinggi membuat suara lebih konsisten, nilai rendah memberikan lebih banyak variasi emosi.</span>
                            </div>
                        </div>
                        <span class="setting-value">${state.settings.stability}</span>
                    </div>
                    <input type="range" class="setting-slider" min="0" max="1" step="0.05" value="${state.settings.stability}" 
                           oninput="updateSetting('stability', parseFloat(this.value)); this.previousElementSibling.querySelector('.setting-value').innerText = this.value">
                </div>
            ` : ''}

            ${gen.settings.similarity_boost ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Similarity Boost</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Meningkatkan kemiripan dengan suara asli. Nilai tinggi memperkuat karakteristik unik suara, namun nilai terlalu tinggi bisa menyebabkan artefak audio.</span>
                            </div>
                        </div>
                        <span class="setting-value">${state.settings.similarity_boost}</span>
                    </div>
                    <input type="range" class="setting-slider" min="0" max="1" step="0.05" value="${state.settings.similarity_boost}" 
                           oninput="updateSetting('similarity_boost', parseFloat(this.value)); this.previousElementSibling.querySelector('.setting-value').innerText = this.value">
                </div>
            ` : ''}

            ${gen.settings.speed ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Speed</span>
                        <span class="setting-value">${state.settings.speed}</span>
                    </div>
                    <input type="range" class="setting-slider" min="0.7" max="1.2" step="0.05" value="${state.settings.speed}" 
                           oninput="updateSetting('speed', parseFloat(this.value)); this.previousElementSibling.querySelector('.setting-value').innerText = this.value">
                </div>
            ` : ''}

            ${gen.settings.use_speaker_boost ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Speaker Boost</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Meningkatkan kejelasan dan kehadiran suara pembicara agar terdengar lebih profesional dan tajam.</span>
                            </div>
                        </div>
                    </div>
                    <select class="setting-select" onchange="updateSetting('use_speaker_boost', this.value === 'true')">
                        <option value="true" ${state.settings.use_speaker_boost !== false ? 'selected' : ''}>Enabled</option>
                        <option value="false" ${state.settings.use_speaker_boost === false ? 'selected' : ''}>Disabled</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.style ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Style</span></div>
                    <select class="setting-select" onchange="updateSetting('style', this.value)">
                        <option value="None" ${state.settings.style === 'None' ? 'selected' : ''}>None</option>
                        <option value="Anime" ${state.settings.style === 'Anime' ? 'selected' : ''}>Anime</option>
                        <option value="Realistic" ${state.settings.style === 'Realistic' ? 'selected' : ''}>Realistic</option>
                        <option value="3D" ${state.settings.style === '3D' ? 'selected' : ''}>3D Render</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.negative_prompt ? `
                <div class="setting-item full-width">
                    <div class="setting-label"><span>Negative Prompt</span></div>
                    <textarea class="setting-textarea" placeholder="Apa yang tidak ingin ditampilkan..." 
                              oninput="updateSetting('negative_prompt', this.value)">${state.settings.negative_prompt}</textarea>
                </div>
            ` : ''}
        </div>
    `;
}

function renderGenerateButton(gen) {
    const uploadState = getUploadState();
    const isUploading = uploadState.uploading.image || uploadState.uploading.video;
    const isCooldown = Date.now() < (state.cooldownUntil || 0);
    const noApiKey = !state.apiKey;
    
    let isMusicEmpty = false;
    if (gen.id === 'music-generation') {
        isMusicEmpty = isMusicSelectionEmpty();
    }

    const disabledAttr = (isUploading || isCooldown || noApiKey || isMusicEmpty) ? 'disabled' : '';
    
    let btnType = gen.outputType.charAt(0).toUpperCase() + gen.outputType.slice(1);
    if (gen.id === 'elevenlabs-turbo-v2-5') btnType = 'Voice';
    if (gen.id === 'music-generation') btnType = 'Music';
    let btnText = `🚀 Generate ${btnType}`;
    
    if (noApiKey) btnText = '🔑 Masukkan API Key';
    else if (isUploading) btnText = '⏳ Uploading...';
    else if (isCooldown) btnText = '⏳ Cooldown...';
    else if (isMusicEmpty) btnText = '✨ Pilih Opsi Musik';

    return `
        <div class="generate-container">
            <button class="btn-generate ${noApiKey ? 'btn-warning' : ''}" onclick="${noApiKey ? 'handleStatusClick()' : 'generate()'}" ${noApiKey ? '' : disabledAttr}>
                ${btnText}
            </button>
        </div>
    `;
}

function renderToasts() {
    if (state.toasts.length === 0) return '';
    return `
        <div class="toast-container">
            ${state.toasts.map(toast => `
                <div class="toast toast-${toast.type}">
                    <div class="toast-icon">
                        <i data-lucide="${toast.type === 'error' ? 'alert-circle' : (toast.type === 'success' ? 'check-circle' : 'info')}"></i>
                    </div>
                    <div class="toast-message">${toast.message}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function updateToastsDOM() {
    const container = document.getElementById('toast-container');
    if (container) {
        container.innerHTML = renderToasts();
        if (window.lucide) lucide.createIcons();
    }
}

function showToast(message, type = 'info') {
    const id = Date.now();
    state.toasts.push({ id, message, type });
    updateToastsDOM();
    setTimeout(() => {
        state.toasts = state.toasts.filter(t => t.id !== id);
        updateToastsDOM();
    }, 4000);
}

function renderActiveTasks() {
    if (state.activeTasks.length === 0) return '';
    
    return `
        <div class="active-tasks">
            ${state.activeTasks.map(task => {
                const gen = GENERATORS.find(g => g.id === task.generatorId) || GENERATORS[0];
                return `
                <div class="task-card">
                    <div class="task-header">
                        <div class="task-header-left">
                            <div class="task-tool-icon">${gen.icon}</div>
                            <span>${task.modelName}</span>
                        </div>
                        <div class="task-header-right">
                            <span>${Math.floor(task.progress)}%</span>
                            <button class="btn-task-action" onclick="pollTaskStatus('${task.id}')" title="Refresh Status">
                                <i data-lucide="refresh-cw"></i>
                            </button>
                            <button class="btn-task-action cancel" onclick="cancelTask('${task.id}')" title="Batalkan Task">
                                <i data-lucide="x"></i>
                            </button>
                        </div>
                    </div>
                    <div class="task-progress-container">
                        <div class="task-progress-bar" style="width: ${task.progress}%"></div>
                    </div>
                    <div class="task-status">${task.status}...</div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

function cancelTask(taskId) {
    const taskIndex = state.activeTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        state.activeTasks.splice(taskIndex, 1);
        updateTasksAndResultsDOM();
        showToast("Task dibatalkan.", "info");
    }
}

function renderResults() {
    const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
    const canSync = activeGen.id === 'kling-v3-std';

    return `
        <div class="results-section">
            <div class="results-header-row">
                <h3>Hasil Generasi</h3>
                ${canSync ? `<button class="btn-sync" onclick="syncTasks()">
                    <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Sync Kling 3
                </button>` : ''}
            </div>
            ${state.completedResults.length === 0 ? `
                <div class="empty-results">
                    <i data-lucide="image-off" style="width: 32px; height: 32px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 13px; margin: 0; font-weight: 500;">Belum ada hasil generasi.</p>
                </div>
            ` : `
                <div class="results-grid">
                    ${state.completedResults.map((res, index) => {
                        const gen = GENERATORS.find(g => g.id === res.generatorId) || GENERATORS[0];
                        return `
                        <div class="result-card">
                            <div class="result-media-wrapper">
                                ${res.type === 'video' ? `
                                    <video src="${res.url}" class="result-media" controls playsinline></video>
                                ` : res.type === 'audio' ? `
                                    <div class="audio-result-container">
                                        <audio src="${res.url}" controls style="width: 100%;"></audio>
                                    </div>
                                ` : `
                                    <img src="${res.url}" class="result-media">
                                `}
                                <div class="result-overlay-actions">
                                    <button class="btn-overlay-action btn-download" onclick="window.open('${res.url}', '_blank')" title="Download HD">
                                        <i data-lucide="download"></i>
                                    </button>
                                    ${res.type === 'image' ? `
                                    <button class="btn-overlay-action btn-seedream" onclick="editWithSeedream('${res.url}')" title="Edit with SeeDream">
                                        <i data-lucide="image-plus"></i>
                                    </button>
                                    ` : ''}
                                    <button class="btn-overlay-action btn-edit" onclick="editPrompt('${res.prompt ? res.prompt.replace(/'/g, "\\'") : ''}')" title="Edit Prompt">
                                        <i data-lucide="edit-3"></i>
                                    </button>
                                    <button class="btn-overlay-action btn-regenerate" onclick="regeneratePrompt('${res.prompt ? res.prompt.replace(/'/g, "\\'") : ''}', '${res.generatorId}')" title="Regenerate">
                                        <i data-lucide="refresh-cw"></i>
                                    </button>
                                    <button class="btn-overlay-action btn-delete" onclick="deleteResult(${index})" title="Hapus">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="result-info">
                                ${res.prompt ? `<div class="result-prompt">${res.prompt}</div>` : ''}
                                <div class="result-meta">
                                    <span class="result-model">${gen.name}</span>
                                    <span class="result-time">${new Date(res.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
}

async function syncTasks() {
    const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
    
    // Determine the best list endpoint
    let listEndpoint = activeGen.statusEndpoint;
    let listType = activeGen.pollingType;
    
    // Kling 3 specific list endpoint fallback
    if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-motion-control-std' || activeGen.id === 'kling-v3-motion-control-pro' || activeGen.id === 'kling-v3-omni-pro') {
        listEndpoint = (activeGen.id === 'kling-v3-motion-control-std' || activeGen.id === 'kling-v3-motion-control-pro')
            ? activeGen.endpoint
            : (activeGen.id === 'kling-v3-omni-pro' ? 'https://api.freepik.com/v1/ai/video/kling-v3-omni' : 'https://api.freepik.com/v1/ai/video/kling-v3');
        listType = 'list';
    } else if (activeGen.id === 'seedream-4-5-edit') {
        listEndpoint = 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit';
        listType = 'list';
    } else if (activeGen.id === 'pixverse-v5') {
        listEndpoint = 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5';
        listType = 'list';
    } else if (activeGen.id === 'runway') {
        listEndpoint = 'https://api.freepik.com/v1/ai/text-to-image/runway';
        listType = 'list';
    } else if (activeGen.id === 'flux-2-turbo') {
        listEndpoint = 'https://api.freepik.com/v1/ai/text-to-image/flux-2-turbo';
        listType = 'list';
    }

    if (!listEndpoint || listType !== 'list') {
        showToast("Fitur sync belum tersedia untuk model ini.", "info");
        return;
    }

    if (!state.apiKey) {
        showToast("Masukkan API Key terlebih dahulu.", "error");
        return;
    }

    const btn = document.querySelector('.btn-sync');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> Syncing...';
    }

    try {
        const url = new URL('/api/freepik/list', window.location.origin);
        url.searchParams.append('endpoint', listEndpoint);
        url.searchParams.append('apiKey', state.apiKey.trim());

        const response = await fetch(url);
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response in sync:", text);
            if (text.includes("Starting Server...")) {
                throw new Error("Server sedang memulai ulang. Silakan coba lagi dalam beberapa detik.");
            }
            if (text.includes("<!DOCTYPE html>") || text.includes("<!doctype html>")) {
                throw new Error("API Freepik sedang mengalami gangguan (Error 500/502). Silakan coba lagi nanti.");
            }
            throw new Error("Server mengembalikan respon yang tidak valid saat sinkronisasi.");
        }

        if (!response.ok) {
            if (response.status === 429) {
                state.globalError = "Limit API Freepik tercapai saat sinkronisasi. Harap tunggu sebentar.";
                renderContent();
                throw new Error(state.globalError);
            }
            
            // Handle "Tasks not found" gracefully
            const errMsg = (data.message || data.error || '').toLowerCase();
            if (response.status === 404 || errMsg.includes('not found')) {
                showToast("Tidak ada task yang ditemukan.", "info");
                return;
            }
            
            let apiMsg = data.message || data.error || "Gagal sinkronisasi.";
            if (typeof apiMsg === 'string' && (apiMsg.toLowerCase().includes("<!doctype html>") || apiMsg.toLowerCase().includes("<html"))) {
                apiMsg = "API Freepik sedang mengalami gangguan (Error 500/502). Silakan coba lagi nanti.";
            }
            throw new Error(apiMsg);
        }

        const tasks = data.data || data.items || (Array.isArray(data) ? data : []);
        
        // Handle "Tasks not found" gracefully even if response.ok is true
        const okErrMsg = (data.message || data.error || '').toLowerCase();
        if (okErrMsg.includes('not found')) {
            showToast("Tidak ada task yang ditemukan.", "info");
            return;
        }

        if (!Array.isArray(tasks)) throw new Error("Format data tidak valid.");

        let addedCount = 0;
        tasks.forEach(task => {
            const taskId = task.id || task.task_id;
            const status = (task.status || task.state || '').toUpperCase();
            const isDone = task.done === true || task.finished === true || status === 'COMPLETED' || status === 'FINISHED' || status === 'SUCCESS' || status === 'SUCCEEDED';
            
            if (isDone) {
                if (!state.completedResults.find(r => r.id === taskId)) {
                    const output = task.output || task;
                    const taskData = task.data || task;
                    
                    let videoUrl = 
                        (taskData.generated && Array.isArray(taskData.generated) && taskData.generated[0]) ||
                        (output.generated && Array.isArray(output.generated) && output.generated[0]) ||
                        output.video_url || 
                        output.url || 
                        output.image_url ||
                        (output.image && output.image.url) ||
                        (output.result && (output.result.url || (output.result.video && output.result.video.url) || (output.result.image && output.result.image.url))) ||
                        (output.generated && typeof output.generated === 'string' ? output.generated : null);
                    
                    // Exhaustive search fallback for sync
                    if (!videoUrl) {
                        const findUrl = (obj) => {
                            if (!obj) return null;
                            if (typeof obj === 'string') {
                                if ((obj.startsWith('http') || obj.startsWith('//')) && 
                                    (obj.includes('.mp4') || obj.includes('.mov') || obj.includes('.webm') || obj.includes('.jpg') || obj.includes('.png') || obj.includes('.webp') || obj.includes('video') || obj.includes('image') || obj.includes('freepik'))) {
                                    return obj;
                                }
                                return null;
                            }
                            if (typeof obj !== 'object') return null;
                            const priorityKeys = ['url', 'image_url', 'video_url', 'download_url', 'uri', 'link', 'src', 'video', 'image'];
                            for (const key of priorityKeys) {
                                if (typeof obj[key] === 'string' && (obj[key].startsWith('http') || obj[key].startsWith('//'))) {
                                    return obj[key];
                                }
                            }
                            for (const key in obj) {
                                const found = findUrl(obj[key]);
                                if (found) return found;
                            }
                            return null;
                        };
                        videoUrl = findUrl(task);
                    }
                    
                    if (videoUrl) {
                        state.completedResults.push({
                            id: taskId,
                            type: 'video',
                            url: videoUrl,
                            generatorId: activeGen.id,
                            timestamp: task.created_at || new Date().toISOString()
                        });
                        addedCount++;
                    }
                }
            }
        });

        if (addedCount > 0) {
            state.completedResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            updateTasksAndResultsDOM();
            showToast(`${addedCount} task baru berhasil disinkronkan.`, "success");
        } else {
            showToast("Tidak ada task baru yang ditemukan.", "info");
        }
    } catch (error) {
        console.error("Sync error:", error);
        showToast(error.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="refresh-cw"></i> Sync ${activeGen.name.split(' ')[0]} ${activeGen.badge || ''}`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// --- LOGIC FUNCTIONS ---

function ensureHttps(url) {
    if (!url || typeof url !== 'string') return url;
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
        return 'https:' + url;
    }
    // Handle http URLs
    if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
    }
    return url;
}

async function generate() {
    const btn = document.querySelector('.btn-generate');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Processing...';
    }

    try {
        if (Date.now() < (state.cooldownUntil || 0)) {
            throw new Error("Harap tunggu beberapa detik sebelum generate lagi.");
        }

        if (!state.apiKey) {
            throw new Error("Masukkan API Key Freepik terlebih dahulu di halaman Setup.");
        }

        const uploadState = getUploadState();

        if (uploadState.uploading.image || uploadState.uploading.video) {
            throw new Error("Mohon tunggu hingga proses upload selesai.");
        }

        if (state.activeTasks.length >= state.taskLimit) {
            throw new Error(`Limit task tercapai (${state.taskLimit}). Tunggu hingga task selesai.`);
        }

        const now = Date.now();
        state.generationHistory = (state.generationHistory || []).filter(t => now - t < 60000);
        if (state.generationHistory.length >= state.queueLimit) {
            throw new Error(`Limit antrean tercapai (${state.queueLimit}/menit). Tunggu beberapa saat.`);
        }

        // Priority: Use the public URL if available (required for Kling), fallback to base64 only if necessary (e.g. SeeDream)
        let imageInput = uploadState.urls.image || uploadState.files.image;
        let videoInput = uploadState.urls.video || uploadState.files.video;

        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        if (!activeGen) throw new Error("Model generator tidak ditemukan.");

        // Force base64 for SeeDream to avoid URL accessibility issues
        if (activeGen.id === 'seedream-4-5-edit') {
            imageInput = uploadState.files.image || uploadState.urls.image;
            videoInput = uploadState.files.video || uploadState.urls.video;
        }

        // Kling models strictly require public HTTPS URLs
        const needsPublicUrl = activeGen.id.toLowerCase().includes('kling') || activeGen.id === 'seedance-1-5-pro' || activeGen.id === 'pixverse-v5';
        if (needsPublicUrl) {
            console.log(`[DEBUG] ${activeGen.name} Input URLs:`, {
                image: imageInput,
                video: videoInput
            });
            
            if (imageInput && imageInput.startsWith('data:')) {
                throw new Error(`Gagal mengunggah gambar ke server publik. ${activeGen.name} memerlukan URL publik (HTTPS). Silakan coba upload ulang atau masukkan URL manual.`);
            }
            if (videoInput && videoInput.startsWith('data:')) {
                throw new Error(`Gagal mengunggah video ke server publik. ${activeGen.name} memerlukan URL publik (HTTPS). Silakan coba upload ulang atau masukkan URL manual.`);
            }
        }

        // Validation based on model
        if (activeGen.id.includes('motion-control')) {
            if (!imageInput || !videoInput) {
                throw new Error("Wajib upload Gambar Karakter & Video Referensi (atau masukkan URL)");
            }
        } else if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-omni-pro') {
            if (!state.currentPrompt && !imageInput) {
                throw new Error("Wajib masukkan Prompt atau Start Image untuk Kling 3.");
            }
        } else if (activeGen.id === 'seedream-4-5-edit') {
            if (!imageInput && !videoInput) {
                throw new Error("Wajib upload setidaknya satu Reference Image untuk SeeDream 4.5 Edit.");
            }
            if (!state.currentPrompt) {
                throw new Error("Wajib masukkan Prompt untuk SeeDream 4.5 Edit.");
            }
        } else if (activeGen.id === 'seedance-1-5-pro') {
            if (!state.currentPrompt && !imageInput) {
                throw new Error("Wajib masukkan Prompt atau Image untuk Seedance 1.5 Pro.");
            }
        } else if (activeGen.id === 'runway') {
            if (!state.currentPrompt) {
                throw new Error("Wajib masukkan Prompt untuk Runway.");
            }
        } else if (activeGen.id === 'flux-2-turbo') {
            if (!state.currentPrompt) {
                throw new Error("Wajib masukkan Prompt untuk Flux 2 Turbo.");
            }
        }

        let finalPrompt = state.currentPrompt || "";
        
        let shouldTranslate = true;
        if (!finalPrompt) {
            shouldTranslate = false;
        } else if (activeGen.id === 'elevenlabs-turbo-v2-5') {
            shouldTranslate = false;
        } else if (activeGen.outputType === 'video' && !activeGen.id.includes('motion-control')) {
            shouldTranslate = false;
        }

        if (shouldTranslate) {
            try {
                const translateRes = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: finalPrompt })
                });
                if (translateRes.ok) {
                    const translateData = await translateRes.json();
                    if (translateData.translatedText && translateData.translatedText !== finalPrompt) {
                        console.log(`Translated prompt: "${finalPrompt}" -> "${translateData.translatedText}"`);
                        finalPrompt = translateData.translatedText;
                    }
                }
                if (btn) btn.innerHTML = '⏳ Processing...';
            } catch (e) {
                console.error("Translation failed, using original prompt", e);
                if (btn) btn.innerHTML = '⏳ Processing...';
            }
        }

        let body = {};
        if (activeGen.id.includes('motion-control')) {
            body = {
                image_url: ensureHttps(imageInput),
                video_url: ensureHttps(videoInput),
                prompt: finalPrompt, 
                character_orientation: state.settings.orientation,
                cfg_scale: state.settings.cfg_scale
            };
        } else if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-omni-pro') {
            let ar = state.settings.aspect_ratio;
            if (ar === 'square_1_1') ar = '1:1';
            else if (ar === 'widescreen_16_9') ar = '16:9';
            else if (ar === 'social_story_9_16') ar = '9:16';
            
            if (!['16:9', '9:16', '1:1'].includes(ar)) {
                ar = '16:9';
            }

            if (activeGen.id === 'kling-v3-omni-pro') {
                body = {
                    prompt: finalPrompt,
                    start_image_url: ensureHttps(imageInput) || undefined,
                    end_image_url: ensureHttps(videoInput) || undefined,
                    aspect_ratio: ar,
                    duration: state.settings.duration,
                    generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true
                };
                // For image-to-video, if start_image_url is provided, image_url is also required by the API
                if (body.start_image_url) {
                    body.image_url = body.start_image_url;
                }
            } else {
                body = {
                    prompt: finalPrompt,
                    start_image_url: ensureHttps(imageInput) || undefined,
                    end_image_url: ensureHttps(videoInput) || undefined,
                    aspect_ratio: ar,
                    duration: state.settings.duration,
                    negative_prompt: state.settings.negative_prompt,
                    cfg_scale: state.settings.cfg_scale,
                    generate_audio: true
                };
            }
        } else if (activeGen.id === 'seedream-4-5-edit') {
            const img1 = (imageInput || "").toString().trim();
            const img2 = (videoInput || "").toString().trim();
            
            // Match the curl example exactly: an array of valid URLs or base64
            const referenceImages = [
                img1 ? (img1.startsWith('http') ? ensureHttps(img1) : img1) : "",
                img2 ? (img2.startsWith('http') ? ensureHttps(img2) : img2) : ""
            ].filter(url => url !== "");
            
            // Ensure aspect_ratio is valid for SeeDream
            let ar = state.settings.aspect_ratio || "square_1_1";
            const validARs = ['square_1_1', 'widescreen_16_9', 'social_story_9_16', 'portrait_2_3', 'traditional_3_4', 'standard_3_2', 'classic_4_3', 'cinematic_21_9'];
            if (!validARs.includes(ar)) {
                ar = 'square_1_1';
            }

            body = {
                prompt: finalPrompt,
                reference_images: referenceImages,
                aspect_ratio: ar,
                enable_safety_checker: state.settings.safety_checker !== undefined ? state.settings.safety_checker : true
            };
            
            if (state.settings.seed !== '' && state.settings.seed !== undefined) {
                body.seed = parseInt(state.settings.seed);
            }
        } else if (activeGen.id === 'flux-2-pro') {
            let prompt = finalPrompt;
            let negativePrompt = state.settings.negative_prompt || "";
            
            if (state.settings.style === 'Realistic') {
                // Enhance realistic style to avoid "poster" look
                prompt = `photorealistic raw photo of ${prompt}, high detail, 8k, highly detailed skin texture, natural lighting, masterwork`;
                negativePrompt = (negativePrompt ? negativePrompt + ", " : "") + "poster, text, typography, watermark, logo, distorted, cartoon, anime, illustration, painting";
            } else if (state.settings.style && state.settings.style !== 'None') {
                prompt = `${state.settings.style} style, ${prompt}`;
            }
            
            let width = 1024;
            let height = 1024;
            const ar = state.settings.aspect_ratio || "16:9";
            
            if (ar === '16:9') {
                width = 1440;
                height = 810;
            } else if (ar === '9:16') {
                width = 810;
                height = 1440;
            } else if (ar === '1:1') {
                width = 1024;
                height = 1024;
            }
            
            body = {
                prompt: prompt,
                negative_prompt: negativePrompt,
                width: width,
                height: height,
                cfg_scale: state.settings.cfg_scale !== undefined ? state.settings.cfg_scale : 0.5,
                steps: state.settings.steps || 25,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'pixverse-v5') {
            if (!imageInput) {
                throw new Error("Wajib upload Gambar untuk Pixverse V5.");
            }
            body = {
                prompt: finalPrompt || "Cinematic video",
                image_url: ensureHttps(imageInput),
                negative_prompt: state.settings.negative_prompt || "",
                resolution: state.settings.resolution || "360p",
                duration: parseInt(state.settings.duration) || 5,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'seedance-1-5-pro') {
            body = {
                prompt: finalPrompt,
                duration: parseInt(state.settings.duration) || 5,
                generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true,
                camera_fixed: state.settings.camera_fixed !== undefined ? state.settings.camera_fixed : false,
                aspect_ratio: state.settings.aspect_ratio || "widescreen_16_9",
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : -1
            };
            
            if (imageInput) {
                // Seedance 1.5 Pro on Freepik usually expects 'image_url', but 'image' is sometimes used
                const imgUrl = ensureHttps(imageInput);
                body.image_url = imgUrl;
                body.image = imgUrl; 
            }
        } else if (activeGen.id === 'elevenlabs-turbo-v2-5') {
            if (!finalPrompt) {
                throw new Error("Wajib masukkan teks untuk Voice Over.");
            }
            body = {
                text: finalPrompt,
                voice_id: state.settings.voice || 'URAuwR59OqCASDVp35yi',
                stability: state.settings.stability !== undefined ? state.settings.stability : 0.5,
                similarity_boost: state.settings.similarity_boost !== undefined ? state.settings.similarity_boost : 0.2,
                speed: state.settings.speed !== undefined ? state.settings.speed : 1,
                use_speaker_boost: state.settings.use_speaker_boost !== undefined ? state.settings.use_speaker_boost : true
            };
        } else if (activeGen.id === 'music-generation') {
            const musicPrompt = buildMusicPrompt();
            if (isMusicSelectionEmpty()) {
                throw new Error("Wajib masukkan deskripsi musik atau pilih opsi.");
            }
            body = {
                prompt: musicPrompt,
                music_length_seconds: parseInt(state.settings.music_duration) || 30
            };
        } else if (activeGen.id === 'runway') {
            body = {
                prompt: finalPrompt,
                ratio: state.settings.aspect_ratio || "1920:1080"
            };
            if (state.settings.seed !== '' && state.settings.seed !== undefined) {
                body.seed = parseInt(state.settings.seed);
            }
        } else if (activeGen.id === 'flux-2-turbo') {
            let width = 1024;
            let height = 1024;
            const ar = state.settings.aspect_ratio || "16:9";
            
            if (ar === '16:9') {
                width = 1440;
                height = 810;
            } else if (ar === '9:16') {
                width = 810;
                height = 1440;
            } else if (ar === '1:1') {
                width = 1024;
                height = 1024;
            }

            body = {
                prompt: finalPrompt,
                guidance_scale: state.settings.guidance_scale !== undefined ? parseFloat(state.settings.guidance_scale) : 2.5,
                image_size: { width, height },
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295),
                enable_safety_checker: state.settings.safety_checker !== undefined ? state.settings.safety_checker : true
            };
        }

        console.log("Generating with body:", body);
        const currentKey = state.apiKey.trim();
        
        const response = await fetch('/api/freepik/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                endpoint: activeGen.endpoint,
                apiKey: currentKey,
                body: body
            })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response:", text);
            if (text.includes("Starting Server...")) {
                throw new Error("Server sedang memulai ulang. Silakan coba lagi dalam beberapa detik.");
            }
            if (text.includes("<!DOCTYPE html>") || text.includes("<!doctype html>")) {
                throw new Error("API Freepik sedang mengalami gangguan (Error 500/502). Silakan coba lagi nanti.");
            }
            throw new Error("Server mengembalikan respon yang tidak valid. Silakan coba lagi.");
        }

        if (!response.ok) {
            console.error("Full API Error Data:", data);
            
            // Extract detailed error messages from Freepik
            let detailMsg = '';
            if (data.details) detailMsg = typeof data.details === 'string' ? data.details : JSON.stringify(data.details);
            if (data.errors) detailMsg = typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors);
            if (data.detail) detailMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            
            let apiMsg = data.message || data.error || 'Gagal membuat task.';
            if (typeof apiMsg === 'string' && (apiMsg.toLowerCase().includes("<!doctype html>") || apiMsg.toLowerCase().includes("<html"))) {
                apiMsg = "API Freepik sedang mengalami gangguan (Error 500/502). Silakan coba lagi nanti.";
            }
            const fullErrorMsg = detailMsg ? `${apiMsg} (${detailMsg})` : apiMsg;
            
            if (response.status === 429) {
                state.globalError = "Limit API Freepik telah tercapai (Too Many Requests). Silakan coba lagi nanti.";
                renderContent();
                throw new Error(state.globalError);
            } else if (response.status === 403 && (apiMsg.toLowerCase().includes('quota') || apiMsg.toLowerCase().includes('limit'))) {
                state.globalError = "Kuota API Key Freepik Anda telah habis. Silakan periksa akun Freepik Anda atau gunakan API Key lain.";
                renderContent();
                throw new Error(state.globalError);
            } else if (response.status === 402) {
                state.globalError = "Saldo/Kredit API Freepik Anda tidak mencukupi untuk request ini.";
                renderContent();
                throw new Error(state.globalError);
            } else if (response.status === 400) {
                throw new Error(`Bad Request (400): ${fullErrorMsg}. Pastikan format gambar valid dan prompt menggunakan bahasa Inggris.`);
            }
            
            throw new Error(fullErrorMsg);
        }

        console.log("API Response:", data);
        
        // Detect Task ID from various possible response structures
        let taskId = data.id || data.task_id || (data.data && (data.data.id || data.data.task_id));
        
        // Recursive search for ID if not found in common paths
        if (!taskId) {
            const findId = (obj) => {
                if (!obj || typeof obj !== 'object') return null;
                if (typeof obj.id === 'string' && obj.id.length > 5) return obj.id;
                if (typeof obj.task_id === 'string') return obj.task_id;
                for (const key in obj) {
                    const found = findId(obj[key]);
                    if (found) return found;
                }
                return null;
            };
            taskId = findId(data);
        }

        console.log("Detected Task ID:", taskId);

        if (!taskId) {
            console.error("Full API Response for debugging:", JSON.stringify(data, null, 2));
            throw new Error("Task ID tidak ditemukan dalam respon API. Silakan coba lagi.");
        }

        state.activeTasks.push({
            id: taskId,
            modelName: activeGen.name,
            generatorId: state.activeGenerator,
            prompt: state.currentPrompt || "",
            progress: 0,
            status: 'Processing'
        });
        
        // Record generation for queue limit tracking
        state.generationHistory.push(Date.now());

        showToast("🚀 Task berhasil dibuat! Sedang diproses...", "success");
        updateTasksAndResultsDOM();
        
        // Add a small initial delay before polling to ensure task is registered
        setTimeout(() => pollTaskStatus(taskId), 2000);

    } catch (error) {
        console.error("Generate error:", error);
        showToast(error.message, "error");
    } finally {
        state.cooldownUntil = Date.now() + 5000; // 5 seconds cooldown
        if (btn) {
            const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
            let secondsLeft = 5;
            btn.innerHTML = `⏳ Cooldown (${secondsLeft}s)...`;
            
            const countdownInterval = setInterval(() => {
                secondsLeft--;
                const currentBtn = document.querySelector('.btn-generate');
                if (currentBtn) {
                    currentBtn.innerHTML = `⏳ Cooldown (${secondsLeft}s)...`;
                }
                
                if (secondsLeft <= 0) {
                    clearInterval(countdownInterval);
                    if (currentBtn && Date.now() >= state.cooldownUntil) {
                        currentBtn.disabled = false;
                        currentBtn.innerHTML = `🚀 Generate ${activeGen.outputType.charAt(0).toUpperCase() + activeGen.outputType.slice(1)}`;
                    }
                }
            }, 1000);
        }
    }
}

async function pollTaskStatus(taskId, fallbackIndex = 0) {
    const taskIndex = state.activeTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    const task = state.activeTasks[taskIndex];
    const activeGen = GENERATORS.find(g => g.id === task.generatorId) || GENERATORS.find(g => g.id === state.activeGenerator);
    
    const currentKey = state.apiKey ? state.apiKey.trim() : '';
    if (!currentKey) {
        console.error("Polling error: No API Key in state");
        return;
    }

    // List of potential status endpoints and formats to try if 404 occurs
    const fallbacks = [
        { base: activeGen.statusEndpoint || 'https://api.freepik.com/v1/ai/video/kling-v3', type: activeGen.pollingType || 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/kling-v3', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/kling-v3', type: 'list' },
        { base: 'https://api.freepik.com/v1/ai/video/tasks', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/tasks', type: 'list' },
        { base: 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/seedance-1-5-pro-720p', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/status', type: 'query' },
        { base: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/voiceover/elevenlabs-turbo-v2-5', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/music-generation', type: 'path' }
    ];
    
    if (fallbackIndex >= fallbacks.length) {
        if (taskIndex !== -1) {
            showToast(`Gagal mengecek status (404): Task ID tidak ditemukan di semua endpoint yang dicoba.`, "error");
            state.activeTasks.splice(taskIndex, 1);
            updateTasksAndResultsDOM();
        }
        return;
    }

    const fallback = fallbacks[fallbackIndex];
    const statusBase = fallback.base;
    
    let url = `/api/freepik/status/${taskId}?endpoint=${encodeURIComponent(statusBase)}&apiKey=${encodeURIComponent(currentKey)}${fallback.type === 'query' ? '&useQuery=true' : ''}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response in polling:", text);
            if (text.includes("Starting Server...")) {
                console.log("Server is restarting, will retry polling...");
            }
            return; // Ignore parse errors in polling and try again later
        }
        
        // Re-find task index in case it was modified during the await
        const currentTaskIndex = state.activeTasks.findIndex(t => t.id === taskId);
        if (currentTaskIndex === -1) return;

        if (!response.ok) {
            // If we get a 429, don't try fallbacks, just show error
            if (response.status === 429) {
                console.error("Polling limit reached (429)");
                state.globalError = "Limit API Freepik tercapai saat mengecek status. Mencoba lagi otomatis dalam 10 detik...";
                renderContent();
                setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 10000);
                return;
            }

            // If we get a 404, try the next fallback
            if (response.status === 404) {
                console.log(`Endpoint ${statusBase} returned 404, trying next fallback (${fallbackIndex + 1}) in 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return pollTaskStatus(taskId, fallbackIndex + 1);
            }

            console.error("Polling failed with status:", response.status, data);
            let apiMsg = data.message || 'Unknown error';
            if (typeof apiMsg === 'string' && (apiMsg.toLowerCase().includes("<!doctype html>") || apiMsg.toLowerCase().includes("<html"))) {
                apiMsg = "API Freepik sedang mengalami gangguan (Error 500/502).";
            }
            showToast(`Gagal mengecek status (${response.status}): ${apiMsg}`, "error");
            state.activeTasks.splice(currentTaskIndex, 1);
            updateTasksAndResultsDOM();
            return;
        }

        // If we found a working endpoint, update the generator's statusEndpoint for future use
        if (fallbackIndex > 0 && activeGen) {
            activeGen.statusEndpoint = statusBase;
        }

        console.log("Polling Raw Response Data:", JSON.stringify(data, null, 2));
        
        // Normalize data structure (handle nested 'data' object)
        let taskData = null;
        
        if (fallback.type === 'list') {
            // If it's a list, we need to find our task ID in the array
            const items = data.data || data.items || (Array.isArray(data) ? data : []);
            if (Array.isArray(items)) {
                taskData = items.find(item => (item.id === taskId || item.task_id === taskId));
            }
            
            if (!taskData) {
                console.log(`Task ${taskId} not found in list from ${statusBase}, trying next fallback...`);
                return pollTaskStatus(taskId, fallbackIndex + 1);
            }
        } else {
            taskData = data.data || data;
        }
        
        // Robust status detection
        let status = (taskData.status || taskData.state || '').toUpperCase();
        
        // Terminal success states
        const isDone = status === 'COMPLETED' || status === 'FINISHED' || status === 'SUCCESS' || status === 'SUCCEEDED' || taskData.done === true || taskData.finished === true;
        // Terminal failure states
        const isFailed = status === 'FAILED' || status === 'ERROR' || status === 'REJECTED' || status === 'CANCELLED';

        let apiProgress = taskData.progress;
        let currentProgress = state.activeTasks[currentTaskIndex].progress;
        let newProgress = currentProgress;
        
        if (apiProgress !== undefined && apiProgress !== null) {
            // Only use API progress if it explicitly provides a value > 0 or greater than our simulated progress
            if (apiProgress > currentProgress || apiProgress > 0) {
                newProgress = apiProgress;
            }
        }

        if (isDone) {
            console.log(`Task ${taskId} reached terminal state: ${status}. Searching for URL...`);
            // Try to find the video URL in various possible locations
            let videoUrl = null;
            
            // 1. Direct check in common paths
            const output = taskData.output || taskData;
            
            // Prioritize 'generated' array for SeeDream and similar models
            videoUrl = 
                (taskData.generated && Array.isArray(taskData.generated) && (typeof taskData.generated[0] === 'string' ? taskData.generated[0] : taskData.generated[0].url)) ||
                (output.generated && Array.isArray(output.generated) && (typeof output.generated[0] === 'string' ? output.generated[0] : output.generated[0].url)) ||
                output.image_url || 
                output.url || 
                output.video_url || 
                output.audio_url || 
                (output.image && output.image.url) ||
                (output.video && output.video.url) ||
                (output.audio && output.audio.url) ||
                (output.result && (output.result.url || (output.result.image && output.result.image.url) || (output.result.video && output.result.video.url) || (output.result.audio && output.result.audio.url))) ||
                (output.items && output.items[0] && (typeof output.items[0] === 'string' ? output.items[0] : output.items[0].url)) ||
                (output.data && (output.data.url || (Array.isArray(output.data) && output.data[0] && (typeof output.data[0] === 'string' ? output.data[0] : output.data[0].url)))) ||
                (taskData.result && taskData.result.url) ||
                (taskData.image && taskData.image.url) ||
                (taskData.video && taskData.video.url) ||
                (taskData.audio && taskData.audio.url);

            // 2. Recursive search fallback if still not found
            if (!videoUrl) {
                const findUrl = (obj, depth = 0) => {
                    if (!obj || depth > 10) return null;
                    
                    // If it's a string, check if it's a URL
                    if (typeof obj === 'string') {
                        const isUrl = obj.startsWith('http') || obj.startsWith('//');
                        const isMedia = obj.includes('.mp4') || obj.includes('.mov') || obj.includes('.webm') || obj.includes('.jpg') || obj.includes('.png') || obj.includes('.webp') || obj.includes('.mp3') || obj.includes('.wav') || obj.includes('video') || obj.includes('image') || obj.includes('audio') || obj.includes('freepik');
                        if (isUrl && isMedia) return obj;
                        return null;
                    }
                    
                    if (typeof obj !== 'object') return null;
                    
                    // Check common property names first on this object level
                    const priorityKeys = ['url', 'image_url', 'video_url', 'download_url', 'uri', 'link', 'src', 'video', 'image', 'output', 'generated_video', 'generated_image'];
                    for (const key of priorityKeys) {
                        const val = obj[key];
                        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('//'))) {
                            return val;
                        }
                        // If the priority key is an object, search inside it immediately
                        if (val && typeof val === 'object') {
                            const found = findUrl(val, depth + 1);
                            if (found) return found;
                        }
                    }
                    
                    // Recurse into all other children
                    for (const key in obj) {
                        if (priorityKeys.includes(key)) continue; // Already checked
                        const found = findUrl(obj[key], depth + 1);
                        if (found) return found;
                    }
                    return null;
                };
                videoUrl = findUrl(taskData); // Search within taskData specifically
            }
            
            if (!videoUrl) {
                // If task is done but no URL, it's likely a CDN propagation delay
                // Try polling more times with increasing delay
                const retryCount = state.activeTasks[currentTaskIndex].urlRetryCount || 0;
                const maxRetries = 6; // Total ~30 seconds of retrying for URL
                
                if (retryCount < maxRetries) {
                    console.log(`Task ${taskId} is ${status} but URL is missing. Retrying in 5s (${retryCount + 1}/${maxRetries})...`);
                    state.activeTasks[currentTaskIndex].urlRetryCount = retryCount + 1;
                    state.activeTasks[currentTaskIndex].status = 'Finalizing...';
                    state.activeTasks[currentTaskIndex].progress = 99;
                    updateTasksAndResultsDOM();
                    
                    setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 5000);
                    return;
                }

                console.error("Output URL not found after retries. Full data:", JSON.stringify(data, null, 2));
                showToast("Error: Video URL tidak ditemukan meskipun status sudah selesai. Silakan cek console log.", "error");
                state.activeTasks.splice(currentTaskIndex, 1);
                updateTasksAndResultsDOM();
                return;
            }

            const result = {
                id: taskId,
                type: activeGen.outputType,
                url: videoUrl,
                generatorId: task.generatorId, // Use the task's original generatorId
                prompt: state.activeTasks[currentTaskIndex].prompt || "",
                timestamp: new Date().toISOString()
            };
            state.completedResults.unshift(result);
            state.activeTasks.splice(currentTaskIndex, 1);
            updateTasksAndResultsDOM();
        } else if (isFailed) {
            console.error("Task failed. Full task data from Freepik:", JSON.stringify(taskData, null, 2));
            let errMsg = taskData.error_message || taskData.reason || taskData.detail || taskData.error || taskData.message;
            
            if (!errMsg && taskData.status_detail) {
                errMsg = taskData.status_detail.message || taskData.status_detail.reason;
            }
            
            if (!errMsg) {
                if (activeGen.outputType === 'video') {
                    errMsg = "Unknown Freepik error (Status: FAILED). Pastikan video referensi berdurasi 3-30 detik dan format didukung.";
                } else {
                    errMsg = "Unknown Freepik error (Status: FAILED). Silakan cek parameter input atau coba lagi nanti.";
                }
            }
            
            showToast("Generation failed: " + errMsg, "error");
            state.activeTasks.splice(currentTaskIndex, 1);
            updateTasksAndResultsDOM();
        } else {
            // Still processing (PENDING, PROCESSING, etc.)
            state.activeTasks[currentTaskIndex].progress = newProgress;
            state.activeTasks[currentTaskIndex].status = status || 'Processing';
            updateTasksAndResultsDOM();
            setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 5000);
        }
    } catch (error) {
        console.error("Polling error:", error);
        showToast("Terjadi kesalahan saat mengecek status. Silakan coba lagi.", "error");
    }
}

function toggleUrlInput() {
    state.showUrlInput = !state.showUrlInput;
    
    // Update only the upload section to prevent flickering in header/selector
    const uploadSection = document.querySelector('.upload-section-wrapper');
    if (uploadSection) {
        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        uploadSection.innerHTML = renderUploadSection(activeGen);
        // Re-initialize lucide icons for the new content
        if (window.lucide) window.lucide.createIcons();
    } else {
        renderContent();
    }
}

function updateUrl(type, val) {
    const uploadState = getUploadState();
    uploadState.urls[type] = val;
    uploadState.autoUploaded[type] = false;
    // No need to re-render everything when typing in URL input
    // Just update the state, the inputs already have the value
}

function setActiveGenerator(id) {
    if (state.activeGenerator === id) return;
    console.log("Model select:", id);
    
    // Save current prompt to the old generator before switching
    state.generatorPrompts[state.activeGenerator] = state.currentPrompt;
    
    state.activeGenerator = id;
    
    // Restore prompt for the new generator
    state.currentPrompt = state.generatorPrompts[id] || '';

    // Reset settings to defaults for the new generator
    if (id === 'kling-v3-std') {
        state.settings.aspect_ratio = '16:9';
        state.settings.duration = '5';
        state.settings.cfg_scale = 0.5;
        state.settings.negative_prompt = 'blur, distort, and low quality';
    } else if (id === 'seedance-1-5-pro') {
        state.settings.aspect_ratio = 'widescreen_16_9';
        state.settings.duration = '5';
        state.settings.generate_audio = true;
        state.settings.camera_fixed = false;
        state.settings.seed = '';
    } else if (id === 'seedream-4-5-edit') {
        state.settings.aspect_ratio = 'square_1_1';
        state.settings.safety_checker = true;
        state.settings.seed = '';
    } else if (id === 'pixverse-v5') {
        state.settings.aspect_ratio = '16:9';
        state.settings.resolution = '360p';
        state.settings.duration = '5';
        state.settings.seed = '';
    } else if (id === 'flux-2-pro') {
        state.settings.aspect_ratio = '16:9';
        state.settings.cfg_scale = 0.5;
        state.settings.steps = 25;
        state.settings.style = 'Realistic';
        state.settings.seed = '';
    } else if (id === 'elevenlabs-turbo-v2-5') {
        state.settings.voice = 'URAuwR59OqCASDVp35yi';
        state.settings.stability = 0.5;
        state.settings.similarity_boost = 0.2;
        state.settings.speed = 1;
        state.settings.use_speaker_boost = true;
    } else {
        state.settings.orientation = 'video';
        state.settings.cfg_scale = 0.5;
    }
    
    // Update active class in DOM surgically to prevent scroll reset
    const modelItems = document.querySelectorAll('.model-item');
    if (modelItems.length > 0) {
        modelItems.forEach(item => {
            const onclickAttr = item.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${id}'`) || onclickAttr.includes(`"${id}"`)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    } else {
        const modelSelector = document.querySelector('.model-selector');
        if (modelSelector) {
            modelSelector.innerHTML = renderModelSelector();
            if (window.lucide) lucide.createIcons();
        }
    }

    // Then update the rest of the content
    const activeGen = GENERATORS.find(g => g.id === id) || GENERATORS[0];
    
    // Update Model Info
    const modelInfo = document.querySelector('.model-info-card');
    if (modelInfo) {
        modelInfo.outerHTML = renderModelInfo(activeGen);
    }

    // Update Upload Section
    const uploadSection = document.querySelector('.upload-section-wrapper');
    if (uploadSection) {
        uploadSection.innerHTML = renderUploadSection(activeGen);
    }

    // Update Settings
    const settingsSection = document.querySelector('.settings-section');
    if (settingsSection) {
        settingsSection.outerHTML = renderSettings(activeGen);
    }

    // Update Prompt Section
    const promptSection = document.querySelector('.prompt-section');
    if (promptSection) {
        promptSection.outerHTML = renderPromptSection();
    }

    // Update Generate Button
    const genBtn = document.querySelector('.generate-container');
    if (genBtn) {
        genBtn.outerHTML = renderGenerateButton(activeGen);
    }

    // Update Results Section to show/hide Sync button
    updateTasksAndResultsDOM();

    // Re-initialize lucide icons
    if (window.lucide) window.lucide.createIcons();
}

function triggerUpload(type) {
    document.getElementById(`file-input-${type}`).click();
}

function updateUploadDOM() {
    const uploadSection = document.querySelector('.upload-section-wrapper');
    if (uploadSection) {
        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        uploadSection.innerHTML = renderUploadSection(activeGen);
        if (window.lucide) window.lucide.createIcons();
    } else {
        renderContent();
    }
}

async function compressImageFile(file) {
    if (!file.type.startsWith('image/')) return file;
    if (file.size <= 500 * 1024) return file; // Skip if already < 500KB

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const MAX_DIM = 1920;
                if (width > height && width > MAX_DIM) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                } else if (height > MAX_DIM) {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    const newFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    console.log(`Compressed image from ${(file.size/1024).toFixed(1)}KB to ${(newFile.size/1024).toFixed(1)}KB`);
                    resolve(newFile);
                }, file.type, 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleFileChange(type, input) {
    let file = input.files[0];
    if (!file) return;

    // Client-side size validation (30MB limit to avoid proxy 413 errors)
    const MAX_SIZE_MB = 30;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`Ukuran file terlalu besar. Maksimal ${MAX_SIZE_MB}MB.`, "error");
        input.value = ''; // Reset input
        return;
    }

    console.log(`Uploading ${type}:`, file.name);
    
    // Set uploading state
    const uploadState = getUploadState();
    uploadState.uploading[type] = true;
    
    updateUploadDOM();

    // Auto-compress image if > 500KB
    if (file.type.startsWith('image/') && file.size > 500 * 1024) {
        try {
            file = await compressImageFile(file);
        } catch (err) {
            console.error("Compression failed, using original file", err);
        }
    }

    // 1. Show local preview immediately and upload
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Result = e.target.result;
        uploadState.files[type] = base64Result;
        updateUploadDOM();

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file: base64Result,
                    name: file.name,
                    type: file.type
                })
            });

            const contentType = response.headers.get("content-type");
            const text = await response.text();
            let data;
            
            if (contentType && contentType.includes("application/json")) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error("Failed to parse JSON response in upload:", text);
                    throw new Error("Server mengembalikan respon yang tidak valid saat upload.");
                }
            } else {
                if (text.includes("Cookie check") || text.includes("Action required")) {
                    state.showSetup = true;
                    renderContent();
                    throw new Error("Akses diblokir browser. Silakan klik tombol kuning '🔓 Klik untuk Authenticate' di bawah Logo ND STUDIO PRO.");
                }
                console.error("Non-JSON response from server:", text);
                throw new Error("Server mengembalikan respon yang tidak valid (bukan JSON).");
            }

            if (!response.ok) {
                let apiMsg = data.message || "Gagal mengupload file.";
                if (typeof apiMsg === 'string' && (apiMsg.toLowerCase().includes("<!doctype html>") || apiMsg.toLowerCase().includes("<html"))) {
                    apiMsg = "API Freepik sedang mengalami gangguan (Error 500/502). Silakan coba lagi nanti.";
                }
                throw new Error(apiMsg);
            }

            const publicUrl = data.url;
            console.log(`File uploaded successfully. Public URL: ${publicUrl}`);
            
            uploadState.urls[type] = publicUrl;
            uploadState.autoUploaded[type] = true;
        } catch (error) {
            console.error("Upload error:", error);
            showToast(error.message || "Gagal mengupload file. Silakan coba lagi.", "error");
            uploadState.files[type] = null;
        } finally {
            uploadState.uploading[type] = false;
            updateUploadDOM();
        }
    };
    reader.readAsDataURL(file);
}

function removeFile(e, type) {
    e.stopPropagation();
    console.log(`Removing ${type}`);
    const uploadState = getUploadState();
    uploadState.files[type] = null;
    uploadState.urls[type] = '';
    uploadState.uploading[type] = false;
    
    updateUploadDOM();
}

function updatePrompt(val) {
    state.currentPrompt = val;
    state.generatorPrompts[state.activeGenerator] = val;
    
    const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
    const maxChars = activeGen.id === 'elevenlabs-turbo-v2-5' ? 40000 : 2500;
    
    // Update counter directly for performance, but state is updated
    const counter = document.querySelector('.prompt-counter');
    if (counter) counter.innerText = `${val.length}/${maxChars}`;

    // For music generation, update preview and button state
    if (state.activeGenerator === 'music-generation') {
        const preview = document.querySelector('.music-prompt-preview-text');
        if (preview) {
            preview.innerText = buildMusicPrompt();
        }
        
        // Update button state
        const btn = document.querySelector('.btn-generate');
        if (btn && !state.apiKey) {
            // keep warning state
        } else if (btn) {
            const isEmpty = isMusicSelectionEmpty();
            btn.disabled = isEmpty || Date.now() < (state.cooldownUntil || 0);
        }
    }
}

function updateMusicSelection(key, val) {
    state.musicSelections[key] = val;
    updateMusicUI();
}

function toggleMusicInstrument(instrument) {
    const idx = state.musicSelections.instruments.indexOf(instrument);
    if (idx === -1) {
        state.musicSelections.instruments.push(instrument);
    } else {
        state.musicSelections.instruments.splice(idx, 1);
    }
    updateMusicUI();
}

function setMusicSuggestion(suggestion) {
    state.currentPrompt = suggestion;
    state.generatorPrompts['music-generation'] = suggestion;
    
    // Update textarea directly
    const textarea = document.querySelector('.prompt-textarea');
    if (textarea) {
        textarea.value = suggestion;
        // Trigger counter update
        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        const maxChars = activeGen.id === 'elevenlabs-turbo-v2-5' ? 40000 : 2500;
        const counter = document.querySelector('.prompt-counter');
        if (counter) counter.innerText = `${suggestion.length}/${maxChars}`;
    }
    
    updateMusicUI();
}

function updateMusicUI() {
    // 1. Update Preview Text
    const preview = document.querySelector('.music-prompt-preview-text');
    if (preview) {
        preview.innerText = buildMusicPrompt();
    }

    // 2. Update Instrument Chips
    const chips = document.querySelectorAll('.instrument-chip');
    chips.forEach(chip => {
        const inst = chip.innerText.trim();
        if (state.musicSelections.instruments.includes(inst)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    // 3. Update Generate Button
    const btn = document.querySelector('.btn-generate');
    if (btn) {
        const noApiKey = !state.apiKey;
        if (noApiKey) {
            // Keep warning state if no API key
            return;
        }

        const isEmpty = isMusicSelectionEmpty();
        const uploadState = getUploadState();
        const isUploading = uploadState.uploading.image || uploadState.uploading.video;
        const isCooldown = Date.now() < (state.cooldownUntil || 0);

        btn.disabled = isEmpty || isUploading || isCooldown;
        
        if (isEmpty) {
            btn.innerText = '✨ Pilih Opsi Musik';
        } else {
            btn.innerText = '🚀 Generate Music';
        }
    }
}

function isMusicSelectionEmpty() {
    const { genre, mood, instruments, tempo } = state.musicSelections;
    return !genre && !mood && instruments.length === 0 && !tempo && !state.currentPrompt.trim();
}

function buildMusicPrompt() {
    const { genre, mood, instruments, tempo } = state.musicSelections;
    const userText = state.currentPrompt.trim();
    
    let parts = [];
    if (genre) parts.push(genre);
    if (mood) parts.push(mood);
    
    if (genre || mood) {
        parts.push("music");
    }
    
    if (instruments.length > 0) {
        parts.push(`with ${instruments.join(', ')}`);
    }
    
    if (tempo) {
        parts.push(`${tempo} tempo`);
    }
    
    if (userText) {
        parts.push(userText);
    }
    
    return parts.join(', ') || "Select options above or describe your music...";
}

function updateCfgValue(val) {
    state.settings.cfg_scale = parseFloat(val);
    const valDisplay = document.getElementById('cfg-val');
    if (valDisplay) valDisplay.innerText = val;
}

function updateStrengthValue(val) {
    state.settings.strength = parseFloat(val);
    const valDisplay = document.getElementById('strength-val');
    if (valDisplay) valDisplay.innerText = val;
}

function updateGuidanceValue(val) {
    state.settings.guidance_scale = parseFloat(val);
    const valDisplay = document.getElementById('guidance-val');
    if (valDisplay) valDisplay.innerText = val;
}

function updateStepsValue(val) {
    state.settings.steps = parseInt(val);
    const valDisplay = document.getElementById('steps-val');
    if (valDisplay) valDisplay.innerText = val;
}

function updateSetting(key, val) {
    state.settings[key] = val;
    
    if (key === 'style') {
        const buttons = document.querySelectorAll('.style-btn');
        buttons.forEach(btn => {
            if (btn.innerText === val) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    // No need to re-render everything for other setting changes
}

function updateTasksAndResultsDOM() {
    const tasksContainer = document.getElementById('active-tasks-container');
    if (tasksContainer) {
        tasksContainer.innerHTML = renderActiveTasks();
    }
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = renderResults();
    }
    
    // Update usage stats bar
    const usageStats = document.querySelector('.usage-stats-bar');
    if (usageStats) {
        usageStats.outerHTML = renderUsageStats();
    }
    
    if (window.lucide) lucide.createIcons();
}

function deleteResult(index) {
    state.completedResults.splice(index, 1);
    updateTasksAndResultsDOM();
}

function editWithSeedream(url) {
    state.activeGenerator = 'seedream-4-5-edit';
    const uploadState = getUploadState();
    uploadState.urls.image = url;
    uploadState.files.image = null;
    updateUploadDOM();
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Gambar siap diedit dengan SeeDream 4.5.", "success");
}

function editPrompt(prompt) {
    state.currentPrompt = prompt;
    state.generatorPrompts[state.activeGenerator] = prompt;
    const promptInput = document.querySelector('.prompt-textarea');
    if (promptInput) {
        promptInput.value = prompt;
        
        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        const maxChars = activeGen.id === 'elevenlabs-turbo-v2-5' ? 40000 : 2500;
        
        // Update counter directly
        const counter = document.querySelector('.prompt-counter');
        if (counter) counter.innerText = `${prompt.length}/${maxChars}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function regeneratePrompt(prompt, generatorId) {
    state.currentPrompt = prompt;
    state.activeGenerator = generatorId;
    state.generatorPrompts[generatorId] = prompt;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        generate();
    }, 500);
}

function handleStatusClick() {
    state.showSetup = !state.showSetup;
    renderContent();
}


function resetApiKey() {
    // Redundant, handled by handleStatusClick
}

// --- UTILS ---

function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }
}

function checkDisclaimer() {
    const accepted = localStorage.getItem('nd_disclaimer_accepted');
    if (!accepted) {
        toggleModal('modal-disclaimer', true);
    }
}

function acceptDisclaimer() {
    localStorage.setItem('nd_disclaimer_accepted', 'true');
    toggleModal('modal-disclaimer', false);
}

// Run App
window.addEventListener('DOMContentLoaded', () => {
    // Expose functions to window for HTML onclick handlers
    window.login = login;
    window.logout = logout;
    window.approveUser = approveUser;
    window.rejectUser = rejectUser;
    window.deleteUserAccount = deleteUserAccount;
    window.clearCloudinaryStorage = clearCloudinaryStorage;
    window.saveApiKey = saveApiKey;
    window.toggleApiKeyVisibility = toggleApiKeyVisibility;
    window.handleStatusClick = handleStatusClick;
    window.toggleModal = toggleModal;
    window.acceptDisclaimer = acceptDisclaimer;
    window.setActiveGenerator = setActiveGenerator;
    window.triggerUpload = triggerUpload;
    window.handleFileChange = handleFileChange;
    window.removeFile = removeFile;
    window.toggleUrlInput = toggleUrlInput;
    window.generate = generate;
    window.pollTaskStatus = pollTaskStatus;
    window.cancelTask = cancelTask;
    window.syncTasks = syncTasks;
    window.editWithSeedream = editWithSeedream;
    window.editPrompt = editPrompt;
    window.regeneratePrompt = regeneratePrompt;
    window.deleteResult = deleteResult;
    window.clearGlobalError = clearGlobalError;
    window.updateSetting = updateSetting;
    window.updatePrompt = updatePrompt;
    window.updateMusicSelection = updateMusicSelection;
    window.toggleMusicInstrument = toggleMusicInstrument;
    window.setMusicSuggestion = setMusicSuggestion;
    window.updateCfgValue = updateCfgValue;
    window.updateStepsValue = updateStepsValue;
    window.updateStrengthValue = updateStrengthValue;
    window.updateGuidanceValue = updateGuidanceValue;
    window.state = state;
    window.renderContent = renderContent;

    init();
    initAuth();
});
