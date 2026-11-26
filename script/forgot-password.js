document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm');
    const message = document.getElementById('forgotPasswordMessage');
    const localLink = document.getElementById('localResetLink');
    const submitButton = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        message.hidden = true;
        message.classList.remove('error');
        localLink.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Preparing reset link...';

        try {
            const result = await window.SecmsAPI.request('/auth/forgot-password', {
                method: 'POST',
                body: { email: document.getElementById('recoveryEmail').value.trim() }
            });
            message.textContent = result.message || 'If an account exists for that email, reset instructions are ready.';
            message.hidden = false;
            if (result.resetUrl) {
                const link = document.createElement('a');
                link.href = result.resetUrl;
                link.textContent = 'Open the local reset link';
                link.rel = 'noopener noreferrer';
                localLink.replaceChildren(link);
                localLink.hidden = false;
            }
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('error');
            message.hidden = false;
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Send reset link';
        }
    });
});
