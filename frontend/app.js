// Dynamic API URL: 
// If running on localhost/127.0.0.1, keep using port 8000
// If running in production (Render), use relative path (empty string) because frontend is served by backend
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const API_URL = isLocal ? 'http://127.0.0.1:8000' : '';


// Store all massas for reference
let allMassas = [];
let filteredMassas = []; // Store current filtered view for export
let appSettings = {
    custom_columns: [],
    hidden_columns: [],
    column_order: ['id', 'nome', 'document_number', 'document_type', 'region', 'status', 'uc_counters', 'fat_counters', 'tags', 'actions']
};

// Selection Mode State
let isSelectionMode = false;
let selectedIds = new Set();

// Pagination State
let currentPage = 1;
let itemsPerPage = 25; // Default items per page
const itemsPerPageOptions = [10, 25, 50, 100];

// Column Definitions (Metadata for Rendering)
const COLUMN_DEFS = {
    id: { label: 'ID', filterType: 'text', width: '50px' },
    nome: { label: 'NOME', filterType: 'text' },
    document_number: { label: 'DOCUMENTO', filterType: 'text' },
    document_type: {
        label: 'TIPO',
        filterType: 'select',
        options: [{ value: 'CPF', label: 'CPF' }, { value: 'CNPJ', label: 'CNPJ' }]
    },
    region: {
        label: 'REGIÃO',
        filterType: 'select',
        options: [
            'Bahia', 'Brasília', 'Mato Grosso do Sul', 'Pernambuco', 'Rio Grande do Norte', 'São Paulo'
        ].map(r => ({ value: r, label: r }))
    },
    status: {
        label: 'STATUS TDM',
        filterType: 'select',
        options: [
            { value: 'AVAILABLE', label: 'Disponível' },
            { value: 'IN_USE', label: 'Em Uso' },
            { value: 'CONSUMED', label: 'Consumido' },
            { value: 'BLOCKED', label: 'Bloqueado' }
        ]
    },
    uc_counters: {
        label: 'STATUS UC',
        filterType: 'select',
        options: [
            { value: 'TEM_LIGADA', label: 'Com Ligada' },
            { value: 'TEM_DESLIGADA', label: 'Com Desligada' },
            { value: 'TEM_SUSPENSA', label: 'Com Suspensa' }
        ]
    },
    fat_counters: {
        label: 'FATURAS',
        filterType: 'select',
        options: [
            { value: 'TEM_VENCIDA', label: 'Com Vencida' },
            { value: 'TEM_A_VENCER', label: 'Com A Vencer' },
            { value: 'TEM_PAGA', label: 'Com Paga' },
            { value: 'TEM_BOLETO', label: 'Com Boleto Único' },
            { value: 'TEM_MULTI', label: 'Com Multifatura' },
            { value: 'TEM_RENEG', label: 'Com Renegociação' }
        ]
    },
    tags: { label: 'TAGS', filterType: 'text' },
    actions: { label: 'AÇÕES', filterType: null }
};

