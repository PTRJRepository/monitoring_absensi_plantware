/**
 * Debug EmpCode mismatch
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

    console.log('=== empQuery EmpCode format (HR_EMPLOYMENT) ===');
    const r1 = await pool.request()
        .input('locCode', sql.VarChar, 'P1A')
        .query(`
            SELECT TOP 3 
                RTRIM(emt.EmpCode) AS EmpCode, 
                '[' + RTRIM(emt.EmpCode) + ']' as Bracketed,
                LEN(RTRIM(emt.EmpCode)) as Len
            FROM HR_EMPLOYMENT emt 
            WHERE UPPER(emt.LocCode) = UPPER(@locCode) 
            ORDER BY emt.EmpCode
        `);
    console.log(r1.recordset);

    console.log('\n=== attQuery EmpCode format (PR_EMP_ATTN) ===');
    const r2 = await pool.request()
        .input('locCode', sql.VarChar, 'P1A')
        .input('month', sql.Int, 12)
        .input('year', sql.Int, 2025)
        .query(`
            SELECT TOP 3 
                RTRIM(a.EmpCode) AS EmpCode, 
                '[' + RTRIM(a.EmpCode) + ']' as Bracketed,
                LEN(RTRIM(a.EmpCode)) as Len
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON RTRIM(emt.EmpCode) = RTRIM(a.EmpCode)
            WHERE UPPER(RTRIM(emt.LocCode)) = UPPER(@locCode)
            AND YEAR(a.AttnDate) = @year AND MONTH(a.AttnDate) = @month
            ORDER BY a.EmpCode
        `);
    console.log(r2.recordset);

    // Check a specific employee A0234
    console.log('\n=== Check A0234 specifically ===');
    const r3 = await pool.request().query(`
        SELECT TOP 1 
            '[' + EmpCode + ']' as Original,
            '[' + RTRIM(EmpCode) + ']' as Trimmed,
            LEN(EmpCode) as OrigLen,
            LEN(RTRIM(EmpCode)) as TrimLen
        FROM HR_EMPLOYMENT WHERE RTRIM(EmpCode) = 'A0234'
    `);
    console.log('HR_EMPLOYMENT A0234:', r3.recordset);

    const r4 = await pool.request().query(`
        SELECT TOP 1 
            '[' + EmpCode + ']' as Original,
            '[' + RTRIM(EmpCode) + ']' as Trimmed,
            LEN(EmpCode) as OrigLen,
            LEN(RTRIM(EmpCode)) as TrimLen
        FROM PR_EMP_ATTN WHERE RTRIM(EmpCode) = 'A0234'
    `);
    console.log('PR_EMP_ATTN A0234:', r4.recordset);

    await pool.close();
}

debug().catch(console.error);
