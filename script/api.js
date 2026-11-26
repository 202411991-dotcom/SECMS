(() => {
    const API_ROOT = `${window.location.origin}/api`;
    const USER_TOKEN_KEY = 'secmsAuthToken';
    const ADMIN_TOKEN_KEY = 'secmsAdminToken';

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        const token = Object.prototype.hasOwnProperty.call(options, 'token')
            ? options.token
            : localStorage.getItem(USER_TOKEN_KEY);
        if (token) headers.set('Authorization', `Bearer ${token}`);

        let body = options.body;
        if (body !== undefined && !(body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(`${API_ROOT}${path}`, {
                ...options,
                headers,
                body
            });
        } catch {
            throw new Error('Cannot connect to SECMS. Check that the server is running and try again.');
        }

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(result.error || 'The request could not be completed.');
            error.status = response.status;
            throw error;
        }
        return result;
    }

    function syncEnergyData(user) {
        if (!user?.isProfileComplete || !user.accountNumber) return;
        const meterData = {
            previousReading: Number(user.previousReading),
            presentReading: Number(user.presentReading),
            kwhUsed: Number(user.initialConsumptionKwh),
            estimatedCost: Number(user.estimatedInitialBill),
            totalRate: Number(user.ratePerKwh),
            timestamp: user.updatedAt || new Date().toISOString()
        };
        localStorage.setItem(`meterData_${user.accountNumber}`, JSON.stringify(meterData));
    }

    function saveUserSession({ token, user }) {
        localStorage.setItem(USER_TOKEN_KEY, token);
        localStorage.setItem('loggedInUser', JSON.stringify(user));
        syncEnergyData(user);
    }

    function clearUserSession() {
        localStorage.removeItem(USER_TOKEN_KEY);
        localStorage.removeItem('loggedInUser');
    }

    window.SecmsAPI = {
        request,
        saveUserSession,
        clearUserSession,
        syncEnergyData,
        userTokenKey: USER_TOKEN_KEY,
        adminTokenKey: ADMIN_TOKEN_KEY
    };
})();
