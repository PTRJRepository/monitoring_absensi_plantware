const sql = require('mssql');
const path = require('path');
const fs = require('fs');

// Load database configuration
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

async function investigateImam() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        // 1. Raw Query for Imam in Nov 2025 (specifically checking the 12th)
        const rawQuery = `
            SELECT 
                TRLN.EmpCode, 
                TRLN.EmpName, 
                TR.DocDate, 
                TRLN.Hours 
            FROM [db_ptrj].[dbo].[PR_TASKREGLN] AS TRLN 
            INNER JOIN [db_ptrj].[dbo].[PR_TASKREG] AS TR ON TR.[ID] = TRLN.[MasterID] 
            WHERE 
                TRLN.OT = '1' 
                AND MONTH(TR.DocDate) = 11 
                AND YEAR(TR.DocDate) = 2025
                AND TRLN.EmpName LIKE 'IMAM ( ASINAH )%'
            ORDER BY TR.DocDate ASC
        `;
        
        console.log('\n--- Raw Database Records ---');
        const result = await sql.query(rawQuery);
        
        // Filter for 12th specifically
        const on12th = result.recordset.filter(r => {
            const d = new Date(r.DocDate);
            return d.getDate() === 12;
        });
        
        if (on12th.length > 1) {
            console.log('✅ CONFIRMED: Multiple records found for 12th Nov:', on12th);
        } else {
            console.log('❌ WARNING: Only found these records for 12th Nov:', on12th);
        }

        // 2. Check API Response Logic (simulated)
        console.log('\n--- Checking API Logic Simulation ---');
        // The API groups by date. If the database returns 2 rows, the API *should* see 2 rows.
        // Let's verify the API response for this employee.
        
        // Need loc code first
        const locQuery = `SELECT LocCode FROM HR_EMPLOYMENT WHERE EmpCode = '${result.recordset[0].EmpCode}'`;
        const locRes = await sql.query(locQuery);
        const locCode = locRes.recordset[0].LocCode.trim();
        
        console.log(`Fetching API for Loc: ${locCode}, Emp: ${result.recordset[0].EmpCode}`);
        
        const url = `http://localhost:3001/api/attendance-by-loc-enhanced?locCode=${locCode}&month=11&year=2025&includeEmpName=true&mode=ot`;
        const response = await fetch(url);
        const apiData = await response.json();
        
        const empData = apiData.data.find(e => e.empCode.trim() === result.recordset[0].EmpCode.trim());
        
        if (empData) {
            const day12 = empData.day_12;
            console.log('API Data for Day 12:', JSON.stringify(day12, null, 2));
        } else {
            console.log('❌ Employee not found in API response');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

investigateImam();
