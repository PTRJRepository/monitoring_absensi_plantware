/**
 * Debug: Check which EmpCodes from PR_EMP_ATTN match HR_EMPLOYMENT P1A
 */
require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
    server: '10.0.0.2',
    database: 'db_ptrj',
    user: 'sa',
    password: 'supp0rt@',
    port: 1888,
    options: { encrypt: false, trustServerCertificate: true }
};

async function debug() {
    const pool = await sql.connect(dbConfig);

    // Get EmpCodes that have attendance records for Dec 2025
    console.log('=== EmpCodes in PR_EMP_ATTN for Dec 2025 (sample) ===');
    const r1 = await pool.request().query(`
        SELECT DISTINCT TOP 10 
            RTRIM(a.EmpCode) AS EmpCodeFromAttn
        FROM PR_EMP_ATTN a
        WHERE YEAR(a.AttnDate) = 2025 AND MONTH(a.AttnDate) = 12
        ORDER BY RTRIM(a.EmpCode)
    `);
    console.log('Sample EmpCodes from PR_EMP_ATTN:', r1.recordset);

    // Check what LocCode these employees belong to
    console.log('\n=== What LocCode do these employees belong to? ===');
    const r2 = await pool.request().query(`
        SELECT TOP 10 
            RTRIM(a.EmpCode) AS EmpCode,
            RTRIM(emt.LocCode) AS LocCode
        FROM PR_EMP_ATTN a
        LEFT JOIN HR_EMPLOYMENT emt ON RTRIM(emt.EmpCode) = RTRIM(a.EmpCode)
        WHERE YEAR(a.AttnDate) = 2025 AND MONTH(a.AttnDate) = 12
        GROUP BY a.EmpCode, emt.LocCode
        ORDER BY RTRIM(a.EmpCode)
    `);
    console.log('EmpCode to LocCode mapping:', r2.recordset);

    // Check if A0023 (which has attendance) is in P1A
    console.log('\n=== Check A0023 (first in PR_EMP_ATTN) ===');
    const r3 = await pool.request().query(`
        SELECT 
            RTRIM(EmpCode) AS EmpCode,
            RTRIM(LocCode) AS LocCode
        FROM HR_EMPLOYMENT 
        WHERE RTRIM(EmpCode) = 'A0023'
    `);
    console.log('A0023 location:', r3.recordset);

    // Check which LocCodes have attendance data in Dec 2025
    console.log('\n=== LocCodes with attendance in Dec 2025 ===');
    const r4 = await pool.request().query(`
        SELECT 
            RTRIM(emt.LocCode) AS LocCode,
            COUNT(DISTINCT a.EmpCode) AS EmpCount,
            COUNT(*) AS AttendanceRecords
        FROM PR_EMP_ATTN a
        JOIN HR_EMPLOYMENT emt ON RTRIM(emt.EmpCode) = RTRIM(a.EmpCode)
        WHERE YEAR(a.AttnDate) = 2025 AND MONTH(a.AttnDate) = 12
        GROUP BY emt.LocCode
        ORDER BY COUNT(*) DESC
    `);
    console.log('LocCodes with attendance:', r4.recordset);

    await pool.close();
}

debug().catch(console.error);
