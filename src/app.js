import { auth, db, googleProvider } from './firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, query, where, serverTimestamp, getDocFromServer, increment, orderBy, limit, getDocs } from 'firebase/firestore';

/**
 * ND Studio Pro - Core Logic (Fixed Functionality)
 * Vanilla JS State-Driven Architecture
 */

// --- STATE MANAGEMENT ---
let state = {
    apiKey: '',
    activeGenerator: 'kling-v3-std',
    uploadedFiles: { image: null, video: null, image3: null },
    uploadedUrls: { image: '', video: '', image3: '' },
    uploading: { image: false, video: false, image3: false },
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
        music_duration: '30',
        person_generation: 'allow_adult',
        safety_settings: 'block_medium_and_above',
        enhance_prompt: true
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
    adminDashboardView: 'menu', // 'menu' or 'users'
    adminUsersTab: 'pending', // 'pending' or 'approved'
    activeToolsTab: 'motion-control', // 'motion-control', 'video', 'image', 'voice', 'music'
    globalStats: { totalGenerations: 0 },
    dailyStats: [], // For admin usage stats
    isAdmin: false,
    showAdminDashboard: false,
    showApiKey: false,
    showLogin: false,
    musicSelections: {
        genre: '',
        mood: '',
        instruments: [],
        tempo: ''
    }
};

let confirmCallback = null;

function showConfirmModal(title, message, onConfirm) {
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    
    confirmCallback = onConfirm;
    toggleModal('modal-confirm', true);
    if (window.lucide) lucide.createIcons();
}

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
        tips: 'Gunakan video referensi dengan gerakan yang jelas untuk hasil terbaik.',
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
        tips: 'Ideal untuk gerakan kompleks seperti menari atau olahraga.',
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
        tips: 'Versi terbaru dengan pemahaman fisik yang lebih baik.',
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
        tips: 'Kualitas sinematik tertinggi untuk kontrol gerakan.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { orientation: true, cfg: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-v3-motion-control-pro',
        pollingType: 'path'
    },
    {
        id: 'kling-v2-6-pro-i2v',
        name: 'Kling 2.6 Pro I2V',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V2.6 PRO',
        description: 'Kling 2.6 Pro - Image to Video: Kualitas profesional dengan detail lebih tajam.',
        tips: 'Gunakan aspect ratio 16:9 atau 9:16 untuk hasil terbaik.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: 'seedance', duration: 'kling26', generate_audio: true, cfg: true, negative_prompt: true },
        endpoint: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6',
        pollingType: 'path'
    },
    {
        id: 'pixverse-v5',
        name: 'Pixverse V5',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'V5',
        description: 'Pixverse V5 - Image to Video: High-quality video generation with advanced motion control.',
        tips: 'Sangat bagus untuk pemandangan alam dan efek partikel.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { style: true, duration: 'pixverse', negative_prompt: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5',
        pollingType: 'path'
    },
    {
        id: 'happy-horse-1',
        name: 'Happy Horse 1.0',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Happy Horse 1.0 - Create high-quality AI video from image using Alibaba\'s image-to-video model.',
        tips: 'Model video yang sangat halus untuk animasi karakter dan pemandangan.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { resolution: 'happy-horse', duration: 'happy-horse', seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/image-to-video/happy-horse-1',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/happy-horse-1',
        pollingType: 'path'
    },
    {
        id: 'runway-4-5',
        name: 'Runway Gen 4.5 I2V',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Runway Gen 4.5 - High-quality image-to-video generation with precise motion control.',
        tips: 'Gunakan prompt deskriptif untuk kontrol gerakan yang lebih presisi.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: 'runway-4-5', duration: 'runway-4-5', seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/image-to-video/runway-4-5',
        statusEndpoint: 'https://api.magnific.com/v1/ai/image-to-video/runway-4-5',
        pollingType: 'path'
    },
    {
        id: 'veo-3-1-i2v',
        name: 'Veo 3.1 Image to Video',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Veo 3.1 - High-quality Image-to-Video generation by Google. Supports 4K and Audio.',
        tips: 'Model video tercanggih dari Google saat ini.',
        inputs: ['image', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: true, duration: 'veo', resolution: 'veo', generate_audio: true, negative_prompt: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/image-to-video/veo-3-1',
        statusEndpoint: 'https://api.freepik.com/v1/ai/image-to-video/veo-3-1',
        pollingType: 'path'
    },
    {
        id: 'veo-3-1-reference',
        name: 'Veo 3.1 Reference to Video',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Veo 3.1 Reference to Video - Generate consistent character/object videos using 1-3 reference images.',
        tips: 'Gunakan foto karakter dari berbagai sudut untuk konsistensi maksimal.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'video',
        settings: { aspect_ratio: true, resolution: 'veo', generate_audio: true, negative_prompt: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/reference-to-video/veo-3-1',
        statusEndpoint: 'https://api.freepik.com/v1/ai/reference-to-video/veo-3-1',
        pollingType: 'path'
    },
    {
        id: 'nano-banana-pro',
        name: 'Nano Banana Pro',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="zap" class="model-icon-lucide"></i></div>',
        badge: 'NEW',
        description: 'Nano Banana Pro (Gemini 3) - Advanced image generation with complex compositions and 4K support.',
        tips: 'Sangat cerdas dalam mengikuti instruksi prompt yang panjang.',
        inputs: ['prompt', 'image', 'video', 'image3'],
        outputType: 'image',
        settings: { aspect_ratio: 'nano', resolution: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro',
        pollingType: 'path'
    },
    {
        id: 'nano-banana-pro-flash',
        name: 'Nano Banana Pro Flash',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="zap" class="model-icon-lucide"></i></div>',
        badge: 'FLASH',
        description: 'Nano Banana Pro Flash (Gemini 3.1 Flash) - Faster variant optimized for quick image generation.',
        inputs: ['prompt', 'image', 'video', 'image3'],
        outputType: 'image',
        settings: { aspect_ratio: 'nano', resolution: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro-flash',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro-flash',
        pollingType: 'path'
    },
    {
        id: 'imagen4-fast',
        name: 'Imagen 4 Fast',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="zap" class="model-icon-lucide"></i></div>',
        badge: 'FAST',
        description: 'Imagen 4 Fast - Optimized for speed and cost-effectiveness. Google\'s latest high-speed image generation.',
        tips: 'Kualitas studio dengan kecepatan kilat.',
        inputs: ['prompt'],
        outputType: 'image',
        settings: { aspect_ratio: 'imagen4', enhance_prompt: true, safety_settings: true, person_generation: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/imagen4-fast',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/imagen4-fast',
        pollingType: 'path'
    },
    {
        id: 'imagen4-ultra',
        name: 'Imagen 4 Ultra',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'ULTRA',
        description: 'Imagen 4 Ultra - Google\'s most capable image generation model. Optimized for highest quality and photorealism.',
        tips: 'Gunakan detail maksimal untuk hasil foto yang sangat nyata.',
        inputs: ['prompt'],
        outputType: 'image',
        settings: { aspect_ratio: 'imagen4', enhance_prompt: true, safety_settings: true, person_generation: true, seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/imagen4-ultra',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/imagen4-ultra',
        pollingType: 'path'
    },
    {
        id: 'gemini-2-5-flash-image',
        name: 'Gemini 2.5 Flash Image',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="sparkles" class="model-icon-lucide"></i></div>',
        badge: 'PREVIEW',
        description: 'Gemini 2.5 Flash - Create or edit images with lightning speed. Supports up to 3 reference images for style transfer or editing.',
        tips: 'Gunakan hingga 3 gambar referensi untuk kontrol lebih baik.',
        inputs: ['prompt', 'image', 'video', 'image3'], // Use 'video' as the second image slot for consistency, then 'image3'
        outputType: 'image',
        settings: { seed: true },
        endpoint: 'https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview',
        statusEndpoint: 'https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview',
        pollingType: 'path'
    },
    {
        id: 'flux-2-pro',
        name: 'Flux 2 Pro',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'PRO',
        description: 'Flux 2 Pro - High-quality image generation. Supports Image-to-Image and Prompt Upsampling.',
        tips: 'Gunakan Prompt Upsampling untuk detail yang lebih kaya.',
        inputs: ['prompt', 'image'],
        outputType: 'image',
        settings: { style_preset: true, aspect_ratio: 'flux', prompt_upsampling: true, seed: true },
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
        id: 'kling-4k-i2v',
        name: 'Kling 4K I2V',
        icon: '<div class="tool-icon-container tool-icon-video"><i data-lucide="video" class="model-icon-lucide"></i></div>',
        badge: '4K I2V',
        description: 'Kling 4K Image-to-Video: Generate AI video in 4K resolution from an image with precise motion control.',
        tips: 'Mendukung resolution 4K, End frame control (Image Tail), dan Motion brush.',
        inputs: ['image', 'video', 'prompt'], // 'video' slot used for image_tail
        outputType: 'video',
        settings: { duration: true, cfg: true, negative_prompt: true },
        endpoint: 'https://api.freepik.com/v1/ai/video/kling-4k-i2v',
        statusEndpoint: 'https://api.freepik.com/v1/ai/video/kling-4k-i2v',
        pollingType: 'path'
    },
    {
        id: 'seedream-4-5-edit',
        name: 'SeeDream 4.5 Edit',
        icon: '<div class="tool-icon-container tool-icon-image"><i data-lucide="image" class="model-icon-lucide"></i></div>',
        badge: 'V4.5',
        description: 'SeeDream 4.5 Edit: High-fidelity Text-to-Image generation with reference images. Preserves subject details and style while editing.',
        inputs: ['image', 'video', 'image3', 'prompt'],
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
        tips: 'Mendukung berbagai bahasa. Masukkan teks yang ingin diucapkan.',
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

// --- TOOL CATEGORIES ---
const TOOL_CATEGORIES = [
    { id: 'motion-control', name: 'Motion Control', icon: 'zap', badge: 'Popular' },
    { id: 'video', name: 'Video Generation', icon: 'video' },
    { id: 'image', name: 'Image Generation', icon: 'image' },
    { id: 'voice', name: 'Voice Generation', icon: 'mic' },
    { id: 'music', name: 'Music Generation', icon: 'music' }
];

function getToolsForTab(tabId) {
    switch (tabId) {
        case 'motion-control':
            return GENERATORS.filter(g => g.id.includes('motion-control'));
        case 'video':
            return GENERATORS.filter(g => g.outputType === 'video' && !g.id.includes('motion-control'));
        case 'image':
            return GENERATORS.filter(g => g.outputType === 'image');
        case 'voice':
            return GENERATORS.filter(g => g.id === 'elevenlabs-turbo-v2-5');
        case 'music':
            return GENERATORS.filter(g => g.id === 'music-generation');
        default:
            return [];
    }
}


// --- AUTH FUNCTIONS ---

function resetUserState() {
    state.apiKey = '';
    state.userDoc = null;
    state.isAdmin = false;
    state.uploadedFiles = { image: null, video: null, image3: null };
    state.uploadedUrls = { image: '', video: '', image3: '' };
    state.activeTasks = [];
    state.completedResults = [];
    state.generationHistory = [];
    state.generatorUploads = {};
    state.generatorPrompts = {};
    state.currentPrompt = '';
    state.globalError = null;
    state.showAdminDashboard = false;
    state.showApiKey = false;
    state.showLogin = false;
}

let lastUserUid = null;
function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        // Prevent clearing state if it's just a silent session refresh for the same user
        if (user && user.uid === lastUserUid) {
            state.currentUser = user;
            state.isAuthLoading = false;
            return;
        }
        lastUserUid = user ? user.uid : null;

        // Reset state immediately to prevent stale data between accounts
        resetUserState();
        
        // Reload state from local storage to recover tasks after account switches or resets
        loadStateFromLocalStorage();
        
        state.currentUser = user;
        state.isAuthLoading = false;
        
        // Restart polling for tasks loaded from local storage after login/auth change
        if (state.activeTasks.length > 0) {
            state.activeTasks.forEach(task => {
                if (!activePolls.has(task.id)) {
                    console.log(`Resuming polling after auth for task: ${task.id}`);
                    // Wrap in timeout to ensure state is fully stabilized
                    setTimeout(() => pollTaskStatus(task.id), 2000);
                }
            });
        }
        
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
            
            if (userSnap && !userSnap.exists()) {
                const newUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isApproved: state.isAdmin, // Admin is auto-approved
                    role: state.isAdmin ? 'admin' : 'user',
                    apiKey: '',
                    lastActive: serverTimestamp(), // Initial online status
                    createdAt: serverTimestamp()
                };
                try {
                    await setDoc(userRef, newUser);
                } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, 'users/' + user.uid);
                }
                state.userDoc = newUser;
            } else if (userSnap) {
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
                    if (state.userDoc.isApproved) {
                        updateActivity(); // Hemat activity tracking
                    }
                    renderContent();
                }
            }, (error) => {
                // If permission is denied here, it might be because the account is blocked by security rules
                console.error("User document listener error:", error);
                // Don't throw fatal error here, let it fail gracefully
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
        }
        
        renderContent();
    });

    // Listen for global stats (accessible to everyone)
    onSnapshot(doc(db, 'stats', 'global'), (snap) => {
        if (snap.exists()) {
            state.globalStats = snap.data();
            
            // Check if stats bar is already visible. If so, update it partially to avoid full page flicker
            const statsBar = document.querySelector('.usage-stats-bar');
            if (statsBar && !state.isAuthLoading && state.currentUser && state.userDoc?.isApproved) {
                updateTasksAndResultsDOM();
            } else {
                renderContent();
            }
        }
    }, (error) => {
        console.warn("Global stats listener error:", error);
    });

    // Auto-refresh UI every 1 minute to keep "Online" and "Time Ago" status fresh
    setInterval(() => {
        if (state.user && state.userDoc) {
            renderContent();
            
            // Juga pastikan user yang sedang buka web tetap dianggap online di DB (Hemat!)
            if (state.userDoc.isApproved) {
                updateActivity();
            }
        }
    }, 60000);
}

async function updateActivity() {
    if (!state.user || !state.userDoc) return;
    
    const now = new Date();
    // Only update if last update was more than 5 minutes ago to save writes (Hemat!)
    const lastUpdate = state.userDoc.lastActive?.toDate ? state.userDoc.lastActive.toDate() : (state.userDoc.lastActive ? new Date(state.userDoc.lastActive) : null);
    
    if (!lastUpdate || (now - lastUpdate > 300000)) {
        try {
            await updateDoc(doc(db, 'users', state.user.uid), {
                lastActive: serverTimestamp()
            });
        } catch (e) {
            console.warn("Silent activity update failed:", e);
        }
    }
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
    
    showConfirmModal(
        "Setujui Pengguna",
        "Apakah Anda yakin ingin menyetujui akses pengguna ini?",
        async () => {
            try {
                await updateDoc(doc(db, 'users', uid), { 
                    isApproved: true,
                    approvedAt: serverTimestamp()
                });
                showToast("✅ Pengguna disetujui!", "success");
            } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, 'users/' + uid);
            }
        }
    );
}

