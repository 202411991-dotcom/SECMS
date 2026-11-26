// script/reports.js
document.addEventListener('DOMContentLoaded', () => {
    const historyListContainer = document.getElementById('history-list');
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    // ==========================================
    // 1. DYNAMIC SUMMARY CARDS
    // ==========================================
    function updateReportSummary() {
        const usageEl = document.getElementById('report-usage');
        const costEl = document.getElementById('report-cost');
        const vsLastEl = document.getElementById('report-vs-last');

        if (!usageEl || !loggedInUser) return;

        let meterData = JSON.parse(localStorage.getItem(`meterData_${loggedInUser.accountNumber}`));

        if (!meterData) {
            usageEl.textContent = 'N/A';
            costEl.textContent = '₱0.00';
            vsLastEl.textContent = '0%';
            return;
        }

        usageEl.textContent = `${meterData.kwhUsed.toFixed(2)} kWh`;
        costEl.textContent = `₱${meterData.estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const lastMonthUsage = meterData.kwhUsed * 0.95;
        let percentDiff = ((meterData.kwhUsed - lastMonthUsage) / lastMonthUsage) * 100;
        if (isNaN(percentDiff) || !isFinite(percentDiff)) percentDiff = 0;
        
        const isDown = percentDiff < 0;
        const arrow = isDown ? '↘' : '↗';
        const colorClass = isDown ? 'text-green' : 'text-red';
        
        vsLastEl.textContent = `${arrow} ${Math.abs(percentDiff).toFixed(0)}%`;
        vsLastEl.className = `card-value ${colorClass}`;
    }

    updateReportSummary();

    // ==========================================
    // 2. REPORT HISTORY GENERATION (FILTERED)
    // ==========================================
    function renderHistory() {
        if (!historyListContainer) return;

        let savedReports = JSON.parse(localStorage.getItem('energyReports')) || [];
        historyListContainer.innerHTML = '';

        // Get the currently selected month from the main form dropdown
        const selectedMonth = document.getElementById('report-month').value;

        // FILTER: Only show reports matching the selected month
        const filteredReports = savedReports.filter(r => r.month === selectedMonth);

        if (filteredReports.length === 0) {
            historyListContainer.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <p>No report found for <strong>${selectedMonth}</strong>.</p>
                    <p style="font-size: 13px; margin-top: 8px;">Use the form above to create one.</p>
                </div>
            `;
            return;
        }

        // Render the filtered reports
        const displayReports = [...filteredReports].reverse();

        displayReports.forEach((report, index) => {
            const iconClass = index % 2 === 0 ? 'bg-blue-light' : 'bg-purple-light';
            const iconEmoji = index % 2 === 0 ? '📊' : '📈';
            
            const reportEl = document.createElement('div');
            reportEl.className = 'history-item';
            
            reportEl.innerHTML = `
                <div class="history-icon ${iconClass}">${iconEmoji}</div>
                <div class="history-content">
                    <h4 class="history-title">${report.month} Energy Report</h4>
                    <p class="history-date">📅 Generated on: ${report.dateGenerated}</p>
                </div>
                
                <div class="history-stats">
                    <div class="stat-block">
                        <span class="stat-label">Usage</span>
                        <span class="stat-val">${report.usage} kWh</span>
                    </div>
                    <div class="stat-block">
                        <span class="stat-label">Cost</span>
                        <span class="stat-val">₱${report.cost}</span>
                    </div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="delete-icon-btn" data-id="${report.id}" style="background: none; border: none; color: #ef4444; font-size: 18px; cursor: pointer; padding: 8px;" title="Delete Report">🗑️</button>
                </div>
            `;
            historyListContainer.appendChild(reportEl);
        });

        document.querySelectorAll('.delete-icon-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const reportId = parseInt(this.getAttribute('data-id'));
                if (confirm("Are you sure you want to delete this report?")) {
                    deleteReport(reportId);
                }
            });
        });
    }

    // ==========================================
    // 3. DELETE LOGIC
    // ==========================================
    function deleteReport(reportId) {
        let savedReports = JSON.parse(localStorage.getItem('energyReports')) || [];
        const updatedReports = savedReports.filter(r => r.id !== reportId);
        localStorage.setItem('energyReports', JSON.stringify(updatedReports));
        renderHistory();
    }

    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            let savedReports = JSON.parse(localStorage.getItem('energyReports')) || [];
            if (savedReports.length === 0) {
                alert("There are no reports to delete.");
                return;
            }
            if (confirm("Are you sure you want to delete ALL reports?")) {
                localStorage.removeItem('energyReports');
                renderHistory();
            }
        });
    }

    // ==========================================
    // 4. LISTEN FOR DROPDOWN CHANGES
    // ==========================================
    const monthDropdown = document.getElementById('report-month');
    if (monthDropdown) {
        monthDropdown.addEventListener('change', () => {
            renderHistory();
        });
    }

    // ==========================================
    // 5. CREATE REPORT MODAL LOGIC
    // ==========================================
    const modal = document.getElementById('createReportModal');
    const createBtn = document.getElementById('create-report-btn');
    const closeBtn = document.getElementById('closeCreateModal');
    const saveBtn = document.getElementById('save-report-btn');

    // Inputs
    const prevInput = document.getElementById('create-prev');
    const presentInput = document.getElementById('create-present');
    const rateInput = document.getElementById('create-rate');
    const kwhUsedDisplay = document.getElementById('create-kwh-used');
    const estCostDisplay = document.getElementById('create-est-cost');

    // Live Calculation
    function calculateModalValues() {
        const prev = parseFloat(prevInput.value) || 0;
        const present = parseFloat(presentInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;

        let kwhUsed = present - prev;
        if (kwhUsed < 0) kwhUsed = 0;

        const estCost = kwhUsed * rate;

        kwhUsedDisplay.textContent = `${kwhUsed.toFixed(2)} kWh`;
        estCostDisplay.textContent = `₱${estCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (prevInput) prevInput.addEventListener('input', calculateModalValues);
    if (presentInput) presentInput.addEventListener('input', calculateModalValues);
    if (rateInput) rateInput.addEventListener('input', calculateModalValues);

    // Open Modal
    if (createBtn && modal) {
        createBtn.addEventListener('click', () => {
            modal.classList.add('show');

            // Auto-fill previous data
            if (loggedInUser) {
                let meterData = JSON.parse(localStorage.getItem(`meterData_${loggedInUser.accountNumber}`));
                if (meterData) {
                    prevInput.value = meterData.presentReading || '';
                    rateInput.value = meterData.totalRate || '';
                    presentInput.value = ''; // Reset present
                }
            }

            // Sync the modal month selector with the main form month selector
            const selectedMonth = document.getElementById('report-month').value;
            document.getElementById('create-month').value = selectedMonth;

            // Calculate immediately after autofill
            calculateModalValues();
        });
    }

    // Close Modal
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    }
    if (modal) {
        window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    }

    // Save Report
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const month = document.getElementById('create-month').value;
            const prev = parseFloat(prevInput.value);
            const present = parseFloat(presentInput.value);
            const rate = parseFloat(rateInput.value);

            if (isNaN(prev) || isNaN(present) || isNaN(rate)) {
                alert("Please fill in all fields correctly.");
                return;
            }

            const kwhUsed = Math.max(0, present - prev);
            const estCost = kwhUsed * rate;

            let savedReports = JSON.parse(localStorage.getItem('energyReports')) || [];
            
            if (savedReports.some(r => r.month === month)) {
                alert(`A report for ${month} already exists.`);
                return;
            }

            const newReport = {
                id: Date.now(),
                month: month,
                usage: kwhUsed.toFixed(2),
                cost: estCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                dateGenerated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            };

            savedReports.push(newReport);
            localStorage.setItem('energyReports', JSON.stringify(savedReports));

            modal.classList.remove('show');
            
            // Update the main form to select the newly created month so the user sees it
            document.getElementById('report-month').value = month;
            
            renderHistory();
            alert(`Report for ${month} saved successfully!`);
        });
    }

    // --- INITIALIZE ---
    renderHistory();
});