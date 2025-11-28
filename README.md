# Plantware Attendance Grid

A modern web application for displaying employee attendance data using AG Grid with dynamic date columns.

## Features

- 📊 **Dynamic Date Matrix**: Automatically generates columns for each day of the selected month
- 🎨 **Modern UI**: Beautiful dark theme with glassmorphism effects
- 🔴 **Visual Indicators**: Red highlighting for weekends (Sundays) and holidays
- 📅 **Day Names**: Shows day names below each date in column headers
- ⚡ **Real-time Data**: Fetches attendance data from SQL Server database
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- SQL Server database with attendance data
- Access to the `db_ptrj` database

## Installation

1. **Install Dependencies**

```bash
npm install
```

2. **Configure Database Connection**

Copy the `.env.example` file to `.env`:

```bash
copy .env.example .env
```

Edit the `.env` file with your database credentials:

```env
DB_SERVER=your_server_name
DB_DATABASE=db_ptrj
DB_USER=your_username
DB_PASSWORD=your_password
DB_PORT=1433

PORT=3000
```

## Usage

1. **Start the Server**

```bash
npm start
```

The server will start on `http://localhost:3000`

2. **Open the Application**

Open your browser and navigate to:
```
http://localhost:3000
```

3. **Load Attendance Data**

- Enter an employee code (e.g., `A0749`)
- Select the month and year
- Click "Load Attendance" button

## API Endpoints

### Get Attendance Data

```
GET /api/attendance?empCode={code}&month={month}&year={year}
```

**Parameters:**
- `empCode` - Employee code (e.g., A0749)
- `month` - Month number (1-12)
- `year` - Year (e.g., 2025)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "daysInMonth": 30
}
```

### Get Employees List

```
GET /api/employees
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "EmpCode": "A0749" },
    ...
  ]
}
```

### Health Check

```
GET /health
```

## Grid Features

### Cell Display

- **Work Hours**: Shows work hours and overtime (e.g., `8h +2`)
- **Leave**: Shows leave indicator with duration (e.g., `🏖️ 2d`)
- **Holiday**: Shows holiday indicator (🎉)
- **Rest Day**: Shows rest day indicator (🌙)
- **No Data**: Shows dash (-)

### Color Coding

- 🔴 **Red Background**: Sundays and holidays
- 🟡 **Yellow Background**: Leave days
- ⚪ **Gray Background**: Rest days

## Database Schema

The application expects the following table structure:

```sql
[db_ptrj].[dbo].[PR_EMP_ATTN]
- ID
- AttnDate
- WorkHours
- OTHours
- IsOnLeave
- LeaveLength
- TodayIsRestDay
- TodayIsHoliday
- PhysMonth
- PhysYear
- EmpCode
- LocCode
```

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQL Server (mssql driver)
- **Frontend**: Vanilla JavaScript, AG Grid Community
- **Styling**: Custom CSS with glassmorphism effects

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify your database credentials in `.env`
2. Check if SQL Server is running
3. Ensure your user has access to the `db_ptrj` database
4. Check firewall settings for SQL Server port (default: 1433)

### Grid Not Loading

If the grid doesn't display:

1. Check browser console for errors
2. Verify the API endpoint is returning data
3. Ensure employee code exists in database
4. Check selected month/year has data

## Development

### File Structure

```
WebService/
├── server.js          # Express backend server
├── index.html         # Main HTML file
├── styles.css         # Custom styles
├── app.js            # Frontend JavaScript
├── package.json      # Dependencies
├── .env.example      # Environment template
└── README.md         # This file
```

## License

ISC

## Support

For issues or questions, please contact your system administrator.
