const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.set('pool', pool);

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
    } else {
        console.log('✅ Database connected successfully');
        release();
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// Import routes
const whatsappRoutes = require('./routes/whatsapp');

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, fullName } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: 'Username or email already exists' });
        
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const role = parseInt(userCount.rows[0].count) === 0 ? 'admin' : 'user';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO users (username, email, password, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role',
            [username, email, hashedPassword, fullName, role]
        );
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, role: user.role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, email, full_name, role FROM users WHERE id = $1', [req.user.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- AGREEMENTS ROUTES ---

app.get('/api/agreements', authenticateToken, async (req, res) => {
    const { agent, fromDate, toDate, search, page = 1, limit = 200 } = req.query;
    
    try {
        let query = 'SELECT * FROM agreements WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (agent && agent !== '-- Select Agent --') {
            query += ` AND agent_name = $${paramCount}`;
            params.push(agent);
            paramCount++;
        }

        if (fromDate && toDate) {
            query += ` AND agreement_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
            params.push(fromDate, toDate);
            paramCount += 2;
        }

        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR location ILIKE $${paramCount} OR contact_number ILIKE $${paramCount} OR agent_name ILIKE $${paramCount} OR token_number ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Add pagination
        const offset = (page - 1) * limit;
        query += ` ORDER BY agreement_date DESC, id DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        
        res.json({
            agreements: result.rows,
            pagination: {
                total: total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get agreements error:', error);
        res.status(500).json({ error: 'Failed to fetch agreements' });
    }
});

app.get('/api/agreements/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM agreements WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Agreement not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch agreement' });
    }
});