// ============ SETTINGS LOGIC ============
async function fetchSettings() {
    try {
        const response = await fetch(`${API_URL}/settings`);
        if (response.ok) {
            appSettings = await response.json();
            // Re-render table and modal fields when settings change
            updateDynamicInterface();
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
    }
}

async function saveSettings(settings) {
    try {
        const response = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (response.ok) {
            appSettings = await response.json();
            updateDynamicInterface();
            showToast('Configurações salvas!', 'success');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Erro ao salvar configurações', 'error');
    }
}

function updateDynamicInterface() {
    // 1. Update Table Headers & Filters (delegate to renderHeaders for dynamic order)
    renderHeaders();

    // 2. Update Edit/View Modal Fields
    updateModalFields();

    // 3. Update Admin List
    renderAdminColumnsList();

    // 4. Re-render data
    renderTable(allMassas);

    if (window.lucide) lucide.createIcons();
}

function updateModalFields() {

    // Let's create a specific container in Geral for now, OR add a new tab dynamically?
    // Adding to Geral is easier for valid HTML structure
    const formGrid = document.querySelector('#tab-geral .form-grid');
    formGrid.querySelectorAll('.dynamic-field').forEach(el => el.remove());

    appSettings.custom_columns.forEach(col => {
        const div = document.createElement('div');
        div.className = 'input-group dynamic-field';

        let inputType = 'text';
        if (col.type === 'number') inputType = 'number';
        if (col.type === 'date') inputType = 'date';

        if (col.type === 'tag') {
            div.innerHTML = `
                <label>${col.name} <small style="color: #666;">(separar por vírgula)</small></label>
                <input type="text" id="edit-custom-${col.key}" placeholder="${col.name}">
            `;
        } else {
            div.innerHTML = `
                <label>${col.name}</label>
                <input type="${inputType}" id="edit-custom-${col.key}" placeholder="${col.name}">
            `;
        }
        formGrid.appendChild(div);
    });
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    if (window.lucide) lucide.createIcons({ root: toast });

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ COLUMN FILTER FUNCTIONS ============
function applyColumnFilters() {
    const filterId = document.getElementById('col-filter-id')?.value.toLowerCase();
    const filterNome = document.getElementById('col-filter-nome')?.value.toLowerCase();
    const filterDoc = document.getElementById('col-filter-doc')?.value.toLowerCase();
    const filterType = document.getElementById('col-filter-type')?.value;
    const filterRegion = document.getElementById('col-filter-region')?.value;
    const filterStatus = document.getElementById('col-filter-status')?.value;
    const filterUc = document.getElementById('col-filter-uc')?.value;
    const filterFaturas = document.getElementById('col-filter-faturas')?.value;
    const filterTags = document.getElementById('col-filter-tags')?.value.toLowerCase();

    const filtered = allMassas.filter(massa => {
        // ID filter (text search)
        if (filterId && !String(massa.id).includes(filterId)) return false;

        // Name filter (text search)
        if (filterNome && !(massa.nome || '').toLowerCase().includes(filterNome)) return false;

        // Document filter (text search)
        if (filterDoc && !massa.document_number.toLowerCase().includes(filterDoc)) return false;

        // Type filter (exact match)
        if (filterType && massa.document_type !== filterType) return false;

        // Region filter (exact match)
        if (filterRegion && massa.region !== filterRegion) return false;

        // Status filter (exact match)
        if (filterStatus && massa.status !== filterStatus) return false;

        // UC filter - filter by presence of UC type
        if (filterUc) {
            if (filterUc === 'TEM_LIGADA' && (massa.uc_ligada || 0) <= 0) return false;
            if (filterUc === 'TEM_DESLIGADA' && (massa.uc_desligada || 0) <= 0) return false;
            if (filterUc === 'TEM_SUSPENSA' && (massa.uc_suspensa || 0) <= 0) return false;
        }

        // Faturas filter - filter by presence of invoice type
        if (filterFaturas) {
            if (filterFaturas === 'TEM_VENCIDA' && (massa.fat_vencidas || 0) <= 0) return false;
            if (filterFaturas === 'TEM_A_VENCER' && (massa.fat_a_vencer || 0) <= 0) return false;
            if (filterFaturas === 'TEM_PAGA' && (massa.fat_pagas || 0) <= 0) return false;
            if (filterFaturas === 'TEM_BOLETO_UNICO' && (massa.fat_boleto_unico || 0) <= 0) return false;
            if (filterFaturas === 'TEM_MULTIFATURAS' && (massa.fat_multifaturas || 0) <= 0) return false;
            if (filterFaturas === 'TEM_RENEGOCIACAO' && (massa.fat_renegociacao || 0) <= 0) return false;
        }

        // Tags filter (text search)
        if (filterTags) {
            const tagsStr = (massa.tags || []).join(' ').toLowerCase();
            if (!tagsStr.includes(filterTags)) return false;
        }

        // Custom column filters
        const customFilterInputs = document.querySelectorAll('.dynamic-col-filter input[data-key]');
        for (const input of customFilterInputs) {
            const key = input.dataset.key;
            const filterValue = input.value.toLowerCase();
            if (filterValue && !String((massa.metadata_info || {})[key] || '').toLowerCase().includes(filterValue)) {
                return false;
            }
        }

        return true;
    });

    filteredMassas = filtered; // Update global filtered state
    renderTable(filtered);
}

function clearColumnFilters() {
    document.getElementById('col-filter-id').value = '';
    document.getElementById('col-filter-nome').value = '';
    document.getElementById('col-filter-doc').value = '';
    document.getElementById('col-filter-type').value = '';
    document.getElementById('col-filter-region').value = '';
    document.getElementById('col-filter-status').value = '';
    document.getElementById('col-filter-uc').value = '';
    document.getElementById('col-filter-tags').value = '';

    // Clear custom column filters
    document.querySelectorAll('.dynamic-col-filter input[data-key]').forEach(input => input.value = '');
    renderTable(allMassas);
}

// ============ DASHBOARD & CHARTS ============
let statusChart = null;
let regionChart = null;

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    // Safety check for non-numeric start/end
    if (isNaN(start)) start = 0;
    if (isNaN(end)) end = 0;

    if (start === end) {
        obj.innerText = end;
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateDashboard(massas) {
    const total = massas.length;
    const available = massas.filter(m => m.status === 'AVAILABLE').length;
    const overdue = massas.filter(m => (m.fat_vencidas || 0) > 0).length; // Helper needed or use logic
    const inUse = massas.filter(m => m.status === 'IN_USE').length;

    // We need hasOverdueInvoice logic if not already available, or just check tags?
    // Let's rely on tags for consistency if possible, or re-implement check.
    // Actually, let's use the same logic as filter:
    const countOverdue = massas.filter(m => (m.fat_vencidas || 0) > 0).length;

    animateValue("dash-total", parseInt(document.getElementById("dash-total").innerText), total, 1000);
    animateValue("dash-available", parseInt(document.getElementById("dash-available").innerText), available, 1000);
    animateValue("dash-overdue", parseInt(document.getElementById("dash-overdue").innerText), countOverdue, 1000);
    animateValue("dash-inuse", parseInt(document.getElementById("dash-inuse").innerText), inUse, 1000);

    renderCharts(massas);
}

// Helper for chart labels
function getStatusLabel(status) {
    const translations = {
        'AVAILABLE': 'Disponível',
        'IN_USE': 'Em Uso',
        'CONSUMED': 'Consumido',
        'BLOCKED': 'Bloqueado'
    };
    return translations[status] || status;
}

function renderCharts(massas) {
    if (!massas) return;

    // Initialize counters
    const statusCounts = {};
    const regionCounts = {};
    const docCounts = {};
    let ucLigada = 0, ucDesligada = 0, ucSuspensa = 0;
    let fatVencida = 0, fatAVencer = 0, fatPaga = 0;
    let fatBoleto = 0, fatMulti = 0, fatReneg = 0;

    // SINGLE LOOP FOR ALL METRICS
    massas.forEach(m => {
        // 1. Status
        statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;

        // 2. Region
        const r = m.region || 'Outros';
        regionCounts[r] = (regionCounts[r] || 0) + 1;

        // 3. Doc Type
        const type = m.document_type || 'OUTRO';
        docCounts[type] = (docCounts[type] || 0) + 1;

        // 4. UC Status
        ucLigada += m.uc_ligada || 0;
        ucDesligada += m.uc_desligada || 0;
        ucSuspensa += m.uc_suspensa || 0;

        // 5. Invoice Status
        fatVencida += m.fat_vencidas || 0;
        fatAVencer += m.fat_a_vencer || 0;
        fatPaga += m.fat_pagas || 0;
        if (m.fat_boleto_unico > 0) fatBoleto++;
        if (m.fat_multifaturas > 0) fatMulti++;
        if (m.fat_renegociacao > 0) fatReneg++;
    });

    // 1. Status Chart
    const statusOrder = ['AVAILABLE', 'IN_USE', 'CONSUMED', 'BLOCKED'];
    const statusLabels = statusOrder.map(s => getStatusLabel(s));
    const statusData = statusOrder.map(s => statusCounts[s] || 0);

    const ctxStatus = document.getElementById('chart-status');
    if (ctxStatus) {
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusData,
                    backgroundColor: [
                        'rgba(4, 211, 97, 0.6)', 'rgba(255, 205, 30, 0.6)',
                        'rgba(247, 90, 104, 0.6)', '#8257e5'
                    ],
                    borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#a8a8b3' } } }
            }
        });
    }

    // 2. Region Chart
    const ctxRegion = document.getElementById('chart-region');
    if (ctxRegion) {
        if (regionChart) regionChart.destroy();
        const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
        regionChart = new Chart(ctxRegion, {
            type: 'bar',
            data: {
                labels: sortedRegions.map(i => i[0]),
                datasets: [{
                    label: 'Massas', data: sortedRegions.map(i => i[1]),
                    backgroundColor: '#8257e5', borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#323238' }, ticks: { color: '#a8a8b3' } },
                    x: { grid: { display: false }, ticks: { color: '#a8a8b3' } }
                }
            }
        });
    }

    // 3. Doc Type Chart
    const ctxDoc = document.getElementById('chart-doc-type');
    if (ctxDoc) {
        if (window.docChart) window.docChart.destroy();
        window.docChart = new Chart(ctxDoc, {
            type: 'pie',
            data: {
                labels: Object.keys(docCounts),
                datasets: [{
                    data: Object.values(docCounts),
                    backgroundColor: ['#3b82f6', '#f97316', '#a855f7'],
                    borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#a8a8b3' } } }
            }
        });
    }

    // 4. UC Status Chart
    const ctxUc = document.getElementById('chart-uc');
    if (ctxUc) {
        if (window.ucChart) window.ucChart.destroy();
        window.ucChart = new Chart(ctxUc, {
            type: 'bar',
            data: {
                labels: ['Ligada', 'Desligada', 'Suspensa'],
                datasets: [{
                    label: 'Quantidade',
                    data: [ucLigada, ucDesligada, ucSuspensa],
                    backgroundColor: ['#04d361', '#f75a68', '#ffcd1e'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#323238' }, ticks: { color: '#a8a8b3' } },
                    x: { grid: { display: false }, ticks: { color: '#a8a8b3' } }
                }
            }
        });
    }

    // 5. Invoice Chart
    const ctxFat = document.getElementById('chart-fat');
    if (ctxFat) {
        if (window.fatChart) window.fatChart.destroy();
        window.fatChart = new Chart(ctxFat, {
            type: 'bar',
            data: {
                labels: ['Vencida', 'A Vencer', 'Paga', 'Boleto Único', 'Multifatura', 'Renegociação'],
                datasets: [{
                    label: 'Quantidade',
                    data: [fatVencida, fatAVencer, fatPaga, fatBoleto, fatMulti, fatReneg],
                    backgroundColor: ['#f75a68', '#ffcd1e', '#04d361', '#8257e5', '#3b82f6', '#2dd4bf'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#323238' }, ticks: { color: '#a8a8b3' } },
                    x: { grid: { display: false }, ticks: { color: '#a8a8b3' } }
                }
            }
        });
    }
}

function toggleLoading(show) {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = show ? 'flex' : 'none';
}

async function fetchMassas() {
    toggleLoading(true);
    try {
        const response = await fetch(`${API_URL}/massas/`);
        const data = await response.json();
        allMassas = data;
        applyColumnFilters(); // Apply any active column filters
        updateDashboard(allMassas); // Update dashboard stats
    } catch (error) {
        console.error('Error fetching massas:', error);
        showToast('Erro ao conectar com servidor', 'error');
    } finally {
        toggleLoading(false);
    }
}


// Translate status to Portuguese
function translateStatus(status) {
    const translations = {
        'AVAILABLE': 'Disponível',
        'IN_USE': 'Em Uso',
        'CONSUMED': 'Consumido',
        'BLOCKED': 'Bloqueado'
    };
    return translations[status] || status;
}

function maskDocument(docNumber, docType) {
    if (!docNumber) return '-';
    if (docType === 'CPF') {
        return docNumber.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (docType === 'CNPJ') {
        return docNumber.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return docNumber;
}

// ============ SELECTION MODE ============

function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    selectedIds.clear();

    const btn = document.getElementById('selection-mode-btn');
    const selectionBar = document.getElementById('selection-bar');

    if (btn) {
        btn.classList.toggle('active', isSelectionMode);
        btn.style.background = isSelectionMode ? 'var(--primary)' : '';
    }

    // Show/hide the existing selection bar from HTML
    if (selectionBar) {
        selectionBar.style.display = isSelectionMode ? 'flex' : 'none';
        // Update the selection bar with better buttons if needed
        if (isSelectionMode) {
            updateSelectionBarContent();
        }
    }

    // Re-render table to show/hide checkboxes
    renderHeaders();
    renderTable(filteredMassas.length > 0 ? filteredMassas : allMassas);

    updateBulkActionsBar();
}

function updateSelectionBarContent() {
    const selectionBar = document.getElementById('selection-bar');
    if (!selectionBar) return;

    selectionBar.style.cssText = `
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 20px;
        background: linear-gradient(135deg, var(--primary), #a855f7);
        border-radius: 12px;
        margin-bottom: 15px;
        color: white;
        box-shadow: 0 4px 15px rgba(130, 87, 229, 0.3);
    `;

    selectionBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="check-square" style="width: 20px; height: 20px;"></i>
            <span id="selected-count" style="font-weight: 600;">0 selecionados</span>
        </div>
        <div style="flex: 1;"></div>
        <button class="btn" onclick="bulkChangeStatus('AVAILABLE')" style="background: var(--success); border: none; padding: 8px 14px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; color: white;" title="Marcar selecionadas como Disponível">
            <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Disponível
        </button>
        <button class="btn" onclick="bulkChangeStatus('IN_USE')" style="background: var(--warning); border: none; padding: 8px 14px; font-size: 0.85rem; color: #000; border-radius: 6px; cursor: pointer;" title="Marcar selecionadas como Em Uso">
            <i data-lucide="clock" style="width: 14px; height: 14px;"></i> Em Uso
        </button>
        <button class="btn" onclick="bulkChangeStatus('BLOCKED')" style="background: var(--danger); border: none; padding: 8px 14px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; color: white;" title="Marcar selecionadas como Bloqueado">
            <i data-lucide="x-circle" style="width: 14px; height: 14px;"></i> Bloqueado
        </button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.3);"></div>
        <button class="btn" onclick="bulkDelete()" style="background: rgba(255,255,255,0.2); border: 1px solid white; padding: 8px 14px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; color: white;" title="Excluir massas selecionadas">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Excluir Selecionadas
        </button>
        <button class="btn" onclick="deleteAllMassas()" style="background: var(--danger); border: none; padding: 8px 14px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; color: white;" title="⚠️ Excluir TODAS as massas do banco">
            <i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Excluir TODAS
        </button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.3);"></div>
        <button class="btn" onclick="toggleSelectionMode()" style="background: rgba(255,255,255,0.2); border: none; padding: 8px 14px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; color: white;">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i> Cancelar
        </button>
    `;

    if (window.lucide) lucide.createIcons();
}

function toggleRowSelection(id, checked) {
    if (checked) {
        selectedIds.add(id);
    } else {
        selectedIds.delete(id);
    }
    updateBulkActionsBar();
}

function toggleSelectAll(checked) {
    const currentData = filteredMassas.length > 0 ? filteredMassas : allMassas;
    if (checked) {
        currentData.forEach(m => selectedIds.add(m.id));
    } else {
        selectedIds.clear();
    }
    // Update all checkboxes
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateBulkActionsBar();
}

function createBulkActionsBar() {
    if (document.getElementById('bulk-actions-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'bulk-actions-bar';
    bar.style.cssText = `
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 20px;
        background: linear-gradient(135deg, var(--primary), #a855f7);
        border-radius: 12px;
        margin-bottom: 15px;
        color: white;
        box-shadow: 0 4px 15px rgba(130, 87, 229, 0.3);
    `;

    bar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="check-square" style="width: 20px; height: 20px;"></i>
            <span id="selected-count" style="font-weight: 600;">0 selecionados</span>
        </div>
        <div style="flex: 1;"></div>
        <button class="btn" onclick="bulkChangeStatus('AVAILABLE')" style="background: var(--success); border: none; padding: 8px 14px; font-size: 0.85rem;" title="Marcar selecionadas como Disponível">
            <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Disponível
        </button>
        <button class="btn" onclick="bulkChangeStatus('IN_USE')" style="background: var(--warning); border: none; padding: 8px 14px; font-size: 0.85rem; color: #000;" title="Marcar selecionadas como Em Uso">
            <i data-lucide="clock" style="width: 14px; height: 14px;"></i> Em Uso
        </button>
        <button class="btn" onclick="bulkChangeStatus('BLOCKED')" style="background: var(--danger); border: none; padding: 8px 14px; font-size: 0.85rem;" title="Marcar selecionadas como Bloqueado">
            <i data-lucide="x-circle" style="width: 14px; height: 14px;"></i> Bloqueado
        </button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.3);"></div>
        <button class="btn" onclick="bulkDelete()" style="background: rgba(255,255,255,0.2); border: 1px solid white; padding: 8px 14px; font-size: 0.85rem;" title="Excluir massas selecionadas">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Excluir Selecionadas
        </button>
        <button class="btn" onclick="deleteAllMassas()" style="background: var(--danger); border: none; padding: 8px 14px; font-size: 0.85rem;" title="⚠️ Excluir TODAS as massas do banco">
            <i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Excluir TODAS
        </button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.3);"></div>
        <button class="btn" onclick="toggleSelectionMode()" style="background: rgba(255,255,255,0.2); border: none; padding: 8px 14px; font-size: 0.85rem;">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i> Cancelar
        </button>
    `;

    const tableCard = document.querySelector('.table-card');
    if (tableCard) {
        tableCard.insertBefore(bar, tableCard.firstChild);
    }

    if (window.lucide) lucide.createIcons();
}

function updateBulkActionsBar() {
    const countEl = document.getElementById('selected-count');
    if (countEl) {
        const count = selectedIds.size;
        countEl.textContent = `${count} selecionado${count !== 1 ? 's' : ''}`;
    }
}

async function bulkChangeStatus(newStatus) {
    if (selectedIds.size === 0) {
        showToast('Nenhum item selecionado', 'warning');
        return;
    }

    const statusPt = translateStatus(newStatus);
    if (!confirm(`Alterar ${selectedIds.size} item(s) para "${statusPt}"?`)) return;

    toggleLoading(true);
    let success = 0, errors = 0;

    for (const id of selectedIds) {
        try {
            await fetch(`${API_URL}/massas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            success++;
        } catch (e) {
            errors++;
        }
    }

    toggleLoading(false);
    showToast(`${success} item(s) atualizados${errors > 0 ? `, ${errors} erro(s)` : ''}`, errors > 0 ? 'warning' : 'success');

    selectedIds.clear();
    await fetchMassas();
    updateBulkActionsBar();
}

async function bulkDelete() {
    if (selectedIds.size === 0) {
        showToast('Nenhum item selecionado', 'warning');
        return;
    }

    if (!confirm(`Excluir permanentemente ${selectedIds.size} item(s)?`)) return;

    toggleLoading(true);
    let success = 0, errors = 0;

    for (const id of selectedIds) {
        try {
            await fetch(`${API_URL}/massas/${id}`, { method: 'DELETE' });
            success++;
        } catch (e) {
            errors++;
        }
    }

    toggleLoading(false);
    showToast(`${success} item(s) excluídos${errors > 0 ? `, ${errors} erro(s)` : ''}`, errors > 0 ? 'warning' : 'success');

    selectedIds.clear();
    await fetchMassas();
    updateBulkActionsBar();
}

// ============ COLUMN MANAGEMENT (Drag & Drop + Visibility) ============

let draggedCol = null;

function renderHeaders() {
    const thead = document.querySelector('.data-table thead');
    thead.innerHTML = '';

    // Ensure column_order exists (backwards compatibility)
    if (!appSettings.column_order || appSettings.column_order.length === 0) {
        appSettings.column_order = Object.keys(COLUMN_DEFS);
        // Append custom columns if not present
        appSettings.custom_columns.forEach(c => {
            if (!appSettings.column_order.includes(c.key)) appSettings.column_order.splice(appSettings.column_order.length - 2, 0, c.key); // Insert before tags/actions
        });
    }

    // Filter visible columns
    const visibleCols = appSettings.column_order.filter(key => !appSettings.hidden_columns.includes(key));

    // 1. Title Row
    const trTitle = document.createElement('tr');

    // Add checkbox column if selection mode is active
    if (isSelectionMode) {
        const thCheckbox = document.createElement('th');
        thCheckbox.style.width = '40px';
        thCheckbox.innerHTML = `<input type="checkbox" onchange="toggleSelectAll(this.checked)" title="Selecionar todos" style="width: 18px; height: 18px; cursor: pointer;">`;
        trTitle.appendChild(thCheckbox);
    }

    visibleCols.forEach(key => {
        const th = document.createElement('th');
        th.draggable = true;
        th.dataset.key = key;

        let label = '';
        if (COLUMN_DEFS[key]) {
            label = COLUMN_DEFS[key].label;
        } else {
            const custom = appSettings.custom_columns.find(c => c.key === key);
            label = custom ? custom.name.toUpperCase() : key;
            th.classList.add('dynamic-col');
        }

        th.textContent = label;
        th.style.cursor = 'move';

        // Drag Events
        th.addEventListener('dragstart', handleDragStart);
        th.addEventListener('dragover', handleDragOver);
        th.addEventListener('drop', handleDrop);
        th.addEventListener('dragend', handleDragEnd);

        trTitle.appendChild(th);
    });
    thead.appendChild(trTitle);

    // 2. Filter Row
    const trFilter = document.createElement('tr');
    trFilter.classList.add('filter-row');

    // Add empty cell for checkbox column if selection mode
    if (isSelectionMode) {
        const emptyTh = document.createElement('th');
        trFilter.appendChild(emptyTh);
    }

    visibleCols.forEach(key => {
        const th = document.createElement('th');
        let def = COLUMN_DEFS[key];

        // Handle Custom Cols (assume text filter for now, or match type)
        if (!def) {
            const custom = appSettings.custom_columns.find(c => c.key === key);
            if (custom) {
                // Map custom types to filter types
                const fType = custom.type === 'tag' || custom.type === 'text' ? 'text' : null;
                def = { filterType: fType };
            } else {
                def = { filterType: null };
            }
        }

        if (def.filterType === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `col-filter-${key}`;
            input.dataset.key = key; // For custom filters
            if (!COLUMN_DEFS[key]) input.classList.add('dynamic-col-filter'); // Mark as custom

            input.placeholder = 'Filtrar...';
            if (key === 'id') { input.placeholder = 'ID'; input.style.width = '50px'; }
            if (key === 'nome') input.placeholder = 'Nome...';
            input.onkeyup = applyColumnFilters;
            th.appendChild(input);
        } else if (def.filterType === 'select') {
            const select = document.createElement('select');
            select.id = `col-filter-${key}`;
            select.onchange = applyColumnFilters;

            const optAll = document.createElement('option');
            optAll.value = '';
            optAll.textContent = key === 'region' ? 'Todas' : 'Todos';
            select.appendChild(optAll);

            if (def.options) {
                def.options.forEach(opt => {
                    const el = document.createElement('option');
                    el.value = opt.value;
                    el.textContent = opt.label;
                    select.appendChild(el);
                });
            }
            th.appendChild(select);
        }

        trFilter.appendChild(th);
    });
    thead.appendChild(trFilter);
}

function handleDragStart(e) {
    draggedCol = e.target.dataset.key;
    e.target.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCol); // Required for Firefox
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('th').forEach(th => th.classList.remove('drag-over'));
}

async function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    const targetKey = e.target.closest('th').dataset.key;
    if (draggedCol && targetKey && draggedCol !== targetKey) {
        // Reorder array
        const oldIndex = appSettings.column_order.indexOf(draggedCol);
        const newIndex = appSettings.column_order.indexOf(targetKey);

        if (oldIndex > -1 && newIndex > -1) {
            appSettings.column_order.splice(oldIndex, 1);
            appSettings.column_order.splice(newIndex, 0, draggedCol);

            // Save settings (optional, or wait for explicit save)
            await saveSettings(appSettings); // Save immediately for UX

            renderHeaders();
            renderTable(allMassas); // Re-render body in new order
        }
    }
    return false;
}

// ============ COLUMN VISIBILITY MODAL ============
function toggleColumnsModal() {
    let modal = document.getElementById('columns-modal');
    if (!modal) {
        createColumnsModal();
        modal = document.getElementById('columns-modal');
    }
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    if (modal.style.display === 'flex') {
        renderColumnsList();
    }
}

function createColumnsModal() {
    const div = document.createElement('div');
    div.id = 'columns-modal';
    // Add proper overlay inline styles with animation
    div.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease;
    `;
    div.onclick = (e) => { if (e.target === div) toggleColumnsModal(); };

    div.innerHTML = `
        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .col-toggle-item:hover { background: var(--bg-card) !important; transform: translateY(-1px); }
            .col-toggle-item.active { border-color: var(--primary) !important; background: rgba(130, 87, 229, 0.1) !important; }
            .toggle-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
            .toggle-switch input { opacity: 0; width: 0; height: 0; }
            .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--border-color); border-radius: 24px; transition: 0.3s; }
            .toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
            .toggle-switch input:checked + .toggle-slider { background: var(--primary); }
            .toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }
            .cols-search-input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(130, 87, 229, 0.15); }
        </style>
        <div style="background: var(--bg-card); border-radius: 16px; max-width: 600px; width: 95%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6); border: 1px solid var(--border-color); animation: slideUp 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), #a855f7); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="columns" style="width: 20px; height: 20px; color: white;"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-size: 1.2rem; font-weight: 600;">Gerenciar Colunas</h2>
                        <p id="cols-counter" style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">0 de 0 colunas visíveis</p>
                    </div>
                </div>
                <button onclick="toggleColumnsModal()" style="background: var(--bg-dark); border: 1px solid var(--border-color); cursor: pointer; padding: 10px; border-radius: 8px; color: var(--text-primary); transition: all 0.2s;" onmouseover="this.style.background='var(--danger)'" onmouseout="this.style.background='var(--bg-dark)'">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
            <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); background: var(--bg-dark);">
                <div style="position: relative;">
                    <i data-lucide="search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--text-secondary);"></i>
                    <input type="text" id="cols-search" class="cols-search-input" placeholder="Buscar colunas..." oninput="filterColumnsList(this.value)" style="width: 100%; padding: 12px 14px 12px 44px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-card); color: var(--text-primary); font-size: 0.95rem; transition: all 0.2s; box-sizing: border-box;">
                </div>
            </div>
            <div style="padding: 0; overflow: hidden; flex: 1;">
                <div id="cols-list" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 20px 24px; max-height: 380px; overflow-y: auto;">
                    <!-- Checkboxes injected here -->
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--border-color); background: var(--bg-dark);">
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="selectAllColumns()" style="display: flex; align-items: center; gap: 6px; padding: 10px 14px; font-size: 0.85rem;">
                        <i data-lucide="eye" style="width: 16px; height: 16px;"></i> Mostrar Todas
                    </button>
                    <button class="btn btn-secondary" onclick="hideAllColumns()" style="display: flex; align-items: center; gap: 6px; padding: 10px 14px; font-size: 0.85rem;">
                        <i data-lucide="eye-off" style="width: 16px; height: 16px;"></i> Ocultar Todas
                    </button>
                </div>
                <button class="btn btn-primary" onclick="toggleColumnsModal()" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px;">
                    <i data-lucide="check" style="width: 16px; height: 16px;"></i> Concluído
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
    if (window.lucide) lucide.createIcons();
}

function selectAllColumns() {
    appSettings.hidden_columns = [];
    saveSettings(appSettings);
    renderHeaders();
    renderTable(filteredMassas.length > 0 ? filteredMassas : allMassas);
    renderColumnsList();
}

function hideAllColumns() {
    // Hide all except 'actions' (always keep actions visible)
    const allKeys = [...Object.keys(COLUMN_DEFS), ...appSettings.custom_columns.map(c => c.key)];
    appSettings.hidden_columns = allKeys.filter(k => k !== 'actions');
    saveSettings(appSettings);
    renderHeaders();
    renderTable(filteredMassas.length > 0 ? filteredMassas : allMassas);
    renderColumnsList();
}

function filterColumnsList(query) {
    const items = document.querySelectorAll('#cols-list .col-toggle-item');
    const q = query.toLowerCase().trim();
    items.forEach(item => {
        const label = item.querySelector('.col-label').textContent.toLowerCase();
        item.style.display = label.includes(q) ? 'flex' : 'none';
    });
}

function renderColumnsList() {
    const list = document.getElementById('cols-list');
    if (!list) return;

    let html = '';
    const allKeys = [...Object.keys(COLUMN_DEFS), ...appSettings.custom_columns.map(c => c.key)];
    const visibleCount = allKeys.filter(k => !(appSettings.hidden_columns || []).includes(k)).length;

    // Update counter
    const counter = document.getElementById('cols-counter');
    if (counter) counter.textContent = `${visibleCount} de ${allKeys.length} colunas visíveis`;

    // Standard Columns
    Object.keys(COLUMN_DEFS).forEach(key => {
        const def = COLUMN_DEFS[key];
        const isHidden = (appSettings.hidden_columns || []).includes(key);
        html += `
            <label class="col-toggle-item ${!isHidden ? 'active' : ''}" style="display: flex; align-items: center; gap: 14px; background: var(--bg-dark); padding: 14px 16px; border-radius: 12px; cursor: pointer; border: 2px solid ${!isHidden ? 'var(--primary)' : 'var(--border-color)'}; transition: all 0.25s ease;">
                <label class="toggle-switch">
                    <input type="checkbox" ${!isHidden ? 'checked' : ''} onchange="toggleColumnVisibility('${key}')">
                    <span class="toggle-slider"></span>
                </label>
                <span class="col-label" style="font-weight: 500; flex: 1;">${def.label}</span>
                ${key === 'actions' ? '<span style="background: var(--warning); color: #000; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 600;">FIXO</span>' : ''}
            </label>
        `;
    });

    // Custom Columns
    appSettings.custom_columns.forEach(col => {
        const isHidden = (appSettings.hidden_columns || []).includes(col.key);
        html += `
            <label class="col-toggle-item ${!isHidden ? 'active' : ''}" style="display: flex; align-items: center; gap: 14px; background: var(--bg-dark); padding: 14px 16px; border-radius: 12px; cursor: pointer; border: 2px solid ${!isHidden ? 'var(--primary)' : 'var(--border-color)'}; transition: all 0.25s ease;">
                <label class="toggle-switch">
                    <input type="checkbox" ${!isHidden ? 'checked' : ''} onchange="toggleColumnVisibility('${col.key}')">
                    <span class="toggle-slider"></span>
                </label>
                <span class="col-label" style="font-weight: 500; flex: 1;">${col.name.toUpperCase()}</span>
                <span style="background: linear-gradient(135deg, var(--primary), #a855f7); color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 600;">CUSTOM</span>
            </label>
        `;
    });

    list.innerHTML = html;
}

async function toggleColumnVisibility(key) {
    const hidden = appSettings.hidden_columns || [];
    const index = hidden.indexOf(key);

    if (index === -1) {
        hidden.push(key); // Hide it
    } else {
        hidden.splice(index, 1); // Show it
    }
    appSettings.hidden_columns = hidden;

    await saveSettings(appSettings);
    renderHeaders();
    renderTable(filteredMassas.length > 0 ? filteredMassas : allMassas);
    renderColumnsList(); // Refresh checkboxes
}

function renderTable(massas) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    // Pagination: Calculate total pages and slice data
    const totalItems = massas.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Ensure currentPage is within valid range
    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedMassas = massas.slice(startIndex, endIndex);

    // Render pagination controls
    renderPaginationControls(totalItems, totalPages);

    paginatedMassas.forEach(massa => {
        const tr = document.createElement('tr');
        const isChecked = selectedIds.has(massa.id);
        const statusPt = translateStatus(massa.status);

        // Build UC tags with counts
        // Build UC tags with counts (Semi-Compact Mode - Icon + Count + Label)
        const ucTags = [];
        if (massa.uc_ligada > 0) {
            ucTags.push(`<span class="mini-tag tag-uc-ligada" title="Ligada"><i data-lucide="zap"></i> ${massa.uc_ligada} Ligada${massa.uc_ligada > 1 ? 's' : ''}</span>`);
        }
        if (massa.uc_desligada > 0) {
            ucTags.push(`<span class="mini-tag tag-uc-desligada" title="Desligada"><i data-lucide="power-off"></i> ${massa.uc_desligada} Desligada${massa.uc_desligada > 1 ? 's' : ''}</span>`);
        }
        if (massa.uc_suspensa > 0) {
            ucTags.push(`<span class="mini-tag tag-uc-suspensa" title="Suspensa"><i data-lucide="alert-triangle"></i> ${massa.uc_suspensa} Suspensa${massa.uc_suspensa > 1 ? 's' : ''}</span>`);
        }
        const ucDisplay = ucTags.length > 0 ? ucTags.join(' ') : '-';

        // Build Invoice tags with counts (Semi-Compact Mode - Icon + Count + Label)
        const fatTags = [];
        if (massa.fat_vencidas > 0) {
            fatTags.push(`<span class="mini-tag tag-fat-vencida" title="Vencida"><i data-lucide="alert-circle"></i> ${massa.fat_vencidas} Vencida${massa.fat_vencidas > 1 ? 's' : ''}</span>`);
        }
        if (massa.fat_a_vencer > 0) {
            fatTags.push(`<span class="mini-tag tag-fat-a-vencer" title="A Vencer"><i data-lucide="clock"></i> ${massa.fat_a_vencer} A Vencer</span>`);
        }
        if (massa.fat_pagas > 0) {
            fatTags.push(`<span class="mini-tag tag-fat-paga" title="Paga"><i data-lucide="check-circle"></i> ${massa.fat_pagas} Paga${massa.fat_pagas > 1 ? 's' : ''}</span>`);
        }
        if (massa.fat_boleto_unico > 0) {
            fatTags.push(`<span class="mini-tag tag-fat-boleto" title="Boleto Único"><i data-lucide="file"></i> ${massa.fat_boleto_unico} Boleto Único</span>`);
        }
        if (massa.fat_multifaturas > 0) {
            fatTags.push(`<span class="mini-tag tag-fat-multi" title="Multifatura"><i data-lucide="files"></i> ${massa.fat_multifaturas} Multifatura${massa.fat_multifaturas > 1 ? 's' : ''}</span>`);
        }
        if (massa.fat_renegociacao > 0) {
            fatTags.push(`<span class="mini-tag tag-fat-renego" title="Renegociação"><i data-lucide="history"></i> ${massa.fat_renegociacao} Renegociação</span>`);
        }
        const fatDisplay = fatTags.length > 0 ? fatTags.join(' ') : '-';

        let rowHtml = '';
        if (isSelectionMode) {
            rowHtml += `<td><input type="checkbox" class="row-checkbox" data-id="${massa.id}" ${isChecked ? 'checked' : ''} onchange="toggleRowSelection(${massa.id}, this.checked)"></td>`;
        }

        // Iterate over column_order to build the row
        // If column_order is not set (first load), use keys of COLUMN_DEFS + custom
        const order = appSettings.column_order && appSettings.column_order.length > 0
            ? appSettings.column_order
            : [...Object.keys(COLUMN_DEFS), ...appSettings.custom_columns.map(c => c.key)];

        order.forEach(key => {
            if (appSettings.hidden_columns.includes(key)) return;

            let cellContent = '-';

            // Standard Columns Logic
            switch (key) {
                case 'id':
                    cellContent = `#${massa.id}`;
                    break;
                case 'nome':
                    cellContent = `<strong>${massa.nome || '-'}</strong>`;
                    break;
                case 'document_number':
                    cellContent = maskDocument(massa.document_number, massa.document_type);
                    break;
                case 'document_type':
                    cellContent = massa.document_type;
                    break;
                case 'region':
                    cellContent = massa.region;
                    break;
                case 'status':
                    cellContent = `<span class="status-badge status-${massa.status.toLowerCase()}" title="${(massa.metadata_info || {}).status_comment || ''}">${statusPt}</span>`;
                    break;
                case 'uc_counters':
                    cellContent = `<div class="tags-container">${ucDisplay}</div>`;
                    break;
                case 'fat_counters':
                    cellContent = `<div class="tags-container">${fatDisplay}</div>`;
                    break;
                case 'tags':
                    // If we had generic tags, they would go here. For now, empty or custom logic.
                    // If 'tags' key is meant for 'Visualizar/Editar' action? No, actions is separate.
                    // Looking at previous code, 'tags' column didn't seem to have content in the snippet I saw?
                    // Ah, the original code had: ${!appSettings.hidden_columns.includes('tags') ? ... map custom_columns ... 
                    // Wait, 'tags' in my COLUMN_DEFS might be a placeholder.
                    // Let's assume it renders custom tags or just empty for now if no data.
                    cellContent = (massa.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
                    if (cellContent) cellContent = `<div class="tags-container">${cellContent}</div>`;
                    else cellContent = '-';
                    break;
                case 'actions':
                    cellContent = `
                        <button class="btn-icon" onclick="openViewModal(${massa.id})" title="Ver Detalhes">
                            <i data-lucide="eye"></i>
                        </button>
                        <button class="btn-icon" onclick="openEditModal(${massa.id})" title="Editar">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteMassa(${massa.id})" title="Excluir" style="color: var(--danger);">
                            <i data-lucide="trash-2"></i>
                        </button>
                    `;
                    break;
                default:
                    // Custom Columns
                    const customCol = appSettings.custom_columns.find(c => c.key === key);
                    if (customCol) {
                        let val = (massa.metadata_info || {})[key] || '-';
                        if (val !== '-') {
                            if (customCol.type === 'date') {
                                const date = new Date(val);
                                if (!isNaN(date.getTime())) {
                                    val = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                }
                            } else if (customCol.type === 'number') {
                                if (!isNaN(val)) val = Number(val).toLocaleString('pt-BR');
                            } else if (customCol.type === 'tag') {
                                const tags = val.split(',').map(t => t.trim()).filter(t => t);
                                val = `<div class="tags-container" style="justify-content: flex-start;">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
                            }
                        }
                        cellContent = val;
                    }
            }

            if (key === 'actions') {
                rowHtml += `<td><div class="action-buttons">${cellContent}</div></td>`;
            } else {
                rowHtml += `<td>${cellContent}</td>`;
            }
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}

// ============ PAGINATION FUNCTIONS ============
function renderPaginationControls(totalItems, totalPages) {
    let container = document.getElementById('pagination-container');

    // Create container if not exists
    if (!container) {
        container = document.createElement('div');
        container.id = 'pagination-container';
        container.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: var(--bg-card);
            border-radius: 12px;
            margin-top: 15px;
            border: 1px solid var(--border-color);
            flex-wrap: wrap;
            gap: 15px;
        `;

        const tableSection = document.querySelector('.data-grid-section');
        if (tableSection) {
            tableSection.appendChild(container);
        }
    }

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Generate page buttons
    let pageButtons = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // First page & ellipsis
    if (startPage > 1) {
        pageButtons += `<button class="pagination-btn" onclick="goToPage(1)" title="Primeira página">1</button>`;
        if (startPage > 2) {
            pageButtons += `<span style="color: var(--text-secondary); padding: 0 5px;">...</span>`;
        }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        pageButtons += `
            <button class="pagination-btn ${isActive ? 'active' : ''}" 
                    onclick="goToPage(${i})" 
                    style="${isActive ? 'background: var(--primary); color: white;' : ''}">
                ${i}
            </button>
        `;
    }

    // Last page & ellipsis
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageButtons += `<span style="color: var(--text-secondary); padding: 0 5px;">...</span>`;
        }
        pageButtons += `<button class="pagination-btn" onclick="goToPage(${totalPages})" title="Última página">${totalPages}</button>`;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Itens por página:</span>
            <select id="items-per-page" onchange="changeItemsPerPage(this.value)" style="
                padding: 8px 12px;
                border-radius: 8px;
                border: 1px solid var(--border-color);
                background: var(--bg-dark);
                color: var(--text-primary);
                cursor: pointer;
                font-size: 0.9rem;
            ">
                ${itemsPerPageOptions.map(opt => `
                    <option value="${opt}" ${opt === itemsPerPage ? 'selected' : ''}>${opt}</option>
                `).join('')}
            </select>
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">
                Mostrando <strong style="color: var(--text-primary);">${startItem}-${endItem}</strong> de <strong style="color: var(--text-primary);">${totalItems}</strong> resultados
            </span>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px;">
            <button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''} title="Primeira página" style="${currentPage === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                <i data-lucide="chevrons-left" style="width: 16px; height: 16px;"></i>
            </button>
            <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="Página anterior" style="${currentPage === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                <i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i>
            </button>
            
            <div style="display: flex; align-items: center; gap: 3px; margin: 0 10px;">
                ${pageButtons}
            </div>
            
            <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} title="Próxima página" style="${currentPage === totalPages || totalPages === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
            </button>
            <button class="pagination-btn" onclick="goToPage(${totalPages})" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} title="Última página" style="${currentPage === totalPages || totalPages === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                <i data-lucide="chevrons-right" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function goToPage(page) {
    const data = filteredMassas.length > 0 ? filteredMassas : allMassas;
    const totalPages = Math.ceil(data.length / itemsPerPage);

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderTable(data);

    // Scroll to top of table
    const tableSection = document.querySelector('.data-grid-section');
    if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function changeItemsPerPage(value) {
    itemsPerPage = parseInt(value);
    currentPage = 1; // Reset to first page
    const data = filteredMassas.length > 0 ? filteredMassas : allMassas;
    renderTable(data);
}

function exportToCSV() {
    // 1. Determine data source (Filtered or All)
    // Defaulting to "What you see is what you get" -> Filtered Data
    const dataToExport = (filteredMassas && filteredMassas.length > 0) ? filteredMassas : allMassas;

    if (!dataToExport || dataToExport.length === 0) {
        showToast('Nada para exportar', 'warning');
        return;
    }

    // 2. Determine Columns (Visible Only)
    // Use column_order to respect user's order
    const visibleKeys = appSettings.column_order.filter(key =>
        !appSettings.hidden_columns.includes(key) && key !== 'actions' && key !== 'uc_counters' && key !== 'fat_counters'
    );

    // Note: uc_counters and fat_counters are visual summaries. 
    // Maybe user wants the raw counts? 
    // Let's include them if visible, but flatten the data? 
    // Or just skip complex visual columns and add specific data columns if needed.
    // Let's stick to: ID, Name, Doc, Type, Region, Status... and then Custom.
    // Better: Map keys to headers dynamically.

    // Additional Columns that are always useful but might not be in column_order as such?
    // Actually, let's strictly follow the visible columns for "WYSIWYG", 
    // plus maybe add detailed counts if the summary column is there?
    // For simplicity and cleanliness: Export what is defined in COLUMN_DEFS + Custom.

    const headers = [];
    visibleKeys.forEach(key => {
        if (COLUMN_DEFS[key]) headers.push(COLUMN_DEFS[key].label);
        else {
            const custom = appSettings.custom_columns.find(c => c.key === key);
            headers.push(custom ? custom.name : key);
        }
    });

    let csvContent = '\uFEFF'; // BOM for Excel
    csvContent += headers.join(';') + '\n';

    dataToExport.forEach(m => {
        const row = [];
        visibleKeys.forEach(key => {
            let val = '';

            // Standard Fields mapping
            if (key === 'id') val = m.id;
            else if (key === 'nome') val = m.nome;
            else if (key === 'document_number') val = m.document_number;
            else if (key === 'document_type') val = m.document_type;
            else if (key === 'region') val = m.region;
            else if (key === 'status') val = translateStatus(m.status);
            else if (key === 'tags') val = (m.tags || []).join(', ');
            else if (key === 'uc_counters') {
                // Export summary string
                const parts = [];
                if (m.uc_ligada > 0) parts.push(`${m.uc_ligada} Ligada`);
                if (m.uc_desligada > 0) parts.push(`${m.uc_desligada} Desligada`);
                if (m.uc_suspensa > 0) parts.push(`${m.uc_suspensa} Suspensa`);
                val = parts.join(', ');
            }
            else if (key === 'fat_counters') {
                const parts = [];
                if (m.fat_vencidas > 0) parts.push(`${m.fat_vencidas} Vencida`);
                if (m.fat_a_vencer > 0) parts.push(`${m.fat_a_vencer} A Vencer`);
                if (m.fat_pagas > 0) parts.push(`${m.fat_pagas} Paga`);
                val = parts.join(', ');
            }
            else {
                // Custom Columns
                val = (m.metadata_info || {})[key] || '';
                // Format check
                const custom = appSettings.custom_columns.find(c => c.key === key);
                if (custom && custom.type === 'date' && val) {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) val = d.toLocaleDateString('pt-BR');
                }
                if (custom && custom.type === 'number' && val) {
                    val = String(val).replace('.', ','); // PT-BR format
                }
            }

            // Escape quotes and wrap
            const stringVal = String(val !== undefined && val !== null ? val : '');
            row.push(`"${stringVal.replace(/"/g, '""')}"`);
        });
        csvContent += row.join(';') + '\n';
    });

    // 3. Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tdm_massas_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function deleteAllMassas() {
    const confirm1 = window.confirm('⚠️ ATENÇÃO: Isso vai excluir TODAS as massas do banco de dados!\n\nTem certeza?');
    if (!confirm1) return;

    const confirm2 = window.confirm('🚨 ÚLTIMA CHANCE: Esta ação é IRREVERSÍVEL!\n\nDigite OK para confirmar a exclusão de TODAS as massas.');
    if (!confirm2) return;

    try {
        const response = await fetch(`${API_URL}/massas/all`, { method: 'DELETE' });
        const result = await response.json();

        showToast(result.message, 'success');
        selectedIds.clear();
        toggleSelectionMode();
        fetchMassas();
    } catch (error) {
        console.error('Error deleting all:', error);
        showToast('Erro ao excluir todas as massas', 'error');
    }
}

function showDetails(id) {
    const massa = allMassas.find(m => m.id === id);
    if (!massa) return;

    let info = "=== DETALHES DA MASSA ===\n\n";
    info += `ID: ${massa.id}\n`;
    info += `Documento: ${massa.document_number}\n`;
    info += `Tipo: ${massa.document_type}\n`;
    info += `Região: ${massa.region}\n`;
    info += `Status TDM: ${massa.status}\n`;
    info += `Status Financeiro: ${massa.financial_status}\n`;
    info += `UCs Ligadas: ${massa.uc_ligada || 0}\n`;
    info += `UCs Desligadas: ${massa.uc_desligada || 0}\n`;
    info += `UCs Suspensas: ${massa.uc_suspensa || 0}\n`;
    info += `\n=== FATURAS ===\n`;
    info += `Vencidas: ${massa.fat_vencidas || 0}\n`;
    info += `A Vencer: ${massa.fat_a_vencer || 0}\n`;
    info += `Pagas: ${massa.fat_pagas || 0}\n`;
    info += `Boleto Único: ${massa.fat_boleto_unico || 0}\n`;
    info += `Multifaturas: ${massa.fat_multifaturas || 0}\n`;
    info += `Renegociação: ${massa.fat_renegociacao || 0}\n`;
    info += `Tags: ${(massa.tags || []).join(', ')}\n`;
    info += `\n=== METADADOS ===\n`;

    if (massa.metadata_info && typeof massa.metadata_info === 'object') {
        for (const [key, value] of Object.entries(massa.metadata_info)) {
            info += `${key}: ${value}\n`;
        }
    } else {
        info += "(Sem metadados)";
    }

    alert(info);
}

// ============ TABS LOGIC ============
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');

    if (btn) {
        btn.classList.add('active');
    } else {
        const targetBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }
}

// ============ EDIT MODAL FUNCTIONS ============
// ============ MODAL FUNCTIONS (Edit, View, New) ============

function _setModalMode(mode, id = null) {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('modal-title');
    const inputs = modal.querySelectorAll('input, select, textarea');
    const saveBtn = modal.querySelector('.btn-primary'); // "Salvar" button

    if (mode === 'new') {
        title.textContent = 'Nova Massa';
        inputs.forEach(el => el.disabled = false);
        if (saveBtn) saveBtn.style.display = 'inline-block';
    } else if (mode === 'edit') {
        title.textContent = `Editar Massa #${id}`;
        inputs.forEach(el => el.disabled = false);
        if (saveBtn) saveBtn.style.display = 'inline-block';
    } else if (mode === 'view') {
        title.textContent = `Visualizar Massa #${id}`;
        inputs.forEach(el => el.disabled = true);
        if (saveBtn) saveBtn.style.display = 'none';
    }

    switchTab('tab-geral');
    modal.style.display = 'flex';
}

function _fillModal(massa) {
    document.getElementById('edit-id').value = massa.id || '';
    document.getElementById('edit-nome').value = massa.nome || '';
    document.getElementById('edit-doc-type').value = massa.document_type || 'CPF';
    document.getElementById('edit-doc-number').value = massa.document_number || '';
    document.getElementById('edit-region').value = massa.region || 'Bahia';
    document.getElementById('edit-status').value = massa.status || 'AVAILABLE';
    document.getElementById('edit-uc-ligada').value = massa.uc_ligada || 0;
    document.getElementById('edit-uc-desligada').value = massa.uc_desligada || 0;
    document.getElementById('edit-uc-suspensa').value = massa.uc_suspensa || 0;
    document.getElementById('edit-fat-vencidas').value = massa.fat_vencidas || 0;
    document.getElementById('edit-fat-a-vencer').value = massa.fat_a_vencer || 0;
    document.getElementById('edit-fat-pagas').value = massa.fat_pagas || 0;
    document.getElementById('edit-fat-boleto-unico').value = massa.fat_boleto_unico || 0;
    document.getElementById('edit-fat-multifaturas').value = massa.fat_multifaturas || 0;
    document.getElementById('edit-fat-renegociacao').value = massa.fat_renegociacao || 0;
    document.getElementById('edit-tags').value = (massa.tags || []).join(', ');
    document.getElementById('edit-metadata').value = JSON.stringify(massa.metadata_info || {}, null, 2);

    document.getElementById('edit-fat-renegociacao').value = massa.fat_renegociacao || 0;
    document.getElementById('edit-tags').value = (massa.tags || []).join(', ');
    document.getElementById('edit-metadata').value = JSON.stringify(massa.metadata_info || {}, null, 2);

    // Fill Status Comment
    document.getElementById('edit-status-comment').value = (massa.metadata_info || {}).status_comment || '';

    // Fill Custom Fields
    appSettings.custom_columns.forEach(col => {
        const val = (massa.metadata_info || {})[col.key] || '';
        const input = document.getElementById(`edit-custom-${col.key}`);
        if (input) input.value = val;
    });
}

function openEditModal(id) {
    const massa = allMassas.find(m => m.id === id);
    if (!massa) return;
    _fillModal(massa);
    _setModalMode('edit', id);
}

function openViewModal(id) {
    const massa = allMassas.find(m => m.id === id);
    if (!massa) return;
    _fillModal(massa);
    _setModalMode('view', id);
}

function openModal() {
    // New massa default values
    _fillModal({});
    _setModalMode('new');
    document.getElementById('edit-tags').value = '';
    document.getElementById('edit-metadata').value = '{}';

    document.getElementById('edit-tags').value = '';
    document.getElementById('edit-metadata').value = '{}';
    document.getElementById('edit-status-comment').value = '';

    // Reset Custom Fields
    appSettings.custom_columns.forEach(col => {
        const input = document.getElementById(`edit-custom-${col.key}`);
        if (input) input.value = '';
    });

    document.getElementById('modal-title').textContent = 'Nova Massa';
}

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

async function saveEdit() {
    const id = document.getElementById('edit-id').value;
    const isNew = !id;

    let metadata = {};
    try {
        metadata = JSON.parse(document.getElementById('edit-metadata').value || '{}');
    } catch (e) {
        showToast('Erro no JSON dos metadados', 'error');
        return;
    }


    // Capture Status Comment
    const statusComment = document.getElementById('edit-status-comment').value;
    if (statusComment) {
        metadata.status_comment = statusComment;
    } else {
        delete metadata.status_comment;
    }

    // Capture Custom Fields into Metadata
    appSettings.custom_columns.forEach(col => {
        const input = document.getElementById(`edit-custom-${col.key}`);
        if (input && input.value) {
            metadata[col.key] = input.value;
        }
    });

    const tagsStr = document.getElementById('edit-tags').value;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

    const payload = {
        nome: document.getElementById('edit-nome').value,
        document_type: document.getElementById('edit-doc-type').value,
        document_number: document.getElementById('edit-doc-number').value,
        region: document.getElementById('edit-region').value,
        status: document.getElementById('edit-status').value,
        uc_ligada: parseInt(document.getElementById('edit-uc-ligada').value) || 0,
        uc_desligada: parseInt(document.getElementById('edit-uc-desligada').value) || 0,
        uc_suspensa: parseInt(document.getElementById('edit-uc-suspensa').value) || 0,
        fat_vencidas: parseInt(document.getElementById('edit-fat-vencidas').value) || 0,
        fat_a_vencer: parseInt(document.getElementById('edit-fat-a-vencer').value) || 0,
        fat_pagas: parseInt(document.getElementById('edit-fat-pagas').value) || 0,
        fat_boleto_unico: parseInt(document.getElementById('edit-fat-boleto-unico').value) || 0,
        fat_multifaturas: parseInt(document.getElementById('edit-fat-multifaturas').value) || 0,
        fat_renegociacao: parseInt(document.getElementById('edit-fat-renegociacao').value) || 0,
        tags: tags,
        metadata_info: metadata
    };

    try {
        let response;
        if (isNew) {
            response = await fetch(`${API_URL}/massas/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`${API_URL}/massas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (response.ok) {
            const savedMassa = await response.json(); // Backend should return the saved object

            closeModal();

            if (isNew) {
                allMassas.push(savedMassa);
            } else {
                const index = allMassas.findIndex(m => m.id == id);
                if (index !== -1) {
                    allMassas[index] = savedMassa;
                }
            }

            // Update UI locally without re-fetching
            applyColumnFilters(); // This re-renders table
            updateDashboard(allMassas); // This updates counters
            renderCharts(allMassas); // This updates charts

            showToast(isNew ? 'Massa criada com sucesso!' : 'Massa atualizada com sucesso!', 'success');
        } else {
            const err = await response.json();
            showToast('Erro: ' + (err.detail || response.statusText), 'error');
        }
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Erro ao salvar', 'error');
    }
}

// ============ FILE UPLOAD / IMPORT ============
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel file - need to use SheetJS library
        showToast('Para importar Excel, salve como CSV primeiro.', 'warning');
        event.target.value = '';
        return;
    }

    // CSV file
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCSVAndUpload(text);
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

async function parseCSVAndUpload(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showToast('Arquivo vazio ou inválido', 'error');
        return;
    }

    // Detect separator (semicolon is common in Portuguese Excel)
    const firstLine = lines[0];
    let separator = ',';
    if (firstLine.includes(';') && !firstLine.includes(',')) {
        separator = ';';
    } else if (firstLine.split(';').length > firstLine.split(',').length) {
        separator = ';';
    }
    console.log('Separador detectado:', separator);

    // Parse headers
    const headers = parseCSVLine(lines[0], separator);
    console.log('Headers encontrados:', headers);

    // Normalize headers for matching
    const normalizedHeaders = headers.map(h =>
        h.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "")
    );
    console.log('Headers normalizados:', normalizedHeaders);

    // Find column indexes - matching user's spreadsheet format
    const findIdx = (keywords) => {
        const idx = normalizedHeaders.findIndex(h => keywords.some(k => h.includes(k)));
        console.log(`Procurando ${keywords.join('/')} -> índice ${idx}`);
        return idx;
    };

    // Column mapping based on user's spreadsheet:
    // A: Tipo Doc, B: Documento, G: Região
    const idxDocType = findIdx(['tipodoc', 'tipodo', 'tipo']);
    const idxDocNum = findIdx(['documento']);
    const idxNome = findIdx(['nome', 'name', 'razaosocial']);
    const idxRegion = findIdx(['regiao']);
    const idxQtdUcLigada = findIdx(['ucsligadas', 'qtducsligadas', 'ligadas']);
    const idxQtdVencidas = findIdx(['faturasvencidas', 'qtdfaturasvencidas', 'vencidas']);
    const idxQtdSuspensa = findIdx(['ucssuspensas', 'qtducssuspensas', 'suspensas']);
    const idxQtdDesligada = findIdx(['ucsdesligadas', 'qtducsdesligadas', 'desligadas']);

    console.log(`Índices: DocType=${idxDocType}, DocNum=${idxDocNum}, Region=${idxRegion}`);

    // Helper function to pad document numbers with leading zeros

    const padDocument = (docNum, docType) => {
        // Remove any non-numeric characters
        const numericOnly = docNum.replace(/\D/g, '');

        // CPF = 11 digits, CNPJ = 14 digits
        const targetLength = docType === 'CNPJ' ? 14 : 11;

        // Pad with leading zeros
        return numericOnly.padStart(targetLength, '0');
    };

    const massas = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator);
        if (values.length < 2) continue;

        const massa = {};

        // Core fields
        massa.nome = idxNome > -1 && values[idxNome] ? values[idxNome].trim() : '';
        massa.document_type = idxDocType > -1 && values[idxDocType] ? values[idxDocType].toUpperCase().trim() : 'CPF';

        // Get raw document number and pad with leading zeros
        const rawDocNum = idxDocNum > -1 && values[idxDocNum] ? values[idxDocNum].trim() : `${i}`;
        massa.document_number = padDocument(rawDocNum, massa.document_type);

        massa.region = idxRegion > -1 && values[idxRegion] ? values[idxRegion].trim() : 'Brasília';

        // Infer statuses
        massa.status = "AVAILABLE";

        // UC Counts - parse from CSV columns
        massa.uc_ligada = idxQtdUcLigada > -1 ? parseInt(values[idxQtdUcLigada]) || 0 : 0;
        massa.uc_desligada = idxQtdDesligada > -1 ? parseInt(values[idxQtdDesligada]) || 0 : 0;
        massa.uc_suspensa = idxQtdSuspensa > -1 ? parseInt(values[idxQtdSuspensa]) || 0 : 0;

        // Financial Status
        massa.financial_status = "ADIMPLENTE";
        if (idxQtdVencidas > -1 && parseInt(values[idxQtdVencidas]) > 0) {
            massa.financial_status = "COM_FATURAS_VENCIDAS";
        }

        // Store ALL columns as metadata (including the newly mapped ones)
        // We iterate headers again to capture everything
        massa.metadata_info = {};

        headers.forEach((header, index) => {
            if (values[index] !== undefined && values[index].trim() !== '') {
                // Try to find the key we generated/matched
                // If it was a standard column, we might not need it in metadata, but storing it doesn't hurt.
                // Ideally we map check the slug again.

                const slug = header.trim().toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/g, "_");

                // If this slug is in custom_columns, store it!
                if (appSettings.custom_columns.some(c => c.key === slug)) {
                    massa.metadata_info[slug] = values[index].trim();
                }
            }
        });

        massa.tags = [];
        if (massa.financial_status !== "ADIMPLENTE") massa.tags.push("com_divida");
        if (massa.uc_ligada > 0) massa.tags.push("com_luz");

        massas.push(massa);
    }

    console.log(`Processadas ${massas.length} massas`);
    if (massas.length > 0) {
        console.log('Exemplo:', massas[0]);
    }

    uploadMassas(massas);
}

function parseCSVLine(line, separator = ',') {
    // Handle CSV with possible quoted fields
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

async function uploadMassas(massas) {
    if (massas.length === 0) {
        showToast('Nenhuma massa válida para importar', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/massas/upload-csv`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(massas)
        });

        if (response.ok) {
            const result = await response.json();
            showToast('Importação realizada com sucesso!', 'success');
            fetchMassas();
        } else {
            const err = await response.json();
            showToast('Erro na importação: ' + (err.detail || response.statusText), 'error');
        }
    } catch (error) {
        console.error('Error uploading:', error);
        showToast('Erro ao conectar com servidor', 'error');
    }
}

// ============ SIDEBAR LOGIC ============
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');

    // Save preference
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
}

// ============ ADMIN MODAL LOGIC ============
function openAdminModal() {
    renderAdminColumnsList();
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

function renderAdminColumnsList() {
    const list = document.getElementById('custom-columns-list');
    if (!list) return;

    // Build the "Standard Columns" management UI as well
    // We need to inject this into the modal if it doesn't exist, or just use innerHTML
    // Ideally the modal HTML should have a container for this.
    // ============ COLUMN MANAGEMENT (Drag & Drop + Visibility) ============

    let draggedCol = null;

    function renderHeaders() {
        const thead = document.querySelector('.data-table thead');
        thead.innerHTML = '';

        // Ensure column_order exists (backwards compatibility)
        if (!appSettings.column_order || appSettings.column_order.length === 0) {
            appSettings.column_order = Object.keys(COLUMN_DEFS);
            // Append custom columns if not present
            appSettings.custom_columns.forEach(c => {
                if (!appSettings.column_order.includes(c.key)) appSettings.column_order.splice(appSettings.column_order.length - 2, 0, c.key); // Insert before tags/actions
            });
        }

        // Filter visible columns
        const visibleCols = appSettings.column_order.filter(key => !appSettings.hidden_columns.includes(key));

        // 1. Title Row
        const trTitle = document.createElement('tr');
        visibleCols.forEach(key => {
            const th = document.createElement('th');
            th.draggable = true;
            th.dataset.key = key;

            let label = '';
            if (COLUMN_DEFS[key]) {
                label = COLUMN_DEFS[key].label;
            } else {
                const custom = appSettings.custom_columns.find(c => c.key === key);
                label = custom ? custom.name.toUpperCase() : key;
                th.classList.add('dynamic-col');
            }

            th.textContent = label;
            th.style.cursor = 'move';

            // Drag Events
            th.addEventListener('dragstart', handleDragStart);
            th.addEventListener('dragover', handleDragOver);
            th.addEventListener('drop', handleDrop);
            th.addEventListener('dragend', handleDragEnd);

            trTitle.appendChild(th);
        });
        thead.appendChild(trTitle);

        // 2. Filter Row
        const trFilter = document.createElement('tr');
        trFilter.classList.add('filter-row');

        visibleCols.forEach(key => {
            const th = document.createElement('th');
            let def = COLUMN_DEFS[key];

            // Handle Custom Cols (assume text filter for now, or match type)
            if (!def) {
                const custom = appSettings.custom_columns.find(c => c.key === key);
                if (custom) {
                    // Map custom types to filter types
                    const fType = custom.type === 'tag' || custom.type === 'text' ? 'text' : null;
                    def = { filterType: fType };
                } else {
                    def = { filterType: null };
                }
            }

            if (def.filterType === 'text') {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `col-filter-${key}`; // Consistent ID
                input.placeholder = 'Filtrar...';
                if (key === 'id') { input.placeholder = 'ID'; input.style.width = '50px'; }
                if (key === 'nome') input.placeholder = 'Nome...';
                input.onkeyup = applyColumnFilters;
                th.appendChild(input);
            } else if (def.filterType === 'select') {
                const select = document.createElement('select');
                select.id = `col-filter-${key}`;
                select.onchange = applyColumnFilters;

                const optAll = document.createElement('option');
                optAll.value = '';
                optAll.textContent = key === 'region' ? 'Todas' : 'Todos';
                select.appendChild(optAll);

                if (def.options) {
                    def.options.forEach(opt => {
                        const el = document.createElement('option');
                        el.value = opt.value;
                        el.textContent = opt.label;
                        select.appendChild(el);
                    });
                }
                th.appendChild(select);
            }

            trFilter.appendChild(th);
        });
        thead.appendChild(trFilter);
    }

    function handleDragStart(e) {
        draggedCol = e.target.dataset.key;
        e.target.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnd(e) {
        e.target.style.opacity = '1';
        document.querySelectorAll('th').forEach(th => th.classList.remove('drag-over'));
    }

    async function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();

        const targetKey = e.target.closest('th').dataset.key;
        if (draggedCol && targetKey && draggedCol !== targetKey) {
            // Reorder array
            const oldIndex = appSettings.column_order.indexOf(draggedCol);
            const newIndex = appSettings.column_order.indexOf(targetKey);

            if (oldIndex > -1 && newIndex > -1) {
                appSettings.column_order.splice(oldIndex, 1);
                appSettings.column_order.splice(newIndex, 0, draggedCol);

                // Save settings (optional, or wait for explicit save)
                await saveSettings(appSettings); // Save immediately for UX

                renderHeaders();
                renderTable(allMassas); // Re-render body in new order
            }
        }
        return false;
    }

    function addCustomColumn() {
        const input = document.getElementById('new-col-name');
        const typeSelect = document.getElementById('new-col-type'); // Capture type
        const name = input.value.trim();
        if (!name) return;

        // Generate key (simple slugify)
        const key = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "_");

        // Check key duplication
        if (appSettings.custom_columns.some(c => c.key === key)) {
            showToast('Essa coluna já existe!', 'warning');
            return;
        }

        appSettings.custom_columns.push({
            name: name,
            key: key,
            type: typeSelect ? typeSelect.value : 'text'
        });
        saveSettings(appSettings);

        input.value = '';
        renderAdminColumnsList(); // Ensure this function exists or is updated
    }

    function removeCustomColumn(index) {
        if (!confirm('Tem certeza? Os dados dessa coluna não serão apagados do banco, mas ela deixará de aparecer.')) return;

        appSettings.custom_columns.splice(index, 1);
        saveSettings(appSettings);
        renderAdminColumnsList(); // Ensure this function exists or is updated
    }

    // Initial load
    document.addEventListener('DOMContentLoaded', async () => {
        // Check for collapsed state first to prevent flickering
        const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        if (isCollapsed) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
        }

        await fetchSettings(); // Load columns first
        renderHeaders(); // Initial render of headers
        fetchMassas(); // Then load data
    });

    // ============ SIDEBAR & NAVIGATION ============
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    }

    function switchView(viewName) {
        // 1. Update Sidebar Active State
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navItem = document.getElementById(`nav-${viewName}`);
        if (navItem) navItem.classList.add('active');

        // 2. Toggle Views
        const massasView = document.getElementById('view-massas');
        const dashboardView = document.getElementById('view-dashboard');

        if (massasView) massasView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'none';

        const activeView = document.getElementById(`view-${viewName}`);
        if (activeView) activeView.style.display = 'block';

        // 3. Special actions
        if (viewName === 'dashboard') {
            // Re-render charts to ensure correct width/height if it was hidden
            if (typeof renderCharts === 'function' && typeof allMassas !== 'undefined') {
                renderCharts(allMassas);
            }
        }
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    // Check for collapsed state first to prevent flickering
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    await fetchSettings(); // Load columns first
    renderHeaders(); // Initial render of headers
    fetchMassas(); // Then load data
});
