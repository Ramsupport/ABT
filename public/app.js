// Agreement Manager - Main Application Logic

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

let currentUser = null;
let editingAgreementId = null;
let allAgreements = [];

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setTodayDates();
    await loadAgreements();
    await loadAgents();
});

function setTodayDates() {
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];

    document.getElementById('agreementDate').value = today;
    document.getElementById('paymentReceivedDate').value = today;
    document.getElementById('reportFromDate').value = lastMonthStr;
    document.getElementById('reportToDate').value = today;
    document.getElementById('waFromDate').value = lastMonthStr;
    document.getElementById('waToDate').value = today;
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        currentUser = await response.json();
        document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;
        
        const roleSpan = document.getElementById('userRole');
        roleSpan.textContent = currentUser.role.toUpperCase();
        roleSpan.className = `badge badge-${currentUser.role}`;
        
        // ✅ Move console.log HERE (after currentUser is set)
        console.log('✅ User authenticated:', currentUser.username);
    } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

// ============================================
// API HELPER
// ============================================

async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error('Unauthorized');
    }

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// ============================================
// TAB MANAGEMENT
// ============================================

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabName === 'agreements') loadAgreements();
    else if (tabName === 'reports') loadAgents();
    else if (tabName === 'whatsapp') loadAgents();
}

// ============================================
// AGREEMENTS MANAGEMENT
// ============================================

function collectAgreementFormData() {
    // Get values from the SIMPLE form
    const name = document.getElementById('ownerName').value.trim();
    const location = document.getElementById('location').value.trim();
    const contact = document.getElementById('contactNumber').value.trim();
    const agent = document.getElementById('agentName').value.trim();
    const agreementDate = document.getElementById('agreementDate').value;
    
    const stampDuty = parseFloat(document.getElementById('stampDuty').value) || 0;
    const regCharges = parseFloat(document.getElementById('regCharges').value) || 1000;
    const dhc = parseFloat(document.getElementById('dhc').value) || 300;
    const serviceCharge = parseFloat(document.getElementById('serviceCharge').value) || 0;
    const policeVerification = parseFloat(document.getElementById('policeVerification').value) || 0;
	const outstationCharges = parseFloat(document.getElementById('outstationCharges').value) || 0; // ✅ NEW
    
    const totalPayment = parseFloat(document.getElementById('totalPayment').value) || 0;
    const paymentReceived = parseFloat(document.getElementById('paymentReceived').value) || 0;
    const paymentReceivedDate = document.getElementById('paymentReceivedDate').value;
    const paymentDue = parseFloat(document.getElementById('paymentDue').value) || 0;
    
    // Map to NEW server format
    return {
        // Required fields
        ownerName: name,
        location: location,
        tokenNumber: `TKN-${Date.now()}`, // Auto-generate if not in form
        agreementDate: agreementDate,
        
        // Contact fields
        ownerContact: contact, // Map contactNumber to ownerContact
        tenantContact: '', // Not in form, send empty
        email: '', // Not in form, send empty
        
        // Date fields
        expiryDate: null,
        reminderDate: null,
        biometricDate: null,
        
        // Other fields
        ccEmail: 'rentodoc@gmail.com',
        agentName: agent,
        
        // Financial fields - NEW format
        totalPayment: totalPayment,
        govtCharges: stampDuty + regCharges + dhc, // Calculate from old fields
        margin: totalPayment - (stampDuty + regCharges + dhc + serviceCharge + policeVerification + outstationCharges), // ✅ UPDATED
        paymentOwner: paymentReceived, // Map paymentReceived to paymentOwner
        paymentTenant: 0,
        paymentReceivedDate1: paymentReceivedDate,
        paymentReceivedDate2: null,
        paymentDue: paymentDue,
        
        // Status fields
        agreementStatus: 'Drafted',
        pvc: 'No',
        notes: '',
        
        // OLD fields for backward compatibility
        stampDuty: stampDuty,
        registrationCharges: regCharges,
        dhc: dhc,
        serviceCharge: serviceCharge,
        policeVerification: policeVerification,
		outstationCharges: outstationCharges // ✅ NEW
    };
}