async function rejectUser(uid) {
    if (!state.isAdmin) return;
    
    showConfirmModal(
        "Cabut Akses Pengguna",
        "Apakah Anda yakin ingin mencabut akses pengguna ini? Pengguna tidak akan bisa menggunakan fitur berbayar.",
        async () => {
            try {
                await updateDoc(doc(db, 'users', uid), { isApproved: false });
                showToast("⚠️ Akses pengguna dicabut.", "warning");
            } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, 'users/' + uid);
            }
        }
    );
}

async function deleteUserAccount(uid) {
    if (!state.isAdmin) return;
    
    showConfirmModal(
        "Hapus Akun Pengguna",
        "Apakah Anda yakin ingin menghapus akun ini secara permanen? Tindakan ini tidak dapat dibatalkan.",
        async () => {
            try {
                await deleteDoc(doc(db, 'users', uid));
                showToast("🗑️ Akun pengguna berhasil dihapus.", "success");
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, 'users/' + uid);
            }
        }
    );
}

async function clearCloudinaryStorage() {
    if (!state.isAdmin) return;
    
    showConfirmModal(
        "Kosongkan Storage",
        "Apakah Anda yakin ingin menghapus semua file referensi di Cloudinary? Ini akan mengosongkan kuota penyimpanan Anda.",
        async () => {
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
    );
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
            files: { image: null, video: null, image3: null },
            urls: { image: '', video: '', image3: '' },
            uploading: { image: false, video: false, image3: false },
            autoUploaded: { image: false, video: false, image3: false }
        };
    }
    // Ensure autoUploaded exists for older states
    if (!state.generatorUploads[state.activeGenerator].autoUploaded) {
        state.generatorUploads[state.activeGenerator].autoUploaded = { image: false, video: false, image3: false };
    }
    // Ensure image3 exists for older states
    if (!state.generatorUploads[state.activeGenerator].files.hasOwnProperty('image3')) {
        state.generatorUploads[state.activeGenerator].files.image3 = null;
        state.generatorUploads[state.activeGenerator].urls.image3 = '';
        state.generatorUploads[state.activeGenerator].uploading.image3 = false;
        state.generatorUploads[state.activeGenerator].autoUploaded.image3 = false;
    }
    return state.generatorUploads[state.activeGenerator];
}

// --- INITIALIZATION ---
let activePolls = new Set();

