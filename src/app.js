/**
 * ND Studio Pro - Core Logic (Fixed Functionality)
 * Vanilla JS State-Driven Architecture
 */

// --- CONFIG & GENERATORS ---
const GENERATORS = [
    {
        id: 'seedance-1-5-pro',
        name: 'Seedance 1.5 Pro',
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=108634&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🖼️</span></div>',
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
        id: 'kling-v3-std',
        name: 'Kling 3 Standard',
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        id: 'kling-v3-pro',
        name: 'Kling 3 Pro',
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        id: 'kling-v3-motion-control-std',
        name: 'Kling 3 Motion Control (Std)',
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        id: 'kling-v2-6-motion-control-std',
        name: 'Kling 2.6 Motion Control (Std)',
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=v899v4ZpX97D&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎬</span></div>',
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
        id: 'seedream-4-5-edit',
        name: 'SeeDream 4.5 Edit',
        icon: '<div class="icon-fallback-wrapper"><img src="https://img.icons8.com/?size=160&id=108634&format=png" style="width: 44px; height: 44px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'"><span class="emoji-fallback" style="display:none;">🎨</span></div>',
        badge: 'V4.5',
        description: 'SeeDream 4.5 Edit - Text to Image with Reference: Preserve subject details and style while editing.',
        inputs: ['image', 'video', 'prompt'],
        outputType: 'image',
        settings: { aspect_ratio: 'seedream', seed: true, safety_checker: true },
        endpoint: 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit',
        statusEndpoint: 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5-edit',
        pollingType: 'path'
    }
];

// --- STATE MANAGEMENT ---
let state = {
    apiKey: localStorage.getItem('nd_api_key') || '',
    activeGenerator: 'kling-v3-std',
    uploadedFiles: { image: null, video: null },
    uploadedUrls: { image: '', video: '' },
    uploading: { image: false, video: false },
    generatorUploads: {}, // Per-generator upload state
    currentPrompt: '',
    settings: {
        orientation: 'video',
        cfg_scale: 0.5,
        aspect_ratio: '16:9',
        duration: '5',
        negative_prompt: 'blur, distort, and low quality',
        strength: 0.5,
        guidance_scale: 7.5,
        steps: 25,
        seed: '',
        style: 'Realistic'
    },
    activeTasks: [],
    completedResults: [],
    generationHistory: [], // Tracks timestamps of generated tasks for queue limit
    cooldownUntil: 0, // Tracks when the user can generate again
    taskLimit: 10,
    queueLimit: 10,
    toasts: [],
    showSetup: false,
    globalError: null
};

function getUploadState() {
    if (!state.generatorUploads[state.activeGenerator]) {
        state.generatorUploads[state.activeGenerator] = {
            files: { image: null, video: null },
            urls: { image: '', video: '' },
            uploading: { image: false, video: false }
        };
    }
    return state.generatorUploads[state.activeGenerator];
}

