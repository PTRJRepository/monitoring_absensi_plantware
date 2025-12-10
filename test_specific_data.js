const sql = require('mssql');

// Database configuration
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

async function testSpecificData() {
    let pool;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(dbConfig);
        console.log('✅ Connected successfully\n');

        // Test data for P1A
        console.log('📊 Testing data for P1A...');

        // Check sample attendance data
        const sampleQuery = `
            SELECT TOP 10
                a.EmpCode,
                e.EmpName,
                a.AttnDate,
                a.WorkHours,
                a.OTHours,
                a.IsPresent,
                a.IsOnWork,
                a.IsOnLeave,
                a.PhysMonth,
                a.PhysYear,
                emt.LocCode
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
            LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = a.EmpCode
            WHERE emt.LocCode = 'P1A'
            ORDER BY a.AttnDate DESC
        `;

        const sampleResult = await pool.request().query(sampleQuery);
        console.log('\nSample attendance records:');
        sampleResult.recordset.forEach((row, i) => {
            console.log(`${i+1}. ${row.EmpCode} (${row.EmpName}) - Date: ${row.AttnDate.toISOString().split('T')[0]} - WH: ${row.WorkHours} - OT: ${row.OTHours} - Present: ${row.IsPresent} - OnWork: ${row.IsOnWork} - Loc: ${row.LocCode}`);
        });

        // Check data distribution
        console.log('\n📈 WorkHours distribution:');
        const distQuery = `
            SELECT
                a.WorkHours,
                COUNT(*) as RecordCount,
                COUNT(DISTINCT a.EmpCode) as EmployeeCount
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
            WHERE emt.LocCode = 'P1A'
            AND YEAR(a.AttnDate) = 2025
            AND MONTH(a.AttnDate) = 12
            GROUP BY a.WorkHours
            ORDER BY a.WorkHours DESC
        `;

        const distResult = await pool.request().query(distQuery);
        distResult.recordset.forEach(row => {
            console.log(`- WorkHours ${row.WorkHours}: ${row.RecordCount} records, ${row.EmployeeCount} employees`);
        });

        // Check IsPresent and IsOnWork flags
        console.log('\n✅ Presence flags:');
        const presenceQuery = `
            SELECT
                IsPresent,
                IsOnWork,
                COUNT(*) as RecordCount
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
            WHERE emt.LocCode = 'P1A'
            AND YEAR(a.AttnDate) = 2025
            AND MONTH(a.AttnDate) = 12
            GROUP BY IsPresent, IsOnWork
            ORDER BY IsPresent DESC, IsOnWork DESC
        `;

        const presenceResult = await pool.request().query(presenceQuery);
        presenceResult.recordset.forEach(row => {
            console.log(`- IsPresent: ${row.IsPresent}, IsOnWork: ${row.IsOnWork} -> ${row.RecordCount} records`);
        });

        // Check specific date (Dec 9, 2025)
        console.log('\n🎯 Checking specific date (Dec 9, 2025):');
        const specificDateQuery = `
            SELECT TOP 20
                a.EmpCode,
                e.EmpName,
                a.WorkHours,
                a.OTHours,
                a.IsPresent,
                a.IsOnWork,
                a.IsOnLeave,
                a.TodayIsRestDay,
                a.TodayIsHoliday
            FROM PR_EMP_ATTN a
            JOIN HR_EMPLOYMENT emt ON emt.EmpCode = a.EmpCode
            LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = a.EmpCode
            WHERE emt.LocCode = 'P1A'
            AND CONVERT(DATE, a.AttnDate) = '2025-12-09'
            ORDER BY a.EmpCode
        `;

        const specificDateResult = await pool.request().query(specificDateQuery);
        console.log(`Found ${specificDateResult.recordset.length} records for Dec 9, 2025:`);
        specificDateResult.recordset.forEach(row => {
            console.log(`- ${row.EmpCode}: WH=${row.WorkHours}, OT=${row.OTHours}, Present=${row.IsPresent}, OnWork=${row.IsOnWork}, Leave=${row.IsOnLeave}, RestDay=${row.TodayIsRestDay}, Holiday=${row.TodayIsHoliday}`);
        });

        console.log('\n✅ Test completed successfully');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n🔌 Connection closed');
        }
    }
}

testSpecificData();