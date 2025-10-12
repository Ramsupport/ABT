# Agreement Manager - Web Application

Complete rental agreement management system for property agents and rental businesses.

## Features

- 📋 **Agreement Management** - Add, edit, delete and search agreements
- 💰 **Payment Tracking** - Track total payments, received amounts and dues
- 📊 **Agent Reports** - Generate reports filtered by agent and date range
- 💬 **WhatsApp Integration** - Send payment reminders directly via WhatsApp
- 💾 **Backup & Restore** - Export and import your complete database
- 🔍 **Search & Filter** - Quick search across all agreement fields
- 🔐 **User Authentication** - Secure login and registration
- 📱 **Responsive Design** - Works on desktop, tablet and mobile

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: HTML + CSS + JavaScript
- **Authentication**: JWT

## Installation

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agreement-manager.git
cd agreement-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create PostgreSQL database:
```bash
createdb agreement_manager
```

4. Run database schema:
```bash
psql agreement_manager < init_db.sql
```

5. Create `.env` file:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/agreement_manager
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=development
PORT=3000
```

6. Start the server:
```bash
npm start
```

7. Open browser:
```
http://localhost:3000
```

## Railway Deployment

1. Push your code to GitHub

2. Go to [Railway.app](https://railway.app)

3. Click "New Project" → "Deploy from GitHub repo"

4. Select your repository

5. Add PostgreSQL database:
   - Click "New" → "Database" → "Add PostgreSQL"

6. Add environment variables:
   - Go to your service → Variables
   - Add: `JWT_SECRET`, `NODE_ENV=production`
   - Railway automatically adds `DATABASE_URL`

7. Deploy! 🚀

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port (default: 3000) | No |

## Default Charges

- **Registration Charges**: ₹1,000 (Fixed)
- **DHC**: ₹300 (Fixed)
- **Stamp Duty**: Variable
- **Service Charge**: Variable
- **Police Verification**: Variable

## Usage

### First Time Setup

1. Register a new account (first user becomes admin)
2. Add your first agreement
3. Start managing your rental agreements!

### Adding Agreements

1. Go to "Agreements" tab
2. Fill in all required fields
3. System automatically calculates total and dues
4. Click "Save Agreement"

### Generating Reports

1. Go to "Reports" tab
2. Select agent and date range
3. Click "Generate Report"
4. Export to CSV if needed

### WhatsApp Reminders

1. Go to "WhatsApp" tab
2. Select agent and date range
3. Click "Load Clients"
4. Click "Send" for individual clients

### Backup & Restore

1. Go to "Backup" tab
2. Click "Download Backup" to export
3. Click "Import Backup" to restore

## Support

For support, email: support@Gizmohub.co.in
Phone/WhatsApp: +91 7021956841

## License

MIT License - Created by Nitya Information Technologies

## Version

1.0.0 - Web Edition