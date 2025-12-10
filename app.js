// Configuration
// Use relative path to allow access from network IPs and match the server port automatically
const API_BASE_URL = '/api';

// Global variables
let gridApi;
let gridColumnApi;
let currentGangTotals = {};
let currentMode = 'hk';

// Day names in Indonesian
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Month names
const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Auto-size columns on window resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            if (gridApi) {
                gridApi.sizeColumnsToFit();
            }
        }, 100);
    });

    // Also auto-size columns periodically to handle any layout changes
    setInterval(() => {
        if (gridApi) {
            gridApi.sizeColumnsToFit();
        }
    }, 5000); // Every 5 seconds
});

// Setup event listeners
function setupEventListeners() {
    const loadByLocBtn = document.getElementById('loadByLocBtn');
    if (loadByLocBtn) {
        loadByLocBtn.addEventListener('click', loadAttendanceByLoc);
    }

    // Listen for loc code changes to load available periods
    const locCodeInput = document.getElementById('locCode');
    if (locCodeInput) {
        // Load periods when user finishes typing (with debounce)
        let debounceTimer;
        locCodeInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const locCode = e.target.value.trim();
                if (locCode.length >= 2) {
                    loadAvailablePeriods(locCode);
                } else {
                    resetPeriodeDropdown();
                }
            }, 500);
        });

        locCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const locCode = e.target.value.trim();
                if (locCode.length >= 2) {
                    loadAvailablePeriods(locCode);
                }
            }
        });
    }

    // Listen for periode changes to auto-load data
    const periodeSelect = document.getElementById('periode');
    if (periodeSelect) {
        periodeSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadAttendanceByLoc();
            }
        });
    }

    const searchNameInput = document.getElementById('searchName');
    if (searchNameInput) {
        searchNameInput.addEventListener('input', (e) => {
            if (gridApi) {
                gridApi.setQuickFilter(e.target.value);
            }
        });
    }

    const monitoringMode = document.getElementById('monitoringMode');
    if (monitoringMode) {
        monitoringMode.addEventListener('change', (e) => {
            const modeLabel = document.getElementById('modeLabel');
            if (e.target.checked) {
                currentMode = 'ot';
                modeLabel.textContent = 'Lembur';
                modeLabel.style.color = '#f6ad55'; // Orange for OT
            } else {
                currentMode = 'hk';
                modeLabel.textContent = 'HK/Absen';
                modeLabel.style.color = '#63b3ed'; // Blue for HK
            }
            // Reload data with new mode if periode is selected
            const periodeSelect = document.getElementById('periode');
            if (periodeSelect && periodeSelect.value) {
                loadAttendanceByLoc();
            }
        });
    }
}

// Reset periode dropdown to initial state
function resetPeriodeDropdown() {
    const periodeSelect = document.getElementById('periode');
    periodeSelect.innerHTML = '<option value="">-- Masukkan Loc Code --</option>';
    periodeSelect.disabled = true;
}

