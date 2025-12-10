/**
 * Test Database Connection Script
 * Run with: node test_db_connection.js
 */

require('dotenv').config();
const sql = require('mssql');

// Database configuration - same as server.js
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

console.log('🔗 Testing database connection...');
console.log('   Server:', dbConfig.server);
console.log('   Port:', dbConfig.port);
console.log('   Database:', dbConfig.database);
console.log('   User:', dbConfig.user);
console.log('');

async function testConnection() {
    let pool;
    try {
        console.log('⏳ Connecting to SQL Server...');
        pool = await sql.connect(dbConfig);
        console.log('✅ Connected successfully!\n');

        // Test 1: Check PR_EMP_ATTN table
        console.log('📊 Test 1: Checking PR_EMP_ATTN table...');
        const countResult = await pool.request().query(`
            SELECT COUNT(*) as total FROM PR_EMP_ATTN
        `);
        console.log('   Total records in PR_EMP_ATTN:', countResult.recordset[0].total);

        // Test 2: Get sample data from PR_EMP_ATTN
        console.log('\n📊 Test 2: Getting sample AttnDate values...');
        const sampleResult = await pool.request().query(`
            SELECT TOP 5 
                EmpCode,
                AttnDate,
                MONTH(AttnDate) as Month,
                YEAR(AttnDate) as Year,
                LocCode,
                PhysMonth,
                PhysYear
            FROM PR_EMP_ATTN
            ORDER BY AttnDate DESC
        `);

        if (sampleResult.recordset.length > 0) {
            console.log('   Sample records:');
            sampleResult.recordset.forEach((row, i) => {
                console.log(`   ${i + 1}. EmpCode: ${row.EmpCode}, AttnDate: ${row.AttnDate}, LocCode: ${row.LocCode}, PhysMonth: ${row.PhysMonth}, PhysYear: ${row.PhysYear}`);
            });
        } else {
            console.log('   ⚠️ No records found in PR_EMP_ATTN');
        }

        // Test 3: Get available months (same query as the API)
        console.log('\n📊 Test 3: Testing available-months query for P1A...');
        const monthsResult = await pool.request()
            .input('locCode', sql.VarChar, 'P1A')
            .query(`
                SELECT DISTINCT 
                    YEAR(a.AttnDate) AS year,
                    MONTH(a.AttnDate) AS month
                FROM PR_EMP_ATTN a
                JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
                WHERE emt.LocCode = @locCode
                ORDER BY year DESC, month DESC
            `);

        if (monthsResult.recordset.length > 0) {
            console.log('   Available periods for P1A:');
            monthsResult.recordset.forEach((row, i) => {
                console.log(`   ${i + 1}. ${row.year}-${String(row.month).padStart(2, '0')}`);
            });
        } else {
            console.log('   ⚠️ No periods found for locCode P1A');
        }

        // Test 4: Get list of LocCodes with data
        console.log('\n📊 Test 4: Getting list of LocCodes with attendance data...');
        const locCodesResult = await pool.request().query(`
            SELECT DISTINCT emt.LocCode, COUNT(*) as RecordCount
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
            GROUP BY emt.LocCode
            ORDER BY emt.LocCode
        `);

        if (locCodesResult.recordset.length > 0) {
            console.log('   LocCodes with attendance data:');
            locCodesResult.recordset.forEach((row) => {
                console.log(`   - ${row.LocCode}: ${row.RecordCount} records`);
            });
        } else {
            console.log('   ⚠️ No LocCodes with attendance data found');
        }

        console.log('\n✅ All tests completed successfully!');

    } catch (err) {
        console.error('\n❌ Database connection failed!');
        console.error('   Error:', err.message);
        if (err.code) console.error('   Code:', err.code);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n🔌 Connection closed.');
        }
    }
}

testConnection();