async function loadAgreements() {
    showLoader('agreementLoader');
    try {
        const response = await fetch(`${API_URL}/api/agreements`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load');
        
        const data = await response.json();
        
        // Handle new pagination format
        allAgreements = data.agreements || data || [];
        
        displayAgreements(allAgreements);
        await loadAgents();
    } catch (error) {
        console.error('Load error:', error);
        alert('Failed to load agreements: ' + error.message);
    } finally {
        hideLoader('agreementLoader', 'agreementTable');
    }
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    // Extract just YYYY-MM-DD from ISO date string
    return dateString.split('T')[0];
}

function displayAgreements(agreements) {
    const tbody = document.querySelector('#agreementTable tbody');
    tbody.innerHTML = '';

    agreements.forEach(agreement => {
        const row = tbody.insertRow();
        
        const dueAmount = parseFloat(agreement.payment_due) || 0;
        const dueClass = dueAmount > 0 ? 'due-red' : '';
        
        // Use correct column names from database
        const contactNumber = agreement.contact_number || agreement.owner_contact || '';
        const paymentReceived = agreement.payment_received || agreement.payment_owner || 0;

        row.innerHTML = `
            <td>${agreement.id}</td>
            <td>${agreement.name}</td>
            <td>${agreement.location}</td>
            <td>${contactNumber}</td>
            <td>${agreement.agent_name || '-'}</td>
            <td>${formatDate(agreement.agreement_date)}</td>
            <td>₹${parseFloat(agreement.total_payment || 0).toFixed(2)}</td>
            <td>₹${parseFloat(paymentReceived).toFixed(2)}</td>
            <td>${formatDate(agreement.payment_received_date || agreement.payment_received_date1)}</td>
            <td class="${dueClass}">₹${dueAmount.toFixed(2)}</td>
            <td class="action-buttons">
                <button class="action-btn btn-warning" onclick="editAgreement(${agreement.id})">Edit</button>
                <button class="action-btn btn-danger" onclick="deleteAgreement(${agreement.id})">Delete</button>
            </td>
        `;
    });
}

function calculateTotal() {
    const stampDuty = parseFloat(document.getElementById('stampDuty').value) || 0;
    const regCharges = parseFloat(document.getElementById('regCharges').value) || 0;
    const dhc = parseFloat(document.getElementById('dhc').value) || 0;
    const serviceCharge = parseFloat(document.getElementById('serviceCharge').value) || 0;
    const policeVerification = parseFloat(document.getElementById('policeVerification').value) || 0;
	const outstationCharges = parseFloat(document.getElementById('outstationCharges').value) || 0; // ✅ NEW
	const total = stampDuty + regCharges + dhc + serviceCharge + policeVerification + outstationCharges; // ✅ FIXED
    document.getElementById('totalPayment').value = total.toFixed(2);
    calculateDue();
}

function calculateDue() {
    const total = parseFloat(document.getElementById('totalPayment').value) || 0;
    const received = parseFloat(document.getElementById('paymentReceived').value) || 0;
    const due = Math.max(0, total - received);
    document.getElementById('paymentDue').value = due.toFixed(2);
}

async function saveAgreement() {
    const formData = collectAgreementFormData();
    
    if (!formData.ownerName || !formData.location || !formData.ownerContact) {
        alert('Please fill in Owner Name, Location, and Contact Number');
        return;
    }
    
    console.log('Sending data:', formData); // Debug
    
    try {
        if (editingAgreementId) {
            const response = await fetch(`${API_URL}/api/agreements/${editingAgreementId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Agreement updated successfully!');
                clearForm();
                await loadAgreements();
            } else {
                console.error('Update error:', data);
                alert('Failed to update: ' + (data.error || 'Unknown error'));
            }
        } else {
            const response = await fetch(`${API_URL}/api/agreements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Agreement added successfully!');
                clearForm();
                await loadAgreements();
            } else {
                console.error('Add error:', data);
                alert('Failed to add: ' + (data.error || 'Unknown error'));
            }
        }
    } catch (error) {
        console.error('Save agreement error:', error);
        alert('Network error: ' + error.message);
    }
}

async function editAgreement(id) {
    try {
        const agreement = await apiCall(`/api/agreements/${id}`);
        
        editingAgreementId = id;
        document.getElementById('formTitle').textContent = 'Edit Agreement';
        
        // Map database columns to form fields with proper date formatting
        document.getElementById('ownerName').value = agreement.name || '';
        document.getElementById('location').value = agreement.location || '';
        document.getElementById('contactNumber').value = agreement.contact_number || '';
        document.getElementById('agentName').value = agreement.agent_name || '';
        document.getElementById('agreementDate').value = formatDateForInput(agreement.agreement_date);
        document.getElementById('stampDuty').value = agreement.stamp_duty || 0;
        document.getElementById('regCharges').value = agreement.registration_charges || 1000;
        document.getElementById('dhc').value = agreement.dhc || 300;
        document.getElementById('serviceCharge').value = agreement.service_charge || 0;
        document.getElementById('policeVerification').value = agreement.police_verification || 0;
		document.getElementById('outstationCharges').value = agreement.outstation_charges || 0; // ✅ NEW
        document.getElementById('totalPayment').value = agreement.total_payment || 0;
        document.getElementById('paymentReceived').value = agreement.payment_received || 0;
        document.getElementById('paymentReceivedDate').value = formatDateForInput(agreement.payment_received_date);
        document.getElementById('paymentDue').value = agreement.payment_due || 0;

        // Scroll to form
        document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
        
        showModal('editModal');
    } catch (error) {
        console.error('Edit agreement error:', error);
        alert('Failed to load agreement: ' + error.message);
    }
}

async function deleteAgreement(id) {
    if (!confirm('Are you sure you want to delete this agreement?')) return;

    try {
        await apiCall(`/api/agreements/${id}`, 'DELETE');
        alert('Agreement deleted successfully!');
        await loadAgreements();
    } catch (error) {
        console.error('Delete agreement error:', error);
        alert('Failed to delete agreement: ' + error.message);
    }
}

function clearForm() {
    editingAgreementId = null;
    document.getElementById('formTitle').textContent = 'Add New Agreement';
    
    document.getElementById('ownerName').value = '';
    document.getElementById('location').value = '';
    document.getElementById('contactNumber').value = '';
    document.getElementById('agentName').value = '';
    document.getElementById('agreementDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('stampDuty').value = '0';
    document.getElementById('regCharges').value = '1000';
    document.getElementById('dhc').value = '300';
    document.getElementById('serviceCharge').value = '0';
    document.getElementById('policeVerification').value = '0';
	document.getElementById('outstationCharges').value = '0'; // ✅ NEW
    document.getElementById('totalPayment').value = '1300';
    document.getElementById('paymentReceived').value = '0';
    document.getElementById('paymentReceivedDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDue').value = '1300';
}

function searchAgreements() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayAgreements(allAgreements);
        return;
    }

    const filtered = allAgreements.filter(agreement => 
        agreement.name.toLowerCase().includes(searchTerm) ||
        agreement.location.toLowerCase().includes(searchTerm) ||
        agreement.contact_number.includes(searchTerm) ||
        (agreement.agent_name && agreement.agent_name.toLowerCase().includes(searchTerm))
    );

    displayAgreements(filtered);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    displayAgreements(allAgreements);
}

