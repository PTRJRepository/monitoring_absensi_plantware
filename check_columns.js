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

        const result = await sql.query`SELECT TOP 1 * FROM PR_TASKREGLN`;
        if (result.recordset.length > 0) {
            console.log('Columns in PR_TASKREGLN:', Object.keys(result.recordset[0]));
        } else {
            console.log('PR_TASKREGLN is empty');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

checkColumns();
