document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.querySelector('.signup-form');
    if (!signupForm) return;

    const submitButton = signupForm.querySelector('[type="submit"]');
    const errorBox = document.getElementById('signupError');

    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!signupForm.reportValidity()) return;

        errorBox.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Creating account...';

        try {
            const result = await window.SecmsAPI.request('/auth/register', {
                method: 'POST',
                body: {
                    fullName: document.getElementById('fullname').value,
                    accountNumber: document.getElementById('account-number').value,
                    email: document.getElementById('email').value,
                    password: document.getElementById('password').value
                }
            });
            window.SecmsAPI.saveUserSession(result);
            window.location.href = result.user.isProfileComplete ? 'dashboard.html' : 'onboarding.html';
        } catch (error) {
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Create Account';
        }
    });
});