// ============================================
// AGENTS MANAGEMENT
// ============================================

async function loadAgents() {
    try {
        const agents = await apiCall('/api/agents');
        
        // Update all agent dropdowns
        const agentSelects = ['reportAgent', 'waAgent'];
        const agentDatalist = document.getElementById('agentList');
        
        agentDatalist.innerHTML = '';
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent;
            agentDatalist.appendChild(option);
        });

        agentSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;
            select.innerHTML = '<option>-- Select Agent --</option>';
            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent;
                option.textContent = agent;
                select.appendChild(option);
            });
            if (agents.includes(currentValue)) {
                select.value = currentValue;
            }
        });
    } catch (error) {
        console.error('Load agents error:', error);
    }
}

// ============================================
// REPORTS
// ============================================

async function generateReport() {
    const agent = document.getElementById('reportAgent').value;
    if (agent === '-- Select Agent --') {
        alert('Please select an agent');
        return;
    }

    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;

    try {
        const data = await apiCall(`/api/reports?agent=${encodeURIComponent(agent)}&fromDate=${fromDate}&toDate=${toDate}`);
        
        const tbody = document.querySelector('#reportTable tbody');
        tbody.innerHTML = '';

        data.agreements.forEach(agreement => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${agreement.name}</td>
                <td>${agreement.location}</td>
                <td>${formatDate(agreement.agreement_date)}</td>
                <td>₹${parseFloat(agreement.total_payment).toFixed(2)}</td>
                <td>₹${parseFloat(agreement.payment_received).toFixed(2)}</td>
                <td>${formatDate(agreement.payment_received_date)}</td>
                <td class="due-red">₹${parseFloat(agreement.payment_due).toFixed(2)}</td>
            `;
        });

        document.getElementById('totalDue').textContent = `₹${data.totalDue}`;
        document.getElementById('reportCard').style.display = 'block';
    } catch (error) {
        console.error('Generate report error:', error);
        alert('Failed to generate report: ' + error.message);
    }
}

function exportReportCSV() {
    const table = document.getElementById('reportTable');
    if (table.style.display === 'none') {
        alert('Please generate a report first');
        return;
    }

    let csv = 'Name,Location,Date,Total,Received,Recv Date,Due\n';
    
    Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
        const cells = Array.from(row.cells);
        csv += cells.map(cell => {
            let text = cell.textContent.replace('₹', '').trim();
            if (text.includes(',')) text = `"${text}"`;
            return text;
        }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agreement-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// WHATSAPP
// ============================================

async function loadWhatsAppClients() {
    const agent = document.getElementById('waAgent').value;
    if (agent === '-- Select Agent --') {
        alert('Please select an agent');
        return;
    }

    const fromDate = document.getElementById('waFromDate').value;
    const toDate = document.getElementById('waToDate').value;

    try {
        const clients = await apiCall(`/api/whatsapp/clients?agent=${encodeURIComponent(agent)}&fromDate=${fromDate}&toDate=${toDate}`);
        
        const tbody = document.querySelector('#waTable tbody');
        tbody.innerHTML = '';

        let previewText = '';

        clients.forEach(client => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${client.name}</td>
                <td>${client.location}</td>
                <td>${client.contact_number}</td>
                <td>${formatDate(client.agreement_date)}</td>
                <td class="due-red">₹${parseFloat(client.payment_due).toFixed(2)}</td>
                <td><button class="btn btn-success btn-sm" onclick="sendWhatsApp('${client.contact_number}', '${agent}', '${client.name}', '${client.location}', '${formatDate(client.agreement_date)}', ${client.stamp_duty}, ${client.registration_charges}, ${client.dhc}, ${client.service_charge}, ${client.police_verification}, ${client.total_payment}, ${client.payment_received}, ${client.payment_due})">Send</button></td>
            `;

            const msg = generateWhatsAppMessage(agent, client.name, client.location, formatDate(client.agreement_date), 
                client.stamp_duty, client.registration_charges, client.dhc, client.service_charge, 
                client.police_verification, client.total_payment, client.payment_received, client.payment_due);
            
            previewText += `📱 ${client.contact_number} - ${client.name}\n${msg}\n\n${'='.repeat(50)}\n\n`;
        });

        document.getElementById('waPreview').value = previewText;
        document.getElementById('waClientsCard').style.display = 'block';
    } catch (error) {
        console.error('Load WhatsApp clients error:', error);
        alert('Failed to load clients: ' + error.message);
    }
}

