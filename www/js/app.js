/**
 * Citizens Incident Reporter - Application Controller
 * Handles live feed rendering, incident reporting, GPS telemetry,
 * photo capture, and authentication with the FastAPI backend.
 */

(function () {
    'use strict';

    if (!window.ApiService) {
        console.error('ApiService is not loaded. Ensure api.js is included before app.js.');
    }

    // Storage keys and defaults
    const STORAGE_KEY_SEEN_IDS = 'CITIZEN_SEEN_POST_IDS_V3';
    const STORAGE_KEY_INCIDENTS_CACHE = 'CITIZEN_CACHED_INCIDENTS_V3';

    // Fallback coordinates if device GPS permissions are denied
    const DEFAULT_FALLBACK_COORDS = {
        latitude: 6.5244,
        longitude: 3.3792
    };

    let appState = {
        isCordovaReady: false,
        currentUser: null,
        feedScope: 'community',
        currentCategoryFilter: 'All',
        searchQuery: '',
        incidents: [],
        seenPostIds: new Set(),
        pollingIntervalMs: 60000,
        pollingTimer: null,
        activeGpsPosition: null,
        currentCapturedPhoto: null
    };

    // Cached DOM element lookups
    const DOM = {
        // App Header
        syncStatusDot: document.getElementById('sync-status-dot'),
        syncStatusText: document.getElementById('sync-status-text'),
        btnRefreshFeed: document.getElementById('btn-refresh-feed'),
        refreshIcon: document.getElementById('refresh-icon'),
        btnOpenProfile: document.getElementById('btn-open-profile'),
        headerAvatarChip: document.getElementById('header-avatar-chip'),
        headerAvatarIcon: document.getElementById('header-avatar-icon'),
        headerAvatarInitials: document.getElementById('header-avatar-initials'),

        // Feed Tabs & Composer Prompt
        tabScopeCommunity: document.getElementById('tab-scope-community'),
        tabScopeMy: document.getElementById('tab-scope-my'),
        myIncidentsBadge: document.getElementById('my-incidents-badge'),
        btnQuickComposer: document.getElementById('btn-quick-composer-prompt'),
        composerUserAvatar: document.getElementById('composer-user-avatar'),

        // Category Filter Chips
        chipsTrack: document.getElementById('category-chips-track'),
        countAll: document.getElementById('count-all'),
        countAccident: document.getElementById('count-accident'),
        countFighting: document.getElementById('count-fighting'),
        countRioting: document.getElementById('count-rioting'),
        countRobbery: document.getElementById('count-robbery'),
        countOther: document.getElementById('count-other'),

        // Feed Elements
        feedSearchInput: document.getElementById('feed-search-input'),
        btnClearSearch: document.getElementById('btn-clear-search'),
        feedStatusSummary: document.getElementById('feed-status-summary'),
        feedLastUpdated: document.getElementById('feed-last-updated'),
        incidentsList: document.getElementById('incidents-list'),
        feedEmptyState: document.getElementById('feed-empty-state'),
        emptyStateTitle: document.getElementById('empty-state-title'),
        emptyStateDesc: document.getElementById('empty-state-desc'),
        btnEmptyReport: document.getElementById('btn-empty-report'),

        // Report Form & GPS
        incidentForm: document.getElementById('incident-form'),
        incidentTitle: document.getElementById('incident-title'),
        incidentCategoryValue: document.getElementById('incident-category-value'),
        categoryPills: document.querySelectorAll('.category-select-pill'),
        incidentDescription: document.getElementById('incident-description'),
        descCharCounter: document.getElementById('desc-char-counter'),
        btnGrabGps: document.getElementById('btn-grab-gps'),
        btnGpsText: document.getElementById('btn-gps-text'),
        radarPingEffect: document.getElementById('radar-ping-effect'),
        gpsAccuracyText: document.getElementById('gps-accuracy-text'),
        dispLatitude: document.getElementById('disp-latitude'),
        dispLongitude: document.getElementById('disp-longitude'),
        inputLat: document.getElementById('incident-lat'),
        inputLng: document.getElementById('incident-lng'),
        btnToggleManualGps: document.getElementById('btn-toggle-manual-gps'),
        manualGpsInputs: document.getElementById('manual-gps-inputs'),
        manualLat: document.getElementById('manual-lat'),
        manualLng: document.getElementById('manual-lng'),
        btnApplyManualGps: document.getElementById('btn-apply-manual-gps'),

        // Photo Evidence Controls
        photoDropzone: document.getElementById('photo-dropzone'),
        photoPlaceholderWrap: document.getElementById('photo-placeholder-wrap'),
        photoPreviewWrap: document.getElementById('photo-preview-wrap'),
        previewImageElement: document.getElementById('photo-preview-img'),
        btnSnapCamera: document.getElementById('btn-snap-camera'),
        btnBrowsePhoto: document.getElementById('btn-browse-photo'),
        btnRetakePhoto: document.getElementById('btn-retake-photo'),
        btnRemovePhoto: document.getElementById('btn-remove-photo'),
        fileFallbackInput: document.getElementById('incident-photo-file-fallback'),

        // Submit Button & Feedback
        btnSubmitIncident: document.getElementById('btn-submit-incident'),
        submitBtnText: document.getElementById('submit-btn-text'),
        submitSpinner: document.getElementById('submit-spinner'),
        formFeedbackMsg: document.getElementById('form-feedback-msg'),

        // User Profile & Authentication Modal (Separate Sign In & Register Pages)
        modalProfile: document.getElementById('modal-profile'),
        btnCloseProfile: document.getElementById('btn-close-profile'),
        profileHeading: document.getElementById('profile-heading'),
        profileSubheading: document.getElementById('profile-subheading'),
        profileLoggedInState: document.getElementById('profile-logged-in-state'),
        profileLoggedOutState: document.getElementById('profile-logged-out-state'),
        profileAvatarLarge: document.getElementById('profile-avatar-large'),
        profileDisplayName: document.getElementById('profile-display-name'),
        profileHandle: document.getElementById('profile-handle'),
        profileStatCount: document.getElementById('profile-stat-count'),
        btnViewMyReports: document.getElementById('btn-view-my-reports'),
        btnSignOut: document.getElementById('btn-sign-out'),

        // Auth Tabs & Pages
        tabAuthSignin: document.getElementById('tab-auth-signin'),
        tabAuthRegister: document.getElementById('tab-auth-register'),
        authPageSignin: document.getElementById('auth-page-signin'),
        authPageRegister: document.getElementById('auth-page-register'),
        linkGotoRegister: document.getElementById('link-goto-register'),
        linkGotoSignin: document.getElementById('link-goto-signin'),

        // Sign In Form
        authLoginForm: document.getElementById('auth-login-form'),
        authUsername: document.getElementById('auth-username'),
        authPassword: document.getElementById('auth-password'),
        btnLoginSubmit: document.getElementById('btn-login-submit'),

        // Register Form
        authRegisterForm: document.getElementById('auth-register-form'),
        registerUsername: document.getElementById('register-username'),
        registerPassword: document.getElementById('register-password'),
        registerConfirmPassword: document.getElementById('register-confirm-password'),
        btnRegisterSubmit: document.getElementById('btn-register-submit'),

        // Incident Detail Modal
        modalDetail: document.getElementById('modal-incident-detail'),
        btnCloseDetail: document.getElementById('btn-close-detail'),
        detailModalTitle: document.getElementById('detail-modal-title'),
        detailCategoryPill: document.getElementById('detail-category-pill'),
        detailTimestamp: document.getElementById('detail-timestamp'),
        detailAuthor: document.getElementById('detail-author'),
        detailIdChip: document.getElementById('detail-id-chip'),
        detailPhotoBox: document.getElementById('detail-photo-box'),
        detailPhotoImg: document.getElementById('detail-photo-img'),
        detailDescription: document.getElementById('detail-description'),
        detailCoordsText: document.getElementById('detail-coords-text'),
        detailMapLink: document.getElementById('detail-map-link'),

        // Notification Banner
        notificationBanner: document.getElementById('in-app-notification'),
        notifCategory: document.getElementById('notif-category'),
        notifTime: document.getElementById('notif-time'),
        notifTitle: document.getElementById('notif-title'),
        btnCloseNotif: document.getElementById('btn-close-notif'),

        // Bottom Dock Tabs
        bottomDockNav: document.querySelector('.bottom-dock-nav'),
        dockTabs: document.querySelectorAll('.dock-tab')
    };

    // App initialization and lifecycle
    document.addEventListener('DOMContentLoaded', onDomReady);
    document.addEventListener('deviceready', onDeviceReady, false);

    function onDomReady() {
        console.log('DOM Ready. Initializing Citizens App with FastAPI backend...');

        // Guard against legacy Cordova browser proxy elements being injected into body
        try {
            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1 && (node.classList?.contains('cordova-camera-select') || node.classList?.contains('cordova-camera-capture'))) {
                            node.remove();
                        }
                    }
                }
            });
            if (document.body) {
                observer.observe(document.body, { childList: true });
            }
        } catch (e) {}

        loadStoredSeenIds();
        loadStoredIncidentsCache();
        initAuthSession();
        initEventListeners();
        initCategoryFilterUI();
        obtainDeviceGps(true); // Pre-warm GPS (silent)

        // Initial live fetch
        refreshFeed();

        // Start background polling
        startBackgroundPolling();
    }

    function onDeviceReady() {
        console.log('Cordova Device is ready.');
        appState.isCordovaReady = true;

        // Configure mobile status bar if plugin is present
        if (window.StatusBar) {
            window.StatusBar.backgroundColorByHexString('#000000');
            window.StatusBar.styleLightContent();
        }

        // Request local notification permissions if available
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.notification) {
            window.cordova.plugins.notification.local.requestPermission(function (granted) {
                console.log('Local Notification permission granted:', granted);
            });
        }
    }

    // Authentication and user session
    function initAuthSession() {
        const storedUser = ApiService.getCurrentUser();
        const storedToken = ApiService.getToken();

        if (storedToken && storedUser) {
            appState.currentUser = storedUser;
            // Refresh user profile asynchronously from backend
            syncUserProfileFromBackend();
        } else {
            appState.currentUser = null;
        }

        updateAuthUI();
    }

    async function syncUserProfileFromBackend() {
        if (!ApiService.getToken()) return;

        try {
            const me = await ApiService.getMe();
            if (me) {
                appState.currentUser = {
                    id: me.id,
                    username: me.username,
                    createdAt: me.created_at,
                    reportsCount: me.reports_count || 0,
                    role: 'Verified Citizen Eyewitness'
                };
                ApiService.setAuth(ApiService.getToken(), appState.currentUser);
                updateAuthUI();
            }
        } catch (err) {
            console.warn('Could not sync user profile from /auth/me:', err.message);
            if (err.status === 401) {
                handleSignOut();
            }
        }
    }

    function updateAuthUI() {
        const user = appState.currentUser;

        if (user) {
            const initials = (user.username || 'CW').substring(0, 2).toUpperCase();
            DOM.headerAvatarChip.classList.add('authenticated');
            DOM.headerAvatarIcon.classList.add('hidden');
            DOM.headerAvatarInitials.classList.remove('hidden');
            DOM.headerAvatarInitials.textContent = initials;

            if (DOM.composerUserAvatar) {
                DOM.composerUserAvatar.textContent = initials;
            }

            // Modal: Logged-in State
            DOM.profileLoggedOutState.classList.add('hidden');
            DOM.profileLoggedInState.classList.remove('hidden');
            DOM.profileAvatarLarge.textContent = initials;
            DOM.profileDisplayName.textContent = user.username;
            DOM.profileHandle.textContent = `@${user.username}`;
            DOM.profileStatCount.textContent = user.reportsCount !== undefined ? user.reportsCount : '0';

            if (DOM.profileHeading) DOM.profileHeading.textContent = 'Citizen Profile';
            if (DOM.profileSubheading) DOM.profileSubheading.textContent = 'Identity & Incident Attribution';

            if (DOM.settingsSessionUser) {
                DOM.settingsSessionUser.textContent = `@${user.username} (ID: ${user.id || 'Active'})`;
            }
        } else {
            DOM.headerAvatarChip.classList.remove('authenticated');
            DOM.headerAvatarIcon.classList.remove('hidden');
            DOM.headerAvatarInitials.classList.add('hidden');

            if (DOM.composerUserAvatar) {
                DOM.composerUserAvatar.textContent = 'CW';
            }

            // Modal: Logged-out State
            DOM.profileLoggedOutState.classList.remove('hidden');
            DOM.profileLoggedInState.classList.add('hidden');

            switchAuthTab('signin');

            if (DOM.settingsSessionUser) {
                DOM.settingsSessionUser.textContent = 'Not signed in (Guest)';
            }
        }
    }

    function switchAuthTab(mode) {
        const isSignin = mode === 'signin';
        if (DOM.tabAuthSignin) {
            DOM.tabAuthSignin.classList.toggle('active', isSignin);
            DOM.tabAuthSignin.setAttribute('aria-selected', isSignin ? 'true' : 'false');
        }
        if (DOM.tabAuthRegister) {
            DOM.tabAuthRegister.classList.toggle('active', !isSignin);
            DOM.tabAuthRegister.setAttribute('aria-selected', !isSignin ? 'true' : 'false');
        }
        if (DOM.authPageSignin) DOM.authPageSignin.classList.toggle('hidden', !isSignin);
        if (DOM.authPageRegister) DOM.authPageRegister.classList.toggle('hidden', isSignin);

        if (DOM.profileHeading) {
            DOM.profileHeading.textContent = isSignin ? 'Sign In' : 'Create Account';
        }
        if (DOM.profileSubheading) {
            DOM.profileSubheading.textContent = isSignin ? 'Access Your Incident Dashboard' : 'Join CitizenWatch Network';
        }
    }

    async function handleAuthLogin(e) {
        e.preventDefault();
        const username = DOM.authUsername.value.trim();
        const password = DOM.authPassword.value;

        if (!username || !password) {
            showFeedback('Please provide both username and password.', 'error');
            return;
        }

        DOM.btnLoginSubmit.disabled = true;
        DOM.btnLoginSubmit.innerHTML = '<span>Signing In...</span>';

        try {
            const result = await ApiService.login(username, password);

            DOM.authLoginForm.reset();
            closeModal(DOM.modalProfile);
            showInAppBanner({
                category: 'Account',
                title: `Welcome, @${result.username}! Signed in successfully.`
            });

            await syncUserProfileFromBackend();
            refreshFeed();
        } catch (err) {
            console.error('Authentication failed:', err);
            showFeedback(`Sign in failed: ${err.message}`, 'error');
        } finally {
            DOM.btnLoginSubmit.disabled = false;
            DOM.btnLoginSubmit.innerHTML = '<span>Sign In</span>';
        }
    }

    async function handleAuthRegister(e) {
        e.preventDefault();
        const username = DOM.registerUsername.value.trim();
        const password = DOM.registerPassword.value;
        const confirmPassword = DOM.registerConfirmPassword.value;

        if (!username || username.length < 2) {
            showFeedback('Username must be at least 2 characters.', 'error');
            return;
        }

        if (!password || password.length < 3) {
            showFeedback('Password must be at least 3 characters.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showFeedback('Passwords do not match. Please re-enter identical passwords.', 'error');
            return;
        }

        DOM.btnRegisterSubmit.disabled = true;
        DOM.btnRegisterSubmit.innerHTML = '<span>Creating Account...</span>';

        try {
            const result = await ApiService.register(username, password);

            DOM.authRegisterForm.reset();
            closeModal(DOM.modalProfile);
            showInAppBanner({
                category: 'Account Created',
                title: `Welcome, @${result.username}! Your account is ready.`
            });

            await syncUserProfileFromBackend();
            refreshFeed();
        } catch (err) {
            console.error('Registration failed:', err);
            showFeedback(`Registration failed: ${err.message}`, 'error');
        } finally {
            DOM.btnRegisterSubmit.disabled = false;
            DOM.btnRegisterSubmit.innerHTML = '<span>Create Account</span>';
        }
    }

    function handleSignOut() {
        ApiService.clearAuth();
        appState.currentUser = null;
        updateAuthUI();
        closeModal(DOM.modalProfile);

        if (appState.feedScope === 'my') {
            switchFeedScope('community');
        } else {
            refreshFeed();
        }

        showInAppBanner({
            category: 'Account',
            title: 'You have been signed out.'
        });
    }

    // Incident feed management
    async function refreshFeed() {
        setSyncStatus('syncing', 'Syncing...');
        if (DOM.refreshIcon) DOM.refreshIcon.classList.add('spinning');

        const scope = appState.feedScope;
        const category = appState.currentCategoryFilter;

        try {
            let data = [];
            if (scope === 'my') {
                if (!ApiService.getToken()) {
                    setSyncStatus('idle', 'Sign in required');
                    renderFeed([], true);
                    return;
                }
                data = await ApiService.getMyIncidents();
            } else {
                data = await ApiService.getIncidents(category);
            }

            if (!Array.isArray(data)) {
                data = [];
            }

            // Check for new incident alerts on community feed
            if (scope === 'community') {
                checkForNewIncidents(data);
                if (category === 'All' && data.length > 0) {
                    try {
                        localStorage.setItem(STORAGE_KEY_INCIDENTS_CACHE, JSON.stringify(data));
                    } catch (e) {}
                }
            }

            appState.incidents = data;
            renderFeed(data);
            updateCategoryCounts();
            setSyncStatus('idle', 'Live Sync');
            DOM.feedLastUpdated.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch (err) {
            console.error('Failed to load incident feed:', err);
            setSyncStatus('error', 'Sync Failed');
            showFeedback(`Could not fetch live incidents: ${err.message}`, 'error');
            // If offline/error, render whatever is currently in appState.incidents
            renderFeed(appState.incidents || []);
        } finally {
            if (DOM.refreshIcon) DOM.refreshIcon.classList.remove('spinning');
        }
    }

    /**
     * Render incident stream
     */
    function renderFeed(items, requiresAuth = false) {
        if (!DOM.incidentsList) return;

        let filtered = items;
        if (appState.searchQuery) {
            const q = appState.searchQuery.toLowerCase();
            filtered = filtered.filter(i => 
                (i.title && i.title.toLowerCase().includes(q)) ||
                (i.description && i.description.toLowerCase().includes(q)) ||
                (i.category && i.category.toLowerCase().includes(q)) ||
                (i.author_username && i.author_username.toLowerCase().includes(q))
            );
        }

        DOM.feedStatusSummary.textContent = `Showing ${filtered.length} ${appState.feedScope === 'my' ? 'personal' : 'community'} reports`;

        // Empty state handling
        if (filtered.length === 0) {
            DOM.incidentsList.innerHTML = '';
            DOM.feedEmptyState.classList.remove('hidden');

            if (requiresAuth) {
                DOM.emptyStateTitle.textContent = 'Sign In to View My Reports';
                DOM.emptyStateDesc.textContent = 'Please sign in with your account to access your eyewitness incident reports. You can also make a post without having an account.';
                if (DOM.btnEmptyReport) {
                    DOM.btnEmptyReport.querySelector('span').textContent = 'Post Incident (No Account Needed)';
                }
            } else if (appState.feedScope === 'my') {
                DOM.emptyStateTitle.textContent = 'No Incidents Submitted Yet';
                DOM.emptyStateDesc.textContent = 'You have not submitted any eyewitness reports under this category.';
                if (DOM.btnEmptyReport) {
                    DOM.btnEmptyReport.querySelector('span').textContent = 'Report First Incident';
                }
            } else {
                DOM.emptyStateTitle.textContent = 'No Incidents Reported';
                DOM.emptyStateDesc.textContent = appState.currentCategoryFilter === 'All' ?
                    'No active incidents in your area.' :
                    `No active reports under the "${appState.currentCategoryFilter}" category.`;
                if (DOM.btnEmptyReport) {
                    DOM.btnEmptyReport.querySelector('span').textContent = 'Report First Incident';
                }
            }
            return;
        }

        DOM.feedEmptyState.classList.add('hidden');

        let html = '';
        filtered.forEach(incident => {
            html += generateIncidentCardHtml(incident);
        });

        DOM.incidentsList.innerHTML = html;

        // Attach event listeners for post clicks to view details
        DOM.incidentsList.querySelectorAll('.incident-card').forEach(card => {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.geo-chip-btn')) return;
                const id = parseInt(this.getAttribute('data-id'), 10);
                const found = appState.incidents.find(i => i.id === id);
                if (found) openDetailModal(found);
            });
        });
    }

    /**
     * Generate incident card markup for an incident item
     */
    function generateIncidentCardHtml(incident) {
        const relativeTime = formatTimeAgo(incident.created_at || incident.date);
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${incident.latitude},${incident.longitude}`;

        const authorUsername = incident.author_username || 'Anonymous';
        const initials = authorUsername.substring(0, 2).toUpperCase() || 'CW';

        // Feature 7: Photographic Evidence Media (photo_base64 from FastAPI)
        let photoMarkup = '';
        const photoSource = incident.photo_base64 || incident.photo;
        if (photoSource) {
            photoMarkup = `
            <div class="incident-media-wrap">
                <img src="${photoSource}" alt="Evidence for ${escapeHtml(incident.title)}" class="incident-media-img" loading="lazy">
                <div class="incident-media-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <span>Photo Evidence</span>
                </div>
            </div>`;
        }

        return `
        <article class="incident-card" data-id="${incident.id}">
            <!-- Left: Avatar Column -->
            <div class="incident-avatar-col">
                <div class="incident-avatar">${initials}</div>
            </div>

            <!-- Right: Incident Content Column -->
            <div class="incident-content-col">
                <!-- Header: Name, Handle, Time, Category -->
                <div class="incident-header-row">
                    <div class="incident-author-meta">
                        <span class="incident-author-name">${escapeHtml(authorUsername)}</span>
                        <span class="incident-author-handle">@${escapeHtml(authorUsername)}</span>
                        <span class="meta-dot">·</span>
                        <span class="incident-time">${relativeTime}</span>
                    </div>
                    <span class="incident-category-badge">${escapeHtml(incident.category)}</span>
                </div>

                <!-- Incident Title -->
                <h3 class="incident-card-title">${escapeHtml(incident.title)}</h3>

                <!-- Incident Description Body -->
                <p class="incident-card-text">${escapeHtml(incident.description)}</p>

                <!-- Location Pin Chip -->
                <div class="incident-location-wrap">
                    <a href="${mapUrl}" class="incident-geo-chip geo-chip-btn" target="_system">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="10" r="3"/>
                            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                        </svg>
                        <span>${Number(incident.latitude).toFixed(4)}, ${Number(incident.longitude).toFixed(4)}</span>
                    </a>
                </div>

                <!-- Embedded Photo Evidence -->
                ${photoMarkup}
            </div>
        </article>
        `;
    }

    function updateCategoryCounts() {
        const counts = { All: 0, Accident: 0, Fighting: 0, Rioting: 0, Robbery: 0, Other: 0 };
        const list = appState.incidents || [];

        counts.All = list.length;
        list.forEach(i => {
            if (counts[i.category] !== undefined) {
                counts[i.category]++;
            }
        });

        if (DOM.countAll) DOM.countAll.textContent = counts.All;
        if (DOM.countAccident) DOM.countAccident.textContent = counts.Accident;
        if (DOM.countFighting) DOM.countFighting.textContent = counts.Fighting;
        if (DOM.countRioting) DOM.countRioting.textContent = counts.Rioting;
        if (DOM.countRobbery) DOM.countRobbery.textContent = counts.Robbery;
        if (DOM.countOther) DOM.countOther.textContent = counts.Other;
    }

    // Incident report submission
    async function handleIncidentSubmit(e) {
        e.preventDefault();

        const title = DOM.incidentTitle.value.trim();
        const category = DOM.incidentCategoryValue.value;
        const description = DOM.incidentDescription.value.trim();
        const lat = parseFloat(DOM.inputLat.value);
        const lng = parseFloat(DOM.inputLng.value);

        if (!title || title.length < 3) {
            showFeedback('Incident title must be at least 3 characters.', 'error');
            return;
        }

        if (!description || description.length < 3) {
            showFeedback('Please provide a detailed incident description (min 3 characters).', 'error');
            return;
        }

        if (isNaN(lat) || isNaN(lng)) {
            showFeedback('Valid GPS coordinates are required. Tap "Grab GPS" or enter manually.', 'error');
            return;
        }

        // Show loading spinner
        setSubmitLoading(true);

        const payload = {
            title,
            category,
            description,
            latitude: lat,
            longitude: lng,
            photo_base64: appState.currentCapturedPhoto || null
        };

        try {
            const created = await ApiService.createIncident(payload);
            console.log('Incident successfully posted to FastAPI:', created);

            // Reset form
            DOM.incidentForm.reset();
            clearCapturedPhoto();
            DOM.descCharCounter.textContent = '0 / 1000';
            DOM.incidentCategoryValue.value = 'Accident';
            DOM.categoryPills.forEach((p, idx) => {
                p.classList.toggle('selected', idx === 0);
                p.setAttribute('aria-checked', idx === 0 ? 'true' : 'false');
            });

            // Show feedback
            showInAppBanner({
                category: created.category || 'Incident Alert',
                title: `Report transmitted! ID: #${created.id}`
            });

            // Refresh user reports count if logged in
            if (appState.currentUser) {
                syncUserProfileFromBackend();
            }

            // Redirect back to Live Community Feed as required by specification
            switchTab('view-feed');
            switchFeedScope('community');
            await refreshFeed();
        } catch (err) {
            console.error('Failed to submit incident:', err);
            showFeedback(`Submission error: ${err.message}`, 'error');
        } finally {
            setSubmitLoading(false);
        }
    }

    function setSubmitLoading(isLoading) {
        if (!DOM.btnSubmitIncident) return;
        DOM.btnSubmitIncident.disabled = isLoading;
        if (DOM.submitBtnText) {
            DOM.submitBtnText.textContent = isLoading ? 'Transmitting Report...' : 'Transmit Incident Report';
        }
        if (DOM.submitSpinner) {
            DOM.submitSpinner.classList.toggle('hidden', !isLoading);
        }
    }

    // GPS location and device telemetry
    function obtainDeviceGps(silent = false) {
        if (DOM.btnGpsText) {
            DOM.btnGpsText.textContent = 'Acquiring GPS...';
        }
        if (DOM.gpsAccuracyText) {
            DOM.gpsAccuracyText.innerHTML = '<span style="color: #60a5fa;">Querying Phone GPS...</span>';
        }
        if (DOM.radarPingEffect) DOM.radarPingEffect.classList.add('active');

        const successCallback = (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const acc = Math.round(pos.coords.accuracy || 10);

            applyGpsCoordinates(lat, lng, acc, false);

            if (!silent) {
                showInAppBanner({
                    category: 'GPS Locked',
                    title: `Coordinates locked: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${acc}m)`
                });
            }
        };

        const tryCellularWifiFallback = (primaryErr) => {
            console.warn('High-accuracy GPS fix failed or timed out, retrying with network/cell positioning:', primaryErr);
            if (DOM.gpsAccuracyText) {
                DOM.gpsAccuracyText.innerHTML = '<span style="color: #f59e0b;">Resolving network location...</span>';
            }

            navigator.geolocation.getCurrentPosition(
                successCallback,
                (finalErr) => {
                    console.warn('All geolocation methods failed or permission denied:', finalErr);
                    if (DOM.radarPingEffect) DOM.radarPingEffect.classList.remove('active');
                    if (DOM.btnGpsText) DOM.btnGpsText.textContent = 'Retry Phone GPS';

                    if (appState.activeGpsPosition && appState.activeGpsPosition.latitude) {
                        applyGpsCoordinates(appState.activeGpsPosition.latitude, appState.activeGpsPosition.longitude, appState.activeGpsPosition.accuracy || 20);
                    } else {
                        // Apply default coordinates but make it clear to user
                        applyGpsCoordinates(DEFAULT_FALLBACK_COORDS.latitude, DEFAULT_FALLBACK_COORDS.longitude, 50, true);
                        if (DOM.gpsAccuracyText) {
                            DOM.gpsAccuracyText.innerHTML = '<span style="color: #f87171;">GPS Permission Needed (Tap Retry)</span>';
                        }
                    }

                    if (!silent) {
                        showFeedback('Could not access phone GPS. Please ensure Location is enabled in device settings or enter coordinates below.', 'error');
                    }
                },
                {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 60000
                }
            );
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                successCallback,
                tryCellularWifiFallback,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.warn('Geolocation not supported by device');
            if (DOM.gpsAccuracyText) {
                DOM.gpsAccuracyText.innerHTML = '<span style="color: #ef4444;">GPS Not Supported</span>';
            }
            if (DOM.btnGpsText) DOM.btnGpsText.textContent = 'Enter GPS Manually';
        }
    }

    function applyGpsCoordinates(lat, lng, accuracy, isFallback = false) {
        appState.activeGpsPosition = { latitude: lat, longitude: lng, accuracy };

        if (DOM.dispLatitude) DOM.dispLatitude.textContent = Number(lat).toFixed(6);
        if (DOM.dispLongitude) DOM.dispLongitude.textContent = Number(lng).toFixed(6);
        if (DOM.inputLat) DOM.inputLat.value = lat;
        if (DOM.inputLng) DOM.inputLng.value = lng;
        if (DOM.manualLat) DOM.manualLat.value = Number(lat).toFixed(6);
        if (DOM.manualLng) DOM.manualLng.value = Number(lng).toFixed(6);

        if (DOM.gpsAccuracyText) {
            if (isFallback) {
                DOM.gpsAccuracyText.innerHTML = '<span style="color: #f59e0b;">Approximate (±' + accuracy + 'm)</span>';
            } else {
                DOM.gpsAccuracyText.innerHTML = '<span style="color: #10b981; font-weight: 600;">● Phone GPS Locked (±' + accuracy + 'm)</span>';
            }
        }

        if (DOM.btnGpsText) DOM.btnGpsText.textContent = 'Update GPS';
        if (DOM.radarPingEffect) DOM.radarPingEffect.classList.remove('active');
    }

    // Camera and photographic evidence
    function triggerCameraCapture() {
        // Native Cordova on Android / iOS has actual hardware camera intent
        const isNativeMobile = !!(window.cordova && window.cordova.platformId !== 'browser' && window.navigator && window.navigator.camera);
        if (isNativeMobile) {
            const cameraOptions = {
                quality: 80,
                destinationType: window.Camera.DestinationType.DATA_URL,
                sourceType: window.Camera.PictureSourceType.CAMERA,
                encodingType: window.Camera.EncodingType.JPEG,
                mediaType: window.Camera.MediaType.PICTURE,
                correctOrientation: true,
                targetWidth: 1000
            };

            navigator.camera.getPicture(
                (imageData) => {
                    const base64DataUrl = `data:image/jpeg;base64,${imageData}`;
                    setCapturedPhoto(base64DataUrl);
                },
                (err) => {
                    console.log('Camera capture cancelled or failed:', err);
                },
                cameraOptions
            );
        } else {
            // Browser or desktop simulator: open clean hidden file input directly
            // Do NOT call CameraProxy on browser which appends stray input elements to the body
            const fileInput = document.getElementById('incident-photo-file-fallback') || DOM.fileFallbackInput;
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        }
    }

    function triggerGalleryPicker() {
        // Native Cordova on Android / iOS has native photo album picker
        const isNativeMobile = !!(window.cordova && window.cordova.platformId !== 'browser' && window.navigator && window.navigator.camera);
        if (isNativeMobile) {
            const cameraOptions = {
                quality: 80,
                destinationType: window.Camera.DestinationType.DATA_URL,
                sourceType: window.Camera.PictureSourceType.PHOTOLIBRARY,
                encodingType: window.Camera.EncodingType.JPEG,
                correctOrientation: true,
                targetWidth: 1000
            };

            navigator.camera.getPicture(
                (imageData) => {
                    const base64DataUrl = `data:image/jpeg;base64,${imageData}`;
                    setCapturedPhoto(base64DataUrl);
                },
                (err) => {
                    console.log('Gallery selection cancelled or failed:', err);
                },
                cameraOptions
            );
        } else {
            // Browser or desktop simulator: open clean hidden file input directly
            const fileInput = document.getElementById('incident-photo-file-fallback') || DOM.fileFallbackInput;
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        }
    }

    function handleFileFallback(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            setCapturedPhoto(event.target.result);
        };
        reader.readAsDataURL(file);
    }

    function setCapturedPhoto(dataUrl) {
        appState.currentCapturedPhoto = dataUrl;
        if (DOM.previewImageElement) DOM.previewImageElement.src = dataUrl;
        if (DOM.photoPlaceholderWrap) DOM.photoPlaceholderWrap.classList.add('hidden');
        if (DOM.photoPreviewWrap) DOM.photoPreviewWrap.classList.remove('hidden');
    }

    function clearCapturedPhoto() {
        appState.currentCapturedPhoto = null;
        if (DOM.previewImageElement) DOM.previewImageElement.src = '';
        if (DOM.photoPlaceholderWrap) DOM.photoPlaceholderWrap.classList.remove('hidden');
        if (DOM.photoPreviewWrap) DOM.photoPreviewWrap.classList.add('hidden');
        if (DOM.fileFallbackInput) DOM.fileFallbackInput.value = '';
    }

    // Background polling and local notification alerts
    function startBackgroundPolling() {
        if (appState.pollingTimer) {
            clearInterval(appState.pollingTimer);
        }

        appState.pollingTimer = setInterval(async () => {
            // Only poll for new items when in community scope
            if (appState.feedScope === 'community') {
                try {
                    const latest = await ApiService.getIncidents("All");
                    if (Array.isArray(latest)) {
                        checkForNewIncidents(latest);
                        appState.incidents = latest;
                        renderFeed(latest);
                        updateCategoryCounts();
                    }
                } catch (e) {
                    console.warn('Background polling check failed:', e.message);
                }
            }
        }, appState.pollingIntervalMs);
    }

    function checkForNewIncidents(incoming) {
        if (!Array.isArray(incoming)) return;

        incoming.forEach(incident => {
            if (!appState.seenPostIds.has(incident.id)) {
                appState.seenPostIds.add(incident.id);
                triggerNotification(incident);
            }
        });

        saveStoredSeenIds();
    }

    function triggerNotification(incident) {
        // Trigger Cordova Local Notification if active
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.notification) {
            try {
                window.cordova.plugins.notification.local.schedule({
                    id: incident.id % 100000,
                    title: `Incident Alert: ${incident.category}`,
                    text: incident.title,
                    foreground: true,
                    data: { incidentId: incident.id }
                });
            } catch (err) {
                console.warn('Cordova notification schedule error:', err);
            }
        }

        // Show floating in-app banner
        showInAppBanner({
            category: incident.category,
            title: incident.title,
            incident: incident
        });
    }

    function showInAppBanner({ category, title, incident }) {
        if (!DOM.notificationBanner) return;

        DOM.notifCategory.textContent = category || 'Incident Alert';
        DOM.notifTime.textContent = 'Just now';
        DOM.notifTitle.textContent = title || '';

        DOM.notificationBanner.classList.add('visible');

        DOM.notificationBanner.onclick = function (e) {
            if (e.target === DOM.btnCloseNotif) return;
            DOM.notificationBanner.classList.remove('visible');
            if (incident) {
                openDetailModal(incident);
            }
        };

        setTimeout(() => {
            if (DOM.notificationBanner) {
                DOM.notificationBanner.classList.remove('visible');
            }
        }, 5000);
    }

    function loadStoredSeenIds() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SEEN_IDS);
            if (raw) {
                const arr = JSON.parse(raw);
                appState.seenPostIds = new Set(arr);
            }
        } catch (e) {
            appState.seenPostIds = new Set();
        }
    }

    function loadStoredIncidentsCache() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_INCIDENTS_CACHE);
            if (raw) {
                const cached = JSON.parse(raw);
                if (Array.isArray(cached) && cached.length > 0) {
                    appState.incidents = cached;
                    renderFeed(cached);
                    updateCategoryCounts();
                }
            }
        } catch (e) {
            console.warn('Could not read cached incidents:', e);
        }
    }

    function saveStoredSeenIds() {
        try {
            const arr = Array.from(appState.seenPostIds);
            localStorage.setItem(STORAGE_KEY_SEEN_IDS, JSON.stringify(arr.slice(-300)));
        } catch (e) {
            console.error('Error saving seen IDs:', e);
        }
    }

    // Event listeners and navigation
    function initEventListeners() {
        // Feed Scope Switcher (Community & My Reports)
        if (DOM.tabScopeCommunity) {
            DOM.tabScopeCommunity.addEventListener('click', () => switchFeedScope('community'));
        }
        if (DOM.tabScopeMy) {
            DOM.tabScopeMy.addEventListener('click', () => switchFeedScope('my'));
        }

        // Quick Incident Composer Prompt
        if (DOM.btnQuickComposer) {
            DOM.btnQuickComposer.addEventListener('click', () => switchTab('view-report'));
        }

        // Refresh Button
        if (DOM.btnRefreshFeed) {
            DOM.btnRefreshFeed.addEventListener('click', () => refreshFeed());
        }

        // Live Search Input
        if (DOM.feedSearchInput) {
            DOM.feedSearchInput.addEventListener('input', function () {
                appState.searchQuery = this.value.trim();
                DOM.btnClearSearch.classList.toggle('hidden', !this.value);
                renderFeed(appState.incidents);
            });
        }
        if (DOM.btnClearSearch) {
            DOM.btnClearSearch.addEventListener('click', function () {
                DOM.feedSearchInput.value = '';
                appState.searchQuery = '';
                this.classList.add('hidden');
                renderFeed(appState.incidents);
            });
        }

        // Empty State CTA
        if (DOM.btnEmptyReport) {
            DOM.btnEmptyReport.addEventListener('click', () => switchTab('view-report'));
        }

        // Category Pills Selector in Report Form
        DOM.categoryPills.forEach(pill => {
            pill.addEventListener('click', function () {
                DOM.categoryPills.forEach(p => {
                    p.classList.remove('selected');
                    p.setAttribute('aria-checked', 'false');
                });
                this.classList.add('selected');
                this.setAttribute('aria-checked', 'true');
                DOM.incidentCategoryValue.value = this.getAttribute('data-value');
            });
        });

        // Incident Description Char Counter
        if (DOM.incidentDescription) {
            DOM.incidentDescription.addEventListener('input', function () {
                DOM.descCharCounter.textContent = `${this.value.length} / 1000`;
            });
        }

        // GPS Actions
        if (DOM.btnGrabGps) {
            DOM.btnGrabGps.addEventListener('click', () => obtainDeviceGps(false));
        }
        if (DOM.btnToggleManualGps) {
            DOM.btnToggleManualGps.addEventListener('click', () => {
                DOM.manualGpsInputs.classList.toggle('hidden');
            });
        }
        if (DOM.btnApplyManualGps) {
            DOM.btnApplyManualGps.addEventListener('click', () => {
                const lat = parseFloat(DOM.manualLat.value);
                const lng = parseFloat(DOM.manualLng.value);
                if (!isNaN(lat) && !isNaN(lng)) {
                    applyGpsCoordinates(lat, lng, 0);
                    DOM.manualGpsInputs.classList.add('hidden');
                    showInAppBanner({ category: 'GPS', title: 'Coordinates applied manually.' });
                } else {
                    showFeedback('Please enter valid numeric latitude and longitude.', 'error');
                }
            });
        }

        // Photo Controls
        if (DOM.btnSnapCamera) DOM.btnSnapCamera.addEventListener('click', triggerCameraCapture);
        if (DOM.btnBrowsePhoto) DOM.btnBrowsePhoto.addEventListener('click', triggerGalleryPicker);
        if (DOM.btnRetakePhoto) DOM.btnRetakePhoto.addEventListener('click', triggerCameraCapture);
        if (DOM.btnRemovePhoto) DOM.btnRemovePhoto.addEventListener('click', clearCapturedPhoto);
        if (DOM.fileFallbackInput) DOM.fileFallbackInput.addEventListener('change', handleFileFallback);

        // Incident Form Submit
        if (DOM.incidentForm) {
            DOM.incidentForm.addEventListener('submit', handleIncidentSubmit);
        }

        // Profile & Auth Modal (Separate Sign In and Register Pages)
        if (DOM.btnOpenProfile) {
            DOM.btnOpenProfile.addEventListener('click', () => openModal(DOM.modalProfile));
        }
        if (DOM.btnCloseProfile) {
            DOM.btnCloseProfile.addEventListener('click', () => closeModal(DOM.modalProfile));
        }

        // Auth Tabs & Switch Links
        if (DOM.tabAuthSignin) {
            DOM.tabAuthSignin.addEventListener('click', () => switchAuthTab('signin'));
        }
        if (DOM.tabAuthRegister) {
            DOM.tabAuthRegister.addEventListener('click', () => switchAuthTab('register'));
        }
        if (DOM.linkGotoRegister) {
            DOM.linkGotoRegister.addEventListener('click', () => switchAuthTab('register'));
        }
        if (DOM.linkGotoSignin) {
            DOM.linkGotoSignin.addEventListener('click', () => switchAuthTab('signin'));
        }

        // Auth Forms
        if (DOM.authLoginForm) {
            DOM.authLoginForm.addEventListener('submit', handleAuthLogin);
        }
        if (DOM.authRegisterForm) {
            DOM.authRegisterForm.addEventListener('submit', handleAuthRegister);
        }

        if (DOM.btnSignOut) {
            DOM.btnSignOut.addEventListener('click', handleSignOut);
        }
        if (DOM.btnViewMyReports) {
            DOM.btnViewMyReports.addEventListener('click', () => {
                closeModal(DOM.modalProfile);
                switchFeedScope('my');
            });
        }

        // Detail Modal Close
        if (DOM.btnCloseDetail) {
            DOM.btnCloseDetail.addEventListener('click', () => closeModal(DOM.modalDetail));
        }

        // In-app Notification Close
        if (DOM.btnCloseNotif) {
            DOM.btnCloseNotif.addEventListener('click', () => {
                DOM.notificationBanner.classList.remove('visible');
            });
        }

        // Bottom Dock Nav Items
        DOM.dockTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                const targetId = this.getAttribute('data-target');
                if (targetId === 'modal-profile') {
                    openModal(DOM.modalProfile);
                } else if (targetId) {
                    switchTab(targetId);
                }
            });
        });
    }

    function initCategoryFilterUI() {
        if (!DOM.chipsTrack) return;

        DOM.chipsTrack.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', function () {
                DOM.chipsTrack.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                appState.currentCategoryFilter = this.getAttribute('data-category');
                refreshFeed();
            });
        });
    }

    function switchFeedScope(scope) {
        appState.feedScope = scope;

        if (scope === 'community') {
            DOM.tabScopeCommunity.classList.add('active');
            DOM.tabScopeMy.classList.remove('active');
            DOM.tabScopeCommunity.setAttribute('aria-selected', 'true');
            DOM.tabScopeMy.setAttribute('aria-selected', 'false');
        } else {
            DOM.tabScopeMy.classList.add('active');
            DOM.tabScopeCommunity.classList.remove('active');
            DOM.tabScopeMy.setAttribute('aria-selected', 'true');
            DOM.tabScopeCommunity.setAttribute('aria-selected', 'false');
        }

        refreshFeed();
    }

    function switchTab(viewId) {
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === viewId);
        });

        DOM.dockTabs.forEach(tab => {
            const target = tab.getAttribute('data-target');
            tab.classList.toggle('active', target === viewId);
        });

        if (viewId === 'view-report') {
            // Auto acquire / refresh phone GPS when entering the report screen
            if (!appState.activeGpsPosition || !DOM.inputLat.value) {
                obtainDeviceGps(true);
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Detail modal dialogs
    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function openDetailModal(incident) {
        DOM.detailModalTitle.textContent = incident.title;
        DOM.detailCategoryPill.textContent = incident.category;
        DOM.detailCategoryPill.className = `category-pill pill-${(incident.category || '').toLowerCase()}`;
        DOM.detailTimestamp.textContent = formatTimeAgo(incident.created_at || incident.date);
        DOM.detailAuthor.textContent = `Reported by ${incident.author_username || 'Anonymous'}`;
        DOM.detailIdChip.textContent = `Report #${incident.id}`;
        DOM.detailDescription.textContent = incident.description;

        const lat = Number(incident.latitude).toFixed(6);
        const lng = Number(incident.longitude).toFixed(6);
        DOM.detailCoordsText.textContent = `${lat}, ${lng}`;
        DOM.detailMapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        // Feature 7 Photo Evidence in modal
        const photoSource = incident.photo_base64 || incident.photo;
        if (photoSource) {
            DOM.detailPhotoImg.src = photoSource;
            DOM.detailPhotoBox.classList.remove('hidden');
        } else {
            DOM.detailPhotoBox.classList.add('hidden');
        }

        openModal(DOM.modalDetail);
    }

    // Helper utilities
    function setSyncStatus(state, label) {
        if (!DOM.syncStatusDot || !DOM.syncStatusText) return;

        DOM.syncStatusText.textContent = label;
        DOM.syncStatusDot.className = 'status-dot';

        if (state === 'syncing') {
            DOM.syncStatusDot.classList.add('pulsing');
        } else if (state === 'error') {
            DOM.syncStatusDot.style.backgroundColor = '#ef4444';
        } else {
            DOM.syncStatusDot.style.backgroundColor = '#00ba7c';
        }
    }

    function showFeedback(message, type = 'error') {
        if (!DOM.formFeedbackMsg) return;
        DOM.formFeedbackMsg.textContent = message;
        DOM.formFeedbackMsg.className = `form-feedback ${type}`;
        DOM.formFeedbackMsg.classList.remove('hidden');

        setTimeout(() => {
            if (DOM.formFeedbackMsg) DOM.formFeedbackMsg.classList.add('hidden');
        }, 6000);
    }

    function formatTimeAgo(isoString) {
        if (!isoString) return 'Recent';
        const date = new Date(isoString);
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
