/**
 * FinPulse — Frontend Application Logic
 * Handles API communication, Chart.js rendering, and DOM interactions.
 */

// ---------------------------------------------------------------------------
// Config — call backend directly on port 5000 (same host, different port)
// ---------------------------------------------------------------------------
const API = `http://${window.location.hostname}:5000/api`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let categoryChart = null;
let trendChart = null;
let topChart = null;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function getFilterParams() {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString() ? '?' + params.toString() : '';
}

async function apiFetch(path, opts = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
    }
    return res;
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------

async function loadSummary() {
    try {
        const res = await apiFetch(`/analytics/summary${getFilterParams()}`);
        const data = await res.json();
        document.getElementById('valIncome').textContent = formatCurrency(data.total_income);
        document.getElementById('valExpense').textContent = formatCurrency(data.total_expense);
        document.getElementById('valSavings').textContent = formatCurrency(data.net_savings);
        document.getElementById('valCount').textContent = data.transaction_count;

        // Animate values in
        document.querySelectorAll('.kpi-card__value').forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = 'fadeUp 0.5s ease';
        });
    } catch (e) {
        console.error('Failed to load summary:', e);
    }
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

// Shared Chart.js defaults
Chart.defaults.color = 'rgba(255,255,255,0.55)';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', sans-serif";

const CHART_COLORS = [
    '#00e5c7', '#7c3aed', '#f59e0b', '#f43f5e', '#38bdf8',
    '#a78bfa', '#34d399', '#fb923c', '#e879f9', '#fbbf24',
];

async function loadCategoryChart() {
    try {
        const res = await apiFetch(`/analytics/by-category${getFilterParams()}`);
        const data = await res.json();
        const labels = Object.keys(data.expense);
        const values = Object.values(data.expense);

        const ctx = document.getElementById('chartCategory').getContext('2d');

        if (categoryChart) categoryChart.destroy();

        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: CHART_COLORS.slice(0, labels.length),
                    borderWidth: 0,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 14,
                            usePointStyle: true,
                            pointStyleWidth: 8,
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(12,12,29,0.92)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
                        },
                    },
                },
            },
        });
    } catch (e) {
        console.error('Failed to load category chart:', e);
    }
}

async function loadTrendChart() {
    try {
        const res = await apiFetch('/analytics/monthly-trend');
        const data = await res.json();

        const ctx = document.getElementById('chartTrend').getContext('2d');

        if (trendChart) trendChart.destroy();

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Income',
                        data: data.income,
                        borderColor: '#00e5c7',
                        backgroundColor: 'rgba(0,229,199,0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: '#00e5c7',
                        pointHoverRadius: 6,
                    },
                    {
                        label: 'Expense',
                        data: data.expense,
                        borderColor: '#f43f5e',
                        backgroundColor: 'rgba(244,63,94,0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: '#f43f5e',
                        pointHoverRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            callback: v => formatCurrency(v),
                            font: { size: 10 },
                        },
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            usePointStyle: true,
                            padding: 16,
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(12,12,29,0.92)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                        },
                    },
                },
            },
        });
    } catch (e) {
        console.error('Failed to load trend chart:', e);
    }
}

async function loadTopChart() {
    try {
        const res = await apiFetch(`/analytics/top-expenses${getFilterParams()}`);
        const data = await res.json();

        const ctx = document.getElementById('chartTop').getContext('2d');

        if (topChart) topChart.destroy();

        topChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Amount',
                    data: data.amounts,
                    backgroundColor: CHART_COLORS.slice(0, data.labels.length).map(c => c + '88'),
                    borderColor: CHART_COLORS.slice(0, data.labels.length),
                    borderWidth: 1.5,
                    borderRadius: 6,
                    barPercentage: 0.65,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            callback: v => formatCurrency(v),
                            font: { size: 10 },
                        },
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(12,12,29,0.92)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (ctx) => ` ${formatCurrency(ctx.raw)}`,
                        },
                    },
                },
            },
        });
    } catch (e) {
        console.error('Failed to load top chart:', e);
    }
}

// ---------------------------------------------------------------------------
// Transaction Table
// ---------------------------------------------------------------------------

