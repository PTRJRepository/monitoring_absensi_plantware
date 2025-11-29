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

async function debugAriel() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        // We found Ariel has EmpCode (from previous output, likely J0816 based on user context or similar)
        // Let's assume we need to find the code first again to be sure
        const nameQuery = "SELECT EmpCode, EmpName FROM HR_EMPLOYEE WHERE EmpName LIKE '%ARIEL SAPUTRA ( SELISA )%'";
        const empResult = await sql.query(nameQuery);

        if (empResult.recordset.length === 0) {
            console.log("Could not find Ariel by exact name. Trying LIKE '%ARIEL%' again");
            const empResult2 = await sql.query("SELECT EmpCode, EmpName FROM HR_EMPLOYEE WHERE EmpName LIKE '%ARIEL%'");
            console.table(empResult2.recordset);
            return;
        }

        const empCode = empResult.recordset[0].EmpCode;
        console.log(`Found Ariel: ${empCode}`);

        console.log(`\n--- Checking ${empCode} in HR_EMPLOYMENT ---`);
        const empEmployment = await sql.query`SELECT EmpCode, LocCode FROM HR_EMPLOYMENT WHERE EmpCode = ${empCode}`;
        console.table(empEmployment.recordset);

        if (empEmployment.recordset.length > 0) {
            console.log(`LocCode in HR_EMPLOYMENT: '${empEmployment.recordset[0].LocCode}'`);
            if (empEmployment.recordset[0].LocCode.trim() === 'ARC') {
                console.log("✅ LocCode matches 'ARC'");
            } else {
                console.log("❌ LocCode does NOT match 'ARC'");
            }
        } else {
            console.log("❌ Ariel NOT FOUND in HR_EMPLOYMENT");
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

debugAriel();