function init() {
    console.log("ND Studio Pro: Initializing...");
    testFirestoreConnection();
    
    // Load persisted state
    loadStateFromLocalStorage();
    
    renderContent();
    
    // Start real-time progress simulation
    startProgressSimulation();
    
    // Resume polling for active tasks
    state.activeTasks.forEach(task => {
        if (!activePolls.has(task.id)) {
            console.log(`Resuming polling for task: ${task.id}`);
            pollTaskStatus(task.id);
        }
    });
    
    // Global Listeners for Modal (if still in HTML)
    const btnAgree = document.getElementById('btn-agree');
    if (btnAgree) btnAgree.addEventListener('click', acceptDisclaimer);
    
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => toggleModal('modal-disclaimer', false));

    const btnConfirmYes = document.getElementById('btn-confirm-yes');
    if (btnConfirmYes) {
        btnConfirmYes.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            toggleModal('modal-confirm', false);
            confirmCallback = null;
        });
    }

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
                // Determine increment based on model type
                let inc = Math.random() * 2.5; // Default increment
                
                const modelId = task.generatorId || '';
                if (modelId.includes('kling') || modelId.includes('veo') || modelId.includes('seedance')) {
                    // Slower increment for heavy video models to avoid staying at 98% too long
                    inc = Math.random() * 0.8; 
                } else if (modelId.includes('flux') || modelId.includes('nano')) {
                    // Faster for images
                    inc = Math.random() * 5;
                }

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
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 20px; background: #070707; position: relative; overflow: hidden;">
                    <!-- Multiple Background Glows -->
                    <div style="position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(212, 175, 55, 0.05) 0%, transparent 70%); border-radius: 50%; animation: pulse-glow 4s ease-in-out infinite;"></div>
                    <div style="position: absolute; width: 250px; height: 250px; background: radial-gradient(circle, rgba(212, 175, 55, 0.03) 0%, transparent 60%); border-radius: 50%; animation: pulse-glow 3s ease-in-out infinite reverse; top: 30%; left: 40%;"></div>
                    
                    <div class="loading-logo-container" style="position: relative; z-index: 2; animation: logo-entrance 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);">
                        <img src="https://i.ibb.co.com/6c7LC9vh/logo.png" alt="ND Studio Pro" style="height: 30px; width: auto; object-fit: contain; filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.4)); animation: logo-float 4s ease-in-out infinite;">
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; z-index: 2;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="height: 1px; width: 30px; background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5));"></div>
                            <p style="color: var(--accent-gold); font-size: 11px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; margin: 0; opacity: 0.9; font-family: var(--font-premium); animation: text-shimmer 3s linear infinite;">ND STUDIO PRO</p>
                            <div style="height: 1px; width: 30px; background: linear-gradient(90deg, rgba(212, 175, 55, 0.5), transparent);"></div>
                        </div>
                        <div style="width: 140px; height: 1px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; overflow: hidden; position: relative;">
                            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, var(--accent-gold), transparent); animation: loading-bar 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;"></div>
                        </div>
                    </div>

                    <style>
                        @keyframes logo-entrance {
                            0% { transform: scale(0.9) translateY(10px); opacity: 0; }
                            100% { transform: scale(1) translateY(0); opacity: 1; }
                        }
                        @keyframes logo-float {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-6px); }
                        }
                        @keyframes pulse-glow {
                            0%, 100% { transform: scale(1); opacity: 0.3; }
                            50% { transform: scale(1.15); opacity: 0.6; }
                        }
                        @keyframes text-shimmer {
                            0% { opacity: 0.5; text-shadow: 0 0 0px var(--accent-gold); }
                            50% { opacity: 1; text-shadow: 0 0 10px rgba(212, 175, 55, 0.4); }
                            100% { opacity: 0.5; text-shadow: 0 0 0px var(--accent-gold); }
                        }
                        @keyframes loading-bar {
                            0% { left: -100%; }
                            100% { left: 100%; }
                        }
                    </style>
                </div>
            `;
            return;
        }

        // 2. Landing & Login Page
        if (!state.currentUser) {
            if (state.showLogin) {
                app.innerHTML = `
                    ${renderHeader()}
                    <main>
                        ${renderLoginPage()}
                    </main>
                    ${renderFooter()}
                `;
            } else {
                app.innerHTML = `
                    ${renderLandingPage()}
                `;
            }
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
                    <div class="app-stacked-layout">
                        ${renderUsageStats()}
                        <div class="main-controls-wrapper">
                            ${renderSetupPage()}
                        </div>
                    </div>
                </main>
                ${renderFooter()}
            `;
        } else {
            const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
            
            // Full render
            app.innerHTML = `
                ${renderHeader()}
                <main>
                    ${renderGlobalError()}
                    <div class="app-stacked-layout">
                        ${renderUsageStats()}
                        ${renderModelSelector()}
                        
                        <div class="main-controls-wrapper">
                            ${renderModelInfo(activeGen)}
                            <div class="upload-section-wrapper">${renderUploadSection(activeGen)}</div>
                            ${renderPromptSection()}
                            ${renderSettings(activeGen)}
                            ${renderGenerateButton(activeGen)}
                        </div>

                        <div class="results-layout-wrapper">
                            <div id="active-tasks-container"></div>
                            <div id="results-container"></div>
                        </div>
                    </div>
                </main>
                ${renderFooter()}
            `;
            
            // Reset DOM optimization tracking so the empty containers are populated
            lastTasksData = null;
            lastResultsData = null;
            
            updateTasksAndResultsDOM();
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


function navigateToLogin() {
    state.showLogin = true;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateToLanding() {
    state.showLogin = false;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLandingPage() {
    const purchaseUrl = 'https://lynk.id/nanda239/ger9z5r0gz5x';
    
    // Video Embeds from ScreenPal
    const videoEmbeds = [
        'cOfZbqnOAC5', 'cOfZbqnOACC', 'cOfZbqnOACp', 
        'cOfZbqnOACk', 'cOfZbqnOACg', 'cOfZbqnOACB', 
        'cOfZbqnOACA', 'cOfZbqnOACz', 'cOfZbqnOACA',
        'cOfZFfnOAdk', 'cOfZFfnOAdp', 'cOfZFfnOAdC',
        'cOfZFfnOAd5', 'cOfZFfnOAdE', 'cOfZFfnOAdG'
    ];

    const toolNames = [
        'Kling 3 Omni Pro', 'Nano Banana Pro', 'Veo 3.1 Google AI', 
        'Imagen 4 Ultra', 'Flux 2 Realistic', 
        'Pixverse V5', 'ElevenLabs Turbo', 'Kling 30s Motion', 
        'Gemini 2.5 Flash', 'Runway Gen 4.5', 'SeeDream 4.5', 
        'Music AI Generation', 'Voice Over Pro', 'Flux 2 Turbo',
        'Kling 2.6 Pro', 'Imagen 4 Fast', 'Kling 3 Standard'
    ];

    const fonts = ['font-syne', 'font-space', 'font-outfit', 'font-premium', 'font-mono'];

    const renderMarqueeRow = (items, isReverse = false) => {
        const doubledItems = [...items, ...items]; // Repeat for seamless scroll
        return `
            <div class="marquee-container">
                <div class="${isReverse ? 'marquee-track-reverse' : 'marquee-track'}">
                    ${doubledItems.map((name, i) => {
                        const fontClass = fonts[i % fonts.length];
                        return `
                            <div class="marquee-item ${fontClass}">
                                ${name}
                                <div class="marquee-dot"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    return `
        <div class="landing-page">
            <!-- Floating Nav -->
            <nav class="landing-nav">
                <div class="header-left">
                    <img src="https://i.ibb.co.com/6c7LC9vh/logo.png" alt="ND Studio Pro" class="app-logo-img">
                </div>
                <div class="landing-nav-actions">
                    <button class="nav-link" onclick="navigateToLogin()">Login</button>
                    <button class="btn-primary-gold-small" onclick="window.open('${purchaseUrl}', '_blank')">Full Akses sekarang</button>
                </div>
            </nav>

            <!-- Hero Section -->
            <section class="hero-section">
                <div class="hero-content">
                    <div class="hero-badge">PREMIUM AI VIDEO GENERATOR</div>
                    <h1 class="hero-title">Wujudkan Imajinasi Menjadi <br><span>Karya Video Nyata</span></h1>
                    <p class="hero-subtitle">
                        Platform AI Video tercanggih untuk kreator konten profesional. 
                        Hasilkan video berkualitas tinggi dalam hitungan detik dengan teknologi ND STUDIO PRO.
                    </p>
                    <div class="hero-actions">
                        <button class="btn-primary-gold" onclick="navigateToLogin()">
                            <i data-lucide="zap"></i> Mulai Sekarang
                        </button>
                        <button class="btn-secondary-white" onclick="window.open('${purchaseUrl}', '_blank')">
                            <i data-lucide="shopping-cart"></i> Full Akses sekarang
                        </button>
                    </div>
                </div>
            </section>

            <!-- Video Showcase Horizontal Scroll -->
            <section class="showcase-section">
                <div class="section-header">
                    <h2 class="section-title">Testimoni & Hasil Karya</h2>
                    <p class="section-subtitle">Geser untuk melihat keajaiban video yang dihasilkan.</p>
                </div>
                
                <div class="video-scroll-container">
                    <div class="video-scroll-wrapper">
                        ${videoEmbeds.map(id => `
                            <div class="video-card-vertical scroll-item">
                                <iframe 
                                    src="https://go.screenpal.com/player/${id}?ap=1&mute=1&tl=0&cl=0&bg=transparent&embed=1" 
                                    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
                                    scrolling="no" 
                                    allow="autoplay"
                                    allowfullscreen="true">
                                </iframe>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>

            <!-- Tools Marquee -->
            <section class="tools-marquee-section">
                ${renderMarqueeRow(toolNames)}
                ${renderMarqueeRow([...toolNames].reverse(), true)}
            </section>

            <!-- Tools & Features Section -->
            <section class="tools-section">
                <div class="section-header">
                    <h2 class="section-title">ND STUDIO PRO - ALL-IN-ONE AI TOOLS (20 TOOLS)</h2>
                    <p class="section-subtitle">Akses ekosistem AI terlengkap untuk produksi konten profesional dalam satu platform.</p>
                </div>
                
                <!-- Prompt Templates Showcase -->
                <div class="prompt-templates-grid">
                    <div class="template-card">
                        <div class="template-tool">NANO BANANA PRO</div>
                        <div class="template-badge">Template Ganti Outfit</div>
                        <div class="template-content">
                            <p class="template-label">Prompt Example:</p>
                            <code class="template-code">Full body shot of a woman wearing a professional [RED SUIT], office background, cinematic lighting, 8k resolution, photorealistic.</code>
                            <p class="template-tip">Tip: Ganti teks di dalam kurung [] untuk mengubah jenis pakaian.</p>
                        </div>
                    </div>
                    <div class="template-card">
                        <div class="template-tool">KLING MOTION CONTROL (2.6 & 3)</div>
                        <div class="template-badge">Template Motion Control</div>
                        <div class="template-content">
                            <p class="template-label">Prompt Example:</p>
                            <code class="template-code">A cinematic tracking shot, moving forward through a neon forest, [DYNAMIC MOTION], high frame rate, masterpiece.</code>
                            <p class="template-tip">Tip: Gunakan "Moving forward", "Panning left", atau "Zoom in" untuk kontrol gerakan.</p>
                        </div>
                    </div>
                </div>

                <div class="tools-grid-categories">
                    <!-- VIDEO GENERATION -->
                    <div class="category-group">
                        <div class="category-header">
                            <i data-lucide="video"></i>
                            <h3>🎬 VIDEO GENERATION (12 Tools)</h3>
                        </div>
                        <div class="tools-list">
                            <div class="tool-list-item"><span>Kling 3 Motion Control (Pro) - Up to 30s</span></div>
                            <div class="tool-list-item"><span>Kling 3 Motion Control (Std) - Up to 30s</span></div>
                            <div class="tool-list-item"><span>Kling 2.6 Pro I2V (High Quality)</span></div>
                            <div class="tool-list-item"><span>Kling 2.6 Motion Control (Pro) - Up to 30s</span></div>
                            <div class="tool-list-item"><span>Kling 2.6 Motion Control (Std) - Up to 30s</span></div>
                            <div class="tool-list-item"><span>Kling 3 Omni Pro (Advanced Multi-modal)</span></div>
                            <div class="tool-list-item"><span>Kling 3 Pro (High Quality)</span></div>
                            <div class="tool-list-item"><span>Kling 3 Standard</span></div>
                            <div class="tool-list-item"><span>Veo 3.1 Image to Video (Google AI)</span></div>
                            <div class="tool-list-item"><span>Veo 3.1 Reference to Video</span></div>
                            <div class="tool-list-item"><span>Pixverse V5 (Advanced Motion)</span></div>
                            <div class="tool-list-item"><span>Runway Gen 4.5 I2V (Precise Motion)</span></div>
                        </div>
                    </div>

                    <!-- IMAGE GENERATION -->
                    <div class="category-group">
                        <div class="category-header">
                            <i data-lucide="image"></i>
                            <h3>🖼️ IMAGE GENERATION (9 Tools)</h3>
                        </div>
                        <div class="tools-list">
                            <div class="tool-list-item"><span>Nano Banana Pro (Gemini 3 - 4K)</span></div>
                            <div class="tool-list-item flash-highlight"><span>Nano Banana Pro Flash (Super Fast)</span></div>
                            <div class="tool-list-item"><span>Imagen 4 Ultra (Ultimate Quality)</span></div>
                            <div class="tool-list-item"><span>Imagen 4 Fast (Optimized Speed)</span></div>
                            <div class="tool-list-item"><span>SeeDream 4.5 Edit (Subject Consistency)</span></div>
                            <div class="tool-list-item"><span>Flux 2 Pro (Ultra Realistic)</span></div>
                            <div class="tool-list-item"><span>Flux 2 Turbo (Speed Optimized)</span></div>
                            <div class="tool-list-item"><span>Runway Gen (Text to Image)</span></div>
                            <div class="tool-list-item"><span>Flux 2 Style (Custom Styles)</span></div>
                        </div>
                    </div>

                    <!-- AUDIO & VOICE -->
                    <div class="category-group">
                        <div class="category-header">
                            <i data-lucide="music"></i>
                            <h3>🎵 AUDIO & VOICE (2 Tools)</h3>
                        </div>
                        <div class="tools-list">
                            <div class="tool-list-item"><span>Voice Over (ElevenLabs Turbo v2.5)</span></div>
                            <div class="tool-list-item"><span>Music Generation (High-Quality AI Music)</span></div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Features -->
            <section class="features-section">
                <div class="feature-card">
                    <i data-lucide="sparkles"></i>
                    <h3>Kualitas 4K</h3>
                    <p>Hasil video super tajam dengan detail yang memukau untuk kebutuhan profesional.</p>
                </div>
                <div class="feature-card">
                    <i data-lucide="zap"></i>
                    <h3>Proses Kilat</h3>
                    <p>Hasilkan video hanya dalam hitungan detik menggunakan server high-end.</p>
                </div>
                <div class="feature-card">
                    <i data-lucide="shield-check"></i>
                    <h3>Akses Eksklusif</h3>
                    <p>Gunakan semua fitur premium tanpa batas dan tanpa watermark.</p>
                </div>
            </section>

            <!-- Pricing Section (Rekomendasi 2) -->
            <section class="pricing-section" id="pricing">
                <div class="section-header">
                    <h2 class="section-title">Investasi Kreatif Terbaik</h2>
                    <p class="section-subtitle">Bebaskan imajinasi Anda dengan akses tanpa batas selamanya.</p>
                </div>
                <div class="pricing-grid">
                    <div class="pricing-card featured">
                        <div class="pricing-badge">PROMO LIMIT TERBATAS</div>
                        <h3 class="pricing-name">Lifetime Pro Access</h3>
                        <div class="pricing-price"><small>Rp</small> 150.000<span class="price-period">Sekali Bayar</span></div>
                        <p style="color: var(--text-muted); font-size: 13px; margin: -20px 0 30px; line-height: 1.4;">Tanpa biaya langganan bulanan. Bayar sekali, pakai selamanya!</p>
                        <ul class="pricing-features">
                            <li><i data-lucide="zap"></i> 20+ Premium AI Tools Terlengkap</li>
                            <li><i data-lucide="video"></i> Video Generator 4K Unlimited</li>
                            <li><i data-lucide="shield-check"></i> Bebas Watermark (Hasil Bersih)</li>
                            <li><i data-lucide="star"></i> Update Fitur AI Terkini Otomatis</li>
                            <li><i data-lucide="lock"></i> Private Private Server Akses</li>
                        </ul>
                        <button class="btn-pricing" onclick="window.open('${purchaseUrl}', '_blank')">Ambil Promo Sekarang</button>
                        <div style="margin-top: 15px; font-size: 11px; color: var(--accent-gold); font-weight: 600;">⚠️ Sisa 5 Slot dengan Harga Ini!</div>
                    </div>
                </div>
            </section>

            <!-- FAQ Section (Rekomendasi 1) -->
            <section class="faq-section">
                <div class="section-header">
                    <h2 class="section-title">Pertanyaan Umum</h2>
                    <p class="section-subtitle">Semua hal yang perlu Anda ketahui tentang ND STUDIO PRO.</p>
                </div>
                <div class="faq-grid">
                    <div class="faq-item">
                        <div class="faq-question">Apakah video yang dihasilkan ada watermark? <i data-lucide="plus"></i></div>
                        <div class="faq-answer">Tidak. Semua video yang dihasilkan menggunakan akun premium kami tidak akan memiliki watermark.</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-question">Berapa lama proses pembuatan videonya? <i data-lucide="plus"></i></div>
                        <div class="faq-answer">Tergantung durasi dan kompleksitas, biasanya memakan waktu antara 30 detik hingga 3 menit.</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-question">Apakah saya bisa menggunakan untuk komersial? <i data-lucide="plus"></i></div>
                        <div class="faq-answer">Ya, semua hasil karya Anda di ND STUDIO PRO sepenuhnya menjadi hak milik Anda untuk kebutuhan komersial.</div>
                    </div>
                </div>
            </section>

            <!-- Final CTA -->
            <section class="cta-bottom">
                <div class="cta-container">
                    <h2>Siap Bergabung dengan Masa Depan?</h2>
                    <p>Dapatkan akses penuh ke semua fitur generator video AI kami sekarang.</p>
                    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-primary-gold" style="background:#000; color:var(--accent-gold);" onclick="window.open('${purchaseUrl}', '_blank')">
                            Full Akses sekarang <i data-lucide="shopping-bag"></i>
                        </button>
                    </div>
                </div>
            </section>

            <!-- Footer (Rekomendasi 5) -->
            <footer class="landing-footer">
                <div class="footer-top">
                    <div class="footer-brand">
                        <img src="https://i.ibb.co.com/6c7LC9vh/logo.png" alt="ND Studio Pro" class="app-logo-img" style="height: 70px; margin-bottom: 12px;">
                        <p>Ekosistem Video AI Profesional.</p>
                    </div>
                    <div class="footer-links">
                        <h4>Navigasi</h4>
                        <a href="#" onclick="navigateToLogin()">Login</a>
                        <a href="#pricing">Harga</a>
                        <a href="${purchaseUrl}" target="_blank">Beli Akses</a>
                    </div>
                    <div class="footer-social">
                        <h4>Ikuti Kami</h4>
                        <div class="social-icons">
                            <a href="https://www.threads.net/@nanda99.official" target="_blank" title="Threads">
                                <i data-lucide="at-sign"></i> <span>Threads</span>
                            </a>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2026 ND STUDIO PRO. All rights reserved.</p>
                </div>
            </footer>
        </div>
    `;
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

function formatTimeAgo(date) {
    if (!date) return 'Belum pernah aktif';
    const now = new Date();
    const then = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return 'Baru saja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
    return `${Math.floor(seconds / 86400)} hari lalu`;
}

function renderUserCard(user, type) {
    const isOnline = user.lastActive && (new Date() - (user.lastActive.toDate ? user.lastActive.toDate() : new Date(user.lastActive)) < 600000);
    
    return `
        <div class="user-card" style="background: #111; padding: 12px; border-radius: 16px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="position: relative;">
                <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName}" style="width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--border-color); object-fit: cover;">
                <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; border-radius: 50%; background: ${isOnline ? '#40c057' : '#444'}; border: 2px solid #111;"></div>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; color: var(--text-main); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.displayName || 'User'}</div>
                <div style="color: var(--text-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${user.email}</div>
                <div style="color: var(--text-muted); font-size: 11px; display: flex; align-items: center; gap: 4px;">
                    <i data-lucide="clock" style="width: 10px; height: 10px;"></i>
                    ${formatTimeAgo(user.lastActive)}
                </div>
            </div>
            <div style="display: flex; gap: 6px;">
                ${type === 'pending' ? `
                    <button onclick="approveUser('${user.uid}')" style="background: var(--accent-green); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Setujui">
                        <i data-lucide="check" style="width: 18px; height: 18px;"></i>
                    </button>
                ` : `
                    <button onclick="rejectUser('${user.uid}')" style="background: rgba(250, 82, 82, 0.1); color: #fa5252; border: 1px solid rgba(250, 82, 82, 0.2); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Blokir/Cabut Akses">
                        <i data-lucide="user-minus" style="width: 18px; height: 18px;"></i>
                    </button>
                `}
                <button onclick="deleteUserAccount('${user.uid}')" style="background: #fa5252; color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Hapus Akun">
                    <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
        </div>
    `;
}

function renderAdminDashboard() {
    if (state.adminDashboardView === 'menu') {
        return renderAdminMenu();
    }
    
    const pendingUsers = state.allUsers
        .filter(u => !u.isApproved)
        .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
    const approvedUsers = state.allUsers
        .filter(u => u.isApproved && u.role !== 'admin')
        .sort((a, b) => {
            const timeA = a.approvedAt?.toDate ? a.approvedAt.toDate().getTime() : (a.approvedAt ? new Date(a.approvedAt).getTime() : 0);
            const timeB = b.approvedAt?.toDate ? b.approvedAt.toDate().getTime() : (b.approvedAt ? new Date(b.approvedAt).getTime() : 0);
            return timeA - timeB; // Ascending: oldest at top, newest at bottom
        });
    
    return `
        <div class="admin-dashboard" style="max-width: 900px; margin: 20px auto; padding: 0 20px; animation: fadeIn 0.4s ease-out;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button onclick="state.adminDashboardView = 'menu'; renderContent();" style="width: 40px; height: 40px; border-radius: 12px; background: #1a1a1a; border: 1px solid var(--border-color); color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="arrow-left" style="width: 20px; height: 20px;"></i>
                    </button>
                    <div>
                        <h1 style="font-size: 24px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-premium); margin:0;">Data Pengguna</h1>
                        <p style="color: var(--text-muted); font-size: 13px; margin:0;">Kelola akses pengguna ND STUDIO PRO (${state.allUsers.length} total).</p>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; position: relative; z-index: 10;">
                    <button onclick="
                        const icon = this.querySelector('svg, i');
                        if(icon) {
                            icon.style.transition = 'none';
                            icon.style.transform = 'rotate(0deg)';
                            icon.offsetHeight; // force reflow
                            icon.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                            icon.style.transform = 'rotate(360deg)';
                        }
                        setTimeout(() => renderContent(), 600);
                    " style="padding: 10px 20px; border-radius: 12px; background: rgba(212, 175, 55, 0.1); border: 1px solid var(--accent-gold); color: var(--accent-gold); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; user-select: none;" onmouseover="this.style.background='rgba(212, 175, 55, 0.2)'" onmouseout="this.style.background='rgba(212, 175, 55, 0.1)'" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'">
                        <i data-lucide="refresh-cw" style="width: 18px; height: 18px;"></i>
                        Refresh
                    </button>
                    <button onclick="state.showAdminDashboard = false; renderContent();" style="padding: 10px 20px; border-radius: 12px; background: #1a1a1a; border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;" onmouseover="this.style.background='#222'" onmouseout="this.style.background='#1a1a1a'" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'">
                        <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                        Tutup
                    </button>
                </div>
            </div>

            <!-- Tab Navigation for Users -->
            <div style="display: flex; background: #111; padding: 6px; border-radius: 16px; border: 1px solid var(--border-color); margin-bottom: 24px; gap: 6px;">
                <button onclick="state.adminUsersTab = 'pending'; renderContent();" style="flex: 1; padding: 12px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 14px; 
                    ${state.adminUsersTab === 'pending' ? 'background: var(--accent-gold); color: #000; box-shadow: 0 4px 12px rgba(212,175,55,0.2);' : 'background: transparent; color: var(--text-muted);'}">
                    <i data-lucide="user-plus" style="width: 18px; height: 18px;"></i>
                    Persetujuan (${pendingUsers.length})
                </button>
                <button onclick="state.adminUsersTab = 'approved'; renderContent();" style="flex: 1; padding: 12px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 14px; 
                    ${state.adminUsersTab === 'approved' ? 'background: var(--accent-gold); color: #000; box-shadow: 0 4px 12px rgba(212,175,55,0.2);' : 'background: transparent; color: var(--text-muted);'}">
                    <i data-lucide="users" style="width: 18px; height: 18px;"></i>
                    Pengguna Aktif (${approvedUsers.length})
                </button>
            </div>

            <div style="width: 100%;">
                <!-- Section: Pending Approval -->
                ${state.adminUsersTab === 'pending' ? `
                <div class="setup-card" style="background: #151515; padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--shadow); animation: slideUp 0.3s ease-out;">
                    <div style="margin-bottom: 20px;">
                        <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px; font-size: 18px; color: var(--accent-gold);">
                            <i data-lucide="user-plus"></i>
                            Menunggu Persetujuan
                        </h3>
                        <p style="color: var(--text-muted); font-size: 13px;">User baru yang mendaftar dan menunggu akses Anda.</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${pendingUsers.length === 0 ? '<p style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 40px;">Tidak ada permintaan persetujuan baru.</p>' : pendingUsers.map(u => renderUserCard(u, 'pending')).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Section: Approved Users -->
                ${state.adminUsersTab === 'approved' ? `
                <div class="setup-card" style="background: #151515; padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--shadow); animation: slideUp 0.3s ease-out;">
                    <div style="margin-bottom: 20px;">
                        <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px; font-size: 18px; color: #40c057;">
                            <i data-lucide="users"></i>
                            Pengguna Aktif
                        </h3>
                        <p style="color: var(--text-muted); font-size: 13px;">User yang saat ini memiliki akses penuh ke platform.</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${approvedUsers.length === 0 ? '<p style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 40px;">Belum ada pengguna yang disetujui.</p>' : approvedUsers.map(u => renderUserCard(u, 'approved')).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function fetchDailyStats() {
    if (!state.isAdmin) return;
    try {
        const statsQuery = query(
            collection(db, 'stats'),
            orderBy('date', 'desc'),
            limit(7)
        );
        const snapshot = await getDocs(statsQuery);
        state.dailyStats = snapshot.docs
            .map(doc => doc.data())
            .filter(d => d.date);
        renderContent();
    } catch (e) {
        console.error("Gagal mengambil statistik harian:", e);
    }
}

window.toggleAdminDashboard = function() {
    state.showAdminDashboard = !state.showAdminDashboard;
    if (state.showAdminDashboard) {
        state.adminDashboardView = 'menu';
        fetchDailyStats();
    }
    renderContent();
};

function renderAdminMenu() {
    const totalGenerations = state.globalStats?.totalGenerations || 0;
    const totalUsers = state.allUsers.length;
    const pendingUsers = state.allUsers.filter(u => !u.isApproved).length;
    const approvedUsers = totalUsers - pendingUsers;
    
    return `
        <div class="admin-dashboard" style="max-width: 900px; margin: 20px auto; padding: 0 20px; animation: fadeIn 0.4s ease-out;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h1 style="font-size: 28px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-premium);">Admin Menu</h1>
                    <p style="color: var(--text-muted); font-size: 14px;">Pilih tindakan administrasi.</p>
                </div>
                <button onclick="state.showAdminDashboard = false; renderContent();" style="padding: 10px 20px; border-radius: 12px; background: #1a1a1a; border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                    Tutup
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
                <div style="background: #151515; padding: 20px; border-radius: 20px; border: 1px solid var(--border-color); text-align: center;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 11px; color: var(--accent-gold); font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">
                        TOTAL KARYA
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #fff;">${totalGenerations.toLocaleString()}</div>
                </div>
                <div style="background: #151515; padding: 20px; border-radius: 20px; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 11px; color: #40c057; font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">USER AKTIF</div>
                    <div style="font-size: 24px; font-weight: 800; color: #fff;">${approvedUsers}</div>
                </div>
                <div style="background: #151515; padding: 20px; border-radius: 20px; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 11px; color: #fab005; font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">PENDING</div>
                    <div style="font-size: 24px; font-weight: 800; color: #fff;">${pendingUsers}</div>
                </div>
            </div>

            <!-- Daily Statistics Chart-like view -->
            <div style="background: #151515; padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); margin-bottom: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="font-size: 16px; color: var(--text-main); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="bar-chart-3" style="width: 18px; color: var(--accent-gold);"></i>
                        Statistik 7 Hari Terakhir
                    </h3>
                    <span style="font-size: 11px; color: var(--text-muted); background: #1a1a1a; padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-color);">Hemat Data Mode</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${state.dailyStats.length === 0 ? `
                        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
                            Belum ada data statistik harian. Data akan muncul setelah ada karya baru dibuat.
                        </div>
                    ` : state.dailyStats.map(day => {
                        const maxCount = Math.max(...state.dailyStats.map(d => d.count), 1);
                        const width = (day.count / maxCount) * 100;
                        const date = new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                        
                        return `
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 85px; font-size: 12px; color: var(--text-muted);">${date}</div>
                                <div style="flex-grow: 1; height: 10px; background: #111; border-radius: 5px; overflow: hidden; border: 1px solid #1a1a1a;">
                                    <div style="height: 100%; width: ${width}%; background: linear-gradient(90deg, #d4af37, #f1c40f); border-radius: 5px;"></div>
                                </div>
                                <div style="width: 40px; text-align: right; font-size: 12px; font-weight: 700; color: #fff;">${day.count}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                <div class="setup-card" onclick="state.adminDashboardView = 'users'; renderContent();" style="background: #151515; padding: 32px; border-radius: 24px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px;" onmouseover="this.style.borderColor='var(--accent-gold)'" onmouseout="this.style.borderColor='var(--border-color)'">
                    <div style="width: 60px; height: 60px; background: rgba(212, 175, 55, 0.1); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--accent-gold);">
                        <i data-lucide="users" style="width: 32px; height: 32px;"></i>
                    </div>
                    <div>
                        <h3 style="font-size: 18px; color: var(--text-main); margin-bottom: 8px;">Kelola Data User</h3>
                        <p style="color: var(--text-muted); font-size: 13px;">Lihat daftar user, setujui akses, atau hapus user.</p>
                    </div>
                </div>

                <div class="setup-card" style="background: #151515; padding: 32px; border-radius: 24px; border: 1px solid var(--border-color); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px;">
                    <div style="width: 60px; height: 60px; background: rgba(250, 82, 82, 0.1); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fa5252;">
                        <i data-lucide="hard-drive" style="width: 32px; height: 32px;"></i>
                    </div>
                    <div>
                        <h3 style="font-size: 18px; color: var(--text-main); margin-bottom: 8px;">Pembersihan</h3>
                        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">Hapus file referensi Cloudinary.</p>
                        <button id="btn-clear-cloudinary" onclick="clearCloudinaryStorage()" style="background: #fa5252; color: white; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 12px; margin: 0 auto;">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus Storage
                        </button>
                    </div>
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
    
    const totalGenerations = state.globalStats?.totalGenerations || 0;
    
    return `
        <div class="usage-stats-bar">
            <div class="stat-item">
                <i data-lucide="layers"></i>
                <span>Task <strong class="stat-active-count">${activeCount}/${taskLimit}</strong> - <strong class="stat-queue-count">${queueCount}/${queueLimit}/min</strong></span>
            </div>
            <div class="stat-item stat-item-global">
                <i data-lucide="sparkles"></i>
                <span>Total Karya: <strong class="stat-total-generations">${totalGenerations.toLocaleString()}</strong></span>
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
            <div class="header-left" onclick="navigateToLanding()" style="cursor: pointer;">
                <img src="https://i.ibb.co.com/6c7LC9vh/logo.png" alt="ND Studio Pro" class="app-logo-img">
            </div>
            <div class="header-actions">
                ${state.isAdmin ? `
                    <button class="btn-icon-action ${state.showAdminDashboard ? 'active' : ''}" onclick="toggleAdminDashboard();" title="Admin Dashboard" style="background: #fff9db; color: #fab005; border-color: #ffec99; position: relative;">
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

                <button class="btn-icon-action" onclick="showGuide()" title="Panduan Penggunaan">
                    <i data-lucide="book-open"></i>
                </button>

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
                <div class="app-footer-powered">POWERED BY FREEPIK API</div>
            </div>
        </footer>
    `;
}

function renderSetupPage() {
    return `
        <div class="setup-page">
            <div class="setup-hero">
                <div class="setup-logo-large" style="background: transparent; box-shadow: none; width: auto; height: auto; border: none; overflow: visible; margin-bottom: 0;">
                    <img src="https://i.ibb.co.com/6c7LC9vh/logo.png" alt="ND Studio Pro" style="height: 60px; width: auto; max-width: 280px; object-fit: contain;">
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
                <a href="https://www.freepik.com/sign-up?client_id=freepik&lang=en" target="_blank" class="btn-step-action">
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
    const activeTools = getToolsForTab(state.activeToolsTab);

    return `
        <div class="tools-navigation-container" style="margin-bottom: 28px; background: rgba(0,0,0,0.2); padding: 20px; border-radius: 28px; border: 1px solid var(--border-color); overflow: visible; position: relative;">
            <!-- Category Title -->
            <div style="margin-bottom: 18px; display: flex; align-items: center; gap: 10px;">
                <div style="width: 4px; height: 18px; background: var(--accent-gold); border-radius: 4px; box-shadow: 0 0 10px rgba(212, 175, 55, 0.4);"></div>
                <span style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted);">Kategori Alat</span>
            </div>
            
            <!-- Categories Tabs -->
            <div class="tools-tabs-wrapper" style="display: flex; gap: 12px; overflow-x: auto; padding: 12px 4px 16px 4px; scrollbar-width: none; -ms-overflow-style: none; overflow-y: visible;">
                ${TOOL_CATEGORIES.map(cat => {
                    const isActive = state.activeToolsTab === cat.id;
                    return `
                        <button onclick="state.activeToolsTab = '${cat.id}'; renderContent();" class="tool-tab-btn" style="flex: 0 0 auto; padding: 12px 22px; border-radius: 18px; border: 1px solid ${isActive ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)'}; background: ${isActive ? 'rgba(212, 175, 55, 0.12)' : '#111'}; color: ${isActive ? 'var(--accent-gold)' : 'var(--text-muted)'}; cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; position: relative; box-shadow: ${isActive ? '0 8px 20px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(212, 175, 55, 0.05)' : 'none'}; overflow: visible;">
                            <i data-lucide="${cat.icon}" style="width: 18px; height: 18px;"></i>
                            ${cat.name}
                            ${cat.badge ? `
                                <div style="position: absolute; top: -14px; right: -8px; background: linear-gradient(135deg, #FFD700, #DAA520); color: #000; font-size: 9px; padding: 3px 10px; border-radius: 20px; font-weight: 900; text-transform: uppercase; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.3); pointer-events: none; z-index: 100; white-space: nowrap;">
                                    ${cat.badge}
                                </div>
                            ` : ''}
                            ${isActive ? '<div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 30%; height: 3px; background: var(--accent-gold); border-radius: 10px 10px 0 0; box-shadow: 0 0 10px var(--accent-gold);"></div>' : ''}
                        </button>
                    `;
                }).join('')}
            </div>

            <!-- Tool Selection (Sub-level) -->
            <div style="margin-top: 15px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); overflow: visible;">
                <div class="model-selector" style="margin-top: 0; padding: 10px 0; display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 16px; scrollbar-width: none; overflow-y: visible;">
                    ${activeTools.length === 0 ? '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 40px; width: 100%;">Segera hadir fitur baru...</div>' : activeTools.map(gen => `
                        <div class="model-item ${state.activeGenerator === gen.id ? 'active' : ''}" 
                             data-id="${gen.id}"
                             onclick="setActiveGenerator('${gen.id}')"
                             style="cursor: pointer; transition: all 0.3s; padding: 0; border-radius: 24px; flex: 0 0 110px; min-width: 110px; border: none; background: transparent; overflow: visible;">
                            <div class="model-icon-wrapper" style="width: 88px; height: 88px; margin: 0 auto 12px auto; transform: translateZ(0); position: relative; border-radius: 24px;">
                                <div class="model-icon-inner" style="border-radius: 22px;">${gen.icon}</div>
                                ${gen.badge ? `<div class="model-badge" style="top: -4px; right: -4px; z-index: 20; background: var(--accent-red); padding: 3px 8px; border-radius: 8px; font-size: 9px;">${gen.badge}</div>` : ''}
                            </div>
                            <div class="model-name-label" style="font-weight: 700; font-size: 11px; line-height: 1.3; color: var(--text-muted); display: block; overflow: visible; height: auto; margin-top: 6px; padding: 0 4px;">${gen.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <style>
            .tools-tabs-wrapper::-webkit-scrollbar { display: none; }
            .tool-tab-btn:hover { border-color: var(--accent-gold); transform: translateY(-2px); }
            .tool-tab-btn:active { transform: scale(0.95); }
        </style>
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
    const isKling4k = gen.id === 'kling-4k-i2v';
    const isSeeDream45 = gen.id === 'seedream-4-5-edit';
    const isVeoRef = gen.id === 'veo-3-1-reference';
    const isNanoPro = gen.id.includes('nano-banana-pro');
    const isGeminiFlash = gen.id === 'gemini-2-5-flash-image';
    const hasTwoInputs = gen.inputs.includes('video') || (isKling3Std && gen.inputs.includes('image')) || (isSeeDream45 && gen.inputs.includes('video')) || (isKling3OmniPro && gen.inputs.includes('video')) || (isKling4k && gen.inputs.includes('video')) || (isVeoRef && gen.inputs.includes('video')) || (isNanoPro && gen.inputs.includes('video')) || (isGeminiFlash && gen.inputs.includes('video'));
    const hasThreeInputs = gen.inputs.includes('image3');

    const uploadState = getUploadState();

    return `
        <div class="upload-section ${!hasTwoInputs && !hasThreeInputs ? 'single-input' : ''} ${hasThreeInputs ? 'three-inputs' : ''}">
            ${gen.inputs.includes('image') ? `
                <div class="upload-card ${uploadState.files.image || uploadState.urls.image ? 'has-file' : ''} ${uploadState.uploading.image ? 'uploading' : ''}" 
                     onclick="${showUrlInput ? '' : "triggerUpload('image')"} "
                     ondragover="handleDragOver(event)"
                     ondragleave="handleDragLeave(event)"
                     ondrop="handleDrop(event, 'image')">
                    ${uploadState.uploading.image ? `
                        <div class="upload-loader">
                            <div class="spinner"></div>
                            <span>Uploading...</span>
                            <button class="btn-remove-loader" onclick="removeFile(event, 'image')" title="Batal">
                                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                            </button>
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
                            <span>${gen.id === 'kling-v3-std' || gen.id === 'kling-v3-omni-pro' || gen.id === 'kling-4k-i2v' ? 'Start Image<br>(Awal)' : (gen.id === 'kling-v3-pro' ? 'Upload Gambar' : (gen.id === 'seedream-4-5-edit' || isVeoRef || isNanoPro || isGeminiFlash ? 'Reference Image 1' : 'Gambar<br>Karakter'))}</span>
                        </div>
                    `}
                </div>
            ` : ''}
            
            ${hasTwoInputs || hasThreeInputs ? `
                <div class="upload-card ${uploadState.files.video || uploadState.urls.video ? 'has-file' : ''} ${uploadState.uploading.video ? 'uploading' : ''}" 
                     onclick="${showUrlInput ? '' : "triggerUpload('video')"} "
                     ondragover="handleDragOver(event)"
                     ondragleave="handleDragLeave(event)"
                     ondrop="handleDrop(event, 'video')">
                    ${uploadState.uploading.video ? `
                        <div class="upload-loader">
                            <div class="spinner"></div>
                            <span>Uploading...</span>
                            <button class="btn-remove-loader" onclick="removeFile(event, 'video')" title="Batal">
                                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                            </button>
                        </div>
                    ` : uploadState.files.video ? `
                        ${(isKling3Std || isKling3OmniPro || isKling4k || isSeeDream45 || isVeoRef || isNanoPro || isGeminiFlash) ? `<img src="${uploadState.files.video}" class="upload-preview">` : `<video src="${uploadState.files.video}" class="upload-preview" muted autoplay loop playsinline></video>`}
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
                            <i data-lucide="${(isKling3Std || isKling3OmniPro || isKling4k || isSeeDream45 || isVeoRef || isNanoPro || isGeminiFlash) ? 'image' : 'video'}"></i>
                            <span>${(isKling3Std || isKling3OmniPro || isKling4k) ? 'End Image<br>(Akhir)' : (isSeeDream45 || isVeoRef || isNanoPro || isGeminiFlash ? 'Reference Image 2' : 'Video<br>Referensi')}</span>
                        </div>
                    `}
                </div>
            ` : ''}

            ${hasThreeInputs ? `
                <div class="upload-card ${uploadState.files.image3 || uploadState.urls.image3 ? 'has-file' : ''} ${uploadState.uploading.image3 ? 'uploading' : ''}" 
                     onclick="${showUrlInput ? '' : "triggerUpload('image3')"} "
                     ondragover="handleDragOver(event)"
                     ondragleave="handleDragLeave(event)"
                     ondrop="handleDrop(event, 'image3')">
                    ${uploadState.uploading.image3 ? `
                        <div class="upload-loader">
                            <div class="spinner"></div>
                            <span>Uploading...</span>
                            <button class="btn-remove-loader" onclick="removeFile(event, 'image3')" title="Batal">
                                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                            </button>
                        </div>
                    ` : uploadState.files.image3 ? `
                        <img src="${uploadState.files.image3}" class="upload-preview">
                        <button class="btn-remove" onclick="removeFile(event, 'image3')"><i data-lucide="x"></i></button>
                    ` : uploadState.urls.image3 ? `
                        <div class="upload-placeholder">
                            <i data-lucide="check-circle" style="color: #40c057;"></i>
                            <span style="font-size: 10px; color: #40c057; font-weight: 700;">URL TERPASANG</span>
                            <span style="font-size: 9px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; width: 80%; white-space: nowrap;">${uploadState.autoUploaded.image3 ? 'File siap digunakan' : uploadState.urls.image3}</span>
                            <button class="btn-remove" onclick="removeFile(event, 'image3')"><i data-lucide="x"></i></button>
                        </div>
                    ` : `
                        <div class="upload-placeholder">
                            <i data-lucide="image"></i>
                            <span>Reference Image 3</span>
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
                    ${hasTwoInputs || hasThreeInputs ? `
                        <input type="text" class="url-input" placeholder="${(isKling3Std || isKling3OmniPro || isSeeDream45 || isVeoRef || isNanoPro || isGeminiFlash) ? 'https://... (Reference Image 2)' : 'https://... (URL Video)'}" 
                               value="${uploadState.autoUploaded.video ? '' : uploadState.urls.video}" oninput="updateUrl('video', this.value)">
                    ` : ''}
                    ${hasThreeInputs ? `
                        <input type="text" class="url-input" placeholder="https://... (Reference Image 3)" 
                               value="${uploadState.autoUploaded.image3 ? '' : uploadState.urls.image3}" oninput="updateUrl('image3', this.value)">
                    ` : ''}
                </div>
            ` : ''}
        </div>
        <input type="file" id="file-input-image" hidden accept="image/*" onchange="handleFileChange('image', this)">
        <input type="file" id="file-input-video" hidden accept="${(isKling3Std || isKling3OmniPro || isKling4k || isSeeDream45 || isVeoRef || isNanoPro || isGeminiFlash) ? 'image/*' : 'video/*'}" onchange="handleFileChange('video', this)">
        <input type="file" id="file-input-image3" hidden accept="image/*" onchange="handleFileChange('image3', this)">
    `;
}

function renderPromptSection() {
    const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
    let placeholder = "Masukkan prompt deskripsi di sini...";
    if (activeGen.id === 'flux-2-pro') {
        placeholder = "Describe your image (e.g. cinematic portrait, ultra realistic, 4k, soft lighting)";
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

            ${gen.settings.style_preset ? `
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

            ${gen.settings.prompt_upsampling ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <span>Prompt Upsampling</span>
                        <span class="setting-value">${state.settings.prompt_upsampling ? 'ON' : 'OFF'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label class="switch">
                            <input type="checkbox" ${state.settings.prompt_upsampling ? 'checked' : ''} 
                                   onchange="updateSetting('prompt_upsampling', this.checked)">
                            <span class="slider round"></span>
                        </label>
                        <span style="font-size: 11px; color: var(--text-muted);">Otomatis memperbagus prompt.</span>
                    </div>
                </div>
            ` : ''}

            ${gen.settings.enhance_prompt ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Enhance Prompt</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Otomatis memperluas dan memperbagus prompt menggunakan model bahasa AI (LLM) untuk hasil yang lebih detail.</span>
                            </div>
                        </div>
                        <span class="setting-value" id="enhance-prompt-val">${state.settings.enhance_prompt ? 'ON' : 'OFF'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label class="switch">
                            <input type="checkbox" ${state.settings.enhance_prompt ? 'checked' : ''} 
                                   onchange="updateSetting('enhance_prompt', this.checked); document.getElementById('enhance-prompt-val').innerText = this.checked ? 'ON' : 'OFF'">
                            <span class="slider round"></span>
                        </label>
                        <span style="font-size: 11px; color: var(--text-muted);">Gunakan LLM untuk memperbagus prompt.</span>
                    </div>
                </div>
            ` : ''}

            ${gen.settings.person_generation ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Person Generation</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Mengatur kebijakan pembuatan gambar wajah atau tubuh manusia.</span>
                            </div>
                        </div>
                    </div>
                    <select class="setting-select" onchange="updateSetting('person_generation', this.value)">
                        <option value="dont_allow" ${state.settings.person_generation === 'dont_allow' ? 'selected' : ''}>Don't Allow</option>
                        <option value="allow_adult" ${state.settings.person_generation === 'allow_adult' ? 'selected' : ''}>Allow Adult</option>
                        <option value="allow_all" ${state.settings.person_generation === 'allow_all' ? 'selected' : ''}>Allow All</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.safety_settings ? `
                <div class="setting-item">
                    <div class="setting-label">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>Safety Settings</span>
                            <div class="setting-info-tooltip">
                                <i data-lucide="help-circle"></i>
                                <span class="tooltip-text">Mengatur tingkat filter keamanan konten untuk memblokir gambar yang dianggap tidak pantas.</span>
                            </div>
                        </div>
                    </div>
                    <select class="setting-select" onchange="updateSetting('safety_settings', this.value)">
                        <option value="block_low_and_above" ${state.settings.safety_settings === 'block_low_and_above' ? 'selected' : ''}>Block Low and Above</option>
                        <option value="block_medium_and_above" ${state.settings.safety_settings === 'block_medium_and_above' ? 'selected' : ''}>Block Medium and Above</option>
                        <option value="block_only_high" ${state.settings.safety_settings === 'block_only_high' ? 'selected' : ''}>Block Only High</option>
                        <option value="block_none" ${state.settings.safety_settings === 'block_none' ? 'selected' : ''}>Block None</option>
                    </select>
                </div>
            ` : ''}

            ${gen.settings.resolution ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Resolution</span></div>
                    <select class="setting-select" onchange="updateSetting('resolution', this.value)">
                        ${gen.id === 'nano-banana-pro' || gen.id === 'nano-banana-pro-flash' ? `
                            <option value="1K" ${state.settings.resolution === '1K' ? 'selected' : ''}>1K (Fast)</option>
                            <option value="2K" ${state.settings.resolution === '2K' ? 'selected' : ''}>2K (Standard)</option>
                            <option value="4K" ${state.settings.resolution === '4K' ? 'selected' : ''}>4K (High Quality)</option>
                        ` : gen.settings.resolution === 'veo' ? `
                            <option value="720p" ${state.settings.resolution === '720p' ? 'selected' : ''}>720p</option>
                            <option value="1080p" ${state.settings.resolution === '1080p' ? 'selected' : ''}>1080p</option>
                            <option value="4k" ${state.settings.resolution === '4k' ? 'selected' : ''}>4K</option>
                        ` : gen.settings.resolution === 'happy-horse' ? `
                            <option value="720P" ${state.settings.resolution === '720P' ? 'selected' : ''}>720P</option>
                            <option value="1080P" ${state.settings.resolution === '1080P' ? 'selected' : ''}>1080P</option>
                        ` : `
                            <option value="360p" ${state.settings.resolution === '360p' ? 'selected' : ''}>360p</option>
                            <option value="540p" ${state.settings.resolution === '540p' ? 'selected' : ''}>540p</option>
                            <option value="720p" ${state.settings.resolution === '720p' ? 'selected' : ''}>720p</option>
                            <option value="1080p" ${state.settings.resolution === '1080p' ? 'selected' : ''}>1080p</option>
                        `}
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
                        ` : gen.settings.aspect_ratio === 'nano' ? `
                            <option value="1:1" ${state.settings.aspect_ratio === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
                            <option value="2:3" ${state.settings.aspect_ratio === '2:3' ? 'selected' : ''}>2:3 (Portrait)</option>
                            <option value="3:2" ${state.settings.aspect_ratio === '3:2' ? 'selected' : ''}>3:2 (Landscape)</option>
                            <option value="4:3" ${state.settings.aspect_ratio === '4:3' ? 'selected' : ''}>4:3 (Standard)</option>
                            <option value="3:4" ${state.settings.aspect_ratio === '3:4' ? 'selected' : ''}>3:4 (Standard Portrait)</option>
                            <option value="5:4" ${state.settings.aspect_ratio === '5:4' ? 'selected' : ''}>5:4 (Photo)</option>
                            <option value="4:5" ${state.settings.aspect_ratio === '4:5' ? 'selected' : ''}>4:5 (Photo Portrait)</option>
                            <option value="16:9" ${state.settings.aspect_ratio === '16:9' ? 'selected' : ''}>16:9 (Widescreen)</option>
                            <option value="9:16" ${state.settings.aspect_ratio === '9:16' ? 'selected' : ''}>9:16 (Social Story)</option>
                            <option value="21:9" ${state.settings.aspect_ratio === '21:9' ? 'selected' : ''}>21:9 (Ultra-wide)</option>
                        ` : gen.settings.aspect_ratio === 'seedance' ? `
                            <option value="widescreen_16_9" ${state.settings.aspect_ratio === 'widescreen_16_9' ? 'selected' : ''}>16:9 (Widescreen)</option>
                            <option value="social_story_9_16" ${state.settings.aspect_ratio === 'social_story_9_16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="square_1_1" ${state.settings.aspect_ratio === 'square_1_1' ? 'selected' : ''}>1:1 (Square)</option>
                        ` : gen.settings.aspect_ratio === 'runway-4-5' ? `
                            <option value="1280:720" ${state.settings.aspect_ratio === '1280:720' ? 'selected' : ''}>Landscape (16:9)</option>
                            <option value="720:1280" ${state.settings.aspect_ratio === '720:1280' ? 'selected' : ''}>Portrait (9:16)</option>
                            <option value="1104:832" ${state.settings.aspect_ratio === '1104:832' ? 'selected' : ''}>Landscape (4:3)</option>
                            <option value="960:960" ${state.settings.aspect_ratio === '960:960' ? 'selected' : ''}>Square (1:1)</option>
                            <option value="832:1104" ${state.settings.aspect_ratio === '832:1104' ? 'selected' : ''}>Portrait (3:4)</option>
                        ` : gen.settings.aspect_ratio === 'imagen4' ? `
                            <option value="square_1_1" ${state.settings.aspect_ratio === 'square_1_1' ? 'selected' : ''}>Square (1:1)</option>
                            <option value="social_story_9_16" ${state.settings.aspect_ratio === 'social_story_9_16' ? 'selected' : ''}>Social Story (9:16)</option>
                            <option value="widescreen_16_9" ${state.settings.aspect_ratio === 'widescreen_16_9' ? 'selected' : ''}>Widescreen (16:9)</option>
                            <option value="traditional_3_4" ${state.settings.aspect_ratio === 'traditional_3_4' ? 'selected' : ''}>Traditional (3:4)</option>
                            <option value="classic_4_3" ${state.settings.aspect_ratio === 'classic_4_3' ? 'selected' : ''}>Classic (4:3)</option>
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
                        ${gen.settings.duration === 'veo' ? `
                            <option value="4" ${state.settings.duration == 4 ? 'selected' : ''}>4 Seconds</option>
                            <option value="6" ${state.settings.duration == 6 ? 'selected' : ''}>6 Seconds</option>
                            <option value="8" ${state.settings.duration == 8 ? 'selected' : ''}>8 Seconds</option>
                        ` : gen.settings.duration === 'kling26' ? [5,10].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('') : gen.settings.duration === 'runway-4-5' ? [5,8,10].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('') : gen.settings.duration === 'happy-horse' ? [5,10,15].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('') : gen.settings.duration === 'seedance' ? [5,10,12].map(d => `
                            <option value="${d}" ${state.settings.duration == d ? 'selected' : ''}>${d}s</option>
                        `).join('') : gen.settings.duration === 'pixverse' ? `
                            <option value="5" ${state.settings.duration == 5 ? 'selected' : ''}>5 Seconds (1080p)</option>
                            <option value="8" ${state.settings.duration == 8 ? 'selected' : ''}>8 Seconds (720p)</option>
                        ` : (gen.id.includes('motion-control') ? [3,4,5,6,7,8,9,10,11,12,13,14,15,20,25,30] : [3,4,5,6,7,8,9,10,11,12,13,14,15]).map(d => `
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
    let btnText = `✨ Generate ${btnType}`;
    
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
                <div class="task-card" id="task-card-${task.id}">
                    <div class="task-header">
                        <div class="task-header-left">
                            <div class="task-tool-icon">${gen.icon}</div>
                            <span>${task.modelName}</span>
                        </div>
                        <div class="task-header-right">
                            <span class="task-progress-text">${Math.floor(task.progress)}%</span>
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

async function syncHistory() {
    if (!state.apiKey) return;
    showToast("🔄 Menyinkronkan riwayat generasi...", "info");
    
    // Ensure all current active tasks are being polled
    state.activeTasks.forEach(task => {
        if (!activePolls.has(task.id)) {
            console.log("Sync: Resuming idle task polling:", task.id);
            pollTaskStatus(task.id);
        }
    });

    // Define endpoints to check for last generation tasks
    const endpoints = [
        'https://api.freepik.com/v1/ai/video/tasks',
        'https://api.freepik.com/v1/ai/image-to-video/tasks',
        'https://api.freepik.com/v1/ai/video/kling-v3-omni',
        'https://api.freepik.com/v1/ai/text-to-image/tasks'
    ];

    let foundNew = 0;
    
    for (const endpoint of endpoints) {
        try {
            const url = `/api/freepik/list?endpoint=${encodeURIComponent(endpoint)}&apiKey=${encodeURIComponent(state.apiKey)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            const items = data.data || data.items || (Array.isArray(data) ? data : []);
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const taskId = item.id || item.task_id;
                    const status = (item.status || item.state || '').toUpperCase();
                    const isDone = status === 'COMPLETED' || status === 'FINISHED' || status === 'SUCCESS' || status === 'SUCCEEDED';
                    
                    // If we found a completed task that isn't in our active tasks or results, we can handle it
                    const inResults = state.completedResults.some(r => r.id === taskId);
                    const inActive = state.activeTasks.some(t => t.id === taskId);
                    
                    if (isDone && !inResults) {
                        // Attempt to find URL
                        const videoUrl = findUrlInObject(item);
                        if (videoUrl) {
                            state.completedResults.unshift({
                                id: taskId,
                                url: videoUrl,
                                type: videoUrl.includes('.mp4') || videoUrl.includes('.mov') ? 'video' : 'image',
                                generatorId: 'unknown',
                                prompt: item.prompt || "Synced from history",
                                timestamp: item.created_at || new Date().toISOString()
                            });
                            foundNew++;
                        } else {
                            // If it's done but no URL in list, trigger a direct poll to get the URL
                            console.log(`Task ${taskId} is done but URL missing in list. Triggering direct poll...`);
                            state.activeTasks.push({
                                id: taskId,
                                modelName: "Recovering URL...",
                                generatorId: 'unknown',
                                prompt: item.prompt || "",
                                progress: 100,
                                status: 'Success',
                                pollCount: 0,
                                startTime: Date.now()
                            });
                            pollTaskStatus(taskId);
                        }
                    } else if (!isDone && !inResults && !inActive && taskId) {
                        // Add back to active tasks if it's still processing
                        state.activeTasks.push({
                            id: taskId,
                            modelName: "Recovered Task",
                            generatorId: 'unknown',
                            prompt: item.prompt || "",
                            progress: item.progress || 0,
                            status: status || 'Processing',
                            pollCount: 0,
                            startTime: Date.now()
                        });
                        pollTaskStatus(taskId);
                        foundNew++;
                    }
                });
            }
        } catch (e) {
            console.error(`Sync error for ${endpoint}:`, e);
        }
    }
    
    if (foundNew > 0) {
        showToast(`✅ Berhasil menyinkronkan ${foundNew} hasil baru!`, "success");
        updateTasksAndResultsDOM();
    } else {
        showToast("ℹ️ Tidak ditemukan hasil baru yang belum dicatat.", "info");
    }
}

function findUrlInObject(obj, depth = 0) {
    if (!obj || depth > 12) return null;
    
    if (typeof obj === 'string') {
        const isUrl = obj.startsWith('http') || obj.startsWith('//');
        const isMedia = obj.includes('.mp4') || obj.includes('.mov') || obj.includes('.webm') || obj.includes('.jpg') || obj.includes('.png') || obj.includes('.webp') || obj.includes('.mp3') || obj.includes('.wav') || obj.includes('video') || obj.includes('image') || obj.includes('audio') || obj.includes('freepik');
        if (isUrl && isMedia) return obj;
        return null;
    }
    
    if (typeof obj !== 'object') return null;
    
    const priorityKeys = ['url', 'image_url', 'video_url', 'download_url', 'uri', 'link', 'src', 'video', 'image', 'output', 'generated_video', 'generated_image'];
    for (const key of priorityKeys) {
        const val = obj[key];
        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('//'))) {
            return val;
        }
        if (val && typeof val === 'object') {
            const found = findUrlInObject(val, depth + 1);
            if (found) return found;
        }
    }
    
    for (const key in obj) {
        if (!priorityKeys.includes(key)) {
            const val = obj[key];
            if (val && typeof val === 'object') {
                const found = findUrlInObject(val, depth + 1);
                if (found) return found;
            }
        }
    }
    return null;
}

function renderResults() {
    return `
        <div class="results-section">
            <div class="results-header-row">
                <h3>Hasil Generasi</h3>
                <button class="btn-sync" onclick="syncHistory()" title="Cek status terbaru dari server Freepik">
                    <i data-lucide="refresh-ccw" style="width: 14px; height: 14px; margin-right: 6px;"></i>
                    Sync Status
                </button>
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
                                    <button class="btn-overlay-action btn-download" onclick="handleDownload('${res.url}', '${res.generatorId}-${index}')" title="Download HD">
                                        <i data-lucide="download"></i>
                                    </button>
                                    <button class="btn-overlay-action btn-share" onclick="handleShare('${res.url}', '${res.prompt ? res.prompt.replace(/'/g, "\\'") : 'ND Studio Pro Result'}')" title="Share">
                                        <i data-lucide="share-2"></i>
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
    if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-motion-control-std' || activeGen.id === 'kling-v3-motion-control-pro' || activeGen.id === 'kling-v3-omni-pro' || activeGen.id === 'kling-v2-6-pro-i2v' || activeGen.id === 'kling-4k-i2v') {
        listEndpoint = (activeGen.id === 'kling-v3-motion-control-std' || activeGen.id === 'kling-v3-motion-control-pro' || activeGen.id === 'kling-4k-i2v')
            ? activeGen.endpoint
            : (activeGen.id === 'kling-v3-omni-pro' ? 'https://api.freepik.com/v1/ai/video/kling-v3-omni' : (activeGen.id === 'kling-v2-6-pro-i2v' ? 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6' : 'https://api.freepik.com/v1/ai/video/kling-v3'));
        listType = 'list';
    } else if (activeGen.id === 'seedream-4-5-edit') {
        listEndpoint = 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit';
        listType = 'list';
    } else if (activeGen.id === 'pixverse-v5') {
        listEndpoint = 'https://api.freepik.com/v1/ai/image-to-video/pixverse-v5';
        listType = 'list';
    } else if (activeGen.id === 'imagen4-fast' || activeGen.id === 'imagen4-ultra') {
        listEndpoint = `https://api.freepik.com/v1/ai/text-to-image/${activeGen.id}`;
        listType = 'list';
    } else if (activeGen.id === 'gemini-2-5-flash-image') {
        listEndpoint = 'https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview';
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

        // Priority: ALWAYS prefer the public URL if available to save Vercel bandwidth (Fast Origin Transfer)
        // Only fallback to base64 if no URL exists and the model explicitly allows it
        let imageInput = uploadState.urls.image || uploadState.files.image;
        let videoInput = uploadState.urls.video || uploadState.files.video;
        let image3Input = uploadState.urls.image3 || uploadState.files.image3;
 
        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        if (!activeGen) throw new Error("Model generator tidak ditemukan.");
 
        // Note: We removed the "Force base64" logic because sending large base64 strings 
        // through Vercel proxy consumes expensive bandwidth. Public URLs are much more efficient.

        // Kling and Veo models strictly require public HTTPS URLs
        const needsPublicUrl = activeGen.id.toLowerCase().includes('kling') || activeGen.id.toLowerCase().includes('happy-horse') || activeGen.id === 'pixverse-v5' || activeGen.id === 'veo-3-1-i2v' || activeGen.id === 'veo-3-1-reference' || activeGen.id === 'kling-v2-6-pro-i2v' || activeGen.id === 'kling-4k-i2v';
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
        } else if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-omni-pro' || activeGen.id === 'kling-v2-6-pro-i2v' || activeGen.id === 'kling-4k-i2v') {
            if ((activeGen.id === 'kling-v2-6-pro-i2v' || activeGen.id === 'kling-4k-i2v') && !imageInput) {
                throw new Error(`Wajib upload Gambar (atau masukkan URL) untuk ${activeGen.name}.`);
            }
            if (!state.currentPrompt && !imageInput) {
                throw new Error("Wajib masukkan Prompt atau Start Image untuk Kling.");
            }
        } else if (activeGen.id === 'seedream-4-5-edit') {
            if (!imageInput && !videoInput) {
                throw new Error("Wajib upload setidaknya satu Reference Image untuk SeeDream 4.5 Edit.");
            }
            if (!state.currentPrompt) {
                throw new Error("Wajib masukkan Prompt untuk SeeDream 4.5 Edit.");
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
        
        // --- TRANSLATION LOGIC ---
        let shouldTranslate = true;
        const isKling = activeGen.id.toLowerCase().includes('kling');
        const isVeo = activeGen.id.toLowerCase().includes('veo');

        if (!finalPrompt) {
            shouldTranslate = false;
        } else if (activeGen.id === 'elevenlabs-turbo-v2-5' || activeGen.id === 'music-generation') {
            shouldTranslate = false;
        } else if (isKling || isVeo) {
            // CRITICAL: Disable translation for Kling and Veo to preserve dialogue in original language
            shouldTranslate = false;
            console.log(`[AUTH] Skipping translation for ${activeGen.name} to preserve original prompt: "${finalPrompt}"`);
        } else if (activeGen.outputType === 'video' && !activeGen.id.includes('motion-control')) {
            // General video models also skip translation unless motion-control
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
        } else if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-omni-pro' || activeGen.id === 'kling-v2-6-pro-i2v') {
            let ar = state.settings.aspect_ratio;
            if (ar === 'square_1_1') ar = '1:1';
            else if (ar === 'widescreen_16_9') ar = '16:9';
            else if (ar === 'social_story_9_16') ar = '9:16';
            
            if (!['16:9', '9:16', '1:1'].includes(ar)) {
                ar = '16:9';
            }

            if (activeGen.id === 'kling-v2-6-pro-i2v') {
                const durationVal = state.settings.duration ? String(state.settings.duration) : "5";
                body = {
                    prompt: finalPrompt,
                    image: ensureHttps(imageInput) || undefined,
                    aspect_ratio: ar === '16:9' ? 'widescreen_16_9' : (ar === '9:16' ? 'social_story_9_16' : 'square_1_1'),
                    duration: (durationVal === "5" || durationVal === "10") ? durationVal : "5",
                    negative_prompt: state.settings.negative_prompt,
                    cfg_scale: state.settings.cfg_scale !== undefined ? state.settings.cfg_scale : 0.5,
                    generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true,
                    prompt_enhancement: false // Force original language
                };
            } else if (activeGen.id === 'kling-v3-omni-pro') {
                body = {
                    prompt: finalPrompt,
                    start_image_url: ensureHttps(imageInput) || undefined,
                    end_image_url: ensureHttps(videoInput) || undefined,
                    aspect_ratio: ar,
                    duration: state.settings.duration,
                    generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true,
                    prompt_enhancement: false // Force original language
                };
                // For image-to-video, if start_image_url is provided, image_url is also required by the API
                if (body.start_image_url) {
                    body.image_url = body.start_image_url;
                }
            } else if (activeGen.id === 'kling-4k-i2v') {
                body = {
                    image: ensureHttps(imageInput),
                    image_tail: videoInput ? ensureHttps(videoInput) : undefined,
                    prompt: finalPrompt,
                    negative_prompt: state.settings.negative_prompt,
                    cfg_scale: state.settings.cfg_scale !== undefined ? state.settings.cfg_scale : 0.5,
                    duration: parseInt(state.settings.duration) || 5
                };
            } else {
                body = {
                    prompt: finalPrompt,
                    start_image_url: ensureHttps(imageInput) || undefined,
                    end_image_url: ensureHttps(videoInput) || undefined,
                    aspect_ratio: ar,
                    duration: state.settings.duration,
                    negative_prompt: state.settings.negative_prompt,
                    cfg_scale: state.settings.cfg_scale,
                    generate_audio: true,
                    prompt_enhancement: false // Force original language
                };
            }
        } else if (activeGen.id === 'seedream-4-5-edit') {
            const img1 = (imageInput || "").toString().trim();
            const img2 = (videoInput || "").toString().trim();
            const img3 = (image3Input || "").toString().trim();
            
            // Match the curl example exactly: an array of valid URLs or base64
            const referenceImages = [
                img1 ? (img1.startsWith('http') ? ensureHttps(img1) : img1) : "",
                img2 ? (img2.startsWith('http') ? ensureHttps(img2) : img2) : "",
                img3 ? (img3.startsWith('http') ? ensureHttps(img3) : img3) : ""
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
        } else if (activeGen.id === 'veo-3-1-i2v') {
            if (!imageInput) {
                throw new Error("Wajib upload Gambar (atau masukkan URL) untuk Veo 3.1 Image to Video.");
            }
            body = {
                image: ensureHttps(imageInput),
                prompt: finalPrompt,
                negative_prompt: state.settings.negative_prompt || "",
                duration: parseInt(state.settings.duration) || 8,
                resolution: state.settings.resolution || "720p",
                aspect_ratio: state.settings.aspect_ratio || "16:9",
                generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'veo-3-1-reference') {
            if (!imageInput) {
                throw new Error("Wajib upload setidaknya satu Gambar Referensi untuk Veo 3.1 Reference to Video.");
            }
            const imageUrls = [
                ensureHttps(imageInput),
                videoInput ? ensureHttps(videoInput) : null
            ].filter(Boolean);

            body = {
                image_urls: imageUrls,
                prompt: finalPrompt,
                negative_prompt: state.settings.negative_prompt || "",
                resolution: state.settings.resolution || "720p",
                aspect_ratio: state.settings.aspect_ratio || "16:9",
                generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'nano-banana-pro' || activeGen.id === 'nano-banana-pro-flash') {
            body = {
                prompt: finalPrompt,
                aspect_ratio: state.settings.aspect_ratio || "1:1",
                resolution: state.settings.resolution || "2K"
            };
            if (imageInput || videoInput || image3Input) {
                body.reference_images = [];
                if (imageInput) {
                    body.reference_images.push({
                        image: ensureHttps(imageInput),
                        text: "Reference 1",
                        mime_type: "image/jpeg"
                    });
                }
                if (videoInput) {
                    body.reference_images.push({
                        image: ensureHttps(videoInput),
                        text: "Reference 2",
                        mime_type: "image/jpeg"
                    });
                }
                if (image3Input) {
                    body.reference_images.push({
                        image: ensureHttps(image3Input),
                        text: "Reference 3",
                        mime_type: "image/jpeg"
                    });
                }
            }
        } else if (activeGen.id === 'flux-2-pro') {
            let prompt = finalPrompt;
            
            if (state.settings.style === 'Realistic') {
                prompt = `photorealistic raw photo of ${prompt}, high detail, 8k, highly detailed skin texture, natural lighting, masterwork`;
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
                width: width,
                height: height,
                prompt_upsampling: state.settings.prompt_upsampling || false,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };

            // Add Image-to-Image if image is uploaded
            if (imageInput) {
                // Freepik requires base64 without the prefix for flux-2-pro input_image
                const base64Image = imageInput.includes('base64,') ? imageInput.split('base64,')[1] : imageInput;
                body.input_image = base64Image;
            }
        } else if (activeGen.id === 'pixverse-v5') {
            if (!imageInput) {
                throw new Error("Wajib upload Gambar untuk Pixverse V5.");
            }
            
            let prompt = finalPrompt || "Cinematic video";
            if (state.settings.style && state.settings.style !== 'None') {
                prompt = `${state.settings.style} style, ${prompt}`;
            }

            const duration = parseInt(state.settings.duration) || 5;
            const resolution = duration === 8 ? "720p" : "1080p";

            body = {
                prompt: prompt,
                image_url: ensureHttps(imageInput),
                negative_prompt: state.settings.negative_prompt || "",
                resolution: resolution,
                duration: duration,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'imagen4-fast' || activeGen.id === 'imagen4-ultra') {
            body = {
                prompt: finalPrompt,
                aspect_ratio: state.settings.aspect_ratio || "square_1_1",
                person_generation: state.settings.person_generation || "allow_adult",
                safety_settings: state.settings.safety_settings || "block_medium_and_above",
                enhance_prompt: state.settings.enhance_prompt !== undefined ? state.settings.enhance_prompt : true,
                language: "en"
            };
            
            // Only add output_options if explicitly needed, sometimes invalid combinations cause failures
            if (activeGen.id === 'imagen4-ultra') {
                body.output_options = {
                    mime_type: "image/jpeg",
                    compression_quality: 90
                };
            }

            if (state.settings.seed !== '' && state.settings.seed !== undefined) {
                body.seed = parseInt(state.settings.seed);
            }
        } else if (activeGen.id === 'gemini-2-5-flash-image') {
            body = {
                prompt: finalPrompt
            };
            const refs = [];
            if (imageInput) refs.push(imageInput);
            if (videoInput) refs.push(videoInput);
            if (image3Input) refs.push(image3Input);
            
            if (refs.length > 0) {
                body.reference_images = refs;
            }
        } else if (activeGen.id === 'happy-horse-1') {
            if (!imageInput) {
                throw new Error("Wajib upload Gambar (atau masukkan URL) untuk Happy Horse 1.0.");
            }
            body = {
                image_url: ensureHttps(imageInput),
                prompt: finalPrompt,
                resolution: state.settings.resolution || "1080P",
                duration: parseInt(state.settings.duration) || 5,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'runway-4-5') {
            if (!imageInput || !finalPrompt) {
                throw new Error("Wajib upload Gambar dan masukkan Prompt untuk Runway Gen 4.5.");
            }
            body = {
                image: ensureHttps(imageInput),
                prompt: finalPrompt,
                ratio: state.settings.aspect_ratio || "1280:720",
                duration: parseInt(state.settings.duration) || 5,
                seed: state.settings.seed !== '' && state.settings.seed !== undefined ? parseInt(state.settings.seed) : Math.floor(Math.random() * 4294967295)
            };
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
            if (text.includes("Starting Server") || text.includes("Ready in") || text.includes("Cold Start")) {
                throw new Error("Server sedang bersiap (Cold Start). Silakan tunggu 15 detik dan klik Generate lagi.");
            }
            if (text.includes("<!DOCTYPE html>") || text.includes("<html>") || text.includes("<title>403")) {
                throw new Error("Akses dibatasi sementara. Silakan tunggu 5-10 Menit atau hubungi developer.");
            }
            throw new Error("Respon server tidak valid. Silakan tunggu 15 detik dan klik Generate lagi.");
        }

        if (data.error) {
            console.error("Proxy returned error:", data);
            
            const errorMessage = data.message ? data.message.toLowerCase() : "";
            
            if (errorMessage.includes("blocked due to suspicious activity")) {
                throw new Error("Akses dibatasi sementara. Silakan tunggu 5-10 Menit atau hubungi developer.");
            }
            
            // Handle Limit / Quota / Credits issues
            if (data.status === 429 || data.status === 402 || 
                errorMessage.includes("limit") || errorMessage.includes("quota") || 
                errorMessage.includes("insufficient") || errorMessage.includes("credits")) {
                throw new Error("Kuota Api key anda telah habis, silakan membuat api key baru.");
            }

            throw new Error(data.message || "Gagal menghubungi API Freepik.");
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
                state.cooldownUntil = Date.now() + 60000; // 1 minute cooldown on 429
                state.globalError = "Limit API Freepik telah tercapai (Too Many Requests). Harap tunggu 1 menit sebelum mencoba lagi.";
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
                throw new Error(`Bad Request (400): ${fullErrorMsg}. Pastikan format gambar/input valid.`);
            }
            
            throw new Error(fullErrorMsg);
        }

        console.log("API Response:", data);
        
        // Detect Task ID from various possible response structures
        let taskId = data.id || data.task_id || (data.data && (data.data.id || data.data.task_id));
        
        updateActivity(); // Activity tracking

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

        // Task started (we don't increment here to ensure only successful works are counted)

        state.activeTasks.push({
            id: taskId,
            modelName: activeGen.name,
            generatorId: state.activeGenerator,
            prompt: state.currentPrompt || "",
            progress: 0,
            status: 'Processing',
            pollCount: 0,
            startTime: Date.now()
        });
        
        // Record generation for queue limit tracking
        state.generationHistory.push(Date.now());

        showToast("✨ Task berhasil dibuat! Sedang diproses...", "success");
        updateTasksAndResultsDOM();
        
        // Strategy: Delay initial poll based on output type
        // Video takes much longer, so wait 20s initially instead of 6s
        const initialDelay = activeGen.outputType === 'video' ? 20000 : 6000;
        console.log(`Initial polling delay set to ${initialDelay}ms for ${activeGen.outputType}`);
        
        setTimeout(() => pollTaskStatus(taskId), initialDelay);

    } catch (error) {
        console.error("Generate error:", error);
        showToast(error.message, "error");
    } finally {
        state.cooldownUntil = Date.now() + 15000; // 15 seconds cooldown
        if (btn) {
            const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
            let secondsLeft = 15;
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
                        currentBtn.innerHTML = `✨ Generate ${activeGen.outputType.charAt(0).toUpperCase() + activeGen.outputType.slice(1)}`;
                    }
                }
            }, 1000);
        }
    }
}

async function pollTaskStatus(taskId, fallbackIndex = 0) {
    const taskIndex = state.activeTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        activePolls.delete(taskId);
        return;
    }
    
    // Track that we are actively polling this task
    activePolls.add(taskId);
    
    const task = state.activeTasks[taskIndex];
    const activeGen = GENERATORS.find(g => g.id === task.generatorId) || GENERATORS.find(g => g.id === state.activeGenerator);
    
    const currentKey = state.apiKey ? state.apiKey.trim() : '';
    if (!currentKey) {
        console.warn("Polling paused: No API Key found yet for task", taskId);
        // Retry in 5 seconds - maybe the database is still loading the key
        setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 5000);
        return;
    }

    // List of potential status endpoints and formats to try if 404 occurs
    const fallbacks = [
        { base: activeGen.statusEndpoint || 'https://api.freepik.com/v1/ai/video/tasks', type: activeGen.pollingType || 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/tasks', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/tasks', type: 'list' },
        { base: 'https://api.freepik.com/v1/ai/video/kling-v3', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/video/kling-v3', type: 'list' },
        { base: 'https://api.freepik.com/v1/ai/video/kling-v3-omni', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6', type: 'path' },
        { base: 'https://api.freepik.com/v1/ai/image-to-video/tasks', type: 'list' },
        { base: 'https://api.freepik.com/v1/ai/video/status', type: 'query' },
        { base: 'https://api.freepik.com/v1/ai/text-to-image/tasks', type: 'list' }
    ];
    
    if (fallbackIndex >= fallbacks.length) {
        if (taskIndex !== -1) {
            const currentT = state.activeTasks[taskIndex];
            currentT.consecutive404s = (currentT.consecutive404s || 0) + 1;
            
            // If we've tried all fallbacks many times and still get 404, only then give up
            // Increased patience to 60 attempts (~10 minutes) to handle slow backends
            if (currentT.consecutive404s > 60) {
                showToast(`Task ${taskId} tidak ditemukan di server setelah 10 menit percobaan. Task dihapus.`, "error");
                state.activeTasks.splice(taskIndex, 1);
                activePolls.delete(taskId);
                updateTasksAndResultsDOM();
                return; // Ensure we exit
            } else {
                console.log(`Task ${taskId} not found in any endpoint. Retrying cycle ${currentT.consecutive404s}/60...`);
                setTimeout(() => pollTaskStatus(taskId, 0), 10000);
                return;
            }
        }
        activePolls.delete(taskId);
        return;
    }
    
    // Reset consecutive 404s if we actually REACH a successful request (even if response.ok is false, it's not a 404 from the proxy/network level)
    // Actually, we should reset it further down when we get a valid taskData


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
            // Retry later instead of just returning and losing the poll loop
            setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 10000);
            return;
        }
        
        if (data.error) {
            console.error("Polling proxy returned error:", data);
            if (data.status === 404 && fallbackIndex < fallbacks.length - 1) {
                return pollTaskStatus(taskId, fallbackIndex + 1);
            }
            // For other proxy errors (like 500 or 403), retry the same task later instead of giving up
            setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 10000);
            return;
        }
        
        // Re-find task index in case it was modified during the await
        const currentTaskIndex = state.activeTasks.findIndex(t => t.id === taskId);
        if (currentTaskIndex === -1) {
            activePolls.delete(taskId);
            return;
        }

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
                // Don't kill the task on transient 5xx errors
                setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 15000);
                return;
            }
            
            // For 403 (blocked) or other fatal-seeming errors, we might want to retry rather than immediately delete
            // because IP blocks can be temporary or endpoints might flip-flop
            console.log("Transient or access error, retrying in 30s...");
            setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 30000);
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

        // Reset consecutive 404s counter since we found the task
        state.activeTasks[currentTaskIndex].consecutive404s = 0;
        
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
                (taskData.generated && Array.isArray(taskData.generated) && taskData.generated.length > 0 && (typeof taskData.generated[0] === 'string' ? taskData.generated[0] : taskData.generated[0].url)) ||
                (output.generated && Array.isArray(output.generated) && output.generated.length > 0 && (typeof output.generated[0] === 'string' ? output.generated[0] : output.generated[0].url)) ||
                output.image_url || 
                output.url || 
                output.video_url || 
                output.audio_url || 
                (output.image && output.image.url) ||
                (output.video && output.video.url) ||
                (output.audio && output.audio.url) ||
                (output.result && (output.result.url || (output.result.image && output.result.image.url) || (output.result.video && output.result.video.url) || (output.result.audio && output.result.audio.url))) ||
                (output.items && output.items[0] && (typeof output.items[0] === 'string' ? output.items[0] : output.items[0].url)) ||
                (output.data && (output.data.url || (Array.isArray(output.data) && output.data.length > 0 && output.data[0] && (typeof output.data[0] === 'string' ? output.data[0] : output.data[0].url)))) ||
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
                    console.log(`Task ${taskId} is ${status} but URL is missing. Retrying in 10s (${retryCount + 1}/${maxRetries})...`);
                    state.activeTasks[currentTaskIndex].urlRetryCount = retryCount + 1;
                    state.activeTasks[currentTaskIndex].status = 'Finalizing...';
                    state.activeTasks[currentTaskIndex].progress = 99;
                    updateTasksAndResultsDOM();
                    
                    setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 10000);
                    return;
                }

                console.error("Output URL not found after retries. Full data:", JSON.stringify(data, null, 2));
                showToast("Error: Video URL tidak ditemukan meskipun status sudah selesai. Silakan cek console log.", "error");
                state.activeTasks.splice(currentTaskIndex, 1);
                activePolls.delete(taskId);
                updateTasksAndResultsDOM();
                return;
            }

            // Increment global and daily generation counter
        try {
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dailyStatsRef = doc(db, 'stats', `daily_${today}`);
            
            await Promise.all([
                setDoc(doc(db, 'stats', 'global'), { totalGenerations: increment(1) }, { merge: true }),
                setDoc(dailyStatsRef, { 
                    count: increment(1),
                    date: today,
                    lastUpdated: serverTimestamp() 
                }, { merge: true })
            ]);
        } catch (e) {
            console.warn("Failed to increment stats on success:", e);
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
            activePolls.delete(taskId);
            updateTasksAndResultsDOM();
        } else if (isFailed) {
            console.error("Task failed. Full task data from Freepik:", JSON.stringify(taskData, null, 2));
            let errMsg = taskData.error_message || taskData.reason || taskData.detail || taskData.error || taskData.message;
            
            if (!errMsg && taskData.status_detail) {
                errMsg = taskData.status_detail.message || taskData.status_detail.reason;
            }
            
            if (!errMsg) {
                if (status === 'FAILED' && taskData.generated && taskData.generated.length === 0) {
                    errMsg = "Task gagal diproses oleh AI (Internal AI Failure).";
                } else if (activeGen.outputType === 'video') {
                    errMsg = "Gagal (Status: FAILED). Ini mungkin karena prompt sensitif, durasi tidak valid, atau gangguan pada model AI.";
                } else {
                    errMsg = "Gagal (Status: FAILED). Silakan cek parameter input atau coba lagi nanti.";
                }
            }
            
            showToast("Task Gagal: " + errMsg, "error");
            state.activeTasks.splice(currentTaskIndex, 1);
            activePolls.delete(taskId);
            updateTasksAndResultsDOM();
        } else {
        // Still processing (PENDING, PROCESSING, etc.)
        state.activeTasks[currentTaskIndex].progress = newProgress;
        state.activeTasks[currentTaskIndex].status = status || 'Processing';
        state.activeTasks[currentTaskIndex].pollCount = (state.activeTasks[currentTaskIndex].pollCount || 0) + 1;
        
        const pollCount = state.activeTasks[currentTaskIndex].pollCount;
        
        // Adaptive Polling Strategy (Slowed down to reduce IP block risk):
        let nextPollDelay = 8000; // Default 8s for images/others
        
        if (activeGen && activeGen.outputType === 'video') {
            if (pollCount > 10) {
                nextPollDelay = 30000; // After 10 polls, check every 30s
            } else if (pollCount > 5) {
                nextPollDelay = 20000; // After 5 polls, check every 20s
            } else {
                nextPollDelay = 15000; // Initial video polls every 15s
            }
        } else {
            // For images/music (usually faster)
            if (pollCount > 5) {
                nextPollDelay = 20000; // If still not done after 5 polls, slow down significantly
            }
        }

        console.log(`Polling task ${taskId} (Poll #${pollCount}). Next check in ${nextPollDelay}ms`);
        updateTasksAndResultsDOM();
        setTimeout(() => pollTaskStatus(taskId, fallbackIndex), nextPollDelay);
        }
    } catch (error) {
        console.error("Polling error:", error);
        // Don't kill the task on unexpected error, retry in 30s
        setTimeout(() => pollTaskStatus(taskId, fallbackIndex), 30000);
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

    // Auto-switch tab based on selected generator
    if (id.includes('motion-control')) {
        state.activeToolsTab = 'motion-control';
    } else {
        const gen = GENERATORS.find(g => g.id === id);
        if (gen) {
            if (gen.outputType === 'video') state.activeToolsTab = 'video';
            else if (gen.outputType === 'image') state.activeToolsTab = 'image';
            else if (id === 'elevenlabs-turbo-v2-5') state.activeToolsTab = 'voice';
            else if (id === 'music-generation') state.activeToolsTab = 'music';
        }
    }
    
    // Restore prompt for the new generator
    state.currentPrompt = state.generatorPrompts[id] || '';

    // Reset settings to defaults for the new generator
    if (id === 'kling-v3-std') {
        state.settings.aspect_ratio = '16:9';
        state.settings.duration = '5';
        state.settings.cfg_scale = 0.5;
        state.settings.negative_prompt = 'blur, distort, and low quality';
    } else if (id === 'seedream-4-5-edit') {
        state.settings.aspect_ratio = 'square_1_1';
        state.settings.safety_checker = true;
        state.settings.seed = '';
    } else if (id === 'pixverse-v5') {
        state.settings.aspect_ratio = '16:9';
        state.settings.style = 'None';
        state.settings.duration = '5';
        state.settings.seed = '';
    } else if (id === 'veo-3-1-i2v') {
        state.settings.aspect_ratio = '16:9';
        state.settings.duration = '8';
        state.settings.resolution = '720p';
        state.settings.generate_audio = true;
        state.settings.negative_prompt = '';
        state.settings.seed = '';
    } else if (id === 'veo-3-1-reference') {
        state.settings.aspect_ratio = '16:9';
        state.settings.resolution = '720p';
        state.settings.generate_audio = true;
        state.settings.negative_prompt = '';
        state.settings.seed = '';
    } else if (id === 'kling-v2-6-pro-i2v') {
        state.settings.aspect_ratio = 'widescreen_16_9';
        state.settings.duration = '5';
        state.settings.generate_audio = true;
        state.settings.cfg_scale = 0.5;
        state.settings.negative_prompt = '';
    } else if (id === 'runway-4-5') {
        state.settings.aspect_ratio = '1280:720';
        state.settings.duration = '8';
        state.settings.seed = '';
    } else if (id === 'nano-banana-pro' || id === 'nano-banana-pro-flash') {
        state.settings.aspect_ratio = '1:1';
        state.settings.resolution = '2K';
        state.settings.seed = '';
    } else if (id === 'flux-2-pro') {
        state.settings.aspect_ratio = '16:9';
        state.settings.prompt_upsampling = false;
        state.settings.style = 'Realistic';
        state.settings.seed = '';
    } else if (id === 'imagen4-fast' || id === 'imagen4-ultra') {
        state.settings.aspect_ratio = 'square_1_1';
        state.settings.person_generation = 'allow_adult';
        state.settings.safety_settings = 'block_medium_and_above';
        state.settings.enhance_prompt = true;
        state.settings.seed = '';
    } else if (id === 'gemini-2-5-flash-image') {
        state.settings.seed = '';
    } else if (id === 'happy-horse-1') {
        state.settings.resolution = '1080P';
        state.settings.duration = '5';
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
            if (item.dataset.id === id) {
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

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e, type) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        // Reuse handleFileChange logic by passing a mock input object
        await handleFileChange(type, { files: files });
    }
}