async function loadTransactions() {
    try {
        const res = await apiFetch(`/transactions${getFilterParams()}`);
        const data = await res.json();
        const tbody = document.getElementById('txnTableBody');
        const empty = document.getElementById('emptyState');

        tbody.innerHTML = '';

        if (data.length === 0) {
            empty.classList.add('visible');
            return;
        }

        empty.classList.remove('visible');

        data.forEach(txn => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${txn.date}</td>
                <td>${txn.description || '—'}</td>
                <td>${txn.category}</td>
                <td><span class="badge badge--${txn.type}">${txn.type}</span></td>
                <td class="col-amount col-amount--${txn.type}">${txn.type === 'expense' ? '-' : '+'}${formatCurrency(txn.amount)}</td>
                <td><button class="btn btn--danger" data-id="${txn.id}" title="Delete transaction">✕</button></td>
            `;
            tbody.appendChild(tr);
        });

        // Attach delete handlers
        tbody.querySelectorAll('.btn--danger').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Delete this transaction?')) return;
                try {
                    await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
                    showToast('Transaction deleted', 'success');
                    refreshAll();
                } catch (e) {
                    showToast(e.message, 'error');
                }
            });
        });
    } catch (e) {
        console.error('Failed to load transactions:', e);
    }
}

// ---------------------------------------------------------------------------
// Refresh all data
// ---------------------------------------------------------------------------

function refreshAll() {
    loadSummary();
    loadCategoryChart();
    loadTrendChart();
    loadTopChart();
    loadTransactions();
}

// ---------------------------------------------------------------------------
// Modal handling
// ---------------------------------------------------------------------------

function openModal(overlayId) {
    document.getElementById(overlayId).classList.add('active');
}
function closeModal(overlayId) {
    document.getElementById(overlayId).classList.remove('active');
}

// Add Transaction Modal
document.getElementById('btnAddTxn').addEventListener('click', () => {
    // Default date to today
    document.getElementById('txnDate').value = new Date().toISOString().split('T')[0];
    openModal('modalOverlay');
});
document.getElementById('btnCloseModal').addEventListener('click', () => closeModal('modalOverlay'));
document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('modalOverlay');
});

// Import Modal
document.getElementById('btnImport').addEventListener('click', () => openModal('importModalOverlay'));
document.getElementById('btnCloseImportModal').addEventListener('click', () => closeModal('importModalOverlay'));
document.getElementById('importModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('importModalOverlay');
});

// ---------------------------------------------------------------------------
// Form submission — Add Transaction
// ---------------------------------------------------------------------------

document.getElementById('txnForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        date: document.getElementById('txnDate').value,
        amount: parseFloat(document.getElementById('txnAmount').value),
        category: document.getElementById('txnCategory').value,
        type: document.getElementById('txnType').value,
        description: document.getElementById('txnDesc').value,
    };

    try {
        await apiFetch('/transactions', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        showToast('Transaction added!', 'success');
        closeModal('modalOverlay');
        e.target.reset();
        refreshAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ---------------------------------------------------------------------------
// Import submission
// ---------------------------------------------------------------------------

document.getElementById('btnSubmitImport').addEventListener('click', async () => {
    const raw = document.getElementById('importTextarea').value.trim();
    if (!raw) {
        showToast('Please paste JSON data', 'error');
        return;
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        showToast('Invalid JSON format', 'error');
        return;
    }

    try {
        const res = await apiFetch('/import', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const result = await res.json();
        showToast(`Imported ${result.imported} transactions`, 'success');
        if (result.errors.length > 0) {
            showToast(`${result.errors.length} entries had errors`, 'error');
        }
        closeModal('importModalOverlay');
        document.getElementById('importTextarea').value = '';
        refreshAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

document.getElementById('btnExport').addEventListener('click', async () => {
    try {
        const res = await fetch(API + '/export');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transactions_export.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Export downloaded!', 'success');
    } catch (err) {
        showToast('Export failed', 'error');
    }
});

// ---------------------------------------------------------------------------
// Date filter
// ---------------------------------------------------------------------------

document.getElementById('btnApplyFilter').addEventListener('click', () => refreshAll());
document.getElementById('btnClearFilter').addEventListener('click', () => {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    refreshAll();
});

// ---------------------------------------------------------------------------
// CSS animation keyframes (injected for KPI value pop)
// ---------------------------------------------------------------------------

const style = document.createElement('style');
style.textContent = `
@keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
}`;
document.head.appendChild(style);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

refreshAll();
