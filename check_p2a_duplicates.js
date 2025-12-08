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

async function findDuplicateOTInP2A() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        // User's exact query logic adapted for P2A location
        const query = `
            SELECT 
                TRLN.EmpCode, 
                TRLN.EmpName, 
                TR.DocDate, 
                COUNT(*) AS JumlahScan 
            FROM [db_ptrj].[dbo].[PR_TASKREGLN] AS TRLN 
            INNER JOIN [db_ptrj].[dbo].[PR_TASKREG] AS TR ON TR.[ID] = TRLN.[MasterID] 
            JOIN HR_EMPLOYMENT emt ON TRLN.EmpCode = emt.EmpCode
            WHERE 
                TRLN.OT = '1' 
                AND MONTH(TR.DocDate) = 11 
                AND YEAR(TR.DocDate) = 2025
                AND emt.LocCode = 'P2A'
            GROUP BY 
                TRLN.EmpCode, 
                TRLN.EmpName, 
                TR.DocDate 
            HAVING 
                COUNT(*) > 1 
            ORDER BY 
                TRLN.EmpCode, 
                TR.DocDate;
        `;

        const result = await sql.query(query);
        
        if (result.recordset.length === 0) {
            console.log('❌ No employees in P2A have multiple OT records on the same day in Nov 2025.');
            
            // Check Imam specifically again to be absolutely sure
            console.log('\nChecking Imam specifically for any duplicate OT (raw rows)...');
            const imamQuery = `
                SELECT TRLN.EmpCode, TRLN.EmpName, TR.DocDate, TRLN.Hours
                FROM PR_TASKREGLN TRLN
                JOIN PR_TASKREG TR ON TR.ID = TRLN.MasterID
                WHERE TRLN.EmpName LIKE 'IMAM ( ASINAH )%'
                AND MONTH(TR.DocDate) = 11
                AND YEAR(TR.DocDate) = 2025
                AND TRLN.OT = '1'
                ORDER BY TR.DocDate
            `;
            const imamResult = await sql.query(imamQuery);
            console.table(imamResult.recordset);

        } else {
            console.log('✅ Found employees in P2A with multiple OT records:');
            console.table(result.recordset);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

findDuplicateOTInP2A();
