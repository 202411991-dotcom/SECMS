document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');
    const message = document.getElementById('resetPasswordMessage');
    const password = document.getElementById('newPassword');
    const confirmation = document.getElementById('confirmPassword');
    const submitButton = form.querySelector('[type="submit"]');
    const token = new URLSearchParams(window.location.search).get('token') || '';

    if (!/^[a-f0-9]{64}$/i.test(token)) {
        message.textContent = 'This reset link is invalid or incomplete. Request a new link.';
        message.classList.add('error');
        message.hidden = false;
        form.querySelectorAll('input, button[type="submit"]').forEach((field) => { field.disabled = true; });
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.hidden = true;
        message.classList.remove('error');
        confirmation.setCustomValidity(password.value === confirmation.value ? '' : 'Passwords do not match.');
        if (!form.reportValidity()) return;

        submitButton.disabled = true;
        submitButton.textContent = 'Saving password...';
        try {
            const result = await window.SecmsAPI.request('/auth/reset-password', {
                method: 'POST',
                body: { token, password: password.value }
            });
            message.textContent = result.message || 'Password reset. You can now sign in.';
            message.hidden = false;
            form.querySelectorAll('input').forEach((field) => { field.disabled = true; field.value = ''; });
            submitButton.textContent = 'Password saved';
            submitButton.disabled = true;
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('error');
            message.hidden = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Save new password';
        }
    });
});