async function handleFileChange(type, input) {
    let file = input.files[0];
    if (!file) return;

    // Client-side size validation (Cloudinary Direct limit is approx 100MB for free tier)
    const MAX_SIZE_MB = 100;
    
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`File terlalu besar. Maksimal ${MAX_SIZE_MB}MB.`, "error");
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
            console.log(`Bypassing Vercel limit: Uploading ${type} direct...`);
            
            // Konfigurasi Cloudinary
            const CLOUD_NAME = 'dwpoqmll1';
            const UPLOAD_PRESET = 'ml_default'; 

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', 'nd_studio_pro');

            let publicUrl = '';

            try {
                // Mencoba Cloudinary Direct
                const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                
                if (response.ok && data.secure_url) {
                    publicUrl = data.secure_url;
                } else {
                    console.warn("Cloudinary direct failed, trying fallback...", data.error?.message);
                    if (data.error?.message?.includes("Upload preset must be whitelisted")) {
                        showToast("Tips: Aktifkan 'Unsigned Upload' di setelan Cloudinary agar upload video besar lebih lancar.", "info");
                    }
                    throw new Error("Cloudinary Failed");
                }
            } catch (err) {
                // Fallback 1: tmpfiles.org
                try {
                    console.log("Using fallback: tmpfiles.org");
                    const tmpFormData = new FormData();
                    tmpFormData.append('file', file);
                    const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
                        method: 'POST',
                        body: tmpFormData
                    });
                    const tmpData = await tmpRes.json();
                    if (tmpData.status === 'success') {
                        publicUrl = tmpData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                    } else {
                        throw new Error("tmpfiles failed");
                    }
                } catch (tmpErr) {
                    // Fallback 2: uguu.se
                    console.log("Using fallback: uguu.se");
                    const uguuFormData = new FormData();
                    uguuFormData.append('files[]', file);
                    const uguuRes = await fetch('https://uguu.se/upload.php', {
                        method: 'POST',
                        body: uguuFormData
                    });
                    const uguuData = await uguuRes.json();
                    if (uguuData.success) {
                        publicUrl = uguuData.files[0].url;
                    } else {
                        throw new Error("Semua provider upload gagal.");
                    }
                }
            }
            
            // Force HTTPS as Freepik strictly requires it
            if (publicUrl.startsWith('http://')) {
                publicUrl = publicUrl.replace('http://', 'https://');
            }

            console.log(`File uploaded successfully. URL: ${publicUrl}`);
            
            uploadState.urls[type] = publicUrl;
            uploadState.autoUploaded[type] = true;
        } catch (error) {
            console.error("All upload attempts failed:", error);
            showToast("Gagal upload file. Silakan coba file yang lebih kecil atau gunakan URL manual.", "error");
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
            btn.innerText = '✨ Generate Music';
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

// --- DOM UPDATE OPTIMIZATION ---
let lastResultsData = null;
let lastTasksData = null;
let lastUsageData = null;

function saveStateToLocalStorage() {
    try {
        const dataToSave = {
            activeTasks: state.activeTasks,
            completedResults: state.completedResults.slice(0, 50) // Limit persistence to last 50 results
        };
        localStorage.setItem('nd_studio_pro_state', JSON.stringify(dataToSave));
    } catch (e) {
        console.error("Failed to save state to localStorage:", e);
    }
}

function loadStateFromLocalStorage() {
    try {
        const saved = localStorage.getItem('nd_studio_pro_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.activeTasks && Array.isArray(parsed.activeTasks)) {
                state.activeTasks = parsed.activeTasks;
            }
            if (parsed.completedResults && Array.isArray(parsed.completedResults)) {
                state.completedResults = parsed.completedResults;
            }
            console.log("State loaded from localStorage:", parsed);
        }
    } catch (e) {
        console.error("Failed to load state from localStorage:", e);
    }
}

