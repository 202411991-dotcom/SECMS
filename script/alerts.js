document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('alert-list-container');
    const filterCards = document.querySelectorAll('.alert-summary-card');
    const modal = document.getElementById('alertDetailModal');
    const token = localStorage.getItem(window.SecmsAPI.userTokenKey);
    let notifications = [];
    let currentFilter = 'all';

    if (!token) {
        window.location.replace('login.html');
        return;
    }

    const iconByType = {
        critical: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info',
        success: 'fa-circle-check'
    };

    function formatDate(value) {
        return value ? new Date(value).toLocaleString() : 'Recently';
    }

    function updateCounts() {
        const counts = { critical: 0, warning: 0, info: 0, success: 0 };
        notifications.forEach((notification) => {
            if (counts[notification.type] !== undefined) counts[notification.type] += 1;
        });
        Object.entries(counts).forEach(([type, count]) => {
            const target = document.getElementById(`count-${type}`);
            if (target) target.textContent = String(count);
        });
    }

    function render() {
        container.replaceChildren();
        const visible = notifications.filter((notification) =>
            currentFilter === 'all' || notification.type === currentFilter
        );

        if (visible.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'alert-empty-state';
            empty.textContent = 'There are no notifications in this category.';
            container.appendChild(empty);
            return;
        }

        visible.forEach((notification) => {
            const type = iconByType[notification.type] ? notification.type : 'info';
            const item = document.createElement('article');
            item.className = `alert-item border-${type === 'critical' ? 'red' : type === 'warning' ? 'yellow' : type === 'success' ? 'green' : 'blue'}`;

            const icon = document.createElement('div');
            icon.className = `alert-icon text-${type === 'critical' ? 'red' : type === 'warning' ? 'yellow' : type === 'success' ? 'green' : 'blue'}`;
            const iconElement = document.createElement('i');
            iconElement.className = `fas ${iconByType[type]}`;
            icon.setAttribute('aria-hidden', 'true');
            icon.appendChild(iconElement);

            const content = document.createElement('div');
            content.className = 'alert-content';
            const title = document.createElement('h3');
            title.className = 'alert-title';
            title.textContent = notification.title || 'Notification';
            const message = document.createElement('p');
            message.className = 'alert-desc';
            message.textContent = notification.message || '';
            const meta = document.createElement('div');
            meta.className = 'alert-meta';
            const time = document.createElement('time');
            time.textContent = formatDate(notification.createdAt);
            meta.appendChild(time);
            content.append(title, message, meta);

            const actions = document.createElement('div');
            actions.className = 'alert-actions';
            const badge = document.createElement('span');
            badge.className = `alert-badge badge-${type}`;
            badge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            actions.appendChild(badge);

            if (!notification.isRead) {
                const markRead = document.createElement('button');
                markRead.className = 'dismiss-btn';
                markRead.type = 'button';
                markRead.textContent = 'Mark read';
                markRead.setAttribute('aria-label', `Mark ${notification.title || 'notification'} as read`);
                markRead.addEventListener('click', async () => {
                    markRead.disabled = true;
                    try {
                        await window.SecmsAPI.request(`/notifications/${encodeURIComponent(notification._id)}/read`, { method: 'PATCH' });
                        await loadNotifications();
                    } catch (error) {
                        markRead.disabled = false;
                        alert(error.message);
                    }
                });
                actions.appendChild(markRead);
            } else {
                const readState = document.createElement('span');
                readState.className = 'alert-read-state';
                readState.textContent = 'Read';
                actions.appendChild(readState);
            }

            item.append(icon, content, actions);
            item.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                document.getElementById('modalAlertIcon').textContent = type.toUpperCase();
                document.getElementById('modalAlertTitle').textContent = notification.title || 'Notification';
                document.getElementById('modalAlertDesc').textContent = notification.message || '';
                const modalBadge = document.getElementById('modalAlertBadge');
                modalBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                modalBadge.className = `alert-modal-badge badge-${type}`;
                document.getElementById('modalAlertMeta').textContent = formatDate(notification.createdAt);
                modal.classList.add('show');
            });
            container.appendChild(item);
        });
    }

    async function loadNotifications() {
        container.setAttribute('aria-busy', 'true');
        try {
            const result = await window.SecmsAPI.request('/notifications?limit=50');
            notifications = result.notifications || [];
            updateCounts();
            render();
        } catch (error) {
            if (error.status === 401) {
                window.SecmsAPI.clearUserSession();
                window.location.replace('login.html');
                return;
            }
            container.replaceChildren();
            const failure = document.createElement('p');
            failure.className = 'alert-empty-state';
            failure.textContent = 'Notifications could not be loaded. Please try again.';
            container.appendChild(failure);
        } finally {
            container.setAttribute('aria-busy', 'false');
        }
    }

    filterCards.forEach((card) => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filter;
            currentFilter = currentFilter === filter ? 'all' : filter;
            filterCards.forEach((item) => item.classList.toggle('active-filter', item.dataset.filter === currentFilter));
            render();
        });
    });

    document.getElementById('closeAlertModal')?.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('modalOkayBtn')?.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.remove('show');
    });

    loadNotifications();
    window.setInterval(() => {
        if (!document.hidden) loadNotifications();
    }, 60000);
});
