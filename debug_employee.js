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

async function debugEmployee() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        const empCode = 'J0816';

        console.log(`\n--- Checking ${empCode} in HR_EMPLOYEE ---`);
        const emp = await sql.query`SELECT EmpCode, EmpName, IsActive, LocCode FROM HR_EMPLOYEE WHERE EmpCode = ${empCode}`;

        if (emp.recordset.length > 0) {
            console.log('Found in HR_EMPLOYEE:', JSON.stringify(emp.recordset[0]));
        } else {
            console.log('❌ NOT FOUND in HR_EMPLOYEE');
        }

        console.log(`\n--- Checking ${empCode} in HR_EMPLOYMENT ---`);
        const emp2 = await sql.query`SELECT EmpCode, LocCode FROM HR_EMPLOYMENT WHERE EmpCode = ${empCode}`;
        if (emp2.recordset.length > 0) {
            console.log('Found in HR_EMPLOYMENT:', JSON.stringify(emp2.recordset[0]));
        } else {
            console.log('❌ NOT FOUND in HR_EMPLOYMENT');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

debugEmployee();
