/**
 * Centralized API Service Module for Citizens Incident Reporting App
 * Production FastAPI + PostgreSQL Backend (Hosted on Render)
 */

(function (window) {
    'use strict';

    const BASE_URL = "https://citizenapi.onrender.com";

    // API EndpointsStorage Keys as specified in production specification
    const KEY_AUTH_TOKEN = "auth_token";
    const KEY_CURRENT_USER = "current_user";

    /**
     * Retrieve active JWT token from localStorage
     * @returns {string}
     */
    function getToken() {
        return localStorage.getItem(KEY_AUTH_TOKEN) || "";
    }

    /**
     * Retrieve cached authenticated user object from localStorage
     * @returns {Object|null}
     */
    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(KEY_CURRENT_USER);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('Error parsing current_user from localStorage', e);
            return null;
        }
    }

    /**
     * Save authentication session
     * @param {string} token 
     * @param {Object} user 
     */
    function setAuth(token, user) {
        if (token) {
            localStorage.setItem(KEY_AUTH_TOKEN, token);
        } else {
            localStorage.removeItem(KEY_AUTH_TOKEN);
        }
        if (user) {
            localStorage.setItem(KEY_CURRENT_USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(KEY_CURRENT_USER);
        }
    }

    /**
     * Clear all authentication state
     */
    function clearAuth() {
        localStorage.removeItem(KEY_AUTH_TOKEN);
        localStorage.removeItem(KEY_CURRENT_USER);
    }

    /**
     * Build standard headers with optional Bearer token
     * @param {boolean} requireAuth 
     * @returns {Object}
     */
    function getHeaders(requireAuth = false) {
        const headers = {
            "Content-Type": "application/json"
        };
        const token = getToken();
        if (token && (requireAuth || token.length > 0)) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        return headers;
    }

    /**
     * General fetch wrapper with timeout and standardized JSON error extraction
     */
    async function request(endpoint, options = {}, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // API EndpointsNormalize leading slash
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${BASE_URL}${path}`;

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const isJson = (response.headers.get('content-type') || '').includes('application/json');
            const data = isJson ? await response.json() : await response.text();

            if (!response.ok) {
                let errorMsg = `Server error (${response.status})`;
                if (typeof data === 'object' && data !== null) {
                    if (data.detail) {
                        if (Array.isArray(data.detail)) {
                            errorMsg = data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
                        } else {
                            errorMsg = data.detail;
                        }
                    } else if (data.message) {
                        errorMsg = data.message;
                    }
                }
                const err = new Error(errorMsg);
                err.status = response.status;
                err.data = data;
                throw err;
            }

            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('Network request timed out. Please check your internet connection.');
            }
            throw err;
        }
    }

    // API Endpoints

    const ApiService = {
        BASE_URL,

        // API EndpointsAuth Helpers
        getToken,
        getCurrentUser,
        setAuth,
        clearAuth,

        /**
         * Register a new user
         * POST /auth/register
         */
        async register(username, password) {
            const data = await request('/auth/register', {
                method: 'POST',
                headers: getHeaders(false),
                body: JSON.stringify({ username: username.trim(), password })
            });

            if (data && data.token) {
                setAuth(data.token, {
                    id: data.id,
                    username: data.username,
                    role: 'Verified Citizen'
                });
            }
            return data;
        },

        /**
         * User Login (FastAPI auto-registers if user does not exist)
         * POST /auth/login
         */
        async login(username, password) {
            const data = await request('/auth/login', {
                method: 'POST',
                headers: getHeaders(false),
                body: JSON.stringify({ username: username.trim(), password })
            });

            if (data && data.token) {
                setAuth(data.token, {
                    id: data.id,
                    username: data.username,
                    role: 'Verified Citizen'
                });
            }
            return data;
        },

        /**
         * Get authenticated user profile & total reports count
         * GET /auth/me
         */
        async getMe() {
            const token = getToken();
            if (!token) return null;

            return await request('/auth/me', {
                method: 'GET',
                headers: getHeaders(true)
            });
        },

        /**
         * Fetch community incident feed with optional category filter
         * GET /incidents?category=<category>
         * Supported categories: "All", "Accident", "Fighting", "Rioting", "Robbery", "Other"
         */
        async getIncidents(category = "All") {
            let endpoint = '/incidents';
            if (category && category !== "All") {
                endpoint += `?category=${encodeURIComponent(category)}`;
            }
            return await request(endpoint, {
                method: 'GET',
                headers: getHeaders(false)
            });
        },

        /**
         * Fetch personal incidents submitted by currently logged in user
         * GET /incidents/me
         */
        async getMyIncidents() {
            const token = getToken();
            if (!token) {
                throw new Error('Please sign in to view your submitted incidents.');
            }
            return await request('/incidents/me', {
                method: 'GET',
                headers: getHeaders(true)
            });
        },

        /**
         * Submit a new eyewitness incident report (GPS + optional Photo Base64)
         * POST /incidents
         * 
         * Payload:
         * {
         *   title: string,
         *   category: string,
         *   description: string,
         *   latitude: number,
         *   longitude: number,
         *   photo_base64: string|null
         * }
         */
        async createIncident(incidentData) {
            const payload = {
                title: incidentData.title.trim(),
                category: incidentData.category,
                description: incidentData.description.trim(),
                latitude: parseFloat(incidentData.latitude),
                longitude: parseFloat(incidentData.longitude),
                photo_base64: incidentData.photo_base64 || null
            };

            return await request('/incidents', {
                method: 'POST',
                headers: getHeaders(true), // Automatically attaches Bearer token if user is signed in
                body: JSON.stringify(payload)
            });
        },

        /**
         * Health check / connection test
         */
        async testConnection() {
            const start = Date.now();
            const res = await request('/incidents', { method: 'GET' });
            const latency = Date.now() - start;
            return {
                ok: true,
                latencyMs: latency,
                count: Array.isArray(res) ? res.length : 0
            };
        }
    };

    window.ApiService = ApiService;

})(window);

