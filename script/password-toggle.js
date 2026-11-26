document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
        const inputId = toggle.getAttribute('aria-controls');
        const passwordInput = inputId ? document.getElementById(inputId) : null;
        if (!passwordInput) return;

        const eyeIcon = toggle.querySelector('[data-eye-icon]');
        const eyeOffIcon = toggle.querySelector('[data-eye-off-icon]');

        toggle.addEventListener('click', () => {
            const revealPassword = passwordInput.type === 'password';
            passwordInput.type = revealPassword ? 'text' : 'password';
            toggle.setAttribute('aria-label', revealPassword ? 'Hide password' : 'Show password');
            toggle.setAttribute('aria-pressed', String(revealPassword));

            if (eyeIcon) eyeIcon.hidden = revealPassword;
            if (eyeOffIcon) eyeOffIcon.hidden = !revealPassword;
        });
    });
});
