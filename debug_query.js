/**
 * Debug Query Script - Check why attendance data not showing properly
 */

require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
    server: '10.0.0.2',
    database: 'db_ptrj',
    user: 'sa',
    password: 'supp0rt@',
    port: 1888,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function debug() {
    let pool;
    try {
        console.log('Connecting to database...');
        pool = await sql.connect(dbConfig);
        console.log('Connected!\n');

        // 1. Check distinct months directly from PR_EMP_ATTN for P1A
        console.log('=== TEST 1: All distinct periods in PR_EMP_ATTN with P1A employees ===');
        const r1 = await pool.request().query(`
            SELECT DISTINCT 
                YEAR(a.AttnDate) AS year,
                MONTH(a.AttnDate) AS month,
                COUNT(*) as recordCount
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON RTRIM(emt.EmpCode) = RTRIM(a.EmpCode)
            WHERE UPPER(RTRIM(emt.LocCode)) = 'P1A'
            GROUP BY YEAR(a.AttnDate), MONTH(a.AttnDate)
            ORDER BY year DESC, month DESC
        `);
        console.log('Periods found:', r1.recordset);

        // 2. Check sample AttnDate values
        console.log('\n=== TEST 2: Sample AttnDate values for P1A ===');
        const r2 = await pool.request().query(`
            SELECT TOP 10 
                RTRIM(a.EmpCode) as EmpCode,
                a.AttnDate,
                a.WorkHours,
                a.PhysMonth,
                a.PhysYear,
                RTRIM(emt.LocCode) as LocCode
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON RTRIM(emt.EmpCode) = RTRIM(a.EmpCode)
            WHERE UPPER(RTRIM(emt.LocCode)) = 'P1A'
            ORDER BY a.AttnDate DESC
        `);
        console.log('Sample records:', r2.recordset);

        // 3. Check if JOIN issue - compare counts
        console.log('\n=== TEST 3: Check JOIN issue ===');
        const r3 = await pool.request().query(`
            SELECT 
                'Total in PR_EMP_ATTN for locCode P1A (after JOIN)' as description,
                COUNT(*) as count
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON RTRIM(emt.EmpCode) = RTRIM(a.EmpCode)
            WHERE UPPER(RTRIM(emt.LocCode)) = 'P1A'
        `);
        console.log(r3.recordset[0]);

        const r4 = await pool.request().query(`
            SELECT 
                'Total in PR_EMP_ATTN (all)' as description,
                COUNT(*) as count
            FROM PR_EMP_ATTN
        `);
        console.log(r4.recordset[0]);

        // 4. Check LocCode values in the table
        console.log('\n=== TEST 4: All distinct LocCode values ===');
        const r5 = await pool.request().query(`
            SELECT DISTINCT RTRIM(LocCode) as LocCode, COUNT(*) as EmpCount
            FROM HR_EMPLOYMENT
            GROUP BY LocCode
            ORDER BY LocCode
        `);
        console.log('LocCodes:', r5.recordset);

        // 5. Test the exact query used by available-months endpoint
        console.log('\n=== TEST 5: Exact available-months query ===');
        const r6 = await pool.request()
            .input('locCode', sql.VarChar, 'P1A')
            .query(`
                SELECT DISTINCT
                    YEAR(a.AttnDate) AS year,
                    MONTH(a.AttnDate) AS month
                FROM PR_EMP_ATTN a
                JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
                WHERE UPPER(emt.LocCode) = UPPER(@locCode)
                ORDER BY year DESC, month DESC
            `);
        console.log('Available months (API query):', r6.recordset);

        // 6. Check if RTRIM is needed
        console.log('\n=== TEST 6: Check if RTRIM is needed for JOIN ===');
        const r7 = await pool.request().query(`
            SELECT TOP 5 
                '[' + a.EmpCode + ']' as AttnEmpCode,
                '[' + emt.EmpCode + ']' as EmtEmpCode,
                LEN(a.EmpCode) as AttnLen,
                LEN(emt.EmpCode) as EmtLen
            FROM PR_EMP_ATTN a, HR_EMPLOYMENT emt
            WHERE RTRIM(a.EmpCode) = RTRIM(emt.EmpCode)
            AND UPPER(RTRIM(emt.LocCode)) = 'P1A'
        `);
        console.log('EmpCode comparison:', r7.recordset);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        if (pool) await pool.close();
    }
}

debug();
