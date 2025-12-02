require('dotenv').config();
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

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

async function checkColumns() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');

        const result = await sql.query`SELECT TOP 1 * FROM HR_GANGLN`;
        if (result.recordset.length > 0) {
            console.log('Columns in HR_GANGLN:', Object.keys(result.recordset[0]));
        } else {
            console.log('HR_GANGLN is empty, checking columns from metadata if possible (or just assuming based on error)');
        }
        
        // Also check HR_GANG just in case
         const result2 = await sql.query`SELECT TOP 1 * FROM HR_GANG`;
        if (result2.recordset.length > 0) {
            console.log('Columns in HR_GANG:', Object.keys(result2.recordset[0]));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

checkColumns();