function generateWhatsAppMessage(agent, name, location, date, stampDuty, regCharges, dhc, service, police, total, received, due) {
    return `👋 *Dear ${agent}*,

📋 *Agreement Summary*:
   • Name: ${name}
   • Location: ${location}
   • Date: ${date}

💼 *Charges*:
   • Stamp Duty: ₹${stampDuty}
   • Registration: ₹${regCharges}
   • DHC: ₹${dhc}
   • Service: ₹${service}
   • Police Verif.: ₹${police}

💰 *Total*: ₹${total}
✅ *Received*: ₹${received}
⚠️ *Due*: ₹${due}

Thanks,
🏢 *RentoDoc Team*`;
}

async function sendWhatsApp(contact, agent, name, location, date, stampDuty, regCharges, dhc, service, police, outstation, total, received, due) {
    if (!confirm(`Send WhatsApp reminder to ${name} (${contact})?`)) {
        return;
    }
    
    try {
        // Format values
        const formattedStampDuty = parseFloat(stampDuty).toFixed(2);
        const formattedRegCharges = parseFloat(regCharges).toFixed(2);
        const formattedDhc = parseFloat(dhc).toFixed(2);
        const formattedService = parseFloat(service).toFixed(2);
        const formattedPolice = parseFloat(police).toFixed(2);
        const formattedTotal = parseFloat(total).toFixed(2);
        const formattedReceived = parseFloat(received).toFixed(2);
        const formattedDue = parseFloat(due).toFixed(2);
        
        console.log('Sending WhatsApp to:', contact);
        
        // Send via API
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                name: name,
                location: location,
                contact: contact,
                date: date,
                stampDuty: formattedStampDuty,
                regCharges: formattedRegCharges,
                dhc: formattedDhc,
                service: formattedService,
                police: formattedPolice,
                total: formattedTotal,
                received: formattedReceived,
                due: formattedDue
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert(`✅ WhatsApp sent successfully to ${name}!`);
            console.log('WhatsApp sent! Message SID:', data.messageSid);
        } else {
            console.error('WhatsApp error:', data);
            alert('⚠️ Failed to send WhatsApp: ' + (data.details || data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Network error sending WhatsApp:', error);
        alert('❌ Network error while sending WhatsApp. Please check your connection and try again.');
    }
}

// ============================================
// BACKUP & RESTORE
// ============================================

async function exportBackup() {
    try {
        showBackupStatus('Creating backup...', 'info');
        
        const backup = await apiCall('/api/backup');
        
        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `agreement-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showBackupStatus('✅ Backup downloaded successfully!', 'success');
    } catch (error) {
        console.error('Export backup error:', error);
        showBackupStatus('❌ Failed to create backup: ' + error.message, 'error');
    }
}

async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!confirm('⚠️ WARNING: This will replace ALL existing data. Are you sure?')) {
        event.target.value = '';
        return;
    }
    
    try {
        showBackupStatus('Reading backup file...', 'info');
        
        const text = await file.text();
        const backup = JSON.parse(text);
        
        if (!backup.data || !backup.version) {
            throw new Error('Invalid backup file format');
        }
        
        showBackupStatus('Restoring data... Please wait.', 'info');
        
        await apiCall('/api/restore', 'POST', backup);
        
        showBackupStatus('✅ Backup restored successfully! Reloading page...', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Import backup error:', error);
        showBackupStatus('❌ Failed to restore backup: ' + error.message, 'error');
    } finally {
        event.target.value = '';
    }
}

function showBackupStatus(message, type) {
    const statusDiv = document.getElementById('backupStatus');
    const colors = {
        info: '#0dcaf0',
        success: '#28a745',
        error: '#dc3545'
    };
    
    statusDiv.innerHTML = `
        <div style="padding: 12px; border-radius: 8px; background: ${colors[type]}20; 
                    color: ${colors[type]}; border-left: 4px solid ${colors[type]};">
            ${message}
        </div>
    `;
    
    if (type !== 'info') {
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 5000);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoader(loaderId) {
    const loader = document.getElementById(loaderId);
    if (loader) loader.style.display = 'block';
}

function hideLoader(loaderId, elementToShowId) {
    const loader = document.getElementById(loaderId);
    if (loader) loader.style.display = 'none';
    const element = document.getElementById(elementToShowId);
    if (element) {
        element.style.display = element.tagName === 'TABLE' ? 'table' : 'block';
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

// Initialize calculations on page load
document.addEventListener('DOMContentLoaded', () => {
    calculateTotal();
});