// Add new agreement with ALL fields
app.post('/api/agreements', authenticateToken, async (req, res) => {
    const {
        ownerName, location, tokenNumber, agreementDate,
        ownerContact, tenantContact, email, expiryDate, reminderDate,
        ccEmail, agentName, totalPayment, govtCharges, margin,
        paymentOwner, paymentTenant, paymentReceivedDate1, paymentReceivedDate2,
        paymentDue, agreementStatus, biometricDate, pvc, notes,
        // Old fields for backward compatibility
        stampDuty, registrationCharges, dhc, serviceCharge, policeVerification
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO agreements (
                user_id, name, location, token_number, agreement_date,
                owner_contact, tenant_contact, email, expiry_date, reminder_date,
                cc_email, agent_name, total_payment, govt_charges, margin,
                payment_owner, payment_tenant, payment_received_date1, payment_received_date2,
                payment_due, agreement_status, biometric_date, pvc, notes,
                stamp_duty, registration_charges, dhc, service_charge, police_verification,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING *
        `, [
            req.user.userId, ownerName, location, tokenNumber, agreementDate,
            ownerContact, tenantContact, email, expiryDate, reminderDate,
            ccEmail || 'support@ramnathshetty.com', agentName, totalPayment || 0, govtCharges || 0, margin || 0,
            paymentOwner || 0, paymentTenant || 0, paymentReceivedDate1, paymentReceivedDate2,
            paymentDue || 0, agreementStatus || 'Drafted', biometricDate, pvc || 'No', notes || '',
            stampDuty || 0, registrationCharges || 1000, dhc || 300, serviceCharge || 0, policeVerification || 0
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add agreement error:', error);
        res.status(500).json({ error: 'Failed to add agreement', details: error.message });
    }
});

// Update agreement with ALL fields
app.put('/api/agreements/:id', authenticateToken, async (req, res) => {
    const {
        ownerName, location, tokenNumber, agreementDate,
        ownerContact, tenantContact, email, expiryDate, reminderDate,
        ccEmail, agentName, totalPayment, govtCharges, margin,
        paymentOwner, paymentTenant, paymentReceivedDate1, paymentReceivedDate2,
        paymentDue, agreementStatus, biometricDate, pvc, notes,
        // Old fields for backward compatibility
        stampDuty, registrationCharges, dhc, serviceCharge, policeVerification
    } = req.body;

    try {
        const result = await pool.query(`
            UPDATE agreements SET
                name = $1, location = $2, token_number = $3, agreement_date = $4,
                owner_contact = $5, tenant_contact = $6, email = $7, expiry_date = $8, reminder_date = $9,
                cc_email = $10, agent_name = $11, total_payment = $12, govt_charges = $13, margin = $14,
                payment_owner = $15, payment_tenant = $16, payment_received_date1 = $17, payment_received_date2 = $18,
                payment_due = $19, agreement_status = $20, biometric_date = $21, pvc = $22, notes = $23,
                stamp_duty = $24, registration_charges = $25, dhc = $26, service_charge = $27, police_verification = $28,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $29
            RETURNING *
        `, [
            ownerName, location, tokenNumber, agreementDate,
            ownerContact, tenantContact, email, expiryDate, reminderDate,
            ccEmail || 'support@ramnathshetty.com', agentName, totalPayment || 0, govtCharges || 0, margin || 0,
            paymentOwner || 0, paymentTenant || 0, paymentReceivedDate1, paymentReceivedDate2,
            paymentDue || 0, agreementStatus || 'Drafted', biometricDate, pvc || 'No', notes || '',
            stampDuty || 0, registrationCharges || 1000, dhc || 300, serviceCharge || 0, policeVerification || 0,
            req.params.id
        ]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Agreement not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update agreement error:', error);
        res.status(500).json({ error: 'Failed to update agreement', details: error.message });
    }
});

app.delete('/api/agreements/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM agreements WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Agreement not found' });
        res.json({ message: 'Agreement deleted successfully' });
    } catch (error) {
        console.error('Delete agreement error:', error);
        res.status(500).json({ error: 'Failed to delete agreement' });
    }
});

app.get('/api/agents', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT DISTINCT agent_name FROM agreements WHERE agent_name IS NOT NULL AND agent_name != '' ORDER BY agent_name"
        );
        res.json(result.rows.map(r => r.agent_name));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

app.get('/api/reports', authenticateToken, async (req, res) => {
    const { agent, fromDate, toDate } = req.query;

    try {
        const result = await pool.query(`
            SELECT name, location, token_number, agreement_date, total_payment, 
                   payment_owner, payment_tenant, payment_received_date1, payment_received_date2,
                   payment_due, contact_number, owner_contact, agent_name
            FROM agreements
            WHERE agent_name = $1 AND agreement_date BETWEEN $2 AND $3 AND total_payment > 0
            ORDER BY agreement_date DESC
        `, [agent, fromDate, toDate]);

        const totalDue = result.rows.reduce((sum, row) => sum + parseFloat(row.payment_due || 0), 0);

        res.json({
            agreements: result.rows,
            totalDue: totalDue.toFixed(2)
        });
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Export comprehensive data
app.get('/api/agreements/export/comprehensive', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM agreements ORDER BY agreement_date DESC');
        
        const csvHeaders = [
            'Name of Owner', 'Location', 'Token Number', 'Agreement Date',
            'Owner Contact', 'Tenant Contact', 'Email', 'Expiry Date',
            'Reminder Date', 'CC Email', 'Agent Name', 'Total Payment',
            'Govt Charges', 'Margin', 'Payment from Owner', 'Payment from Tenant',
            'Payment Received Date 1', 'Payment Received Date 2', 'Payment Due',
            'Agreement Status', 'Biometric Date', 'PVC', 'Created Date'
        ].join(',');

        const csvRows = result.rows.map(row => [
            row.name || '', row.location || '', row.token_number || '', row.agreement_date || '',
            row.owner_contact || '', row.tenant_contact || '', row.email || '', row.expiry_date || '',
            row.reminder_date || '', row.cc_email || '', row.agent_name || '', row.total_payment || 0,
            row.govt_charges || 0, row.margin || 0, row.payment_owner || 0, row.payment_tenant || 0,
            row.payment_received_date1 || '', row.payment_received_date2 || '', row.payment_due || 0,
            row.agreement_status || '', row.biometric_date || '', row.pvc || '', row.created_at || ''
        ].map(field => `"${field}"`).join(','));

        const csv = [csvHeaders, ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=comprehensive_agreements.csv');
        res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Backup endpoint
app.get('/api/backup', authenticateToken, async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        const agreements = await pool.query('SELECT * FROM agreements');

        const backup = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            data: {
                users: users.rows,
                agreements: agreements.rows
            }
        };

        res.json(backup);
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

app.post('/api/restore', authenticateToken, async (req, res) => {
    const { data } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM agreements');
        await client.query('DELETE FROM users WHERE id != $1', [req.user.userId]);

        if (data.agreements && data.agreements.length > 0) {
            for (const agreement of data.agreements) {
                await client.query(`
                    INSERT INTO agreements (
                        id, user_id, name, location, token_number, agreement_date,
                        owner_contact, tenant_contact, email, expiry_date, reminder_date,
                        cc_email, agent_name, total_payment, govt_charges, margin,
                        payment_owner, payment_tenant, payment_received_date1, payment_received_date2,
                        payment_due, agreement_status, biometric_date, pvc, notes,
                        stamp_duty, registration_charges, dhc, service_charge, police_verification,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
                    )
                `, [
                    agreement.id, agreement.user_id, agreement.name, agreement.location, agreement.token_number,
                    agreement.agreement_date, agreement.owner_contact, agreement.tenant_contact, agreement.email,
                    agreement.expiry_date, agreement.reminder_date, agreement.cc_email, agreement.agent_name,
                    agreement.total_payment, agreement.govt_charges, agreement.margin, agreement.payment_owner,
                    agreement.payment_tenant, agreement.payment_received_date1, agreement.payment_received_date2,
                    agreement.payment_due, agreement.agreement_status, agreement.biometric_date, agreement.pvc,
                    agreement.notes, agreement.stamp_duty, agreement.registration_charges, agreement.dhc,
                    agreement.service_charge, agreement.police_verification, agreement.created_at, agreement.updated_at
                ]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Backup restored successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Restore error:', error);
        res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
    } finally {
        client.release();
    }
});

// Register WhatsApp routes
app.use('/api/whatsapp', authenticateToken, whatsappRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Agreement Manager Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});