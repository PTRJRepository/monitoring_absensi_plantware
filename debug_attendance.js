require('dotenv').config();
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

// Load database configuration from config.json
let config;
try {
    const configPath = path.join(__dirname, 'config.json');
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.error('❌ Failed to load config.json:', err.message);
    process.exit(1);
}

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

async function debugAttendance() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        const empCode = 'J0816';
        const month = 11; // Assuming November based on context
        const year = 2025;

        console.log(`\n--- Checking Attendance for ${empCode} in ${month}/${year} ---`);
        const attn = await sql.query`
            SELECT COUNT(*) as count 
            FROM PR_EMP_ATTN 
            WHERE EmpCode = ${empCode} 
            AND PhysMonth = ${month} 
            AND PhysYear = ${year}
        `;
        console.log('Attendance Records Count:', attn.recordset[0].count);

        if (attn.recordset[0].count === 0) {
            console.log('❌ No attendance records found. This explains why the employee is missing from the grid.');
        } else {
            console.log('✅ Attendance records found. The issue might be something else.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

debugAttendance();
