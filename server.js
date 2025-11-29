require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
        const { locCode, month, year, includeInactive = false } = req.query;

        if (!locCode || !month || !year) {
            return res.status(400).json({
                error: 'Missing required parameters: locCode, month, year'
            });
        }

        const daysInMonth = new Date(year, month, 0).getDate();

        if (!pool) {
            // Fallback data untuk development
            const employees = [
                { empCode: 'A0749', gangCode: 'G1', empName: 'Employee A' },
                { empCode: 'B1001', gangCode: 'G2', empName: 'Employee B' },
                { empCode: 'C2050', gangCode: 'G2', empName: 'Employee C' },
                { empCode: 'D3011', gangCode: 'G3', empName: 'Employee D' }
            ];

            const rows = employees.map(({ empCode, gangCode, empName }) => {
                const row = { empCode, gangCode, empName, month, year };
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(parseInt(year), parseInt(month) - 1, day);
                    const isSunday = date.getDay() === 0;
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
                return row;
            });

            return res.json({
                success: true,
                data: rows,
                daysInMonth,
                totalEmployees: rows.length,
                location: locCode
            });
        }

        // Query untuk mendapatkan semua employee di lokasi tersebut
        const empQuery = `
            SELECT DISTINCT
                emt.EmpCode,
                e.EmpName,
                g.GangCode,
                g.GangName
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

        // Query untuk mendapatkan data absensi semua employee
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

        // Group attendance data by employee
        const attByEmp = {};
        attResult.recordset.forEach(record => {
            const emp = record.EmpCode;
            if (!attByEmp[emp]) {
                attByEmp[emp] = {
                    empName: record.EmpName,
                    gangCode: record.GangCode,
                    records: []
                };
            }
            attByEmp[emp].records.push(record);
        });

        // Build final result with all employees and their attendance
        const rows = employees.map(emp => {
            const dateMap = {};
            const empAttData = attByEmp[emp.EmpCode];

            if (empAttData && empAttData.records) {
                empAttData.records.forEach(record => {
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
            }

            const row = {
                empCode: emp.EmpCode,
                gangCode: emp.GangCode,
                empName: emp.EmpName,
                month,
                year
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

        res.json({
            success: true,
            data: rows,
            daysInMonth,
            totalEmployees: rows.length,
            location: locCode
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
