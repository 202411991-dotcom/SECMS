document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.login-form');
    if (!loginForm) return;

    const submitButton = loginForm.querySelector('[type="submit"]');
    const errorBox = document.getElementById('loginError');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!loginForm.reportValidity()) return;

        errorBox.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Signing in...';

        try {
            const result = await window.SecmsAPI.request('/auth/login', {
                method: 'POST',
                body: {
                    accountNumber: document.getElementById('account-number').value,
                    password: document.getElementById('password').value
                }
            });
            window.SecmsAPI.saveUserSession(result);
            window.location.href = result.user.isProfileComplete ? 'dashboard.html' : 'onboarding.html';
        } catch (error) {
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Log In';
        }
    });
});
