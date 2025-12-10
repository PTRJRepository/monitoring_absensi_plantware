const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5176,
    path: '/api/attendance-by-loc-enhanced?locCode=P1A&month=12&year=2025&mode=hk',
    method: 'GET'
};

http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('Total employees:', json.totalEmployees);

        // Check first 3 employees' day_9
        json.data.slice(0, 3).forEach(emp => {
            console.log('\n=== Employee:', emp.empCode, '-', emp.empName, '===');
            console.log('day_9:', JSON.stringify(emp.day_9, null, 2));
        });
    });
}).end();