// Load available periods from database
async function loadAvailablePeriods(locCode) {
    const periodeSelect = document.getElementById('periode');

    try {
        periodeSelect.innerHTML = '<option value="">Memuat periode...</option>';
        periodeSelect.disabled = true;

        const response = await fetch(`${API_BASE_URL}/available-months?locCode=${encodeURIComponent(locCode)}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch available months');
        }

        const result = await response.json();
        console.log('📅 Available periods:', result);

        if (!result.success || !result.data || result.data.length === 0) {
            periodeSelect.innerHTML = '<option value="">Tidak ada data absensi</option>';
            periodeSelect.disabled = true;
            return;
        }

        // Populate dropdown with available periods
        periodeSelect.innerHTML = '<option value="">-- Pilih Periode --</option>';
        result.data.forEach(period => {
            const monthName = monthNames[period.month - 1];
            const option = document.createElement('option');
            option.value = `${period.year}-${period.month}`;
            option.textContent = `${monthName} ${period.year}`;
            periodeSelect.appendChild(option);
        });

        periodeSelect.disabled = false;

        // Auto-select the first (most recent) period
        if (result.data.length > 0) {
            periodeSelect.selectedIndex = 1; // Select first actual period
            periodeSelect.disabled = true; // Disable selection after loading
            // Update label to show it's based on database data
            const label = document.querySelector('label[for="periode"]');
            if (label) {
                label.textContent = 'Periode (Berdasarkan Data)';
            }
            // Auto-load data
            loadAttendanceByLoc();
        }

    } catch (error) {
        console.error('❌ Error loading available periods:', error);
        periodeSelect.innerHTML = '<option value="">Error memuat periode</option>';
        periodeSelect.disabled = true;
    }
}

// Generate column definitions for the grid
function generateColumnDefs(year, month, daysInMonth) {
    const columnDefs = [
        // Gang column removed as requested
        {
            headerName: 'Name',
            field: 'empName',
            pinned: 'left',
            width: 120,
            cellStyle: { fontWeight: '600', paddingLeft: '5px' }
        },
        {
            headerName: 'Jml',
            field: 'totalPresence',
            pinned: 'left',
            width: 60,
            cellStyle: { fontWeight: 'bold', color: '#63b3ed', textAlign: 'center', padding: '0' }
        }
    ];

    // Add a column for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        const dayName = dayNames[dayOfWeek];
        const isSunday = dayOfWeek === 0;

        columnDefs.push({
            headerName: `${day}\n${dayName}`,
            headerTooltip: `${dayName}, ${day} ${getMonthName(month)}`,
            field: `day_${day}`,
            width: 32, // Increased width to accommodate day number and day name
            minWidth: 28,
            maxWidth: 60,
            sortable: false, // Disable sorting to save space in header
            resizable: true, // Enable resizing so users can adjust if needed
            suppressMenu: true,
            suppressSizeToFit: false,
            cellStyle: (params) => getCellStyle(params, isSunday),
            cellRenderer: (params) => cellRenderer(params),
            headerClass: isSunday ? 'cell-sunday compact-header' : 'compact-header'
        });
    }

    return columnDefs;
}

async function loadAttendanceByLoc() {
    const locCode = document.getElementById('locCode').value.trim();
    const periodeSelect = document.getElementById('periode');
    const selectedPeriode = periodeSelect.value;

    if (!locCode) {
        alert('Please enter a loc code');
        return;
    }

    if (!selectedPeriode) {
        alert('Please select a periode');
        return;
    }

    // Parse periode (format: YYYY-MM)
    const [year, month] = selectedPeriode.split('-');

    console.log(`🔍 Loading data for: ${locCode}, ${month}/${year}, Mode: ${currentMode}`);
    showLoading(true);

    try {
        const response = await fetch(
            `${API_BASE_URL}/attendance-by-loc-enhanced?locCode=${encodeURIComponent(locCode)}&month=${month}&year=${year}&includeEmpName=true&mode=${currentMode}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch attendance data');
        }

        const result = await response.json();
        console.log('📊 API Response:', result);

        if (!result.success || !result.data) {
            throw new Error('Invalid response format');
        }

        // Store gang totals
        currentGangTotals = result.gangTotals || {};

        const daysInMonth = result.daysInMonth || new Date(year, month, 0).getDate();
        const columnDefs = generateColumnDefs(parseInt(year), parseInt(month), daysInMonth);

        // Clean and prepare row data
        const cleanData = result.data.map(row => {
            let totalPresenceCount = 0;

            const cleanRow = {
                gangCode: row.gangCode || 'INF',
                empName: (row.empName || row.empCode || '').trim(),
                month: row.month,
                year: row.year
            };

            // Add day columns with proper data structure
            for (let day = 1; day <= daysInMonth; day++) {
                const dayData = row[`day_${day}`];
                let hasData = false;

                if (dayData && typeof dayData === 'object') {
                    // Check if meaningful data exists for the count
                    if (currentMode === 'ot') {
                        hasData = (dayData.otHours > 0 || (dayData.otDetails && dayData.otDetails.length > 0));
                    } else {
                        hasData = (dayData.workHours > 0 || dayData.otHours > 0 || dayData.isOnLeave || dayData.isHoliday || dayData.isRestDay);
                    }

                    cleanRow[`day_${day}`] = {
                        workHours: dayData.workHours || 0,
                        otHours: dayData.otHours || 0,
                        otDetails: dayData.otDetails || [],
                        isOnLeave: dayData.isOnLeave || false,
                        leaveLength: dayData.leaveLength || 0,
                        isRestDay: dayData.isRestDay || false,
                        isHoliday: dayData.isHoliday || false,
                        date: dayData.date
                    };
                } else {
                    cleanRow[`day_${day}`] = {
                        workHours: 0,
                        otHours: 0,
                        otDetails: [],
                        isOnLeave: false,
                        leaveLength: 0,
                        isRestDay: false,
                        isHoliday: false,
                        date: new Date(parseInt(year), parseInt(month) - 1, day)
                    };
                }

                if (hasData) {
                    totalPresenceCount++;
                }
            }

            cleanRow.totalPresence = totalPresenceCount;
            return cleanRow;
        });

        // Inject Gang Headers
        const groupedData = [];
        let lastGangCode = null;

        cleanData.forEach(row => {
            if (row.gangCode !== lastGangCode) {
                // Add a header row
                groupedData.push({
                    isGangHeader: true,
                    gangCode: row.gangCode
                });
                lastGangCode = row.gangCode;
            }
            groupedData.push(row);
        });

        if (gridApi) {
            gridApi.setColumnDefs(columnDefs);
            gridApi.setRowData(groupedData);
            console.log('✅ Grid updated with existing API');
        } else {
            initializeGrid(columnDefs, groupedData);
            console.log('✅ Grid initialized with new data');
        }

        showLoading(false);

    } catch (error) {
        console.error('❌ Error loading attendance by loc:', error);
        alert(`Error: ${error.message}`);
        showLoading(false); // This will return to empty state on error if no data
    }
}
// Custom cell renderer
function cellRenderer(params) {
    const data = params.value;

    if (currentMode === 'ot') {
        // OT Mode Renderer
        if (data && (data.otHours > 0 || (data.otDetails && data.otDetails.length > 0))) {
            let content = '';
            let isMultiple = false;

            if (data.otDetails && data.otDetails.length > 0) {
                // Join with pipe
                content = data.otDetails.map(h => parseFloat(h).toFixed(1).replace(/\.0$/, '')).join(' | ');
                if (data.otDetails.length > 1) {
                    isMultiple = true;
                }
            } else {
                content = parseFloat(data.otHours).toFixed(1).replace(/\.0$/, '');
            }

            // Different style for multiple OT records
            const bgStyle = isMultiple ? 'background-color: #744210; border-radius: 4px;' : ''; // Dark orange background for multiple
            const colorStyle = isMultiple ? 'color: #fbd38d;' : 'color: #f6ad55;';

            return `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; ${colorStyle} ${bgStyle}">${content}</div>`;
        }
        return '';
    }

    // HK/Absen Mode Renderer (Default)
    let title = "No Data";
    let bgColor = "#ef4444"; // Red for no data

    // Check if any activity is present (work hours, OT, leave, holiday, rest day)
    const dataExists = data && (data.workHours > 0 || data.otHours > 0 || data.isOnLeave || data.isHoliday || data.isRestDay);

    if (dataExists) {
        // Blue circle for data exists
        bgColor = "#3b82f6"; // Blue for data exists
        title = `Work: ${data.workHours}h, OT: ${data.otHours}h`;
        if (data.isOnLeave) title += `, On Leave`;
        if (data.isHoliday) title += `, Holiday`;
        if (data.isRestDay) title += `, Rest Day`;
    }

    return `<div class="attendance-status" style="background-color: ${bgColor};" title="${title}"></div>`;
}