function updateTasksAndResultsDOM() {
    // Auto-save state whenever DOM is updated (usually when tasks/results change)
    saveStateToLocalStorage();

    const tasksContainer = document.getElementById('active-tasks-container');
    if (tasksContainer) {
        const currentTaskIds = state.activeTasks.map(t => t.id).join(',');
        const currentTasksFullData = JSON.stringify(state.activeTasks);
        
        // If lastTasksData is not an object (compatibility with old state)
        if (typeof lastTasksData === 'string') lastTasksData = null;

        if (!lastTasksData || lastTasksData.ids !== currentTaskIds || !tasksContainer.innerHTML) {
            tasksContainer.innerHTML = renderActiveTasks();
            lastTasksData = { ids: currentTaskIds, full: currentTasksFullData };
            if (window.lucide) lucide.createIcons({ root: tasksContainer });
        } else if (lastTasksData.full !== currentTasksFullData) {
            // Surgical update for progresses
            state.activeTasks.forEach(task => {
                const card = document.getElementById(`task-card-${task.id}`);
                if (card) {
                    const progressBar = card.querySelector('.task-progress-bar');
                    const progressText = card.querySelector('.task-progress-text');
                    const statusText = card.querySelector('.task-status');
                    
                    if (progressBar) progressBar.style.width = `${task.progress}%`;
                    if (progressText) progressText.innerText = `${Math.floor(task.progress)}%`;
                    if (statusText) statusText.innerText = `${task.status}...`;
                }
            });
            lastTasksData.full = currentTasksFullData;
        }
    }

    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        const currentResultsData = JSON.stringify({
            results: state.completedResults,
            activeGen: state.activeGenerator,
            apiKey: !!state.apiKey
        });

        if (lastResultsData !== currentResultsData) {
            resultsContainer.innerHTML = renderResults();
            lastResultsData = currentResultsData;
            if (window.lucide) lucide.createIcons({ root: resultsContainer });
        }
    }
    
    // Update usage stats bar
    const usageStats = document.querySelector('.usage-stats-bar');
    if (usageStats) {
        const activeCount = state.activeTasks.length;
        const taskLimit = state.taskLimit || 10;
        const queueLimit = state.queueLimit || 10;
        
        // Re-calculate queue
        const now = Date.now();
        state.generationHistory = (state.generationHistory || []).filter(t => now - t < 60000);
        const queueCount = state.generationHistory.length;
        const total = state.globalStats?.totalGenerations || 0;

        const currentUsageData = JSON.stringify({
            active: activeCount,
            queue: queueCount,
            total: total
        });

        if (lastUsageData !== currentUsageData) {
            const totalEl = usageStats.querySelector('.stat-total-generations');
            const activeEl = usageStats.querySelector('.stat-active-count');
            const queueEl = usageStats.querySelector('.stat-queue-count');
            const globalItem = usageStats.querySelector('.stat-item-global');
            
            if (totalEl && activeEl && queueEl && globalItem) {
                // Surgical update
                if (totalEl.innerText !== total.toLocaleString()) {
                    totalEl.innerText = total.toLocaleString();
                }
                activeEl.innerText = `${activeCount}/${taskLimit}`;
                queueEl.innerText = `${queueCount}/${queueLimit}/min`;
                

                lastUsageData = currentUsageData;
            } else {
                // Full update if structure missing
                usageStats.outerHTML = renderUsageStats();
                lastUsageData = currentUsageData;
                const newUsageStats = document.querySelector('.usage-stats-bar');
                if (newUsageStats && window.lucide) lucide.createIcons({ root: newUsageStats });
            }
        }
    }
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

