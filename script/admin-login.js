// script/admin-login.js
document.addEventListener('DOMContentLoaded', () => {
    const adminForm = document.getElementById('adminLoginForm');
    const errorMessage = document.getElementById('adminLoginError');

    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!adminForm.reportValidity()) return;

            const username = document.getElementById('admin-username').value;
            const password = document.getElementById('admin-password').value;
            const submitButton = adminForm.querySelector('[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Signing in…';
            errorMessage.hidden = true;

            try {
                const result = await window.SecmsAPI.request('/auth/admin-login', {
                    method: 'POST',
                    token: null,
                    body: { username, password }
                });
                sessionStorage.setItem(window.SecmsAPI.adminTokenKey, result.token);
                window.location.href = 'admin.html';
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.hidden = false;
                submitButton.disabled = false;
                submitButton.textContent = 'Access Admin Panel';
            }
        });
    }
});