// Get cell style based on conditions
function getCellStyle(params, isSunday) {
    const baseStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
    };

    if (!params.value) {
        return baseStyle;
    }

    // We mainly rely on the cellRenderer for the circles, 
    // but we can keep background styling for Sundays to help visual grid
    if (isSunday) {
        return {
            ...baseStyle,
            backgroundColor: 'rgba(255, 255, 255, 0.03)', // Very subtle sunday highlight
        };
    }

    return baseStyle;
}


// Initialize AG Grid
function initializeGrid(columnDefs, rowData) {
    const gridOptions = {
        columnDefs: columnDefs,
        rowData: rowData,
        defaultColDef: {
            sortable: true,
            resizable: true,
            filter: false,
            suppressMenu: true
        },
        animateRows: true,
        enableCellTextSelection: true,
        suppressRowClickSelection: true,
        rowHeight: 40, // Slightly tighter rows for monitoring
        headerHeight: 50, // Optimized height for two-line headers
        suppressHorizontalScroll: false,
        onGridReady: (params) => {
            gridApi = params.api;
            gridColumnApi = params.columnApi;
            params.api.sizeColumnsToFit();
        },
        onFirstDataRendered: (params) => {
            params.api.sizeColumnsToFit();
        },
        // Full Width Row Configuration for Gang Headers
        isFullWidthRow: (params) => params.rowNode.data && params.rowNode.data.isGangHeader,
        fullWidthCellRenderer: (params) => {
            const gang = params.data.gangCode || 'Unknown';
            let html = `<div class="gang-header-cell"><span>GANG: ${gang}</span>`;

            // Add Total HK if in HK mode and data exists
            if (currentMode === 'hk' && currentGangTotals && currentGangTotals[gang] !== undefined) {
                html += `<span class="total-hk-badge" style="margin-left: auto; margin-right: 15px; background: #2b6cb0; padding: 2px 8px; border-radius: 4px; font-size: 0.9em;">Total HK: ${currentGangTotals[gang]}</span>`;
            }

            html += `</div>`;
            return html;
        }
    };

    const gridDiv = document.getElementById('myGrid');
    new agGrid.Grid(gridDiv, gridOptions);
}

// Show/hide loading state
function showLoading(isLoading) {
    const loadingState = document.getElementById('loadingState');
    const gridDiv = document.getElementById('myGrid');
    const emptyState = document.getElementById('emptyState');

    if (isLoading) {
        loadingState.style.display = 'flex';
        gridDiv.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loadingState.style.display = 'none';
        // Only show grid if we have data loaded (usually we call this after success)
        // If called without context, we might show empty state, but here we assume success path shows grid.
        gridDiv.style.display = 'block';
        emptyState.style.display = 'none';
    }
}

// Get month name
function getMonthName(month) {
    return monthNames[month - 1];
}
