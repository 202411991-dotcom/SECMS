document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem(window.SecmsAPI.userTokenKey);
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    let user;
    try {
        const result = await window.SecmsAPI.request('/users/me');
        user = result.user;
    } catch (error) {
        if (error.status === 401) {
            window.SecmsAPI.clearUserSession();
            window.location.replace('login.html');
        } else {
            alert(error.message);
        }
        return;
    }

    if (!user.isProfileComplete) {
        window.location.replace('onboarding.html');
        return;
    }
    window.SecmsAPI.saveUserSession({ token, user });

    const byId = (id) => document.getElementById(id);
    const form = byId('profileForm');
    const saveButton = form?.querySelector('[type="submit"]');
    const successPopup = byId('successPopup');
    const closePopupButton = byId('closePopupBtn');

    function populateProfile(profile) {
        byId('userName').textContent = profile.fullName;
        byId('userEmail').textContent = profile.email;
        byId('userAvatar').textContent = profile.fullName.charAt(0).toUpperCase();
        byId('headerFullName').textContent = profile.fullName;
        byId('headerEmail').textContent = profile.email;
        byId('inputFullName').value = profile.fullName;
        byId('inputEmail').value = profile.email;
        byId('inputAccountNumber').value = profile.accountNumber;
        byId('inputPhone').value = profile.phoneNumber || '';
        byId('inputAddress').value = profile.completeAddress || '';
        byId('inputProvider').value = profile.electricityProvider || '';

        byId('profilePreviousReading').textContent = `${Number(profile.previousReading).toFixed(2)} kWh`;
        byId('profilePresentReading').textContent = `${Number(profile.presentReading).toFixed(2)} kWh`;
        byId('profileRatePerKwh').textContent = `PHP ${Number(profile.ratePerKwh).toFixed(4)}`;
        byId('profileInitialConsumption').textContent = `${Number(profile.initialConsumptionKwh).toFixed(2)} kWh`;
        byId('profileInitialBill').textContent = `PHP ${Number(profile.estimatedInitialBill).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const accountStatus = profile.accountStatus || 'active';
        byId('accountStatusText').textContent = accountStatus === 'active' ? 'Active and Verified' : 'Inactive';
        byId('accountStatusBox').className = `status-box ${accountStatus === 'active' ? 'status-success' : 'status-danger'}`;
        const billStatus = profile.billStatus || 'pending';
        byId('billSetupText').textContent = billStatus === 'not-paid' ? 'Not Paid' : billStatus.charAt(0).toUpperCase() + billStatus.slice(1);
        byId('billSetupBox').className = `status-box ${billStatus === 'paid' ? 'status-success' : billStatus === 'not-paid' ? 'status-danger' : 'status-warning'}`;
        byId('dateCreatedText').textContent = profile.dateCreated || 'N/A';
    }

    populateProfile(user);

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            saveButton.disabled = true;
            saveButton.textContent = 'Saving…';
            try {
                const result = await window.SecmsAPI.request('/users/me', {
                    method: 'PATCH',
                    body: {
                        fullName: byId('inputFullName').value,
                        email: byId('inputEmail').value,
                        phoneNumber: byId('inputPhone').value,
                        completeAddress: byId('inputAddress').value
                    }
                });
                user = result.user;
                window.SecmsAPI.saveUserSession({ token, user });
                populateProfile(user);
                successPopup.classList.add('show');
            } catch (error) {
                alert(error.message);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Changes';
            }
        });
    }

    closePopupButton?.addEventListener('click', () => successPopup.classList.remove('show'));
    window.addEventListener('click', (event) => {
        if (event.target === successPopup) successPopup.classList.remove('show');
    });
});
