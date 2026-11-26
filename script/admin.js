// script/admin.js
document.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem(window.SecmsAPI.adminTokenKey)) {
        window.location.replace('admin-login.html');
        return;
    }
    let users = [];

    // --- LOGOUT ---
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem(window.SecmsAPI.adminTokenKey);
            window.location.href = 'admin-login.html';
        });
    }

    // --- TAB SWITCHING LOGIC ---
    window.switchTab = function(tabName, element) {
        const targetTab = document.getElementById(`tab-${tabName}`);
        const titles = {
            users: 'Manage Users',
            reports: 'System Logs',
            notifications: 'Send Alerts'
        };

        if (!targetTab || !titles[tabName]) {
            console.error(`Admin tab "${tabName}" is unavailable.`);
            return false;
        }

        document.querySelectorAll('.admin-tab').forEach(tab => tab.style.display = 'none');
        targetTab.style.display = 'block';

        document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
            const isActive = link === element;
            link.classList.toggle('active', isActive);
            if (isActive) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });

        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = titles[tabName];
        return false;
    };

    // ==========================================
    // USER DETAILS MODAL LOGIC
    // ==========================================
    window.showUserDetails = function(accountNumber) {
        const user = users.find((item) => item.accountNumber === accountNumber);
        if (!user) {
            alert('User not found. Refresh the users list and try again.');
            return;
        }

        const number = (value) => value === null || value === undefined || value === ''
            ? null
            : Number.isFinite(Number(value)) ? Number(value) : null;
        const previousReading = number(user.previousReading);
        const presentReading = number(user.presentReading);
        const ratePerKwh = number(user.ratePerKwh);
        const consumption = number(user.initialConsumptionKwh) ?? (previousReading !== null && presentReading !== null ? presentReading - previousReading : null);
        const estimatedBill = number(user.estimatedInitialBill) ?? (consumption !== null && ratePerKwh !== null ? consumption * ratePerKwh : null);
        const format = (value, digits = 2) => value === null ? 'Not provided' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

        document.getElementById('modalUserAvatar').textContent = (user.fullName || '?').charAt(0).toUpperCase();
        document.getElementById('modalUserName').textContent = user.fullName || 'User';
        document.getElementById('modalUserEmail').textContent = user.email || 'Not provided';
        document.getElementById('modalUserAccount').textContent = user.accountNumber || 'Not provided';
        document.getElementById('modalUserAccStatus').textContent = (user.accountStatus || 'active').toUpperCase();
        document.getElementById('modalUserAlertStatus').textContent = user.alertStatus || 'Normal';
        document.getElementById('modalUserDate').textContent = user.dateCreated || user.createdAt || 'N/A';
        document.getElementById('modalUserProvider').textContent = user.electricityProvider || 'Not provided';
        document.getElementById('modalUserAddress').textContent = user.completeAddress || 'Not provided';
        document.getElementById('modalUserPhone').textContent = user.phoneNumber || 'Not provided';
        document.getElementById('modalUserPrev').textContent = previousReading === null ? 'Not provided' : `${format(previousReading)} kWh`;
        document.getElementById('modalUserPresent').textContent = presentReading === null ? 'Not provided' : `${format(presentReading)} kWh`;
        document.getElementById('modalUserKwh').textContent = consumption === null ? 'Not provided' : `${format(consumption)} kWh`;
        document.getElementById('modalUserRate').textContent = ratePerKwh === null ? 'Not provided' : `PHP ${format(ratePerKwh, 4)}`;
        document.getElementById('modalUserCost').textContent = estimatedBill === null ? 'Not provided' : `PHP ${format(estimatedBill)}`;
        document.getElementById('userDetailModal').classList.add('show');
    };
    const closeModalBtn = document.getElementById('closeUserModalBtn');
    const userModal = document.getElementById('userDetailModal');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            userModal.classList.remove('show');
        });
    }

    if (userModal) {
        window.addEventListener('click', (e) => {
            if (e.target === userModal) {
                userModal.classList.remove('show');
            }
        });
    }

    // ==========================================
    // LOGGING HELPER
    // ==========================================
    function readSystemLogs() {
        try {
            const logs = JSON.parse(localStorage.getItem('systemLogs') || '[]');
            return Array.isArray(logs) ? logs : [];
        } catch {
            return [];
        }
    }

    function logActivity(actionType, target, details) {
        const logs = readSystemLogs();
        logs.push({
            id: Date.now(),
            timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            actionType: actionType,
            target: target,
            details: details
        });
        try {
            localStorage.setItem('systemLogs', JSON.stringify(logs));
        } catch {
            // Local audit logs are optional; do not block a successful API update.
        }
        loadSystemLogs();
    }

    // ==========================================
    // USER STATISTICS
    // ==========================================
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    async function loadUsers() {
        const usersTable = document.getElementById('users-table-body');
        const targetDropdown = document.getElementById('alert-target');
        usersTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading users...</td></tr>';
        try {
            const result = await window.SecmsAPI.request('/admin/users', {
                token: sessionStorage.getItem(window.SecmsAPI.adminTokenKey)
            });
            users = result.users || [];
        } catch (error) {
            if (error.status === 401) {
                sessionStorage.removeItem(window.SecmsAPI.adminTokenKey);
                window.location.replace('admin-login.html');
                return;
            }
            users = [];
            usersTable.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;">${error.message}</td></tr>`;
            return;
        }

        // Keep the browser cache in sync for the user dashboard and reports.
        try {
            localStorage.setItem('energyUsers', JSON.stringify(users));
            users.forEach((user) => {
                if (user.isProfileComplete && user.accountNumber) {
                    localStorage.setItem(`meterData_${user.accountNumber}`, JSON.stringify({
                        previousReading: Number(user.previousReading),
                        presentReading: Number(user.presentReading),
                        kwhUsed: Number(user.initialConsumptionKwh),
                        estimatedCost: Number(user.estimatedInitialBill),
                        totalRate: Number(user.ratePerKwh),
                        timestamp: user.updatedAt || user.createdAt
                    }));
                }
            });
        } catch {
            // Quota or browser privacy settings must not prevent the users list from rendering.
        }

        let total = users.length;
        let pending = 0, active = 0, inactive = 0;

        users.forEach(user => {
            if (user.billStatus !== 'paid' && user.billStatus !== 'not-paid') pending++;
            
            if (user.accountStatus === 'inactive') inactive++;
            else active++;
        });

        document.getElementById('stat-total-users').textContent = total;
        document.getElementById('stat-pending-users').textContent = pending;
        document.getElementById('stat-active-users').textContent = active;
        document.getElementById('stat-inactive-users').textContent = inactive;

        if (users.length === 0) {
            usersTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>';
        } else {
            usersTable.innerHTML = users.map((user, index) => {
                const accClass = user.accountStatus === 'active' ? 'active-status' : 'inactive-status';
                const accText = user.accountStatus === 'active' ? 'Active' : 'Inactive';
                const alertStatus = ['Normal', 'High', 'Critical'].includes(user.alertStatus) ? user.alertStatus : 'Normal';

                return `
                <tr onclick="showUserDetails('${user.accountNumber}')" style="cursor: pointer;" class="clickable-row">
                    <td><strong>${escapeHtml(user.fullName)}</strong></td>
                    <td>${escapeHtml(user.accountNumber)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td><span class="status-btn alert-status alert-${alertStatus.toLowerCase()}" title="Latest consumption: ${user.currentConsumptionKwh ?? 'Not available'} kWh">${alertStatus}</span></td>
                    <td>
                        <div class="status-dropdown-wrapper" onclick="event.stopPropagation()">
                            <button class="status-btn ${accClass}" onclick="toggleAccountMenu(${index})">${accText} ▾</button>
                            <div class="status-menu" id="account-menu-${index}">
                                <div class="status-menu-item" onclick="updateAccountStatus('${user.accountNumber}', 'active')"><span class="menu-dot paid"></span> Active</div>
                                <div class="status-menu-item" onclick="updateAccountStatus('${user.accountNumber}', 'inactive')"><span class="menu-dot not-paid"></span> Inactive</div>
                            </div>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }

        if (targetDropdown) {
            targetDropdown.innerHTML = '<option value="all">All Users (Broadcast)</option>';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.accountNumber;
                option.textContent = `${user.fullName} (${user.accountNumber})`;
                targetDropdown.appendChild(option);
            });
        }
    }

    window.toggleBillMenu = function(index) {
        document.querySelectorAll('.status-menu').forEach(menu => menu.classList.remove('show'));
        document.getElementById(`bill-menu-${index}`).classList.toggle('show');
    };

    window.toggleAccountMenu = function(index) {
        document.querySelectorAll('.status-menu').forEach(menu => menu.classList.remove('show'));
        document.getElementById(`account-menu-${index}`).classList.toggle('show');
    };

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.status-dropdown-wrapper')) {
            document.querySelectorAll('.status-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    async function updateUserStatus(accountNumber, body, actionType, status) {
        try {
            const result = await window.SecmsAPI.request(`/admin/users/${encodeURIComponent(accountNumber)}/status`, {
                method: 'PATCH',
                token: sessionStorage.getItem(window.SecmsAPI.adminTokenKey),
                body
            });
            const userIndex = users.findIndex((user) => user.accountNumber === accountNumber);
            if (userIndex !== -1) users[userIndex] = result.user;
            localStorage.setItem('energyUsers', JSON.stringify(users));
            logActivity(actionType, result.user.fullName, `Changed ${actionType.toLowerCase()} to ${status.toUpperCase()}`);
            await loadUsers();
        } catch (error) {
            alert(error.message);
        }
    }

    window.updateBillStatus = (accountNumber, newStatus) => updateUserStatus(
        accountNumber, { billStatus: newStatus }, 'Bill Status', newStatus
    );

    window.updateAccountStatus = (accountNumber, newStatus) => updateUserStatus(
        accountNumber, { accountStatus: newStatus }, 'Account Status', newStatus
    );

    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);

    // ==========================================
    // SYSTEM LOGS DISPLAY
    // ==========================================
    function loadSystemLogs() {
        const logsBody = document.getElementById('system-logs-body');
        if (!logsBody) return;

        const logs = readSystemLogs();

        if (logs.length === 0) {
            logsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No activity logs yet.</td></tr>';
            return;
        }

        logsBody.innerHTML = '';
        [...logs].reverse().forEach(log => {
            let badgeColor = 'badge-info';
            if (log.actionType === 'Bill Status') badgeColor = 'badge-warning';
            if (log.actionType === 'Account Status') badgeColor = 'badge-danger';
            if (log.actionType === 'Alert Sent') badgeColor = 'badge-success';

            logsBody.innerHTML += `
                <tr>
                    <td>${escapeHtml(log.timestamp)}</td>
                    <td><span class="alert-badge ${badgeColor}">${escapeHtml(log.actionType)}</span></td>
                    <td><strong>${escapeHtml(log.target)}</strong></td>
                    <td>${escapeHtml(log.details)}</td>
                </tr>
            `;
        });
    }

    // ==========================================
    // ALERT HISTORY & SENDING
    // ==========================================
    async function loadAlertHistory() {
        const historyTable = document.getElementById('alert-history-body');
        historyTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading notifications...</td></tr>';
        try {
            const result = await window.SecmsAPI.request('/admin/notifications', { token: sessionStorage.getItem(window.SecmsAPI.adminTokenKey) });
            const notifications = result.notifications || [];
            if (notifications.length === 0) {
                historyTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">No alerts sent yet.</td></tr>';
                return;
            }
            historyTable.replaceChildren();
            notifications.forEach((notification) => {
                const row = document.createElement('tr');
                const values = [
                    notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'N/A',
                    (notification.targetName || 'User') + (notification.targetAccount ? ' (' + notification.targetAccount + ')' : ''),
                    notification.type || 'info',
                    notification.title || 'Notification',
                    notification.message || ''
                ];
                values.forEach((value) => {
                    const cell = document.createElement('td');
                    cell.textContent = value;
                    row.appendChild(cell);
                });
                historyTable.appendChild(row);
            });
        } catch (error) {
            if (error.status === 401) {
                sessionStorage.removeItem(window.SecmsAPI.adminTokenKey);
                window.location.replace('admin-login.html');
                return;
            }
            historyTable.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;"></td></tr>';
            historyTable.querySelector('td').textContent = error.message;
        }
    }

    const alertForm = document.getElementById('alert-form');
    if (alertForm) {
        alertForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!alertForm.reportValidity()) return;
            const submitButton = alertForm.querySelector('[type="submit"]');
            const targetAccount = document.getElementById('alert-target').value;
            const type = document.getElementById('alert-type').value;
            const title = document.getElementById('alert-title').value.trim();
            const message = document.getElementById('alert-desc').value.trim();
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            try {
                await window.SecmsAPI.request('/admin/notifications', {
                    method: 'POST',
                    token: sessionStorage.getItem(window.SecmsAPI.adminTokenKey),
                    body: { targetAccount, type, title, message }
                });
                const target = targetAccount === 'all'
                    ? 'All active users'
                    : users.find((user) => user.accountNumber === targetAccount)?.fullName || targetAccount;
                logActivity('Alert Sent', target, 'Sent ' + type + ' alert: "' + title + '"');
                alertForm.reset();
                await loadAlertHistory();
            } catch (error) {
                if (error.status === 401) {
                    sessionStorage.removeItem(window.SecmsAPI.adminTokenKey);
                    window.location.replace('admin-login.html');
                    return;
                }
                alert(error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Send Notification';
            }
        });
    }
    // --- INITIALIZE ---
    loadSystemLogs();
    loadAlertHistory();
    loadUsers();
    window.setInterval(loadUsers, 30000);
});