// --- INITIALIZATION ---
function init() {
    console.log("App Initialized");
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
    const app = document.getElementById('app');
    if (!app) return;

    // If no API key or showSetup is true, show setup page
    if (!state.apiKey || state.showSetup) {
        app.innerHTML = `
            ${renderHeader()}
            <main>
                ${renderGlobalError()}
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
}

// --- UI COMPONENTS ---

function renderGlobalError() {
    if (!state.globalError) return '';
    
    const isLimit = state.globalError.includes('Limit') || state.globalError.includes('Kuota') || state.globalError.includes('429');
    
    return `
        <div class="global-error-alert" style="background: ${isLimit ? '#fff9db' : '#fff5f5'}; border: 2px solid ${isLimit ? '#fab005' : '#ffc9c9'}; color: ${isLimit ? '#856404' : '#fa5252'}; padding: 16px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 12px; animation: slideDown 0.3s ease-out; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <i data-lucide="${isLimit ? 'clock' : 'alert-triangle'}" style="flex-shrink: 0; margin-top: 2px;"></i>
            <div style="flex-grow: 1; font-size: 13px; line-height: 1.5;">
                <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${isLimit ? '⚠️ API Rate Limit / Quota' : '❌ Error Terjadi'}</strong>
                ${state.globalError}
                ${isLimit ? `<div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">Tips: Tunggu 1-2 menit atau gunakan API Key Freepik lainnya di menu Setup.</div>` : ''}
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
    return `
        <header>
            <div class="header-left">
                <div class="logo">
                    <img src="https://img.icons8.com/?size=160&id=67587&format=png" style="width: 24px; height: 24px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'">
                    <i data-lucide="zap" class="emoji-fallback" style="display:none;"></i>
                </div>
                <div class="brand-name">ND STUDIO PRO</div>
            </div>
            <div class="header-actions">
                <button class="api-settings-btn ${state.apiKey ? 'active' : ''}" onclick="handleStatusClick()">
                    <div class="api-settings-icon">
                        <i data-lucide="key"></i>
                    </div>
                    <div class="api-settings-text">
                        <span class="api-label">API SETTINGS</span>
                        <span class="api-status">${state.apiKey ? 'CONNECTED' : 'NOT CONNECTED'}</span>
                    </div>
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
                <div class="app-footer-powered">POWERED BY <a href="https://freepik.com" target="_blank" class="app-footer-link">FREEPIK API</a></div>
            </div>
        </footer>
    `;
}

function renderSetupPage() {
    return `
        <div class="setup-page">
            <div class="setup-hero">
                <div class="setup-logo-large">
                    <img src="https://img.icons8.com/?size=160&id=67587&format=png" style="width: 48px; height: 48px;" referrerPolicy="no-referrer" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\'">
                    <i data-lucide="zap" class="emoji-fallback" style="display:none; width: 48px; height: 48px;"></i>
                </div>
                <h1>Selamat Datang di ND STUDIO PRO</h1>
                <p>AI Video Generator dengan 20+ model AI</p>
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
                        <div class="step-desc">Disimpan lokal di perangkat ini</div>
                    </div>
                </div>
                <div class="api-input-group">
                    <input type="text" id="api-key-input" class="api-input" placeholder="fpk-xxxxxxxxxxxxxxx" value="${state.apiKey}">
                    <button class="btn-save-api" onclick="saveApiKey()">Simpan</button>
                </div>
            </div>

            <div class="info-box" style="background: #fff9db; border: 2px solid #fab005; padding: 16px;">
                <div class="info-title" style="color: #856404; font-weight: 800; font-size: 14px;">
                    <i data-lucide="shield-alert"></i> PENTING: Perbaikan Akses Browser
                </div>
                <p style="font-size: 12px; margin: 8px 0 12px; color: #856404; line-height: 1.4;">
                    Browser memblokir akses upload karena kebijakan keamanan iframe. Klik tombol di bawah untuk membuka jalur akses aman:
                </p>
                <button class="btn-step-action" onclick="window.open('/api/upload', '_blank')" style="background: #fab005; border: none; color: white; box-shadow: 0 4px 12px rgba(250, 176, 5, 0.3); font-size: 14px; padding: 12px; width: 100%; animation: pulse 2s infinite;">
                    🔓 Klik untuk Authenticate
                </button>
                <p style="font-size: 10px; margin-top: 8px; color: #856404; text-align: center;">
                    (Hanya perlu dilakukan satu kali per sesi)
                </p>
            </div>
            
            <style>
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                    100% { transform: scale(1); }
                }
            </style>

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
    const isSeeDream45 = gen.id === 'seedream-4-5-edit';
    const hasTwoInputs = gen.inputs.includes('video') || (isKling3Std && gen.inputs.includes('image')) || (isSeeDream45 && gen.inputs.includes('video'));

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
                            <span style="font-size: 9px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; width: 80%; white-space: nowrap;">${uploadState.urls.image}</span>
                            <button class="btn-remove" onclick="removeFile(event, 'image')"><i data-lucide="x"></i></button>
                        </div>
                    ` : `
                        <div class="upload-placeholder">
                            <i data-lucide="image"></i>
                            <span>${gen.id === 'kling-v3-std' ? 'Start Image<br>(Awal)' : (gen.id === 'kling-v3-pro' ? 'Upload Gambar' : (gen.id === 'seedream-4-5-edit' ? 'Reference Image 1' : (gen.id === 'seedance-1-5-pro' ? 'Upload Image<br>(Optional)' : 'Gambar<br>Karakter')))}</span>
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
                        ${(isKling3Std || gen.id === 'seedream-4-5-edit') ? `<img src="${uploadState.files.video}" class="upload-preview">` : `<video src="${uploadState.files.video}" class="upload-preview" muted autoplay loop playsinline></video>`}
                        <button class="btn-remove" onclick="removeFile(event, 'video')"><i data-lucide="x"></i></button>
                    ` : uploadState.urls.video ? `
                        <div class="upload-placeholder">
                            <i data-lucide="check-circle" style="color: #40c057;"></i>
                            <span style="font-size: 10px; color: #40c057; font-weight: 700;">URL TERPASANG</span>
                            <span style="font-size: 9px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; width: 80%; white-space: nowrap;">${uploadState.urls.video}</span>
                            <button class="btn-remove" onclick="removeFile(event, 'video')"><i data-lucide="x"></i></button>
                        </div>
                    ` : `
                        <div class="upload-placeholder">
                            <i data-lucide="${(isKling3Std || gen.id === 'seedream-4-5-edit') ? 'image' : 'video'}"></i>
                            <span>${isKling3Std ? 'End Image<br>(Akhir)' : (gen.id === 'seedream-4-5-edit' ? 'Reference Image 2' : 'Video<br>Referensi')}</span>
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
                           value="${uploadState.urls.image}" oninput="updateUrl('image', this.value)">
                    ${hasTwoInputs ? `
                        <input type="text" class="url-input" placeholder="${isKling3Std ? 'https://... (End Image URL)' : 'https://... (URL Video)'}" 
                               value="${uploadState.urls.video}" oninput="updateUrl('video', this.value)">
                    ` : ''}
                </div>
            ` : ''}
        </div>
        <input type="file" id="file-input-image" hidden accept="image/*" onchange="handleFileChange('image', this)">
        <input type="file" id="file-input-video" hidden accept="${(isKling3Std || isSeeDream45) ? 'image/*' : 'video/*'}" onchange="handleFileChange('video', this)">
    `;
}

function renderPromptSection() {
    const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
    let placeholder = "Masukkan prompt deskripsi di sini...";
    if (activeGen.id === 'flux-2-pro') {
        placeholder = "Describe your image (e.g. cinematic portrait, ultra realistic, 4k, soft lighting)";
    } else if (activeGen.id === 'seedance-1-5-pro') {
        placeholder = "Describe your video (e.g. cinematic scene, person talking, realistic motion)";
    }

    return `
        <div class="prompt-section">
            <textarea class="prompt-textarea" placeholder="${placeholder}" 
                      oninput="updatePrompt(this.value)">${state.currentPrompt}</textarea>
            <div class="prompt-counter">${state.currentPrompt.length}/2500</div>
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
                        ${['Realistic', 'Cinematic', 'Anime', 'Portrait', 'Product', 'Fantasy'].map(style => `
                            <button class="style-btn ${state.settings.style === style ? 'active' : ''}" 
                                    onclick="updateSetting('style', '${style}')">${style}</button>
                        `).join('')}
                    </div>
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
                            <option value="portrait_9_16" ${state.settings.aspect_ratio === 'portrait_9_16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="square_1_1" ${state.settings.aspect_ratio === 'square_1_1' ? 'selected' : ''}>1:1 (Square)</option>
                        ` : `
                            <option value="16:9" ${state.settings.aspect_ratio === '16:9' ? 'selected' : ''}>16:9 (Landscape)</option>
                            <option value="9:16" ${state.settings.aspect_ratio === '9:16' ? 'selected' : ''}>9:16 (Portrait)</option>
                            <option value="1:1" ${state.settings.aspect_ratio === '1:1' ? 'selected' : ''}>1:1 (Square)</option>
                        `}
                    </select>
                </div>
            ` : ''}

            ${gen.settings.duration ? `
                <div class="setting-item">
                    <div class="setting-label"><span>Duration (Seconds)</span></div>
                    <select class="setting-select" onchange="updateSetting('duration', this.value)">
                        ${gen.settings.duration === 'seedance' ? [3,5,10].map(d => `
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
    const disabledAttr = (isUploading || isCooldown) ? 'disabled' : '';
    
    let btnText = `🚀 Generate ${gen.outputType.charAt(0).toUpperCase() + gen.outputType.slice(1)}`;
    if (isUploading) btnText = '⏳ Uploading...';
    else if (isCooldown) btnText = '⏳ Cooldown...';

    return `
        <div class="generate-container">
            <button class="btn-generate" onclick="generate()" ${disabledAttr}>
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
            <div class="results-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 0 4px;">
                <h3 style="font-size: 15px; font-weight: 700; color: #212529; margin: 0;">Hasil Generasi</h3>
                ${canSync ? `<button class="btn-sync" onclick="syncTasks()" style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; color: #495057; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                    <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Sync Kling 3
                </button>` : ''}
            </div>
            ${state.completedResults.length === 0 ? `
                <div class="empty-results" style="text-align: center; padding: 60px 20px; background: #f8f9fa; border-radius: 20px; color: #adb5bd; border: 1px dashed #dee2e6;">
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
                                ` : `
                                    <img src="${res.url}" class="result-media">
                                `}
                                <div class="result-overlay-actions">
                                    <button class="btn-overlay-action btn-download" onclick="window.open('${res.url}', '_blank')" title="Download HD">
                                        <i data-lucide="download"></i>
                                    </button>
                                    ${res.type === 'image' ? `
                                    <button class="btn-overlay-action btn-animate" onclick="animateImage('${res.url}')" title="Animate to Video">
                                        <i data-lucide="play-circle"></i>
                                    </button>
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
    if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro' || activeGen.id === 'kling-v3-motion-control-std' || activeGen.id === 'kling-v3-motion-control-pro') {
        listEndpoint = (activeGen.id === 'kling-v3-motion-control-std' || activeGen.id === 'kling-v3-motion-control-pro')
            ? activeGen.endpoint
            : 'https://api.freepik.com/v1/ai/video/kling-v3';
        listType = 'list';
    } else if (activeGen.id === 'seedream-4-5-edit') {
        listEndpoint = 'https://api.freepik.com/v1/ai/image-to-image/tasks';
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
        const data = await response.json();

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
            
            throw new Error(data.message || "Gagal sinkronisasi.");
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
                    let videoUrl = 
                        output.video_url || 
                        output.url || 
                        (output.video && output.video.url) ||
                        (output.result && (output.result.url || (output.result.video && output.result.video.url))) ||
                        (output.generated && Array.isArray(output.generated) && output.generated[0]) ||
                        (output.generated && typeof output.generated === 'string' ? output.generated : null);
                    
                    // Exhaustive search fallback for sync
                    if (!videoUrl) {
                        const findUrl = (obj) => {
                            if (!obj) return null;
                            if (typeof obj === 'string') {
                                if ((obj.startsWith('http') || obj.startsWith('//')) && 
                                    (obj.includes('.mp4') || obj.includes('.mov') || obj.includes('.webm') || obj.includes('video') || obj.includes('freepik'))) {
                                    return obj;
                                }
                                return null;
                            }
                            if (typeof obj !== 'object') return null;
                            const priorityKeys = ['url', 'video_url', 'download_url', 'uri', 'link', 'src', 'video'];
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
        const imageInput = uploadState.urls.image || uploadState.files.image;
        const videoInput = uploadState.urls.video || uploadState.files.video;

        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        if (!activeGen) throw new Error("Model generator tidak ditemukan.");

        // Kling models strictly require public HTTPS URLs
        const isKling = activeGen.id.toLowerCase().includes('kling');
        if (isKling) {
            console.log(`[DEBUG] Kling Input URLs:`, {
                image: imageInput,
                video: videoInput
            });
            
            if (imageInput && imageInput.startsWith('data:')) {
                throw new Error("Gagal mengunggah gambar ke server publik. Freepik memerlukan URL publik (HTTPS). Silakan coba upload ulang atau masukkan URL manual.");
            }
            if (videoInput && videoInput.startsWith('data:')) {
                throw new Error("Gagal mengunggah video ke server publik. Freepik memerlukan URL publik (HTTPS). Silakan coba upload ulang atau masukkan URL manual.");
            }
        }

        // Validation based on model
        if (activeGen.id.includes('motion-control')) {
            if (!imageInput || !videoInput) {
                throw new Error("Wajib upload Gambar Karakter & Video Referensi (atau masukkan URL)");
            }
        } else if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro') {
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
            // Check for Indonesian prompt (simple heuristic)
            const indonesianWords = ['gambar', 'buatkan', 'tolong', 'sebuah', 'dengan', 'dan', 'yang', 'di', 'ke', 'dari'];
            const promptWords = state.currentPrompt.toLowerCase().split(' ');
            const hasIndonesian = promptWords.some(w => indonesianWords.includes(w));
            if (hasIndonesian) {
                showToast("⚠️ Peringatan: Gunakan bahasa Inggris untuk hasil prompt yang lebih baik.", "info");
            }
        } else if (activeGen.id === 'seedance-1-5-pro') {
            if (!state.currentPrompt && !imageInput) {
                throw new Error("Wajib masukkan Prompt atau Image untuk Seedance 1.5 Pro.");
            }
        }

        let body = {};
        if (activeGen.id.includes('motion-control')) {
            body = {
                image_url: ensureHttps(imageInput),
                video_url: ensureHttps(videoInput),
                prompt: state.currentPrompt || "", 
                character_orientation: state.settings.orientation,
                cfg_scale: state.settings.cfg_scale
            };
        } else if (activeGen.id === 'kling-v3-std' || activeGen.id === 'kling-v3-pro') {
            let ar = state.settings.aspect_ratio;
            if (ar === 'square_1_1') ar = '1:1';
            else if (ar === 'widescreen_16_9') ar = '16:9';
            else if (ar === 'social_story_9_16') ar = '9:16';
            
            if (!['16:9', '9:16', '1:1'].includes(ar)) {
                ar = '16:9';
            }

            body = {
                prompt: state.currentPrompt || "",
                start_image_url: ensureHttps(imageInput) || undefined,
                end_image_url: ensureHttps(videoInput) || undefined,
                aspect_ratio: ar,
                duration: state.settings.duration,
                negative_prompt: state.settings.negative_prompt,
                cfg_scale: state.settings.cfg_scale,
                generate_audio: true
            };
        } else if (activeGen.id === 'seedream-4-5-edit') {
            const referenceImages = [];
            // Freepik SeeDream accepts Base64 directly, which is much more reliable than public URLs!
            if (imageInput) referenceImages.push(ensureHttps(imageInput));
            if (videoInput) referenceImages.push(ensureHttps(videoInput));

            body = {
                prompt: state.currentPrompt || "",
                reference_images: referenceImages,
                aspect_ratio: state.settings.aspect_ratio || "square_1_1",
                seed: state.settings.seed || Math.floor(Math.random() * 4294967295),
                enable_safety_checker: state.settings.safety_checker !== undefined ? state.settings.safety_checker : true
            };
        } else if (activeGen.id === 'flux-2-pro') {
            let prompt = state.currentPrompt || "";
            if (state.settings.style && state.settings.style !== 'Realistic') {
                prompt = `${state.settings.style} style, ${prompt}`;
            }
            body = {
                prompt: prompt,
                aspect_ratio: state.settings.aspect_ratio || "16:9",
                cfg_scale: state.settings.cfg_scale !== undefined ? state.settings.cfg_scale : 0.5,
                steps: state.settings.steps || 25,
                seed: state.settings.seed || Math.floor(Math.random() * 4294967295)
            };
        } else if (activeGen.id === 'seedance-1-5-pro') {
            body = {
                prompt: state.currentPrompt || "",
                duration: parseInt(state.settings.duration) || 5,
                generate_audio: state.settings.generate_audio !== undefined ? state.settings.generate_audio : true,
                camera_fixed: state.settings.camera_fixed !== undefined ? state.settings.camera_fixed : false,
                aspect_ratio: state.settings.aspect_ratio || "widescreen_16_9",
                seed: state.settings.seed || -1
            };
            
            if (imageInput) {
                body.image = ensureHttps(imageInput);
            }
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

        const data = await response.json();
        if (!response.ok) {
            console.error("Full API Error Data:", data);
            
            // Extract detailed error messages from Freepik
            let detailMsg = '';
            if (data.details) detailMsg = typeof data.details === 'string' ? data.details : JSON.stringify(data.details);
            if (data.errors) detailMsg = typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors);
            if (data.detail) detailMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            
            const apiMsg = data.message || data.error || 'Gagal membuat task.';
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
        state.cooldownUntil = Date.now() + 3000; // 3 seconds cooldown
        if (btn) {
            const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
            btn.innerHTML = '⏳ Cooldown...';
            setTimeout(() => {
                const currentBtn = document.querySelector('.btn-generate');
                if (currentBtn && Date.now() >= state.cooldownUntil) {
                    currentBtn.disabled = false;
                    currentBtn.innerHTML = `🚀 Generate ${activeGen.outputType.charAt(0).toUpperCase() + activeGen.outputType.slice(1)}`;
                }
            }, 3000);
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
        { base: 'https://api.freepik.com/v1/ai/image-to-video/kling-v2-6', type: 'path' }
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
    
    let url;
    if (fallback.type === 'list') {
        url = `/api/freepik/list?endpoint=${encodeURIComponent(statusBase)}&apiKey=${encodeURIComponent(currentKey)}`;
    } else {
        url = `/api/freepik/status/${taskId}?endpoint=${encodeURIComponent(statusBase)}&apiKey=${encodeURIComponent(currentKey)}${fallback.type === 'query' ? '&useQuery=true' : ''}`;
    }
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
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
            showToast(`Gagal mengecek status (${response.status}): ${data.message || 'Unknown error'}`, "error");
            state.activeTasks.splice(currentTaskIndex, 1);
            updateTasksAndResultsDOM();
            return;
        }

        // If we found a working endpoint, update the generator's statusEndpoint for future use
        if (fallbackIndex > 0 && activeGen) {
            activeGen.statusEndpoint = statusBase;
        }

        console.log("Polling Data:", data);
        
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
            videoUrl = 
                output.video_url || 
                output.url || 
                (output.video && output.video.url) ||
                (output.result && (output.result.url || (output.result.video && output.result.video.url))) ||
                (output.generated && Array.isArray(output.generated) && output.generated[0]) ||
                (output.items && output.items[0] && output.items[0].url) ||
                (output.data && output.data.url) ||
                (taskData.result && taskData.result.url) ||
                (taskData.video && taskData.video.url);

            // 2. Recursive search fallback if still not found
            if (!videoUrl) {
                const findUrl = (obj, depth = 0) => {
                    if (!obj || depth > 10) return null;
                    
                    // If it's a string, check if it's a URL
                    if (typeof obj === 'string') {
                        const isUrl = obj.startsWith('http') || obj.startsWith('//');
                        const isMedia = obj.includes('.mp4') || obj.includes('.mov') || obj.includes('.webm') || obj.includes('.jpg') || obj.includes('.png') || obj.includes('.webp') || obj.includes('video') || obj.includes('image') || obj.includes('freepik');
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
            console.error("Task failed. Full data:", taskData);
            let errMsg = taskData.error_message || taskData.reason || taskData.detail || taskData.error || taskData.message;
            
            if (!errMsg && taskData.status_detail) {
                errMsg = taskData.status_detail.message || taskData.status_detail.reason;
            }
            
            if (!errMsg) {
                errMsg = "Unknown Freepik error (Status: FAILED). Pastikan video referensi berdurasi 3-30 detik dan format didukung.";
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
    // No need to re-render everything when typing in URL input
    // Just update the state, the inputs already have the value
}

function setActiveGenerator(id) {
    if (state.activeGenerator === id) return;
    console.log("Model select:", id);
    state.activeGenerator = id;

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
    } else {
        state.settings.orientation = 'video';
        state.settings.cfg_scale = 0.5;
    }
    
    // Update active class in DOM directly to prevent flicker in the selector
    const items = document.querySelectorAll('.model-item');
    items.forEach(item => {
        if (item.getAttribute('onclick').includes(id)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

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

async function handleFileChange(type, input) {
    const file = input.files[0];
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
    
    const updateUploadDOM = () => {
        const uploadSection = document.querySelector('.upload-section-wrapper');
        if (uploadSection) {
            const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
            uploadSection.innerHTML = renderUploadSection(activeGen);
            if (window.lucide) window.lucide.createIcons();
        } else {
            renderContent();
        }
    };

    updateUploadDOM();

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
            let data;
            
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                if (text.includes("Cookie check") || text.includes("Action required")) {
                    state.showSetup = true;
                    renderContent();
                    throw new Error("Akses diblokir browser. Silakan klik tombol kuning '🔓 Klik untuk Authenticate' di bawah Logo ND STUDIO PRO.");
                }
                console.error("Non-JSON response from server:", text);
                throw new Error("Server mengembalikan respon yang tidak valid (bukan JSON).");
            }

            if (!response.ok) throw new Error(data.message || "Gagal mengupload file.");

            const publicUrl = data.url;
            console.log(`File uploaded successfully. Public URL: ${publicUrl}`);
            
            uploadState.urls[type] = publicUrl;
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
    
    // Update only the upload section
    const uploadSection = document.querySelector('.upload-section-wrapper');
    if (uploadSection) {
        const activeGen = GENERATORS.find(g => g.id === state.activeGenerator) || GENERATORS[0];
        uploadSection.innerHTML = renderUploadSection(activeGen);
        if (window.lucide) window.lucide.createIcons();
    } else {
        renderContent();
    }
}

function updatePrompt(val) {
    state.currentPrompt = val;
    // Update counter directly for performance, but state is updated
    const counter = document.querySelector('.prompt-counter');
    if (counter) counter.innerText = `${val.length}/2500`;
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

function animateImage(url) {
    state.activeGenerator = 'kling-v3-std';
    const uploadState = getUploadState();
    uploadState.urls.image = url;
    uploadState.files.image = null;
    updateUploadDOM();
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Gambar siap dianimasikan dengan Kling 3.", "success");
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
    const promptInput = document.querySelector('.prompt-input');
    if (promptInput) {
        promptInput.value = prompt;
        updatePromptCounter(prompt);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function regeneratePrompt(prompt, generatorId) {
    state.currentPrompt = prompt;
    state.activeGenerator = generatorId;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        generate();
    }, 500);
}

function handleStatusClick() {
    if (!state.apiKey) {
        showToast("Silakan masukkan API Key di halaman setup", "info");
        return;
    }

    state.showSetup = !state.showSetup;
    renderContent();
}

function saveApiKey() {
    const input = document.getElementById('api-key-input');
    if (!input) return;

    const key = input.value.trim();
    
    if (!key) {
        if (state.apiKey) {
            // If they clear the input and save, they want to delete the key
            state.apiKey = '';
            localStorage.removeItem('nd_api_key');
            showToast("API Key dihapus", "info");
            state.showSetup = false;
            renderContent();
            return;
        }
        showToast("Masukkan API Key Freepik Anda", "error");
        return;
    }

    console.log("Saving API Key. Length:", key.length);
    localStorage.setItem('nd_api_key', key);
    state.apiKey = key;
    state.showSetup = false;
    
    showToast("API Key berhasil disimpan!", "success");
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
init();
