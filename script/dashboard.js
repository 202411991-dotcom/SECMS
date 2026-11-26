// script/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    
    // Resolve the signed-in account from the API before rendering protected pages.
    let loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const token = localStorage.getItem(window.SecmsAPI.userTokenKey);

    if (!token || !loggedInUser) {
        window.location.replace('login.html');
        return;
    }

    try {
        const response = await window.SecmsAPI.request('/users/me');
        loggedInUser = response.user;
        window.SecmsAPI.saveUserSession({ token, user: loggedInUser });
    } catch (error) {
        if (error.status === 401) {
            window.SecmsAPI.clearUserSession();
            window.location.replace('login.html');
        } else {
            alert(error.message);
        }
        return;
    }

    if (!loggedInUser.isProfileComplete) {
        window.location.replace('onboarding.html');
        return;
    }

    // --- 1. Populate User Data ---
    const firstName = loggedInUser.fullName.split(' ')[0];
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const welcomeNameEl = document.getElementById('welcomeName');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl) userNameEl.textContent = loggedInUser.fullName;
    if (userEmailEl) userEmailEl.textContent = loggedInUser.email || 'No email provided';
    if (welcomeNameEl) welcomeNameEl.textContent = firstName;
    if (userAvatarEl) userAvatarEl.textContent = loggedInUser.fullName.charAt(0).toUpperCase();

    // --- 2. Logout ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.SecmsAPI.clearUserSession();
            window.location.replace('login.html');
        });
    }

    // --- 3. REAL-TIME DATE AND TIME ---
    function updateDateTime() {
        const dateDisplay = document.getElementById('currentDate');
        if (!dateDisplay) return;
        const now = new Date();
        const options = { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        };
        dateDisplay.textContent = now.toLocaleDateString('en-US', options);
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // ==========================================
    // 4. FETCH METER DATA FROM LOCAL STORAGE
    // ==========================================
    function getMeterData() {
        return JSON.parse(localStorage.getItem(`meterData_${loggedInUser.accountNumber}`)) || null;
    }

    // ==========================================
    // 5. CONSUMPTION TREND CHART
    // ==========================================
    function renderConsumptionChart() {
        const wrapper = document.getElementById('dynamic-bars-wrapper');
        const yAxis = document.getElementById('dynamic-y-axis');
        if (!wrapper || !yAxis) return;

        const meterData = getMeterData();

        if (!meterData) {
            wrapper.innerHTML = '<div style="align-self: center; width: 100%; text-align: center; color: var(--text-muted);">No consumption data available yet.</div>';
            yAxis.innerHTML = '';
            return;
        }

        const currentKwh = meterData.kwhUsed || 0;
        const data = [
            { month: 'Jun', usage: currentKwh * 0.85 },
            { month: 'Jul', usage: currentKwh * 0.95 },
            { month: 'Aug', usage: currentKwh * 1.10 },
            { month: 'Sep', usage: currentKwh * 1.05 },
            { month: 'Oct', usage: currentKwh * 0.90 },
            { month: 'Nov', usage: currentKwh }
        ];

        const maxUsage = Math.max(...data.map(d => d.usage), 10);
        let axisMax = 100;
        if (maxUsage > 300) axisMax = Math.ceil(maxUsage / 100) * 100;
        else if (maxUsage > 200) axisMax = 300;
        else if (maxUsage > 100) axisMax = 200;
        else axisMax = 100;

        yAxis.innerHTML = `
            <span>${axisMax}</span>
            <span>${Math.round(axisMax * 0.66)}</span>
            <span>${Math.round(axisMax * 0.33)}</span>
            <span>0</span>
        `;

        wrapper.innerHTML = '';
        const colors = ['bar-blue', 'bar-purple', 'bar-green', 'bar-blue', 'bar-yellow', 'bar-green'];

        data.forEach((d, index) => {
            const heightPercent = (d.usage / axisMax) * 100;
            const barGroup = document.createElement('div');
            barGroup.className = 'bar-group';
            barGroup.innerHTML = `
                <div class="bar-tooltip">${d.usage.toFixed(2)} kWh</div>
                <div class="bar ${colors[index]}" style="height: ${heightPercent}%;"></div>
                <span class="bar-label">${d.month}</span>
            `;
            wrapper.appendChild(barGroup);
        });
    }

    // ==========================================
    // 6. AI RECOMMENDATIONS
    // ==========================================
    async function generateAIRecommendations() {
        const container = document.getElementById('dynamic-ai-recommendations');
        if (!container) return;

        const meterData = getMeterData();
        const refreshButton = document.getElementById('refresh-ai-recommendations');
        const apiRoot = window.SECMS_API_BASE_URL || `${window.location.origin}/api`;
        const loading = document.createElement('div');
        loading.className = 'ai-alert alert-blue ai-state';
        loading.textContent = 'Analyzing your latest energy use…';

        container.replaceChildren(loading);
        container.setAttribute('aria-busy', 'true');
        if (refreshButton) refreshButton.disabled = true;

        try {
            const payload = meterData ? {
                kwh: Number(meterData.kwhUsed) || 0,
                estimatedCost: Number(meterData.estimatedCost) || 0,
                peakHours: Array.isArray(meterData.peakHours) ? meterData.peakHours : [],
                appliances: Array.isArray(meterData.appliances) ? meterData.appliances : [],
                timestamp: meterData.timestamp || new Date().toISOString()
            } : {};
            const response = await fetch(`${apiRoot}/recommendations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const error = new Error(errorBody.error || 'Recommendation request failed.');
                error.status = response.status;
                error.code = errorBody.code;
                throw error;
            }

            renderAIRecommendations(container, await response.json());
        } catch (error) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'ai-alert alert-yellow ai-state';
            errorMessage.textContent = error.status === 404
                ? 'Add an energy reading to generate personalized recommendations.'
                : error.code === 'AI_CONFIGURATION_ERROR'
                    ? 'AI recommendations are unavailable because the configured OpenAI API key is invalid. Update OPENAI_API_KEY in .env and restart the backend.'
                : 'We couldn’t load recommendations right now. Please try again.';
            container.replaceChildren(errorMessage);
        } finally {
            container.setAttribute('aria-busy', 'false');
            if (refreshButton) refreshButton.disabled = false;
        }
    }

    function renderAIRecommendations(container, result) {
        if (!result || !Array.isArray(result.recommendations)) {
            throw new Error('Invalid recommendation response.');
        }

        const fragment = document.createDocumentFragment();
        const summary = document.createElement('div');
        const statusClass = result.status === 'high'
            ? 'alert-yellow'
            : result.status === 'excellent' ? 'alert-green' : 'alert-blue';
        summary.className = `ai-alert ${statusClass}`;

        const status = document.createElement('h4');
        status.textContent = `Energy status: ${result.status || 'unknown'}`;
        const summaryText = document.createElement('p');
        summaryText.textContent = result.summary || '';
        summary.append(status, summaryText);
        fragment.appendChild(summary);

        result.recommendations.forEach((recommendation) => {
            const card = document.createElement('div');
            const impact = ['low', 'medium', 'high'].includes(recommendation.impact)
                ? recommendation.impact
                : 'medium';
            card.className = `ai-alert ${impact === 'high' ? 'alert-green' : impact === 'low' ? 'alert-yellow' : 'alert-blue'}`;

            const title = document.createElement('h4');
            title.textContent = recommendation.title || 'Energy saving tip';
            const detail = document.createElement('p');
            detail.textContent = recommendation.description || '';
            const target = document.createElement('span');
            target.className = 'ai-target';
            target.textContent = `${recommendation.target_appliance || 'Household'} · ${impact} impact`;
            card.append(title, detail, target);
            fragment.appendChild(card);
        });

        container.replaceChildren(fragment);
    }

    // ==========================================
    // 7. REAL-TIME METER SIMULATION
    // ==========================================
    let meterInterval = null; 

    function startMeter() {
        if (meterInterval) clearInterval(meterInterval);

        const meterData = getMeterData();
        
        const meterDisplay = document.getElementById('dash-meter'); 
        const costDisplay = document.getElementById('dash-cost'); 
        const usageDisplay = document.getElementById('dash-usage'); 
        const previousDisplay = document.getElementById('dash-previous'); 

        if (!meterDisplay) return;

        if (!meterData) {
            meterDisplay.textContent = `Waiting for Admin...`;
            if (costDisplay) costDisplay.textContent = '₱0.00';
            if (usageDisplay) usageDisplay.textContent = '0 kWh';
            if (previousDisplay) previousDisplay.textContent = '0.00 kWh';
            return;
        }

        const lockedPreviousReading = meterData.previousReading;
        const totalRate = meterData.totalRate;
        let currentMeter = meterData.presentReading;
        
        if (previousDisplay) {
            previousDisplay.textContent = `${lockedPreviousReading.toFixed(2)} kWh`;
        }

        let lastMeterStr = '';
        let lastUsageStr = '';
        let lastCostStr = '';

        function updateLiveUI() {
            const liveUsage = Math.max(0, currentMeter - lockedPreviousReading);
            const liveCost = liveUsage * totalRate;

            const meterStr = `${currentMeter.toFixed(2)} kWh`;
            const usageStr = `${liveUsage.toFixed(2)} kWh`;
            const costStr = `₱${liveCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            if (meterStr !== lastMeterStr) {
                meterDisplay.textContent = meterStr;
                lastMeterStr = meterStr;
            }
            if (usageDisplay && usageStr !== lastUsageStr) {
                usageDisplay.textContent = usageStr;
                lastUsageStr = usageStr;
            }
            if (costDisplay && costStr !== lastCostStr) {
                costDisplay.textContent = costStr;
                lastCostStr = costStr;
            }
        }

        updateLiveUI();

        meterInterval = setInterval(() => {
            currentMeter += (Math.random() * 0.00001); 
            updateLiveUI();
        }, 1); 
    }

    // ==========================================
    // 8. CONSUMPTION PAGE SUMMARY CARDS
    // ==========================================
    function initConsumptionSummary(timeRange = 'month') {
        const usageEl = document.getElementById('cons-current-usage');
        if (!usageEl) return;

        const meterData = getMeterData();

        if (!meterData) {
            usageEl.textContent = `Waiting...`;
            return;
        }

        const lockedPreviousReading = meterData.previousReading;
        let currentMeter = meterData.presentReading;
        const baseKwh = meterData.kwhUsed;
        const baseCost = meterData.estimatedCost;

        const todayTotalEl = document.getElementById('cons-today-total');
        const costEl = document.getElementById('cons-estimated-cost');
        const vsLastMonthEl = document.getElementById('cons-vs-last-month');

        let rangeUsage = baseKwh;
        let rangeCost = baseCost;

        if (timeRange === '7') {
            rangeUsage = baseKwh * 0.25;
            rangeCost = baseCost * 0.25;
        } else if (timeRange === '30') {
            // Check for October 2026 report in Local Storage
            let savedReports = JSON.parse(localStorage.getItem('energyReports')) || [];
            const octoberReport = savedReports.find(r => r.month === 'October 2026');
            
            if (octoberReport) {
                rangeUsage = parseFloat(octoberReport.usage);
                rangeCost = parseFloat(octoberReport.cost.replace(/,/g, ''));
            }
        }

        function updateCards() {
            const liveUsage = Math.max(0, currentMeter - lockedPreviousReading);
            const currentKw = (liveUsage * 0.01).toFixed(2); 
            const rangeTotal = rangeUsage.toFixed(2);

            const lastMonthUsage = rangeUsage * 0.95;
            let percentDiff = ((rangeUsage - lastMonthUsage) / lastMonthUsage) * 100;
            if (isNaN(percentDiff) || !isFinite(percentDiff)) percentDiff = 0;
            
            const isDown = percentDiff < 0;
            const arrow = isDown ? '↘' : '↗';
            const colorClass = isDown ? 'text-green' : 'text-red';
            
            usageEl.textContent = `${currentKw} kW`;
            if (todayTotalEl) todayTotalEl.textContent = `${rangeTotal} kWh`;
            if (costEl) costEl.textContent = `₱${rangeCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            if (vsLastMonthEl) {
                vsLastMonthEl.textContent = `${arrow} ${Math.abs(percentDiff).toFixed(0)}%`;
                vsLastMonthEl.className = `card-value ${colorClass}`;
            }
        }

        updateCards();

        setInterval(() => {
            currentMeter += (Math.random() * 0.00001); 
            const liveUsage = Math.max(0, currentMeter - lockedPreviousReading);
            const currentKw = (liveUsage * 0.01).toFixed(2); 
            usageEl.textContent = `${currentKw} kW`;
        }, 1);
    }

    // ==========================================
    // 9. DAILY COST CHART (Interactive)
    // ==========================================
    function renderDailyCostChart() {
        const wrapper = document.getElementById('daily-cost-bars-wrapper');
        const yAxis = document.getElementById('daily-cost-y-axis');
        const tooltip = document.getElementById('bar-tooltip');
        if (!wrapper || !yAxis) return;

        const meterData = getMeterData();

        if (!meterData) {
            wrapper.innerHTML = '';
            yAxis.innerHTML = '';
            return;
        }

        const today = new Date();
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            dates.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        }

        const baseRate = meterData.totalRate;
        const dailyData = [
            { day: dates[0], cost: baseRate * 5 },
            { day: dates[1], cost: baseRate * 7 },
            { day: dates[2], cost: baseRate * 6 },
            { day: dates[3], cost: baseRate * 8 },
            { day: dates[4], cost: baseRate * 7.5 },
            { day: dates[5], cost: baseRate * 9 },
            { day: dates[6], cost: baseRate * 8.5 }
        ];

        const maxCost = Math.max(...dailyData.map(d => d.cost), 10);
        let axisMax = 100;
        if (maxCost > 1000) axisMax = Math.ceil(maxCost / 1000) * 1000;
        else if (maxCost > 500) axisMax = Math.ceil(maxCost / 500) * 500;
        else if (maxCost > 100) axisMax = Math.ceil(maxCost / 100) * 100;
        else axisMax = 50;

        yAxis.innerHTML = `
            <span>₱${axisMax}</span>
            <span>₱${Math.round(axisMax * 0.66)}</span>
            <span>₱${Math.round(axisMax * 0.33)}</span>
            <span>₱0</span>
        `;

        wrapper.innerHTML = '';
        dailyData.forEach(d => {
            const heightPercent = (d.cost / axisMax) * 100;
            const barGroup = document.createElement('div');
            barGroup.className = 'bar-group';
            
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${heightPercent}%`;

            const showTooltip = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                if (!tooltip) return;
                tooltip.textContent = `${d.day}: ₱${d.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                tooltip.style.opacity = 1;
                const rect = bar.getBoundingClientRect();
                const containerRect = wrapper.getBoundingClientRect();
                tooltip.style.left = `${rect.left - containerRect.left + (rect.width / 2)}px`;
                tooltip.style.top = `${rect.top - containerRect.top - 10}px`;
            };

            bar.addEventListener('mouseenter', showTooltip);
            bar.addEventListener('touchstart', showTooltip);
            bar.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.opacity = 0; });

            const label = document.createElement('span');
            label.className = 'bar-label';
            label.textContent = d.day;

            barGroup.appendChild(bar);
            barGroup.appendChild(label);
            wrapper.appendChild(barGroup);
        });

        if (tooltip) wrapper.addEventListener('click', () => { tooltip.style.opacity = 0; });
    }

    // ==========================================
    // 10. MONTHLY LINE CHART (Interactive)
    // ==========================================
    function renderLineChart() {
        const chartGroup = document.getElementById('dynamic-line-group');
        const tooltip = document.getElementById('line-tooltip');
        const svg = document.getElementById('monthly-line-chart');
        if (!chartGroup || !svg) return;

        const meterData = getMeterData();
        if (!meterData) return;

        const currentKwh = meterData.kwhUsed || 0;
        const data = [
            { month: 'Jul', usage: currentKwh * 0.85, x: 80 },
            { month: 'Aug', usage: currentKwh * 0.95, x: 160 },
            { month: 'Sep', usage: currentKwh * 1.10, x: 240 },
            { month: 'Oct', usage: currentKwh * 1.05, x: 320 },
            { month: 'Nov', usage: currentKwh * 0.90, x: 400 },
            { month: 'Dec', usage: currentKwh, x: 480 }
        ];

        const maxUsage = Math.max(...data.map(d => d.usage), 100);
        const getY = (val) => 200 - ((val / maxUsage) * 150);
        const chartContainer = svg.parentElement;
        const plottedPoints = data.map((item) => ({ ...item, y: getY(item.usage) }));
        const hitRadius = 46;
        let activePoint = null;

        chartGroup.innerHTML = '';
        let polylinePoints = '';

        plottedPoints.forEach((point) => {
            polylinePoints += `${point.x},${point.y} `;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", point.x);
            circle.setAttribute("cy", point.y);
            circle.setAttribute("r", "6");
            circle.setAttribute("class", "data-point");
            circle.setAttribute('tabindex', '0');
            circle.setAttribute('role', 'graphics-symbol');
            circle.setAttribute('aria-label', `${point.month}: ${point.usage.toFixed(2)} kWh`);
            circle.addEventListener('focus', () => showTooltip(point));
            circle.addEventListener('blur', hideTooltip);

            chartGroup.appendChild(circle);
        });

        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", polylinePoints.trim());
        polyline.setAttribute("class", "data-line");
        chartGroup.appendChild(polyline);

        function hideTooltip() {
            if (!tooltip) return;
            tooltip.style.opacity = '0';
            tooltip.setAttribute('aria-hidden', 'true');
            activePoint = null;
            chartGroup.querySelectorAll('.data-point.is-active').forEach((circle) => {
                circle.classList.remove('is-active');
            });
        }

        function showTooltip(point) {
            if (!tooltip || !chartContainer) return;
            const screenMatrix = svg.getScreenCTM();
            if (!screenMatrix) return;

            const svgPoint = svg.createSVGPoint();
            svgPoint.x = point.x;
            svgPoint.y = point.y;
            const screenPosition = svgPoint.matrixTransform(screenMatrix);
            const containerRect = chartContainer.getBoundingClientRect();

            tooltip.textContent = `${point.month}: ${point.usage.toFixed(2)} kWh`;
            tooltip.style.opacity = '1';
            tooltip.setAttribute('aria-hidden', 'false');

            const halfTooltipWidth = tooltip.offsetWidth / 2;
            const minLeft = halfTooltipWidth + 8;
            const maxLeft = containerRect.width - halfTooltipWidth - 8;
            const left = Math.min(Math.max(screenPosition.x - containerRect.left, minLeft), maxLeft);
            const top = Math.max(tooltip.offsetHeight + 8, screenPosition.y - containerRect.top - 12);
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;

            if (activePoint !== point) {
                chartGroup.querySelectorAll('.data-point.is-active').forEach((circle) => {
                    circle.classList.remove('is-active');
                });
                const pointIndex = plottedPoints.indexOf(point);
                chartGroup.querySelectorAll('.data-point')[pointIndex]?.classList.add('is-active');
                activePoint = point;
            }
        }

        function updateHoveredPoint(event) {
            const screenMatrix = svg.getScreenCTM();
            if (!screenMatrix) return;

            const pointer = svg.createSVGPoint();
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            const localPointer = pointer.matrixTransform(screenMatrix.inverse());
            let nearestPoint = null;
            let nearestDistance = Infinity;

            plottedPoints.forEach((point) => {
                const distance = Math.hypot(localPointer.x - point.x, localPointer.y - point.y);
                if (distance < nearestDistance) {
                    nearestPoint = point;
                    nearestDistance = distance;
                }
            });

            if (nearestPoint && nearestDistance <= hitRadius) {
                showTooltip(nearestPoint);
            } else if (!chartGroup.contains(document.activeElement)) {
                hideTooltip();
            }
        }

        svg.addEventListener('pointermove', updateHoveredPoint);
        svg.addEventListener('pointerdown', (event) => {
            if (event.pointerType !== 'mouse') updateHoveredPoint(event);
        });
        svg.addEventListener('pointerleave', () => {
            if (!chartGroup.contains(document.activeElement)) hideTooltip();
        });
    }

    // ==========================================
    // 11. LISTEN FOR FILTER CHANGES
    // ==========================================
    const timeFilter = document.getElementById('time-range-select');
    if (timeFilter) {
        timeFilter.addEventListener('change', (e) => {
            initConsumptionSummary(e.target.value);
        });
    }

    // --- INITIALIZE EVERYTHING ---
    startMeter();
    renderConsumptionChart(); 
    generateAIRecommendations(); 
    const refreshRecommendationsButton = document.getElementById('refresh-ai-recommendations');
    if (refreshRecommendationsButton) {
        refreshRecommendationsButton.addEventListener('click', generateAIRecommendations);
    }
    initConsumptionSummary('month'); 
    renderDailyCostChart();
    renderLineChart();
});