function showGuide() {
    const modal = document.getElementById('modal-guide');
    const body = modal.querySelector('.guide-body');
    
    body.innerHTML = `
        <div style="background: rgba(212, 175, 55, 0.1); border: 1px solid var(--border-color); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
            <p style="font-size: 13px; color: var(--accent-gold); font-weight: 600; margin-bottom: 5px;">💡 Tips Umum:</p>
            <ul style="font-size: 12px; color: var(--text-main); padding-left: 20px; line-height: 1.6;">
                <li>Gunakan prompt dalam Bahasa Inggris untuk hasil yang lebih akurat.</li>
                <li>Pastikan gambar yang diunggah memiliki kualitas yang baik (tidak blur).</li>
                <li>Untuk model Video, proses generasi biasanya memakan waktu 1-3 menit.</li>
            </ul>
        </div>
        ${GENERATORS.map(gen => `
            <div class="guide-item">
                <div class="guide-item-header">
                    <div class="guide-item-icon">${gen.icon}</div>
                    <div class="guide-item-title">${gen.name}</div>
                </div>
                <div class="guide-item-desc">${gen.description}</div>
                ${gen.tips ? `<div style="font-size: 11px; color: var(--accent-gold); font-style: italic; margin-top: -5px;">✨ Tips: ${gen.tips}</div>` : ''}
                <div class="guide-item-meta">
                    <span class="guide-badge">Output: ${gen.outputType.toUpperCase()}</span>
                    ${gen.inputs.includes('image') ? '<span class="guide-badge">Butuh Gambar</span>' : ''}
                    ${gen.inputs.includes('video') ? '<span class="guide-badge">Butuh Video/Ref</span>' : ''}
                    ${gen.inputs.includes('prompt') ? '<span class="guide-badge">Butuh Prompt</span>' : ''}
                </div>
            </div>
        `).join('')}
    `;
    
    toggleModal('modal-guide', true);
    if (window.lucide) lucide.createIcons();
}

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
    window.handleDragOver = handleDragOver;
    window.handleDragLeave = handleDragLeave;
    window.handleDrop = handleDrop;
    window.removeFile = removeFile;
    window.toggleUrlInput = toggleUrlInput;
    window.generate = generate;
    window.pollTaskStatus = pollTaskStatus;
    window.showGuide = showGuide;
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
    window.syncHistory = syncHistory;
    window.findUrlInObject = findUrlInObject;
    window.renderContent = renderContent;

    window.handleDownload = async function(url, filename) {
        try {
            // Deteksi ekstensi dari URL
            let ext = '';
            try {
                const urlPath = new URL(url).pathname;
                const pathParts = urlPath.split('.');
                if (pathParts.length > 1) {
                    ext = '.' + pathParts.pop().toLowerCase();
                    // Hilangkan query params jika masih menempel di ekstensi
                    if (ext.includes('?')) ext = ext.split('?')[0];
                }
            } catch (e) {
                console.warn("Could not parse URL for extension:", url);
            }

            // Fallback ekstensi jika tidak ketemu tapi ada petunjuk di URL
            if (!ext) {
                if (url.includes('.mp4')) ext = '.mp4';
                else if (url.includes('.png')) ext = '.png';
                else if (url.includes('.jpg') || url.includes('.jpeg')) ext = '.jpg';
                else if (url.includes('.webp')) ext = '.webp';
                else if (url.includes('.mp3')) ext = '.mp3';
            }

            const fullFilename = filename ? (filename.includes('.') ? filename : filename + ext) : 'nd-studio-result' + ext;

            const isVideo = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.webm');
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            // Prioritas 1: Direct download for non-iOS
            if (!isIOS) {
                const link = document.createElement('a');
                link.href = url;
                link.download = fullFilename;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast("Memulai unduhan...", "success");
                return;
            }

            // Prioritas 2: Proxy for iOS
            console.log("Downloading via proxy for iOS compatibility:", url);
            const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fullFilename)}`;
            
            const link = document.createElement('a');
            link.href = proxyUrl;
            link.download = fullFilename;
            // Di iOS, buka di tab baru agar user bisa "Save to Photos" atau "Save to Files" dengan mudah
            link.target = '_blank'; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast("Membuka file (iOS)...", "success");
        } catch (error) {
            console.error("Download error:", error);
            window.open(url, '_blank');
        }
    };

    window.handleShare = async function(url, title) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'ND Studio Pro Result',
                    text: title,
                    url: url
                });
                console.log('Shared successfully');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                    copyToClipboard(url);
                    showToast("Link disalin ke clipboard", "success");
                }
            }
        } else {
            copyToClipboard(url);
            showToast("Link disalin ke clipboard", "success");
        }
    };
    
    window.navigateToLogin = navigateToLogin;
    window.navigateToLanding = navigateToLanding;
    window.login = login;

    init();
    initAuth();
});
