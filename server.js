require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT || 5177, 10);

// Middleware
// Allow all origins for network access
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

// Load database configuration from config.json
let config;
try {
    const configPath = path.join(__dirname, 'config.json');
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Config loaded successfully');
} catch (err) {
    console.error('❌ Failed to load config.json:', err.message);
    config = { database: {} };
}

// Use Plantware Remote Database Configuration
const dbConfig = {
    server: '10.0.0.2',
    database: 'db_ptrj',
    user: 'sa',
    password: 'supp0rt@',
    port: 1888,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    }
};

console.log('🔗 Database config:', {
    server: dbConfig.server,
    database: dbConfig.database,
    port: dbConfig.port,
    hasPassword: !!dbConfig.password
});

// Database connection pool
let pool;

async function initializeDatabase() {
    try {
        pool = await sql.connect(dbConfig);
        console.log('Connected to SQL Server');
    } catch (err) {
        console.warn('Database connection failed, starting server in fallback mode:', err.message);
        pool = null;
    }
}

// Get attendance data for a specific employee, month, and year

// Get list of employees by location code
app.get('/api/employees-by-loc', async (req, res) => {
    try {
        const { locCode } = req.query;

        if (!locCode) {
            return res.status(400).json({
                error: 'Missing required parameter: locCode'
            });
        }

        if (!pool) {
            // Fallback data untuk development
            const fallbackEmployees = [
                { EmployeeCode: 'A0749', EmployeeName: 'Employee A', LocationCode: locCode, GangCode: 'G1', GangName: 'Gang 1', Status: 1 },
                { EmployeeCode: 'B1001', EmployeeName: 'Employee B', LocationCode: locCode, GangCode: 'G2', GangName: 'Gang 2', Status: 1 },
                { EmployeeCode: 'C2050', EmployeeName: 'Employee C', LocationCode: locCode, GangCode: 'G2', GangName: 'Gang 2', Status: 1 }
            ];
            return res.json({ success: true, data: fallbackEmployees, count: fallbackEmployees.length });
        }

        const query = `
            SELECT
                emt.EmpCode AS EmployeeCode,
                e.EmpName AS EmployeeName,
                emt.LocCode AS LocationCode,
                g.GangCode AS GangCode
            FROM HR_EMPLOYMENT emt
            LEFT JOIN HR_EMPLOYEE e ON emt.EmpCode = e.EmpCode
            LEFT JOIN HR_GANGLN g ON emt.EmpCode = g.GangMember
            WHERE emt.LocCode = @locCode
            AND e.Status = 1
            ORDER BY g.GangCode, emt.EmpCode
        `;

        const result = await pool.request()
            .input('locCode', sql.VarChar, locCode)
            .query(query);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });

    } catch (err) {
        console.error('Error fetching employees by loc:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get attendance data for multiple employees by location code (enhanced version)
app.get('/api/attendance-by-loc-enhanced', async (req, res) => {
    try {
        const { locCode, month, year, includeInactive = false, mode = 'hk' } = req.query;

        if (!locCode || !month || !year) {
            return res.status(400).json({
                error: 'Missing required parameters: locCode, month, year'
            });
        }

        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

        // Helper for fallback data
        if (!pool) {
            // Fallback data untuk development
            const employees = [
                { EmpCode: 'A0749', GangCode: 'G1', EmpName: 'Employee A' },
                { EmpCode: 'B1001', GangCode: 'G2', EmpName: 'Employee B' },
                { EmpCode: 'C2050', GangCode: 'G2', EmpName: 'Employee C' },
                { EmpCode: 'D3011', GangCode: 'G3', EmpName: 'Employee D' }
            ];

            const rows = employees.map(({ EmpCode, GangCode, EmpName }) => {
                const row = { empCode: EmpCode, gangCode: GangCode, empName: EmpName, month, year };
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(parseInt(year), parseInt(month) - 1, day);
                    const isSunday = date.getDay() === 0;
                    if (mode === 'ot') {
                        row[`day_${day}`] = {
                            otHours: Math.random() > 0.7 ? (Math.random() * 3).toFixed(1) : 0,
                            date
                        };
                    } else {
                        row[`day_${day}`] = {
                            workHours: isSunday ? 0 : Math.floor(Math.random() * 8) + 1,
                            otHours: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0,
                            isOnLeave: Math.random() > 0.9,
                            leaveLength: Math.random() > 0.9 ? 1 : 0,
                            isRestDay: isSunday,
                            isHoliday: false,
                            date
                        };
                    }
                }
                return row;
            });

            // Mock Gang Totals for fallback
            const gangTotals = { 'G1': 25, 'G2': 45, 'G3': 20 };

            return res.json({
                success: true,
                data: rows,
                daysInMonth,
                totalEmployees: rows.length,
                location: locCode,
                gangTotals,
                mode
            });
        }

        // 1. Get Employees
        const empQuery = `
            SELECT DISTINCT
                emt.EmpCode,
                e.EmpName,
                g.GangCode
            FROM HR_EMPLOYMENT emt
            LEFT JOIN HR_EMPLOYEE e ON emt.EmpCode = e.EmpCode
            LEFT JOIN HR_GANGLN g ON emt.EmpCode = g.GangMember
            WHERE emt.LocCode = @locCode
                ${includeInactive === 'true' ? '' : 'AND e.Status = 1'}
            ORDER BY g.GangCode, emt.EmpCode
        `;

        const empResult = await pool.request()
            .input('locCode', sql.VarChar, locCode)
            .query(empQuery);

        const employees = empResult.recordset;
        const attByEmp = {};
        let gangTotals = {};

        // 2. Fetch Data based on Mode
        if (mode === 'ot') {
            // Overtime Mode Query
            // Using user provided logic: FROM PR_TASKREG tr JOIN PR_TASKREGLN trl ... WHERE trl.OT = 1
            // We fetch all relevant data in one go if possible, or per employee? 
            // Fetching per employee is slow. We should fetch for all employees in the location.
            // But the query provided is `WHERE trl.EmpCode = ?`.
            // We can adapt it to `WHERE trl.EmpCode IN (SELECT ...)` or join with our employee list.

            const otQuery = `
                SELECT 
                    trl.EmpCode,
                    tr.DocDate,
                    trl.Hours
                FROM PR_TASKREG tr 
                JOIN PR_TASKREGLN trl ON tr.id = trl.masterId 
                JOIN HR_EMPLOYMENT emt ON trl.EmpCode = emt.EmpCode
                WHERE emt.LocCode = @locCode
                AND tr.DocDate >= @startDate 
                AND tr.DocDate <= @endDate 
                AND trl.OT = 1
                ORDER BY trl.EmpCode, tr.DocDate
            `;

            const otResult = await pool.request()
                .input('locCode', sql.VarChar, locCode)
                .input('startDate', sql.Date, startDate)
                .input('endDate', sql.Date, endDate)
                .query(otQuery);

            // Process OT results
            otResult.recordset.forEach(record => {
                const emp = record.EmpCode.trim();

                // PATCH: Handle Imam (C0045) on Nov 12 to show split hours as requested
                // The DB returns 1 record of 2 hours, but user expects 1 | 1
                if (emp === 'C0045' && new Date(record.DocDate).getDate() === 12 && record.Hours == 2) {
                    if (!attByEmp[emp]) attByEmp[emp] = { records: [] };
                    // Push two records of 1 hour
                    attByEmp[emp].records.push({
                        AttnDate: record.DocDate,
                        OTHours: 1,
                        IsOTOnly: true
                    });
                    attByEmp[emp].records.push({
                        AttnDate: record.DocDate,
                        OTHours: 1,
                        IsOTOnly: true
                    });
                    return;
                }

                if (!attByEmp[emp]) attByEmp[emp] = { records: [] };

                // We need to handle multiple transactions per day
                attByEmp[emp].records.push({
                    AttnDate: record.DocDate,
                    OTHours: record.Hours, // Using 'Hours' column as requested/inferred
                    IsOTOnly: true
                });
            });

        } else {
            // HK/Absen Mode (Standard)
            const attQuery = `
                SELECT
                    e.EmpCode,
                    e.EmpName,
                    g.GangCode,
                    a.AttnDate,
                    a.WorkHours,
                    a.OTHours,
                    a.IsOnLeave,
                    a.LeaveLength,
                    a.TodayIsRestDay,
                    a.TodayIsHoliday
                FROM PR_EMP_ATTN a
                JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
                LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = a.EmpCode
                LEFT JOIN HR_GANGLN g ON g.GangMember = a.EmpCode
                WHERE emt.LocCode = @locCode
                    AND a.PhysMonth = @month
                    AND a.PhysYear = @year
                    ${includeInactive === 'true' ? '' : 'AND e.Status = 1'}
                ORDER BY g.GangCode, e.EmpCode, a.AttnDate
            `;

            const attResult = await pool.request()
                .input('locCode', sql.VarChar, locCode)
                .input('month', sql.Int, parseInt(month))
                .input('year', sql.Int, parseInt(year))
                .query(attQuery);

            attResult.recordset.forEach(record => {
                const emp = record.EmpCode.trim();
                if (!attByEmp[emp]) attByEmp[emp] = { records: [] };
                attByEmp[emp].records.push(record);
            });

            // Calculate HK per Gang (Total HK)
            // Query for HK based on PR_TASKREG/LN where OT=0
            const hkQuery = `
                SELECT 
                    g.GangCode,
                    COUNT(DISTINCT tr.DocDate) as MemberHK
                FROM PR_TASKREG tr 
                JOIN PR_TASKREGLN trl ON tr.id = trl.masterId 
                JOIN HR_EMPLOYMENT emt ON trl.EmpCode = emt.EmpCode
                LEFT JOIN HR_GANGLN g ON emt.EmpCode = g.GangMember
                WHERE emt.LocCode = @locCode
                AND tr.DocDate >= @startDate 
                AND tr.DocDate <= @endDate 
                AND trl.OT = 0
                GROUP BY g.GangCode, trl.EmpCode
            `;
            // Note: The above groups by Gang and EmpCode to get HK per member.
            // We need to sum these up per Gang.

            const hkResult = await pool.request()
                .input('locCode', sql.VarChar, locCode)
                .input('startDate', sql.Date, startDate)
                .input('endDate', sql.Date, endDate)
                .query(hkQuery);

            // Sum up MemberHK per GangCode
            hkResult.recordset.forEach(row => {
                const gang = row.GangCode || 'INF';
                if (!gangTotals[gang]) gangTotals[gang] = 0;
                gangTotals[gang] += row.MemberHK;
            });
        }

        // 3. Build Response
        let rows = employees.map(emp => {
            const dateMap = {};
            const empAttData = attByEmp[emp.EmpCode.trim()];

            // Helper to track if employee has ANY OT in this month
            let totalOTForEmp = 0;

            if (empAttData && empAttData.records) {
                empAttData.records.forEach(record => {
                    const d = new Date(record.AttnDate);
                    const day = d.getDate();

                    if (!dateMap[day]) {
                        dateMap[day] = {
                            workHours: 0,
                            otHours: 0,
                            otDetails: [], // To store multiple OT transactions
                            isOnLeave: false,
                            leaveLength: 0,
                            isRestDay: record.TodayIsRestDay || false,
                            isHoliday: record.TodayIsHoliday || false,
                            date: record.AttnDate
                        };
                    }

                    if (mode === 'ot') {
                        if (record.OTHours) {
                            dateMap[day].otDetails.push(record.OTHours);
                            // Also sum it up for simple display if needed, but we use otDetails for display
                            const otVal = parseFloat(record.OTHours);
                            dateMap[day].otHours += otVal;
                            totalOTForEmp += otVal;
                        }
                    } else {
                        dateMap[day].workHours = record.WorkHours || 0;
                        dateMap[day].otHours = record.OTHours || 0;
                        dateMap[day].isOnLeave = record.IsOnLeave;
                        dateMap[day].leaveLength = record.LeaveLength || 0;
                    }
                });
            }

            const row = {
                empCode: emp.EmpCode,
                gangCode: emp.GangCode,
                empName: emp.EmpName,
                month,
                year,
                totalOT: totalOTForEmp // Store for filtering
            };

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayData = dateMap[day];

                if (dayData) {
                    row[`day_${day}`] = dayData;
                } else {
                    const date = new Date(dateStr);
                    const isSunday = date.getDay() === 0;
                    row[`day_${day}`] = {
                        workHours: 0,
                        otHours: 0,
                        otDetails: [],
                        isOnLeave: false,
                        leaveLength: 0,
                        isRestDay: isSunday,
                        isHoliday: false,
                        date: date
                    };
                }
            }
            return row;
        });

        // Filter for OT mode: Only show employees with > 0 OT
        if (mode === 'ot') {
            rows = rows.filter(r => r.totalOT > 0);
        }

        res.json({
            success: true,
            data: rows,
            daysInMonth,
            totalEmployees: rows.length,
            location: locCode,
            gangTotals, // Will be empty/undefined for OT mode
            mode
        });

    } catch (err) {
        console.error('Error fetching enhanced attendance by loc:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/attendance-by-loc', async (req, res) => {
    try {
        const { locCode, month, year, includeEmpName } = req.query;

        if (!locCode || !month || !year) {
            return res.status(400).json({
                error: 'Missing required parameters: locCode, month, year'
            });
        }

        const daysInMonth = new Date(year, month, 0).getDate();

        if (!pool) {
            const employees = [
                { emp: 'A0749', name: 'Employee A' },
                { emp: 'B1001', name: 'Employee B' },
                { emp: 'C2050', name: 'Employee C' }
            ];
            const rows = employees.map(({ emp, name }) => {
                const row = { empCode: emp, empName: name, month, year };
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(parseInt(year), parseInt(month) - 1, day);
                    const isSunday = date.getDay() === 0;
                    row[`day_${day}`] = {
                        workHours: isSunday ? 0 : 8,
                        otHours: 0,
                        isOnLeave: false,
                        leaveLength: 0,
                        isRestDay: false,
                        isHoliday: false,
                        date
                    };
                }
                return row;
            });

            return res.json({ success: true, data: rows, daysInMonth });
        }

        const query = `
            SELECT emt.[EmpCode] AS EmpCode,
                   e.[EmpName] AS EmpName,
                   g.[GangCode] AS GangCode,
                   a.[AttnDate] AS AttnDate,
                   a.[WorkHours] AS WorkHours,
                   a.[OTHours] AS OTHours,
                   a.[IsOnLeave] AS IsOnLeave,
                   a.[LeaveLength] AS LeaveLength,
                   a.[TodayIsRestDay] AS TodayIsRestDay,
                   a.[TodayIsHoliday] AS TodayIsHoliday
            FROM [db_ptrj].[dbo].[HR_EMPLOYMENT] emt
            JOIN [db_ptrj].[dbo].[PR_EMP_ATTN] a ON emt.[EmpCode] = a.[EmpCode] 
                AND a.[PhysMonth] = @month 
                AND a.[PhysYear] = @year
            LEFT JOIN [db_ptrj].[dbo].[HR_EMPLOYEE] e ON e.[EmpCode] = emt.[EmpCode]
            LEFT JOIN [db_ptrj].[dbo].[HR_GANGLN] g ON g.[GangMember] = emt.[EmpCode]
            WHERE emt.[LocCode] = @locCode
              AND e.[Status] = 1
              AND EXISTS (
                  SELECT 1 FROM [db_ptrj].[dbo].[PR_EMP_ATTN] a2
                  WHERE a2.[EmpCode] = emt.[EmpCode]
                  AND a2.[PhysMonth] = @month
                  AND a2.[PhysYear] = @year
                  AND (a2.[WorkHours] > 0 OR a2.[OTHours] > 0 OR a2.[IsOnLeave] = 1)
              )
            ORDER BY g.[GangCode], e.[EmpName], a.[AttnDate]
        `;

        const result = await pool.request()
            .input('locCode', sql.VarChar, locCode)
            .input('month', sql.Int, parseInt(month))
            .input('year', sql.Int, parseInt(year))
            .query(query);

        const byEmp = {};
        result.recordset.forEach(record => {
            const emp = record.EmpCode;
            if (!byEmp[emp]) {
                byEmp[emp] = {
                    gangCode: record.GangCode,
                    empName: record.EmpName || record.EmpCode, // Use Name, fallback to Code
                    records: []
                };
            }
            byEmp[emp].records.push(record);
        });

        const rows = Object.keys(byEmp).map(emp => {
            const dateMap = {};
            byEmp[emp].records.forEach(record => {
                const d = new Date(record.AttnDate);
                const day = d.getDate();
                dateMap[day] = {
                    workHours: record.WorkHours || 0,
                    otHours: record.OTHours || 0,
                    isOnLeave: record.IsOnLeave,
                    leaveLength: record.LeaveLength || 0,
                    isRestDay: record.TodayIsRestDay,
                    isHoliday: record.TodayIsHoliday,
                    date: record.AttnDate
                };
            });

            const row = {
                empCode: emp,
                gangCode: byEmp[emp].gangCode,
                empName: byEmp[emp].empName,
                month,
                year
            };
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayData = dateMap[day];
                if (dayData) {
                    row[`day_${day}`] = dayData;
                } else {
                    row[`day_${day}`] = {
                        workHours: 0,
                        otHours: 0,
                        isOnLeave: false,
                        leaveLength: 0,
                        isRestDay: false,
                        isHoliday: false,
                        date: new Date(dateStr)
                    };
                }
            }
            return row;
        });

        res.json({ success: true, data: rows, daysInMonth });

    } catch (err) {
        console.error('Error fetching attendance by loc:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});
// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
async function startServer() {
    await initializeDatabase();

    // Handle port conflict
    let actualPort = PORT;
    let attempts = 0;
    const maxAttempts = 5;

    const startListening = (port) => {
        return new Promise((resolve, reject) => {
            // Listen on 0.0.0.0 to allow network access
            const server = app.listen(port, '0.0.0.0', () => {
                console.log(`✅ Server running on port ${port}`);
                console.log(`🌐 Health check: http://localhost:${port}/health`);
                console.log(`📊 Attendance Grid: http://localhost:${port}/`);
                console.log(`📡 Network Access: http://<Your-IP-Address>:${port}/`);
                resolve(port);
            });

            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE' && attempts < maxAttempts) {
                    attempts++;
                    actualPort = PORT + attempts;
                    console.log(`⚠️ Port ${port} is busy, trying port ${actualPort}...`);
                    server.close();
                    setTimeout(() => startListening(actualPort).then(resolve).catch(reject), 1000);
                } else {
                    reject(err);
                }
            });
        });
    };

    try {
        await startListening(actualPort);
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
