const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { query } = require('../config/database');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// Get expiring agreements
router.get('/expiring', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        
        const result = await query(
            `SELECT * FROM agreements 
             WHERE expiry_date <= $1 AND expiry_date >= CURRENT_DATE
             ORDER BY expiry_date ASC`,
            [futureDate.toISOString().split('T')[0]]
        );
        
        res.json({ agreements: result.rows });
    } catch (error) {
        console.error('Error fetching expiring agreements:', error);
        res.status(500).json({ error: 'Failed to fetch expiring agreements' });
    }
});

// Send single WhatsApp using approved template
router.post('/send', async (req, res) => {
    const { agreementId } = req.body;
    
    try {
        // Get agreement details
        const result = await query(
            'SELECT * FROM agreements WHERE id = $1',
            [agreementId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Agreement not found' });
        }
        
        const agreement = result.rows[0];
        const phoneNumber = agreement.owner_contact || agreement.ownerContact;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'No phone number found for this agreement' });
        }
        
        // Format phone number for WhatsApp (must include country code)
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        // Prepare template parameters
        const ownerName = agreement.owner_name || agreement.ownerName || 'Client';
        const location = agreement.location || 'N/A';
        const agreementDate = new Date(agreement.agreement_date || agreement.agreementDate).toLocaleDateString('en-IN');
        const stampDuty = parseFloat(agreement.stamp_duty || 0).toFixed(2);
        const registration = parseFloat(agreement.registration_charges || 1000).toFixed(2);
        const dhc = parseFloat(agreement.dhc || 300).toFixed(2);
        const service = parseFloat(agreement.service_charge || 0).toFixed(2);
        const police = parseFloat(agreement.police_verification || 0).toFixed(2);
        const total = parseFloat(agreement.total_payment || agreement.totalPayment || 0).toFixed(2);
        const received = parseFloat(agreement.payment_owner || agreement.paymentOwner || 0) + 
                        parseFloat(agreement.payment_tenant || agreement.paymentTenant || 0);
        const due = parseFloat(agreement.payment_due || agreement.paymentDue || 0).toFixed(2);
        
        // Send WhatsApp message using approved template
        const message = await client.messages.create({
            from: `whatsapp:${twilioWhatsAppNumber}`,
            to: `whatsapp:${formattedPhone}`,
            contentSid: 'HXffda457bb20a191891f8e6643df04686', // Your template SID
            contentVariables: JSON.stringify({
                "1": ownerName,      // Dear {{1}}
                "2": ownerName,      // Client: {{2}}
                "3": location,       // Location: {{3}}
                "4": agreementDate,  // Agreement Date: {{4}}
                "5": stampDuty,      // Stamp Duty: {{5}}
                "6": registration,   // Registration: {{6}}
                "7": dhc,            // DHC: {{7}}
                "8": service,        // Service Charge: {{8}}
                "9": police,         // Police Verification: {{9}}
                "10": total,         // Total: {{10}}
                "11": received.toFixed(2), // Received: {{11}}
                "12": due            // Due: {{12}}
            })
        });
        
        // Log the send
        await query(
            `INSERT INTO activity_logs (user_id, action, details, timestamp) 
             VALUES ($1, $2, $3, NOW())`,
            [req.session.userId, 'WHATSAPP_SENT', `Sent reminder to ${ownerName} (${formattedPhone})`]
        );
        
        res.json({ 
            success: true, 
            messageSid: message.sid,
            message: 'WhatsApp sent successfully'
        });
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        res.status(500).json({ 
            error: 'Failed to send WhatsApp',
            details: error.message 
        });
    }
});

// Send bulk WhatsApp messages
router.post('/send-bulk', async (req, res) => {
    const { agreementIds } = req.body;
    
    if (!agreementIds || agreementIds.length === 0) {
        return res.status(400).json({ error: 'No agreement IDs provided' });
    }
    
    const results = {
        successful: 0,
        failed: 0,
        errors: []
    };
    
    for (const agreementId of agreementIds) {
        try {
            const result = await query(
                'SELECT * FROM agreements WHERE id = $1',
                [agreementId]
            );
            
            if (result.rows.length === 0) {
                results.failed++;
                results.errors.push({ agreementId, error: 'Agreement not found' });
                continue;
            }
            
            const agreement = result.rows[0];
            const phoneNumber = agreement.owner_contact || agreement.ownerContact;
            
            if (!phoneNumber) {
                results.failed++;
                results.errors.push({ agreementId, error: 'No phone number' });
                continue;
            }
            
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            
            // Prepare template parameters (same as above)
            const ownerName = agreement.owner_name || agreement.ownerName || 'Client';
            const location = agreement.location || 'N/A';
            const agreementDate = new Date(agreement.agreement_date || agreement.agreementDate).toLocaleDateString('en-IN');
            const stampDuty = parseFloat(agreement.stamp_duty || 0).toFixed(2);
            const registration = parseFloat(agreement.registration_charges || 1000).toFixed(2);
            const dhc = parseFloat(agreement.dhc || 300).toFixed(2);
            const service = parseFloat(agreement.service_charge || 0).toFixed(2);
            const police = parseFloat(agreement.police_verification || 0).toFixed(2);
            const total = parseFloat(agreement.total_payment || agreement.totalPayment || 0).toFixed(2);
            const received = parseFloat(agreement.payment_owner || agreement.paymentOwner || 0) + 
                            parseFloat(agreement.payment_tenant || agreement.paymentTenant || 0);
            const due = parseFloat(agreement.payment_due || agreement.paymentDue || 0).toFixed(2);
            
            await client.messages.create({
                from: `whatsapp:${twilioWhatsAppNumber}`,
                to: `whatsapp:${formattedPhone}`,
                contentSid: 'HXffda457bb20a191891f8e6643df04686',
                contentVariables: JSON.stringify({
                    "1": ownerName,
                    "2": ownerName,
                    "3": location,
                    "4": agreementDate,
                    "5": stampDuty,
                    "6": registration,
                    "7": dhc,
                    "8": service,
                    "9": police,
                    "10": total,
                    "11": received.toFixed(2),
                    "12": due
                })
            });
            
            results.successful++;
            
            // Small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`Error sending WhatsApp to agreement ${agreementId}:`, error);
            results.failed++;
            results.errors.push({ agreementId, error: error.message });
        }
    }
    
    // Log bulk send
    await query(
        `INSERT INTO activity_logs (user_id, action, details, timestamp) 
         VALUES ($1, $2, $3, NOW())`,
        [req.session.userId, 'WHATSAPP_BULK_SENT', `Sent ${results.successful} reminders, ${results.failed} failed`]
    );
    
    res.json({ 
        success: true,
        summary: results
    });
});

module.exports = router;
```

---

## **2. UPDATE: `.env` FILE**

Add these Twilio credentials:
```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=+14155238886