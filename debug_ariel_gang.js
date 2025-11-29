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

async function debugArielGang() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        const nameQuery = "SELECT EmpCode, EmpName FROM HR_EMPLOYEE WHERE EmpName LIKE '%ARIEL SAPUTRA ( SELISA )%'";
        const empResult = await sql.query(nameQuery);

        if (empResult.recordset.length === 0) {
            console.log("Could not find Ariel by exact name.");
            return;
        }

        const empCode = empResult.recordset[0].EmpCode;
        console.log(`Found Ariel: ${empCode}`);

        console.log(`\n--- Checking GangCode for ${empCode} in HR_GANGLN ---`);
        const gangResult = await sql.query`SELECT GangCode, GangMember FROM HR_GANGLN WHERE GangMember = ${empCode}`;

        if (gangResult.recordset.length > 0) {
            const gangCode = gangResult.recordset[0].GangCode;
            console.log(`ACTUAL GangCode: '${gangCode}'`); // Log clearly
            console.log(`Trimmed GangCode: '${gangCode.trim()}'`);

            if (gangCode.trim() === 'J1T') {
                console.log("✅ GangCode matches 'J1T'");
            } else {
                console.log(`❌ GangCode '${gangCode.trim()}' does NOT match 'J1T'`);
            }
        } else {
            console.log("❌ Ariel NOT FOUND in HR_GANGLN (No Gang Assigned)");
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

debugArielGang();
