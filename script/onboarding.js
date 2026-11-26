document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem(window.SecmsAPI.userTokenKey);
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    const form = document.getElementById('onboardingForm');
    const submitButton = document.getElementById('onboardingSubmit');
    const errorBox = document.getElementById('onboardingError');
    const providerSelect = document.getElementById('electricityProvider');
    const otherProviderField = document.getElementById('otherProviderField');
    const otherProviderInput = document.getElementById('otherProvider');
    const previousInput = document.getElementById('previousReading');
    const presentInput = document.getElementById('presentReading');
    const logoutButton = document.getElementById('onboardingLogout');

    logoutButton.addEventListener('click', () => {
        window.SecmsAPI.clearUserSession();
        window.location.replace('login.html');
    });

    function showFieldError(name, message) {
        const target = document.getElementById(`${name}Error`);
        if (target) target.textContent = message;
    }

    function validateReadings() {
        const previous = Number(previousInput.value);
        const present = Number(presentInput.value);
        const invalid = presentInput.value !== '' && previousInput.value !== '' && present < previous;
        presentInput.setCustomValidity(invalid ? 'Present reading must be greater than or equal to the previous reading.' : '');
        showFieldError('presentReading', invalid ? 'Present reading must be at least the previous reading.' : '');
    }

    previousInput.addEventListener('input', validateReadings);
    presentInput.addEventListener('input', validateReadings);
    providerSelect.addEventListener('change', () => {
        const isOther = providerSelect.value === 'Other';
        otherProviderField.hidden = !isOther;
        otherProviderInput.required = isOther;
        if (!isOther) {
            otherProviderInput.value = '';
            showFieldError('otherProvider', '');
        }
    });

    try {
        const result = await window.SecmsAPI.request('/users/me');
        const user = result.user;
        if (user.isProfileComplete) {
            window.SecmsAPI.saveUserSession({ token, user });
            window.location.replace('dashboard.html');
            return;
        }
        localStorage.setItem('loggedInUser', JSON.stringify(user));
        document.getElementById('onboardingUserName').textContent = 'Setting up ' + user.fullName + ' - account ' + user.accountNumber;
    } catch (error) {
        if (error.status === 401) {
            window.SecmsAPI.clearUserSession();
            window.location.replace('login.html');
            return;
        }
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        submitButton.disabled = true;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        validateReadings();
        errorBox.hidden = true;

        if (!form.reportValidity()) return;
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        const payload = {
            previousReading: Number(previousInput.value),
            presentReading: Number(presentInput.value),
            ratePerKwh: Number(document.getElementById('ratePerKwh').value),
            completeAddress: document.getElementById('completeAddress').value.trim(),
            phoneNumber: document.getElementById('phoneNumber').value.trim(),
            electricityProvider: providerSelect.value,
            otherProvider: otherProviderInput.value.trim()
        };

        try {
            const result = await window.SecmsAPI.request('/user/onboarding', {
                method: 'PUT',
                body: payload
            });
            window.SecmsAPI.saveUserSession({ token, user: result.user });
            window.location.replace('dashboard.html');
        } catch (error) {
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Save and continue to dashboard';
        }
    });
});
