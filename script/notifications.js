document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.top-navbar');
    if (!header || !window.SecmsAPI || !localStorage.getItem(window.SecmsAPI.userTokenKey)) return;

    let actions = header.querySelector('.global-header-actions');
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'global-header-actions';
        header.appendChild(actions);
    }

    const profile = header.querySelector('.user-profile');
    if (profile && profile.parentElement !== actions) actions.appendChild(profile);

    const widget = document.createElement('div');
    widget.className = 'notification-widget';
    widget.innerHTML = `
        <button class="notification-bell" type="button" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
            <span aria-hidden="true">&#128276;</span><span class="notification-count" hidden></span>
        </button>
        <section class="notification-panel" aria-label="Recent notifications" hidden>
            <div class="notification-panel-header"><h2>Notifications</h2><button type="button" class="notification-mark-all">Mark all read</button></div>
            <div class="notification-list" role="list"></div>
            <a class="notification-view-all" href="alerts.html">View all alerts</a>
        </section>`;
    actions.prepend(widget);

    const bell = widget.querySelector('.notification-bell');
    const count = widget.querySelector('.notification-count');
    const panel = widget.querySelector('.notification-panel');
    const list = widget.querySelector('.notification-list');
    const markAllButton = widget.querySelector('.notification-mark-all');

    function togglePanel(open) {
        panel.hidden = !open;
        bell.setAttribute('aria-expanded', String(open));
        if (open) refreshNotifications();
    }

    function renderNotifications(notifications, unreadCount) {
        count.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        count.hidden = unreadCount <= 0;
        list.replaceChildren();

        if (notifications.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'notification-empty';
            empty.textContent = 'You are all caught up.';
            list.appendChild(empty);
            return;
        }

        notifications.forEach((notification) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `notification-entry${notification.isRead ? '' : ' unread'}`;
            item.dataset.type = notification.type || 'info';

            const title = document.createElement('strong');
            title.textContent = notification.title || 'Notification';
            const message = document.createElement('p');
            message.textContent = notification.message || '';
            const time = document.createElement('time');
            if (notification.createdAt) {
                const createdAt = new Date(notification.createdAt);
                time.dateTime = createdAt.toISOString();
                time.textContent = createdAt.toLocaleString();
            }
            item.append(title, message, time);
            item.addEventListener('click', async () => {
                if (!notification.isRead) {
                    try {
                        await window.SecmsAPI.request(`/notifications/${encodeURIComponent(notification._id)}/read`, { method: 'PATCH' });
                    } catch {
                        // Keep the panel usable; the next refresh will show the saved state.
                    }
                }
                refreshNotifications();
            });
            list.appendChild(item);
        });
    }

    async function refreshNotifications() {
        try {
            const result = await window.SecmsAPI.request('/notifications?limit=8');
            renderNotifications(result.notifications || [], Number(result.unreadCount) || 0);
        } catch (error) {
            list.replaceChildren();
            const message = document.createElement('p');
            message.className = 'notification-error';
            message.textContent = error.status === 401
                ? 'Sign in again to view notifications.'
                : 'Notifications could not be loaded. Try again shortly.';
            list.appendChild(message);
            count.hidden = true;
        }
    }

    bell.addEventListener('click', () => togglePanel(panel.hidden));
    markAllButton.addEventListener('click', async () => {
        markAllButton.disabled = true;
        try {
            await window.SecmsAPI.request('/notifications/read-all', { method: 'PATCH' });
            await refreshNotifications();
        } catch {
            list.replaceChildren();
            const message = document.createElement('p');
            message.className = 'notification-error';
            message.textContent = 'Notifications could not be updated. Try again.';
            list.appendChild(message);
        } finally {
            markAllButton.disabled = false;
        }
    });

    document.addEventListener('click', (event) => {
        if (!widget.contains(event.target)) togglePanel(false);
    });
    refreshNotifications();
    window.setInterval(() => {
        if (!document.hidden) refreshNotifications();
    }, 60000);
});
