// Configuration
// Use relative path to allow access from network IPs and match the server port automatically
const API_BASE_URL = '/api';

// Global variables
let gridApi;
let gridColumnApi;

// Day names in Indonesian
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Set current month and year as default
    const now = new Date();
    document.getElementById('month').value = now.getMonth() + 1;
    document.getElementById('year').value = now.getFullYear();

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

    document.getElementById('year').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadAttendanceByLoc();
    });

    const locCodeInput = document.getElementById('locCode');
    if (locCodeInput) {
        locCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadAttendanceByLoc();
        });
    }

    // Removed auto size button functionality
}

// Generate column definitions for the grid
function generateColumnDefs(year, month, daysInMonth) {
    const columnDefs = [
        {
            headerName: 'Employee',
            field: 'empName',
            pinned: 'left',
            width: 150,
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
    const month = document.getElementById('month').value;
    const year = document.getElementById('year').value;

    if (!locCode) {
        alert('Please enter a loc code');
        return;
    }

    if (!month || !year) {
        alert('Please select month and year');
        return;
    }

    console.log(`🔍 Loading data for: ${locCode}, ${month}/${year}`);
    showLoading(true);

    try {
        const response = await fetch(
            `${API_BASE_URL}/attendance-by-loc?locCode=${encodeURIComponent(locCode)}&month=${month}&year=${year}&includeEmpName=true`
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

        const daysInMonth = result.daysInMonth || new Date(year, month, 0).getDate();
        const columnDefs = generateColumnDefs(parseInt(year), parseInt(month), daysInMonth);

        // Clean and prepare row data
        const cleanData = result.data.map(row => {
            let totalPresenceCount = 0;

            const cleanRow = {
                empName: (row.empName || row.empCode || 'Unknown').trim(),  // Use empName if available, fallback to empCode
                month: row.month,
                year: row.year
            };

            // Add day columns with proper data structure
            for (let day = 1; day <= daysInMonth; day++) {
                const dayData = row[`day_${day}`];
                let hasData = false;

                if (dayData && typeof dayData === 'object') {
                    // Check if meaningful data exists for the count
                     hasData = (dayData.workHours > 0 || dayData.otHours > 0 || dayData.isOnLeave || dayData.isHoliday || dayData.isRestDay);

                    cleanRow[`day_${day}`] = {
                        workHours: dayData.workHours || 0,
                        otHours: dayData.otHours || 0,
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

        if (gridApi) {
            gridApi.setColumnDefs(columnDefs);
            gridApi.setRowData(cleanData);
            console.log('✅ Grid updated with existing API');
        } else {
            initializeGrid(columnDefs, cleanData);
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
        headerHeight: 70, // Increased height to accommodate two-line headers
        suppressHorizontalScroll: false,
        onGridReady: (params) => {
            gridApi = params.api;
            gridColumnApi = params.columnApi;
            params.api.sizeColumnsToFit();
        },
        onFirstDataRendered: (params) => {
            params.api.sizeColumnsToFit();
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
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month - 1];
}
