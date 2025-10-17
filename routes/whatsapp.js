const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// Get clients with pending dues
router.get('/clients', async (req, res) => {
    const { agent, fromDate, toDate } = req.query;
    
    try {
        // Access pool through req.app
        const pool = req.app.get('pool');
        
        const result = await pool.query(`
            SELECT name, location, contact_number, agreement_date, payment_due,
                   stamp_duty, registration_charges, dhc, service_charge, police_verification,
                   total_payment, payment_received, id
            FROM agreements
            WHERE agent_name = $1 AND agreement_date BETWEEN $2 AND $3 AND payment_due > 0
            ORDER BY payment_due DESC
        `, [agent, fromDate, toDate]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get WhatsApp clients error:', error);
        res.status(500).json({ error: 'Failed to fetch WhatsApp clients' });
    }
});

// Send single WhatsApp message using approved template
router.post('/send', async (req, res) => {
    const { name, location, contact, date, stampDuty, regCharges, dhc, service, police, total, received, due } = req.body;
    
    try {
        // Format phone number for WhatsApp
        const formattedPhone = contact.startsWith('+') ? contact : `+91${contact}`;
        
        console.log('Sending WhatsApp to:', formattedPhone);
        console.log('Template SID:', 'HXffda457bb20a191891f8e6643df04686');
        
        // Send WhatsApp message using approved template
        const message = await client.messages.create({
            from: `whatsapp:${twilioWhatsAppNumber}`,
            to: `whatsapp:${formattedPhone}`,
            contentSid: 'HXffda457bb20a191891f8e6643df04686', // Your approved template SID
            contentVariables: JSON.stringify({
                "1": name,           // Dear {{1}}
                "2": name,           // Client: {{2}}
                "3": location,       // Location: {{3}}
                "4": date,           // Agreement Date: {{4}}
                "5": stampDuty,      // Stamp Duty: {{5}}
                "6": regCharges,     // Registration: {{6}}
                "7": dhc,            // DHC: {{7}}
                "8": service,        // Service Charge: {{8}}
                "9": police,         // Police Verification: {{9}}
                "10": total,         // Total: {{10}}
                "11": received,      // Received: {{11}}
                "12": due            // Due: {{12}}
            })
        });
        
        console.log('WhatsApp sent successfully! SID:', message.sid);
        
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

module.exports = router;