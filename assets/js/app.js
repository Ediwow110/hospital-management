const YEAR = 2026;

const ROLE_LABELS = {
  patient: 'Client / Patient',
  receptionist: 'Receptionist',
  cashier: 'Cashier',
  nurse: 'Nurse / Clinical Staff',
  doctor: 'Doctor',
  med_tech: 'Med-Tech',
  lab_approver: 'Pathologist / Lab Approver',
  radiology_staff: 'Radiology Staff',
  pharmacist: 'Pharmacist',
  inventory_staff: 'Inventory Staff',
  hr_manager: 'HR Staff / HR Manager',
  branch_manager: 'Manager / Branch Manager',
  super_admin: 'Admin / Super Admin'
};

const DEMO_USERS = {
  super_admin: { id: 'u-admin', name: 'A. Reyes', role: 'super_admin', branch: 'Main Branch' },
  receptionist: { id: 'u-reception', name: 'R. Cruz', role: 'receptionist', branch: 'Main Branch' },
  cashier: { id: 'u-cashier', name: 'C. Gomez', role: 'cashier', branch: 'Main Branch' },
  med_tech: { id: 'u-medtech', name: 'M. Santos', role: 'med_tech', branch: 'Main Branch' },
  lab_approver: { id: 'u-labapprover', name: 'D. Lim', role: 'lab_approver', branch: 'Main Branch' },
  inventory_staff: { id: 'u-inventory', name: 'I. Navarro', role: 'inventory_staff', branch: 'Main Branch' },
  hr_manager: { id: 'u-hr', name: 'H. Ramos', role: 'hr_manager', branch: 'Main Branch' },
  branch_manager: { id: 'u-manager', name: 'B. Mercado', role: 'branch_manager', branch: 'Main Branch' }
};

const ALL_PERMISSIONS = [
  'patient.view', 'patient.create', 'patient.update', 'patient.archive', 'patient.merge.request', 'patient.merge.approve',
  'order.create', 'order.void.request', 'order.void.approve', 'order.discount.apply', 'order.discount.approve',
  'lab.result.encode', 'lab.result.validate', 'lab.result.approve', 'lab.result.release', 'lab.result.amend.request', 'lab.result.amend.approve',
  'billing.payment.create', 'billing.payment.void.request', 'billing.payment.void.approve', 'billing.refund.request', 'billing.refund.approve', 'cashier.close',
  'inventory.receive', 'inventory.transfer', 'inventory.adjust.request', 'inventory.adjust.approve',
  'hr.employee.update', 'report.view', 'report.export', 'audit.view',
  'notification.send', 'user.role.change.request', 'user.role.change.approve', 'backup.run', 'backup.restore.request'
];

const ROLE_PERMISSIONS = {
  patient: [],
  receptionist: ['patient.view', 'patient.create', 'patient.update', 'patient.merge.request', 'order.create'],
  cashier: ['patient.view', 'billing.payment.create', 'billing.payment.void.request', 'billing.refund.request', 'cashier.close', 'report.view'],
  nurse: ['patient.view'],
  doctor: ['patient.view', 'order.create'],
  med_tech: ['patient.view', 'lab.result.encode', 'lab.result.amend.request'],
  lab_approver: ['patient.view', 'lab.result.validate', 'lab.result.approve', 'lab.result.release', 'lab.result.amend.approve'],
  radiology_staff: ['patient.view'],
  pharmacist: ['patient.view', 'inventory.receive'],
  inventory_staff: ['inventory.receive', 'inventory.transfer', 'inventory.adjust.request', 'report.view'],
  hr_manager: ['hr.employee.update', 'user.role.change.request', 'report.view'],
  branch_manager: ['patient.view', 'report.view', 'report.export', 'audit.view', 'order.void.approve', 'billing.refund.approve', 'billing.payment.void.approve', 'inventory.adjust.approve', 'patient.merge.approve', 'user.role.change.approve', 'backup.run', 'backup.restore.request', 'notification.send'],
  super_admin: ALL_PERMISSIONS
};

const APPROVAL_PERMISSION = {
  order_void: 'order.void.approve',
  payment_void: 'billing.payment.void.approve',
  refund: 'billing.refund.approve',
  manual_discount: 'order.discount.approve',
  result_amendment: 'lab.result.amend.approve',
  inventory_adjustment: 'inventory.adjust.approve',
  patient_merge: 'patient.merge.approve',
  role_change: 'user.role.change.approve',
  backup_restore: 'backup.restore.request'
};

const LAB_STEPS = ['Pending Collection', 'Collected', 'Received', 'Processing', 'Encoded', 'Validated', 'Approved', 'Released'];
const LAB_TRANSITIONS = {
  'Pending Collection': ['Collected', 'Cancelled', 'Rejected'],
  Collected: ['Received', 'Rejected'],
  Received: ['Processing', 'Rejected'],
  Processing: ['Encoded', 'Rejected'],
  Encoded: ['Validated', 'Rejected'],
  Validated: ['Approved', 'Rejected'],
  Approved: ['Released', 'Rejected'],
  Released: ['Amended', 'Superseded'],
  Amended: ['Superseded'],
  Superseded: []
};

const PREFIXES = {
  patient: 'P',
  order: 'ORD',
  invoice: 'INV',
  receipt: 'OR',
  lab: 'LAB',
  queue: 'Q',
  approval: 'APR',
  employee: 'EMP',
  purchaseOrder: 'PO',
  notification: 'NTF',
  document: 'DOC'
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function permissionsForRole(role) {
  return new Set(ROLE_PERMISSIONS[role] || []);
}

function hasPermission(targetState, permission) {
  return permissionsForRole(targetState.currentUser.role).has(permission);
}

function statusClass(status) {
  return `status-${String(status || 'draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function money(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmount(value) {
  const amount = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(amount) ? amount : NaN;
}

function nextNumber(targetState, type) {
  const prefix = PREFIXES[type];
  if (!prefix) throw new Error(`Unknown numbering type: ${type}`);
  const next = targetState.sequences[type] || 1;
  targetState.sequences[type] = next + 1;
  return `${prefix}-${YEAR}-${String(next).padStart(6, '0')}`;
}

function ageFromBirthdate(birthdate) {
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const hadBirthday = today.getMonth() > born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return Math.max(age, 0);
}

function canTransitionLab(fromStatus, toStatus) {
  return (LAB_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function canApprove(targetState, approval) {
  const permission = APPROVAL_PERMISSION[approval.type];
  return Boolean(permission && hasPermission(targetState, permission) && targetState.currentUser.id !== approval.requestedUserId);
}

function canPostPayment(invoice, amount, settings = { overpaymentEnabled: false }) {
  if (!invoice) return { ok: false, message: 'No active invoice is selected.' };
  if (['Voided', 'Cancelled', 'Refunded'].includes(invoice.status)) return { ok: false, message: `Invoice ${invoice.no} is ${invoice.status.toLowerCase()} and cannot accept payments.` };
  if (invoice.isLocked && invoice.balance <= 0) return { ok: false, message: `Invoice ${invoice.no} is already locked as paid.` };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Payment amount must be greater than zero.' };
  if (amount > invoice.balance && !settings.overpaymentEnabled) return { ok: false, message: 'Payment cannot exceed invoice balance unless overpayment is enabled.' };
  return { ok: true, message: 'Payment allowed.' };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function todayInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function createInitialState() {
  return {
    currentUser: { ...DEMO_USERS.super_admin },
    currentPatientId: 'P-2026-000001',
    currentInvoiceNo: 'INV-2026-000001',
    currentLabNo: 'LAB-2026-000001',
    selectedServices: [],
    settings: {
      overpaymentEnabled: false,
      dualApprovalEnabled: true,
      sessionTimeoutMinutes: 15,
      backupRequiredBeforeDeploy: true,
      branchAccessRequired: true
    },
    sequences: {
      patient: 2,
      order: 2,
      invoice: 2,
      receipt: 1,
      lab: 2,
      queue: 24,
      approval: 1,
      employee: 2,
      purchaseOrder: 1,
      notification: 2,
      document: 2
    },
    patients: [
      {
        id: 'P-2026-000001',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        name: 'Juan Dela Cruz',
        birthdate: '1992-06-12',
        sex: 'male',
        contact: '09170000001',
        email: 'juan.delacruz@example.com',
        address: 'Makati City',
        classification: 'Regular',
        consent: 'Signed',
        duplicateRisk: false,
        status: 'active',
        documents: [
          { id: 'DOC-2026-000001', title: 'Patient consent', category: 'Consent', status: 'active', private: true }
        ]
      }
    ],
    services: [
      { code: 'CBC', name: 'Complete Blood Count', department: 'Laboratory', price: 450, version: 1, template: 'cbc' },
      { code: 'FBS', name: 'Fasting Blood Sugar', department: 'Laboratory', price: 180, version: 1, template: 'chemistry_basic' },
      { code: 'URINALYSIS', name: 'Urinalysis', department: 'Laboratory', price: 150, version: 1, template: 'urinalysis' },
      { code: 'XRAY-CHEST', name: 'Chest X-Ray', department: 'Radiology', price: 650, version: 1, template: 'radiology_report' },
      { code: 'EXEC-PKG', name: 'Executive Wellness Package', department: 'Package', price: 1800, version: 1, template: 'package' }
    ],
    orders: [
      { no: 'ORD-2026-000001', patientId: 'P-2026-000001', status: 'Pending Payment', paymentStatus: 'Unpaid', itemCodes: ['CBC'], itemNames: ['Complete Blood Count'], total: 450, invoiceNo: 'INV-2026-000001', createdAt: '08:20', isVoided: false }
    ],
    invoices: [
      { no: 'INV-2026-000001', orderNo: 'ORD-2026-000001', patientId: 'P-2026-000001', status: 'Unpaid', total: 450, balance: 450, isLocked: false, payments: [] }
    ],
    queue: [
      { ticket: 'Q-000021', patientId: 'P-2026-000001', patient: 'Juan Dela Cruz', station: 'Cashier', status: 'Pending', priority: false, orderNo: 'ORD-2026-000001', labNo: 'LAB-2026-000001' },
      { ticket: 'Q-000022', patientId: 'P-2026-000001', patient: 'Juan Dela Cruz', station: 'Laboratory', status: 'Processing', priority: true, orderNo: 'ORD-2026-000001', labNo: 'LAB-2026-000001' }
    ],
    labOrders: [
      {
        labNo: 'LAB-2026-000001',
        orderNo: 'ORD-2026-000001',
        patientId: 'P-2026-000001',
        serviceCode: 'CBC',
        serviceName: 'Complete Blood Count',
        status: 'Processing',
        barcode: 'LAB-2026-000001',
        chain: { collectedBy: 'M. Santos', collectedAt: '08:35', receivedBy: 'M. Santos', receivedAt: '08:42', processedBy: 'M. Santos' }
      }
    ],
    labResults: [
      {
        labNo: 'LAB-2026-000001',
        version: 1,
        status: 'Processing',
        encodedBy: null,
        validatedBy: null,
        approvedBy: null,
        releasedBy: null,
        isLocked: false,
        comments: '',
        items: [
          { analyte: 'Hemoglobin', result: '13.5', unit: 'g/dL', range: '12.0-16.0', flag: '', critical: false },
          { analyte: 'WBC', result: '7.2', unit: '10^9/L', range: '4.0-10.0', flag: '', critical: false },
          { analyte: 'Platelet', result: '250', unit: '10^9/L', range: '150-400', flag: '', critical: false }
        ]
      }
    ],
    inventory: [
      { id: 'INVITEM-001', code: 'CBC-REAGENT', name: 'CBC Reagent', category: 'Laboratory reagents', batch: 'BATCH-2026-031', supplier: 'Prime Diagnostics Supply', expiry: '2026-12-31', qty: 12, reorderLevel: 10, status: 'stocked' },
      { id: 'INVITEM-002', code: 'VACUTAINER', name: 'Vacutainer Tube', category: 'Lab consumables', batch: 'BATCH-2026-004', supplier: 'Prime Diagnostics Supply', expiry: '2026-06-15', qty: 8, reorderLevel: 20, status: 'low stock' },
      { id: 'INVITEM-003', code: 'RAPID-KIT', name: 'Rapid Test Kit', category: 'Laboratory reagents', batch: 'BATCH-2025-118', supplier: 'MedSupply PH', expiry: '2026-05-20', qty: 5, reorderLevel: 5, status: 'expiring' }
    ],
    employees: [
      { id: 'EMP-2026-000001', name: 'Maria Santos', department: 'Laboratory', position: 'Med-Tech', status: 'active', linkedUserId: 'u-medtech', linkedUserStatus: 'active', licenseExpiry: '2027-03-30' }
    ],
    approvals: [
      { id: 'APR-2026-000000', type: 'refund', module: 'billing', record: 'OR-2026-000118', status: 'Submitted', reason: 'Duplicate payment posted by patient.', requestedBy: 'C. Gomez', requestedUserId: 'u-cashier', createdAt: '08:14' }
    ],
    notifications: [
      { id: 'NTF-2026-000001', recipient: 'Juan Dela Cruz', channel: 'In-app', template: 'result_ready', subject: 'Secure document available', body: 'Your laboratory result is available. Please log in securely.', status: 'queued', safe: true }
    ],
    audit: [
      { time: '08:10', user: 'A. Reyes', role: 'Super Admin', module: 'auth', action: 'login', record: 'session', reason: 'MFA verified' },
      { time: '08:18', user: 'M. Santos', role: 'Med-Tech', module: 'patients', action: 'view', record: 'P-2026-000001', reason: 'Front desk workflow' }
    ],
    cashierSession: { status: 'Open', openingCash: 5000, expectedCash: 5000, actualCash: 5450, variance: 0, closedAt: null },
    backups: [{ time: 'Today 02:00', status: 'encrypted', restoreTested: true }]
  };
}

const state = createInitialState();
let charts = {};
let pendingReasonAction = null;

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function currentPatient() {
  return state.patients.find(patient => patient.id === state.currentPatientId) || state.patients[0];
}

function currentInvoice() {
  return state.invoices.find(invoice => invoice.no === state.currentInvoiceNo) || state.invoices[0];
}

function currentOrder() {
  const invoice = currentInvoice();
  return state.orders.find(order => order.no === invoice?.orderNo) || state.orders[0];
}

function currentLabOrder() {
  return state.labOrders.find(order => order.labNo === state.currentLabNo) || state.labOrders[0];
}

function currentLabResult() {
  return state.labResults.find(result => result.labNo === state.currentLabNo && result.status !== 'Superseded') || state.labResults[0];
}

function addAudit(module, action, record, reason = 'Workflow action') {
  state.audit.unshift({
    time: nowTime(),
    user: state.currentUser.name,
    role: roleLabel(state.currentUser.role).replace('Admin / ', ''),
    module,
    action,
    record,
    reason
  });
  renderAudit();
}

function notify(title, message = '', tone = 'success') {
  const stack = document.querySelector('#toast-stack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `app-toast ${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  stack.prepend(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function requirePermission(permission, module, action, record = permission) {
  if (hasPermission(state, permission)) return true;
  addAudit('security', 'permission.denied', record, `Missing permission ${permission} for ${module}.${action}`);
  notify('Permission denied', `This role needs ${permission}.`, 'danger');
  return false;
}

function showScreen(name) {
  const target = document.querySelector(`#screen-${name}`);
  if (!target) return;
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.screen === name));
  if (name === 'reports') updateCharts();
}

function showInfo(title, bodyHtml) {
  const modalElement = document.querySelector('#info-modal');
  document.querySelector('#info-title').textContent = title;
  document.querySelector('#info-body').innerHTML = bodyHtml;
  if (window.bootstrap) {
    window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
  } else {
    window.alert(`${title}\n\n${modalElement.textContent}`);
  }
}

function askReason({ title, message, keyword, confirmLabel = 'Confirm', tone = 'danger', onConfirm }) {
  const modalElement = document.querySelector('#reason-modal');
  const keywordWrapper = document.querySelector('#keyword-wrapper');
  pendingReasonAction = { keyword, onConfirm };
  document.querySelector('#reason-title').textContent = title;
  document.querySelector('#reason-message').textContent = message;
  document.querySelector('#reason-text').value = '';
  document.querySelector('#reason-keyword').value = '';
  document.querySelector('#reason-confirm').textContent = confirmLabel;
  document.querySelector('#reason-confirm').className = `btn btn-${tone}`;
  keywordWrapper.classList.toggle('d-none', !keyword);
  if (keyword) {
    keywordWrapper.querySelector('input').placeholder = keyword;
  }
  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function confirmReason() {
  if (!pendingReasonAction) return;
  const reason = document.querySelector('#reason-text').value.trim();
  const typedKeyword = document.querySelector('#reason-keyword').value.trim();
  if (!reason) {
    notify('Reason required', 'Sensitive actions must capture a reason.', 'warning');
    return;
  }
  if (pendingReasonAction.keyword && typedKeyword !== pendingReasonAction.keyword) {
    notify('Keyword mismatch', `Type ${pendingReasonAction.keyword} to continue.`, 'warning');
    return;
  }
  const handler = pendingReasonAction.onConfirm;
  pendingReasonAction = null;
  window.bootstrap.Modal.getOrCreateInstance(document.querySelector('#reason-modal')).hide();
  handler(reason);
}

function setCurrentUser(role) {
  state.currentUser = { ...DEMO_USERS[role] };
  document.querySelector('#topbar-role').textContent = roleLabel(role);
  document.querySelector('#topbar-branch').textContent = state.currentUser.branch;
}

function registerPatient(event) {
  event.preventDefault();
  if (!requirePermission('patient.create', 'patients', 'create')) return;
  const firstName = document.querySelector('#reg-first').value.trim();
  const lastName = document.querySelector('#reg-last').value.trim();
  const mobile = document.querySelector('#reg-mobile').value.trim();
  const birthdate = document.querySelector('#reg-birthdate').value;
  const duplicateRisk = state.patients.some(patient =>
    patient.firstName.toLowerCase() === firstName.toLowerCase() &&
    patient.lastName.toLowerCase() === lastName.toLowerCase() &&
    patient.contact === mobile
  );
  const patient = {
    id: nextNumber(state, 'patient'),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    birthdate,
    sex: document.querySelector('#reg-sex').value,
    contact: mobile,
    email: document.querySelector('#reg-email').value.trim(),
    address: document.querySelector('#reg-address').value.trim(),
    classification: document.querySelector('#reg-classification').value,
    consent: document.querySelector('#reg-consent').value === 'signed' ? 'Signed' : 'Pending',
    duplicateRisk,
    status: 'active',
    documents: []
  };
  state.patients.unshift(patient);
  state.currentPatientId = patient.id;
  addAudit('patients', 'patient.create', patient.id, duplicateRisk ? 'Patient registration with duplicate risk flagged' : 'Patient registration');
  notify('Patient registered', `${patient.id} created.`);
  renderAll();
  showScreen('profile');
}

function addApproval(type, module, record, reason) {
  const approval = {
    id: nextNumber(state, 'approval'),
    type,
    module,
    record,
    status: 'Submitted',
    reason,
    requestedBy: state.currentUser.name,
    requestedUserId: state.currentUser.id,
    createdAt: nowTime()
  };
  state.approvals.unshift(approval);
  addAudit(module, `${type}.request`, record, reason);
  renderAll();
  notify('Approval requested', `${approval.id} is waiting for an authorized reviewer.`);
  return approval;
}

function createOrderFromSelection() {
  if (!requirePermission('order.create', 'orders', 'create')) return;
  if (!state.selectedServices.length) {
    notify('No services selected', 'Add at least one service or package.', 'warning');
    return;
  }
  const patient = currentPatient();
  const orderNo = nextNumber(state, 'order');
  const invoiceNo = nextNumber(state, 'invoice');
  const selectedServices = state.selectedServices.map(code => state.services.find(service => service.code === code)).filter(Boolean);
  const total = selectedServices.reduce((sum, service) => sum + service.price, 0);
  state.orders.unshift({
    no: orderNo,
    patientId: patient.id,
    status: 'Pending Payment',
    paymentStatus: 'Unpaid',
    itemCodes: selectedServices.map(service => service.code),
    itemNames: selectedServices.map(service => service.name),
    total,
    invoiceNo,
    createdAt: nowTime(),
    isVoided: false
  });
  state.invoices.unshift({
    no: invoiceNo,
    orderNo,
    patientId: patient.id,
    status: 'Unpaid',
    total,
    balance: total,
    isLocked: false,
    payments: []
  });
  selectedServices.filter(service => service.department === 'Laboratory').forEach(service => {
    const labNo = nextNumber(state, 'lab');
    state.labOrders.unshift({
      labNo,
      orderNo,
      patientId: patient.id,
      serviceCode: service.code,
      serviceName: service.name,
      status: 'Pending Collection',
      barcode: labNo,
      chain: {}
    });
    state.labResults.unshift({
      labNo,
      version: 1,
      status: 'Pending Collection',
      encodedBy: null,
      validatedBy: null,
      approvedBy: null,
      releasedBy: null,
      isLocked: false,
      comments: '',
      items: defaultResultItems(service.code)
    });
    state.currentLabNo = labNo;
  });
  state.currentInvoiceNo = invoiceNo;
  state.selectedServices = [];
  document.querySelector('#discount-reason').value = '';
  addAudit('orders', 'order.create', orderNo, 'Order created from selected services with price versions locked');
  notify('Order created', `${orderNo} moved to Pending Payment.`);
  renderAll();
  showScreen('billing');
}

function defaultResultItems(serviceCode) {
  if (serviceCode === 'FBS') return [{ analyte: 'Fasting Blood Sugar', result: '95', unit: 'mg/dL', range: '70-99', flag: '', critical: false }];
  if (serviceCode === 'URINALYSIS') return [
    { analyte: 'Color', result: 'Yellow', unit: '', range: 'Yellow', flag: '', critical: false },
    { analyte: 'Protein', result: 'Negative', unit: '', range: 'Negative', flag: '', critical: false }
  ];
  return [
    { analyte: 'Hemoglobin', result: '13.5', unit: 'g/dL', range: '12.0-16.0', flag: '', critical: false },
    { analyte: 'WBC', result: '7.2', unit: '10^9/L', range: '4.0-10.0', flag: '', critical: false },
    { analyte: 'Platelet', result: '250', unit: '10^9/L', range: '150-400', flag: '', critical: false }
  ];
}

function postPayment(event) {
  event.preventDefault();
  if (!requirePermission('billing.payment.create', 'billing', 'payment.create')) return;
  const invoice = currentInvoice();
  const amount = parseAmount(document.querySelector('#payment-amount').value);
  const validation = canPostPayment(invoice, amount, state.settings);
  if (!validation.ok) {
    notify('Payment blocked', validation.message, 'danger');
    addAudit('billing', 'payment.blocked', invoice?.no || 'invoice', validation.message);
    return;
  }
  const receiptNo = nextNumber(state, 'receipt');
  const paid = Math.min(amount, invoice.balance);
  invoice.balance = Number((invoice.balance - paid).toFixed(2));
  invoice.status = invoice.balance === 0 ? 'Paid' : 'Partially Paid';
  invoice.isLocked = invoice.balance === 0;
  invoice.payments.unshift({
    receiptNo,
    mode: document.querySelector('#payment-mode').value,
    reference: document.querySelector('#payment-reference').value.trim(),
    amount: paid,
    status: 'Posted',
    createdAt: nowTime()
  });
  const order = state.orders.find(item => item.no === invoice.orderNo);
  if (order) {
    order.paymentStatus = invoice.status;
    if (invoice.status === 'Paid') order.status = 'Paid';
  }
  state.cashierSession.expectedCash += document.querySelector('#payment-mode').value === 'Cash' ? paid : 0;
  if (invoice.status === 'Paid') createQueueTicketsForOrder(order);
  addAudit('billing', 'billing.payment.create', receiptNo, `${invoice.payments[0].mode} payment posted for ${invoice.no}`);
  notify('Payment posted', `${receiptNo} created. ${invoice.no} is ${invoice.status}.`);
  renderAll();
  showScreen(invoice.status === 'Paid' ? 'queue' : 'billing');
}

function createQueueTicketsForOrder(order) {
  if (!order) return;
  const patient = state.patients.find(item => item.id === order.patientId);
  state.labOrders.filter(labOrder => labOrder.orderNo === order.no).forEach(labOrder => {
    if (!state.queue.some(ticket => ticket.labNo === labOrder.labNo && ticket.station === 'Laboratory')) {
      state.queue.unshift({
        ticket: nextNumber(state, 'queue').replace('Q-2026-', 'Q-'),
        patientId: patient.id,
        patient: patient.name,
        station: 'Laboratory',
        status: 'Pending',
        priority: false,
        orderNo: order.no,
        labNo: labOrder.labNo
      });
    }
  });
}

function requestVoid() {
  if (!requirePermission('order.void.request', 'orders', 'void.request')) return;
  const order = currentOrder();
  if (!order || order.isVoided) {
    notify('Void unavailable', 'There is no active order to void.', 'warning');
    return;
  }
  askReason({
    title: `Void Order ${order.no}?`,
    message: 'This will create an approval request. The requester cannot approve the request.',
    keyword: 'VOID',
    confirmLabel: 'Request void',
    onConfirm: reason => addApproval('order_void', 'orders', order.no, reason)
  });
}

function requestRefund() {
  if (!requirePermission('billing.refund.request', 'billing', 'refund.request')) return;
  const invoice = currentInvoice();
  if (!invoice || invoice.payments.length === 0) {
    notify('Refund unavailable', 'A posted payment is required before refund request.', 'warning');
    return;
  }
  askReason({
    title: `Refund ${invoice.no}?`,
    message: 'This creates a maker-checker refund request and keeps the original receipt locked.',
    confirmLabel: 'Request refund',
    tone: 'warning',
    onConfirm: reason => addApproval('refund', 'billing', invoice.no, reason)
  });
}

function approveRequest(approvalId) {
  const approval = state.approvals.find(item => item.id === approvalId);
  if (!approval || approval.status !== 'Submitted') return;
  if (!canApprove(state, approval)) {
    addAudit('approval', 'approval.denied', approval.id, 'Requester cannot approve own request or role lacks approval permission');
    notify('Approval blocked', 'Requester cannot approve own request and role must hold the approval permission.', 'danger');
    return;
  }
  approval.status = 'Approved';
  approval.reviewedBy = state.currentUser.name;
  approval.reviewedAt = nowTime();
  applyApproval(approval);
  addAudit('approval', `${approval.type}.approve`, approval.record, `Approved ${approval.id}`);
  notify('Request approved', `${approval.id} applied.`);
  renderAll();
}

function rejectRequest(approvalId) {
  const approval = state.approvals.find(item => item.id === approvalId);
  if (!approval || approval.status !== 'Submitted') return;
  const permission = APPROVAL_PERMISSION[approval.type];
  if (permission && !requirePermission(permission, 'approval', 'reject', approval.id)) return;
  if (approval.requestedUserId === state.currentUser.id) {
    notify('Rejection blocked', 'Requester cannot review own request.', 'danger');
    return;
  }
  approval.status = 'Rejected';
  approval.reviewedBy = state.currentUser.name;
  approval.reviewedAt = nowTime();
  addAudit('approval', `${approval.type}.reject`, approval.record, `Rejected ${approval.id}`);
  renderAll();
}

function applyApproval(approval) {
  if (approval.type === 'order_void') {
    const order = state.orders.find(item => item.no === approval.record);
    const invoice = state.invoices.find(item => item.orderNo === approval.record);
    if (order) {
      order.status = 'Voided';
      order.isVoided = true;
    }
    if (invoice && invoice.status !== 'Paid') {
      invoice.status = 'Voided';
      invoice.isLocked = true;
    }
  }
  if (approval.type === 'refund') {
    const invoice = state.invoices.find(item => item.no === approval.record);
    if (invoice) {
      invoice.status = 'Refunded';
      invoice.isLocked = true;
    }
  }
  if (approval.type === 'result_amendment') {
    const result = state.labResults.find(item => item.labNo === approval.record && item.status === 'Released');
    if (result && result.status === 'Released') {
      result.status = 'Superseded';
      result.isLocked = true;
      state.currentLabNo = approval.record;
      state.labResults.unshift({
        ...result,
        items: result.items.map(item => ({ ...item })),
        version: result.version + 1,
        status: 'Encoded',
        isLocked: false,
        supersedesVersion: result.version,
        encodedBy: state.currentUser.name,
        validatedBy: null,
        approvedBy: null,
        releasedBy: null
      });
    }
  }
  if (approval.type === 'inventory_adjustment') {
    const item = state.inventory.find(record => record.id === approval.record);
    if (item) {
      item.qty = Math.max(0, item.qty - 1);
      item.status = inventoryStatus(item);
    }
  }
  if (approval.type === 'role_change') {
    const employee = state.employees.find(item => item.id === approval.record);
    if (employee) employee.linkedUserStatus = 'inactive';
  }
}

function setLabWorkflowStatus(nextStatus, permission, reason) {
  const labOrder = currentLabOrder();
  const result = currentLabResult();
  if (!labOrder || !result) return false;
  if (permission && !requirePermission(permission, 'laboratory', nextStatus.toLowerCase(), labOrder.labNo)) return false;
  if (!canTransitionLab(result.status, nextStatus)) {
    notify('Workflow blocked', `${result.status} cannot move directly to ${nextStatus}.`, 'danger');
    addAudit('laboratory', 'workflow.blocked', labOrder.labNo, `${result.status} -> ${nextStatus} rejected`);
    return false;
  }
  result.status = nextStatus;
  labOrder.status = nextStatus;
  if (nextStatus === 'Collected') {
    labOrder.chain.collectedBy = state.currentUser.name;
    labOrder.chain.collectedAt = nowTime();
  }
  if (nextStatus === 'Received') {
    labOrder.chain.receivedBy = state.currentUser.name;
    labOrder.chain.receivedAt = nowTime();
  }
  if (nextStatus === 'Processing') labOrder.chain.processedBy = state.currentUser.name;
  addAudit('laboratory', `lab.${nextStatus.toLowerCase().replace(/\s+/g, '_')}`, labOrder.labNo, reason);
  renderAll();
  return true;
}

function collectSample(ticketId) {
  const ticket = state.queue.find(item => item.ticket === ticketId);
  if (!ticket) return;
  state.currentLabNo = ticket.labNo;
  if (setLabWorkflowStatus('Collected', 'lab.result.encode', 'Specimen collected with barcode custody')) {
    ticket.status = 'Processing';
    showScreen('lab');
  }
}

function receiveSample(ticketId) {
  const ticket = state.queue.find(item => item.ticket === ticketId);
  if (!ticket) return;
  state.currentLabNo = ticket.labNo;
  if (setLabWorkflowStatus('Received', 'lab.result.encode', 'Specimen received by laboratory')) showScreen('lab');
}

function startProcessing(ticketId) {
  const ticket = state.queue.find(item => item.ticket === ticketId);
  if (!ticket) return;
  state.currentLabNo = ticket.labNo;
  if (setLabWorkflowStatus('Processing', 'lab.result.encode', 'Specimen moved to processing')) showScreen('lab');
}

function encodeResult() {
  const result = currentLabResult();
  if (!result) return;
  if (!requirePermission('lab.result.encode', 'laboratory', 'result.encode', state.currentLabNo)) return;
  if (result.isLocked || result.status === 'Released') {
    notify('Result locked', 'Released results require an amendment request.', 'danger');
    return;
  }
  document.querySelectorAll('[data-lab-index]').forEach(input => {
    const index = Number(input.dataset.labIndex);
    result.items[index].result = input.value.trim();
  });
  result.comments = document.querySelector('#lab-comments').value.trim();
  result.encodedBy = state.currentUser.name;
  if (result.status === 'Processing') {
    result.status = 'Encoded';
    currentLabOrder().status = 'Encoded';
  }
  addAudit('laboratory', 'lab.result.encode', state.currentLabNo, 'Result values saved');
  notify('Result encoded', `${state.currentLabNo} is ready for validation.`);
  renderAll();
}

function validateResult() {
  const result = currentLabResult();
  if (!result) return;
  if (!requirePermission('lab.result.validate', 'laboratory', 'result.validate', state.currentLabNo)) return;
  if (result.status !== 'Encoded') {
    notify('Validation blocked', 'Result must be encoded before validation.', 'danger');
    return;
  }
  result.status = 'Validated';
  result.validatedBy = state.currentUser.name;
  currentLabOrder().status = 'Validated';
  addAudit('laboratory', 'lab.result.validate', state.currentLabNo, 'Validated by authorized approver');
  notify('Result validated', `${state.currentLabNo} can now be approved.`);
  renderAll();
}

function approveResult(event) {
  event.preventDefault();
  const result = currentLabResult();
  if (!result) return;
  if (!requirePermission('lab.result.approve', 'laboratory', 'result.approve', state.currentLabNo)) return;
  if (result.status !== 'Validated') {
    notify('Approval blocked', 'Result must be validated before approval.', 'danger');
    return;
  }
  if (state.settings.dualApprovalEnabled && result.encodedBy === state.currentUser.name) {
    notify('Approval blocked', 'Dual approval prevents the encoder from approving their own result.', 'danger');
    addAudit('laboratory', 'approval.denied', state.currentLabNo, 'Encoder attempted to approve own result');
    return;
  }
  result.status = 'Approved';
  result.approvedBy = state.currentUser.name;
  currentLabOrder().status = 'Approved';
  addAudit('laboratory', 'lab.result.approve', state.currentLabNo, 'Approved for release');
  notify('Result approved', `${state.currentLabNo} can now be released.`);
  renderAll();
}

function releaseResult() {
  const result = currentLabResult();
  if (!result) return;
  if (!requirePermission('lab.result.release', 'laboratory', 'result.release', state.currentLabNo)) return;
  if (result.status !== 'Approved') {
    notify('Release blocked', 'Result must be approved before release.', 'danger');
    return;
  }
  result.status = 'Released';
  result.releasedBy = state.currentUser.name;
  result.isLocked = true;
  currentLabOrder().status = 'Released';
  const patient = currentPatientForLab();
  const documentId = nextNumber(state, 'document');
  patient.documents.unshift({ id: documentId, title: `${currentLabOrder().serviceName} result`, category: 'Laboratory', status: 'released', private: true, labNo: state.currentLabNo });
  queueNotification(patient.name, 'result_ready', 'Your laboratory result is available. Please log in securely.');
  addAudit('laboratory', 'lab.result.release', state.currentLabNo, 'Released result and queued privacy-safe notification');
  notify('Result released', `${state.currentLabNo} is locked and available for print preview.`);
  renderAll();
  showScreen('print');
}

function currentPatientForLab() {
  const labOrder = currentLabOrder();
  return state.patients.find(patient => patient.id === labOrder?.patientId) || currentPatient();
}

function requestAmendment() {
  const result = currentLabResult();
  if (!result || result.status !== 'Released') {
    notify('Amendment unavailable', 'Only released results can enter amendment workflow.', 'warning');
    return;
  }
  if (!requirePermission('lab.result.amend.request', 'laboratory', 'result.amend.request', state.currentLabNo)) return;
  askReason({
    title: `Amend ${state.currentLabNo}?`,
    message: 'Released results cannot be edited directly. Approval creates a new version and supersedes the old result.',
    keyword: 'AMEND',
    confirmLabel: 'Request amendment',
    onConfirm: reason => addApproval('result_amendment', 'laboratory', state.currentLabNo, reason)
  });
}

function queueNotification(recipient, template, body) {
  state.notifications.unshift({
    id: nextNumber(state, 'notification'),
    recipient,
    channel: 'In-app',
    template,
    subject: 'Secure document available',
    body,
    status: 'queued',
    safe: !/(hemoglobin|hiv|diagnosis|pneumonia|result:\s*\d)/i.test(body)
  });
}

function receiveStock(event) {
  event.preventDefault();
  if (!requirePermission('inventory.receive', 'inventory', 'receive')) return;
  const qty = parseAmount(document.querySelector('#stock-qty').value);
  if (!Number.isFinite(qty) || qty <= 0) {
    notify('Receiving blocked', 'Quantity must be greater than zero.', 'danger');
    return;
  }
  const itemName = document.querySelector('#stock-item').value.trim();
  const batch = document.querySelector('#stock-batch').value.trim();
  const expiry = document.querySelector('#stock-expiry').value;
  if (!itemName || !batch || !expiry) {
    notify('Receiving blocked', 'Item, batch, and expiry date are required.', 'danger');
    return;
  }
  const existing = state.inventory.find(item => item.name.toLowerCase() === itemName.toLowerCase() && item.batch === batch);
  const item = existing || {
    id: `INVITEM-${String(state.inventory.length + 1).padStart(3, '0')}`,
    code: itemName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: itemName,
    category: 'Laboratory reagents',
    batch,
    supplier: document.querySelector('#stock-supplier').value.trim(),
    expiry,
    qty: 0,
    reorderLevel: 10,
    status: 'stocked'
  };
  item.qty += qty;
  item.expiry = expiry;
  item.supplier = document.querySelector('#stock-supplier').value.trim();
  item.status = inventoryStatus(item);
  if (!existing) state.inventory.unshift(item);
  addAudit('inventory', 'inventory.receive', item.code, `Received ${qty} ${item.name}, batch ${item.batch}`);
  notify('Stock received', `${item.name} stock updated.`);
  renderAll();
}

function inventoryStatus(item) {
  const expiry = new Date(`${item.expiry}T00:00:00`);
  const daysToExpiry = (expiry - new Date()) / 86400000;
  if (daysToExpiry < 0) return 'expired';
  if (daysToExpiry <= 45) return 'expiring';
  if (item.qty <= item.reorderLevel) return 'low stock';
  return 'stocked';
}

function issueStock(itemId) {
  const item = state.inventory.find(record => record.id === itemId);
  if (!item) return;
  if (!requirePermission('inventory.transfer', 'inventory', 'issue', item.code)) return;
  if (inventoryStatus(item) === 'expired') {
    notify('Issue blocked', 'Expired inventory cannot be issued without documented override.', 'danger');
    addAudit('inventory', 'inventory.issue.blocked', item.code, 'Expired inventory issue blocked');
    return;
  }
  if (item.qty <= 0) {
    notify('Issue blocked', 'No stock available.', 'warning');
    return;
  }
  item.qty -= 1;
  item.status = inventoryStatus(item);
  addAudit('inventory', 'inventory.issue', item.code, 'Issued one unit to operations');
  renderAll();
}

function requestInventoryAdjustment(itemId) {
  const item = state.inventory.find(record => record.id === itemId);
  if (!item) return;
  if (!requirePermission('inventory.adjust.request', 'inventory', 'adjust.request', item.code)) return;
  askReason({
    title: `Adjust inventory ${item.name}?`,
    message: 'Inventory adjustments require reason and manager approval.',
    confirmLabel: 'Request adjustment',
    tone: 'warning',
    onConfirm: reason => addApproval('inventory_adjustment', 'inventory', item.id, reason)
  });
}

function offboardEmployee(employeeId) {
  const employee = state.employees.find(item => item.id === employeeId);
  if (!employee) return;
  if (!requirePermission('hr.employee.update', 'hr', 'offboard', employee.id)) return;
  askReason({
    title: `Offboard ${employee.name}?`,
    message: 'Offboarding triggers login deactivation and permission revocation through approval.',
    confirmLabel: 'Request offboarding',
    tone: 'warning',
    onConfirm: reason => {
      employee.status = 'offboarding';
      addApproval('role_change', 'hr', employee.id, reason);
      addAudit('hr', 'employee.offboarding.request', employee.id, reason);
      renderAll();
    }
  });
}

function previewCashierClosing() {
  const opening = parseAmount(document.querySelector('#cash-opening').value);
  const actual = parseAmount(document.querySelector('#cash-actual').value);
  const cashPayments = state.invoices.flatMap(invoice => invoice.payments).filter(payment => payment.mode === 'Cash' && payment.status === 'Posted').reduce((sum, payment) => sum + payment.amount, 0);
  state.cashierSession.openingCash = Number.isFinite(opening) ? opening : 0;
  state.cashierSession.actualCash = Number.isFinite(actual) ? actual : 0;
  state.cashierSession.expectedCash = state.cashierSession.openingCash + cashPayments;
  state.cashierSession.variance = Number((state.cashierSession.actualCash - state.cashierSession.expectedCash).toFixed(2));
  renderCashier();
}

function closeCashier(event) {
  event.preventDefault();
  if (!requirePermission('cashier.close', 'billing', 'cashier.close')) return;
  previewCashierClosing();
  const reason = document.querySelector('#cash-remarks').value.trim() || 'Cashier session closing';
  state.cashierSession.status = 'Closed';
  state.cashierSession.closedAt = nowTime();
  addAudit('billing', 'cashier.close', 'session', `${reason}; variance ${money(state.cashierSession.variance)}`);
  notify('Cashier closed', `Variance: ${money(state.cashierSession.variance)}.`);
  renderAll();
}

function runDemo() {
  if (state.currentUser.role !== 'super_admin') {
    notify('Demo blocked', 'Sign in as Super Admin to run the full cross-role demo script.', 'warning');
    return;
  }
  const patient = {
    id: nextNumber(state, 'patient'),
    firstName: 'Maria',
    lastName: 'Santos',
    name: 'Maria Santos',
    birthdate: '1991-03-14',
    sex: 'female',
    contact: '09171234567',
    email: 'maria.santos@example.com',
    address: 'Quezon City',
    classification: 'Regular',
    consent: 'Signed',
    duplicateRisk: false,
    status: 'active',
    documents: []
  };
  state.patients.unshift(patient);
  state.currentPatientId = patient.id;
  state.selectedServices = ['CBC'];
  createOrderFromSelection();
  document.querySelector('#payment-amount').value = String(currentInvoice().balance.toFixed(2));
  document.querySelector('#payment-mode').value = 'Cash';
  postPayment(new Event('submit'));
  const ticket = state.queue.find(item => item.patientId === patient.id && item.labNo);
  if (ticket) {
    state.currentLabNo = ticket.labNo;
    collectSample(ticket.ticket);
    receiveSample(ticket.ticket);
    startProcessing(ticket.ticket);
  }
  encodeResult();
  const result = currentLabResult();
  result.encodedBy = 'M. Santos';
  validateResult();
  approveResult(new Event('submit'));
  releaseResult();
  addAudit('reports', 'report.view', 'daily-sales', 'Demo script viewed sales report');
  renderAll();
  showScreen('print');
  notify('CBC demo complete', 'Patient, payment, queue, lab release, print preview, report, and audit steps are complete.');
}

function renderAll() {
  renderTopbar();
  renderDashboard();
  renderPatients();
  renderServices();
  renderOrder();
  renderProfile();
  renderBilling();
  renderCashier();
  renderQueue();
  renderLab();
  renderPrint();
  renderInventory();
  renderEmployees();
  renderNotifications();
  renderPortal();
  renderReports();
  renderApprovals();
  renderAudit();
  renderSettings();
  updateCharts();
}

function renderTopbar() {
  const branch = document.querySelector('#topbar-branch');
  if (!branch) return;
  branch.textContent = state.currentUser.branch;
  document.querySelector('#topbar-role').textContent = roleLabel(state.currentUser.role);
  const unread = state.notifications.some(notification => notification.status === 'queued' || notification.status === 'failed');
  document.querySelector('#notification-dot').classList.toggle('d-none', !unread);
}

function renderDashboard() {
  const waiting = state.queue.filter(ticket => ticket.status === 'Pending').length;
  const priority = state.queue.filter(ticket => ticket.priority && ticket.status !== 'Completed').length;
  const pendingLab = state.labResults.filter(result => ['Encoded', 'Validated'].includes(result.status)).length;
  const critical = state.labResults.flatMap(result => result.items).filter(item => item.critical).length;
  const unpaid = state.invoices.filter(invoice => ['Unpaid', 'Partially Paid'].includes(invoice.status));
  const lowStock = state.inventory.filter(item => ['low stock', 'expired', 'expiring'].includes(inventoryStatus(item)));
  setText('#metric-queue', waiting);
  setText('#metric-priority', `${priority} priority`);
  setText('#metric-lab', pendingLab);
  setText('#metric-critical', `${critical} critical flags`);
  setText('#metric-unpaid', unpaid.length);
  setText('#metric-unpaid-total', money(unpaid.reduce((sum, invoice) => sum + invoice.balance, 0)));
  setText('#metric-stock', lowStock.length);
  setText('#metric-expiry', `${lowStock.filter(item => inventoryStatus(item) === 'expiring').length} expiring`);
  const pendingApprovals = state.approvals.filter(approval => approval.status === 'Submitted');
  setText('#approval-count', `${pendingApprovals.length} needs review`);
  document.querySelector('#action-queue').innerHTML = pendingApprovals.length ? pendingApprovals.map(approval => `
    <div class="list-group-item d-flex justify-content-between align-items-center gap-3">
      <span><strong>${escapeHtml(approval.id)}</strong> ${escapeHtml(approval.type.replace(/_/g, ' '))} for ${escapeHtml(approval.record)}</span>
      <button type="button" class="btn btn-sm btn-outline-primary" data-jump="approvals">Review</button>
    </div>
  `).join('') : '<div class="list-group-item text-secondary">No pending approvals.</div>';
}

function renderPatients() {
  const body = document.querySelector('#patient-table');
  if (!body) return;
  const query = (document.querySelector('#patient-search')?.value || '').toLowerCase();
  const statusFilter = document.querySelector('#patient-status-filter')?.value || 'active';
  const rows = state.patients.filter(patient => {
    const matchesQuery = [patient.id, patient.name, patient.contact, patient.email].join(' ').toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    return matchesQuery && matchesStatus;
  });
  body.innerHTML = rows.map(patient => `
    <tr>
      <td><strong>${escapeHtml(patient.id)}</strong></td>
      <td>${escapeHtml(patient.name)}</td>
      <td>${ageFromBirthdate(patient.birthdate)} / ${escapeHtml(patient.sex)}</td>
      <td>${escapeHtml(patient.contact)}</td>
      <td><span class="badge ${statusClass(patient.status)}">${escapeHtml(patient.status)}</span></td>
      <td class="text-end">
        <div class="btn-group">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="viewPatient" data-patient-id="${escapeHtml(patient.id)}"><i class="bi bi-eye"></i> View</button>
          <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false"><span class="visually-hidden">More</span></button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button type="button" class="dropdown-item" data-action="startOrderForPatient" data-patient-id="${escapeHtml(patient.id)}">Create order</button></li>
            <li><button type="button" class="dropdown-item" data-action="requestMerge" data-patient-id="${escapeHtml(patient.id)}">Request merge</button></li>
            <li><button type="button" class="dropdown-item text-danger" data-action="archivePatient" data-patient-id="${escapeHtml(patient.id)}">Archive</button></li>
          </ul>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="text-center text-secondary">No patients match the filters.</td></tr>';
}

function renderServices() {
  const list = document.querySelector('#service-list');
  if (!list) return;
  list.innerHTML = state.services.map(service => `
    <div class="service-item">
      <div><strong>${escapeHtml(service.name)}</strong><span>${escapeHtml(service.department)} | ${escapeHtml(service.code)} | v${service.version}</span></div>
      <strong>${money(service.price)}</strong>
      <button type="button" class="btn btn-sm btn-outline-primary" data-action="addService" data-service="${escapeHtml(service.code)}"><i class="bi bi-plus-lg"></i> Add</button>
    </div>
  `).join('');
}

function renderOrder() {
  const container = document.querySelector('#order-items');
  if (!container) return;
  const selectedServices = state.selectedServices.map(code => state.services.find(service => service.code === code)).filter(Boolean);
  container.innerHTML = selectedServices.length ? selectedServices.map((service, index) => `
    <div class="document-row">
      <i class="bi bi-clipboard2-pulse"></i>
      <span>${escapeHtml(service.name)} <small class="text-secondary">v${service.version}</small></span>
      <button type="button" class="btn btn-sm btn-outline-danger" data-action="removeService" data-index="${index}"><i class="bi bi-x-lg"></i></button>
    </div>
  `).join('') : '<p class="text-secondary">No services selected.</p>';
  const total = selectedServices.reduce((sum, service) => sum + service.price, 0);
  setText('#order-total', money(total));
  setText('#order-status', state.selectedServices.length ? 'Draft' : 'Draft');
}

function renderProfile() {
  const patient = currentPatient();
  if (!patient) return;
  setText('#profile-name', patient.name);
  setText('#profile-id', patient.id);
  setText('#profile-classification', patient.classification);
  setText('#profile-consent', patient.consent);
  const duplicate = document.querySelector('#profile-duplicate');
  duplicate.textContent = patient.duplicateRisk ? 'Review needed' : 'Clear';
  duplicate.className = patient.duplicateRisk ? 'text-warning' : 'text-success';
  const orders = state.orders.filter(order => order.patientId === patient.id);
  document.querySelector('#profile-orders').innerHTML = orders.length ? orders.map(order => `
    <div class="timeline-item">
      <div class="d-flex justify-content-between"><strong>${escapeHtml(order.no)}</strong><span class="badge ${statusClass(order.status)}">${escapeHtml(order.status)}</span></div>
      <div class="text-secondary">${escapeHtml(order.itemNames.join(', '))} | ${money(order.total)}</div>
    </div>
  `).join('') : '<p class="text-secondary">No orders yet.</p>';
  document.querySelector('#profile-documents').innerHTML = patient.documents.length ? patient.documents.map(documentItem => `
    <div class="document-row">
      <i class="bi bi-file-earmark-lock"></i>
      <span>${escapeHtml(documentItem.title)} <small class="text-secondary">${escapeHtml(documentItem.category)}</small></span>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="previewDocument" data-document-id="${escapeHtml(documentItem.id)}">Preview</button>
    </div>
  `).join('') : '<p class="text-secondary">No released documents.</p>';
}

function renderBilling() {
  const invoice = currentInvoice();
  if (!invoice) return;
  setText('#invoice-no', invoice.no);
  setText('#invoice-total', money(invoice.total));
  setText('#invoice-balance', `Balance: ${money(invoice.balance)}`);
  setText('#invoice-lock', invoice.isLocked ? 'Locked' : 'Not locked');
  const badge = document.querySelector('#invoice-status');
  badge.textContent = invoice.status;
  badge.className = `badge ${statusClass(invoice.status)}`;
  document.querySelector('#payment-amount').value = invoice.balance > 0 ? invoice.balance.toFixed(2) : '0.00';
}

function renderCashier() {
  const status = document.querySelector('#cashier-status');
  if (!status) return;
  status.textContent = state.cashierSession.status;
  status.className = `badge ${statusClass(state.cashierSession.status)}`;
  setText('#cash-expected', money(state.cashierSession.expectedCash));
  setText('#cash-variance', money(state.cashierSession.variance));
}

function renderQueue() {
  const board = document.querySelector('#queue-board');
  if (!board) return;
  board.innerHTML = state.queue.map(ticket => {
    const labOrder = state.labOrders.find(item => item.labNo === ticket.labNo);
    const actions = [];
    if (ticket.status === 'Pending') actions.push(`<button type="button" class="btn btn-sm btn-outline-primary" data-action="callQueue" data-ticket="${escapeHtml(ticket.ticket)}">Call</button>`);
    if (labOrder?.status === 'Pending Collection') actions.push(`<button type="button" class="btn btn-sm btn-outline-success" data-action="collectSample" data-ticket="${escapeHtml(ticket.ticket)}">Collect</button>`);
    if (labOrder?.status === 'Collected') actions.push(`<button type="button" class="btn btn-sm btn-outline-success" data-action="receiveSample" data-ticket="${escapeHtml(ticket.ticket)}">Receive</button>`);
    if (labOrder?.status === 'Received') actions.push(`<button type="button" class="btn btn-sm btn-outline-success" data-action="startProcessing" data-ticket="${escapeHtml(ticket.ticket)}">Process</button>`);
    actions.push(`<button type="button" class="btn btn-sm btn-outline-secondary" data-action="openLabFromQueue" data-ticket="${escapeHtml(ticket.ticket)}">Open</button>`);
    return `
      <div class="queue-ticket">
        <div><span class="badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span><strong>${escapeHtml(ticket.ticket)}</strong></div>
        <div><span>${escapeHtml(ticket.patient)}</span><small class="d-block text-secondary">${escapeHtml(ticket.station)} | ${escapeHtml(labOrder?.status || 'No lab order')}</small></div>
        <div class="queue-actions">${actions.join('')}</div>
      </div>
    `;
  }).join('') || '<p class="text-secondary">Queue is clear.</p>';
}

function renderLab() {
  const labOrder = currentLabOrder();
  const result = currentLabResult();
  if (!labOrder || !result) return;
  const patient = currentPatientForLab();
  const status = document.querySelector('#lab-status');
  status.textContent = result.status;
  status.className = `badge ${statusClass(result.status)}`;
  document.querySelector('#lab-meta').innerHTML = [
    labOrder.labNo,
    labOrder.serviceName,
    patient.name,
    `Barcode ${labOrder.barcode}`,
    `Version ${result.version}`
  ].map(item => `<span>${escapeHtml(item)}</span>`).join('');
  const stepIndex = LAB_STEPS.indexOf(result.status);
  document.querySelector('#lab-workflow').innerHTML = LAB_STEPS.map((step, index) => {
    const className = index < stepIndex ? 'done' : index === stepIndex ? 'current' : '';
    return `<span class="workflow-step ${className}">${escapeHtml(step)}</span>`;
  }).join('');
  const locked = result.isLocked || result.status === 'Released' || result.status === 'Superseded';
  document.querySelector('#lab-items').innerHTML = result.items.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.analyte)}</td>
      <td><input class="form-control form-control-sm" data-lab-index="${index}" value="${escapeHtml(item.result)}" ${locked ? 'disabled' : ''}></td>
      <td>${escapeHtml(item.unit)}</td>
      <td>${escapeHtml(item.range)}</td>
      <td><span class="badge ${item.flag ? 'status-pending' : 'status-approved'}">${escapeHtml(item.flag || 'normal')}</span></td>
    </tr>
  `).join('');
  document.querySelector('#lab-comments').value = result.comments || '';
  document.querySelector('#lab-comments').disabled = locked;
}

function renderPrint() {
  const labOrder = currentLabOrder();
  const result = currentLabResult();
  if (!labOrder || !result) return;
  const patient = currentPatientForLab();
  setText('#print-patient', patient.name);
  setText('#print-lab-no', labOrder.labNo);
  document.querySelector('#print-items').innerHTML = result.items.map(item => `
    <tr><td>${escapeHtml(item.analyte)}</td><td>${escapeHtml(item.result)}</td><td>${escapeHtml(item.unit)}</td><td>${escapeHtml(item.range)}</td><td>${escapeHtml(item.flag || 'normal')}</td></tr>
  `).join('');
}

function renderInventory() {
  const body = document.querySelector('#inventory-table');
  if (!body) return;
  body.innerHTML = state.inventory.map(item => {
    item.status = inventoryStatus(item);
    return `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong><small class="d-block text-secondary">${escapeHtml(item.category)}</small></td>
        <td>${escapeHtml(item.batch)}</td>
        <td>${escapeHtml(item.expiry)}</td>
        <td>${item.qty}</td>
        <td><span class="badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="issueStock" data-item-id="${escapeHtml(item.id)}">Issue</button>
          <button type="button" class="btn btn-sm btn-outline-warning" data-action="requestInventoryAdjustment" data-item-id="${escapeHtml(item.id)}">Adjust</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderEmployees() {
  const body = document.querySelector('#employee-table');
  if (!body) return;
  body.innerHTML = state.employees.map(employee => `
    <tr>
      <td><strong>${escapeHtml(employee.id)}</strong></td>
      <td>${escapeHtml(employee.name)}<small class="d-block text-secondary">${escapeHtml(employee.position)}</small></td>
      <td>${escapeHtml(employee.department)}</td>
      <td><span class="badge ${statusClass(employee.status)}">${escapeHtml(employee.status)}</span></td>
      <td><span class="badge ${statusClass(employee.linkedUserStatus)}">${escapeHtml(employee.linkedUserStatus)}</span></td>
      <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" data-action="offboardEmployee" data-employee-id="${escapeHtml(employee.id)}">Offboard</button></td>
    </tr>
  `).join('');
}

function renderNotifications() {
  const list = document.querySelector('#notification-list');
  if (!list) return;
  list.innerHTML = state.notifications.map(notification => `
    <div class="notification-item">
      <div>
        <strong>${escapeHtml(notification.subject)}</strong>
        <div>${escapeHtml(notification.body)}</div>
        <small class="text-secondary">${escapeHtml(notification.channel)} to ${escapeHtml(notification.recipient)} | ${escapeHtml(notification.template)}</small>
      </div>
      <div class="notification-actions">
        <span class="badge ${statusClass(notification.status)}">${escapeHtml(notification.status)}</span>
        <button type="button" class="btn btn-sm btn-outline-primary" data-action="markNotificationRead" data-notification-id="${escapeHtml(notification.id)}">Mark read</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="retryNotification" data-notification-id="${escapeHtml(notification.id)}">Retry</button>
      </div>
    </div>
  `).join('');
}

function renderPortal() {
  const patient = currentPatient();
  if (!patient) return;
  document.querySelector('#portal-summary').innerHTML = `
    <div class="portal-card">
      <strong>${escapeHtml(patient.name)}</strong>
      <span class="d-block text-secondary">${escapeHtml(patient.id)} | ${escapeHtml(patient.contact)}</span>
      <span class="badge ${statusClass(patient.status)}">${escapeHtml(patient.status)}</span>
    </div>
    <div class="mt-3">
      ${patient.documents.length ? patient.documents.map(documentItem => `<div class="document-row"><i class="bi bi-file-earmark-lock"></i><span>${escapeHtml(documentItem.title)}</span><button type="button" class="btn btn-sm btn-outline-secondary" data-action="portalDownloadDocument" data-document-id="${escapeHtml(documentItem.id)}">Download</button></div>`).join('') : '<p class="text-secondary">No released documents for this patient.</p>'}
    </div>
  `;
}

function renderReports() {
  const paid = state.invoices.filter(invoice => invoice.status === 'Paid' || invoice.status === 'Refunded').reduce((sum, invoice) => sum + invoice.total, 0);
  const exceptions = [
    ['Released results without payment', state.labOrders.filter(lab => lab.status === 'Released' && !state.orders.some(order => order.no === lab.orderNo && order.paymentStatus === 'Paid')).length],
    ['High discount transactions', state.approvals.filter(item => item.type === 'manual_discount').length],
    ['Frequent voids/refunds', state.approvals.filter(item => ['order_void', 'refund'].includes(item.type)).length],
    ['Amended results', state.labResults.filter(result => result.status === 'Superseded').length],
    ['Low stock critical items', state.inventory.filter(item => ['low stock', 'expired', 'expiring'].includes(inventoryStatus(item))).length],
    ['Daily collections', money(paid)]
  ];
  document.querySelector('#exception-list').innerHTML = exceptions.map(([label, value]) => `<li>${escapeHtml(label)} <span>${escapeHtml(value)}</span></li>`).join('');
}

function renderApprovals() {
  const list = document.querySelector('#approval-list');
  if (!list) return;
  list.innerHTML = state.approvals.map(approval => {
    const disabled = approval.status === 'Submitted' ? '' : 'disabled';
    return `
      <div class="approval-item">
        <div>
          <strong>${escapeHtml(approval.id)} - ${escapeHtml(approval.type.replace(/_/g, ' '))}</strong>
          <div>${escapeHtml(approval.record)} | Requested by ${escapeHtml(approval.requestedBy)} at ${escapeHtml(approval.createdAt)}</div>
          <small class="text-secondary">${escapeHtml(approval.reason)}</small>
        </div>
        <div class="approval-actions">
          <span class="badge ${statusClass(approval.status)}">${escapeHtml(approval.status)}</span>
          <button type="button" class="btn btn-sm btn-success" data-action="approveRequest" data-approval-id="${escapeHtml(approval.id)}" ${disabled}>Approve</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="rejectRequest" data-approval-id="${escapeHtml(approval.id)}" ${disabled}>Reject</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAudit() {
  const body = document.querySelector('#audit-table');
  if (!body) return;
  const query = (document.querySelector('#audit-filter')?.value || '').toLowerCase();
  const moduleFilter = document.querySelector('#audit-module-filter')?.value || 'all';
  const rows = state.audit.filter(row => {
    const matchesQuery = [row.module, row.action, row.record, row.reason, row.user].join(' ').toLowerCase().includes(query);
    const matchesModule = moduleFilter === 'all' || row.module === moduleFilter;
    return matchesQuery && matchesModule;
  });
  body.innerHTML = rows.map(row => `
    <tr><td>${escapeHtml(row.time)}</td><td>${escapeHtml(row.user)}</td><td>${escapeHtml(row.role)}</td><td>${escapeHtml(row.module)}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.record)}</td><td>${escapeHtml(row.reason)}</td></tr>
  `).join('');
}

function renderSettings() {
  const list = document.querySelector('#settings-list');
  if (!list) return;
  list.innerHTML = Object.entries(state.settings).map(([key, value]) => `
    <div class="settings-row">
      <div><strong>${escapeHtml(key.replace(/([A-Z])/g, ' $1').toLowerCase())}</strong><small class="d-block text-secondary">Controlled setting</small></div>
      <span class="badge ${value ? 'status-approved' : 'status-draft'}">${escapeHtml(value)}</span>
    </div>
  `).join('');
  const latestBackup = state.backups[0];
  setText('#backup-status', latestBackup ? `${latestBackup.time}, ${latestBackup.status}${latestBackup.restoreTested ? ', restore tested' : ''}` : 'No backup');
}

function updateCharts() {
  if (!window.Chart) return;
  const exceptionCanvas = document.querySelector('#exception-chart');
  if (exceptionCanvas && !charts.exception) {
    charts.exception = new window.Chart(exceptionCanvas, {
      type: 'bar',
      data: { labels: ['Lab delay', 'Unpaid', 'Low stock', 'Approvals'], datasets: [{ data: [0, 0, 0, 0], backgroundColor: ['#2563eb', '#b7791f', '#b42318', '#64748b'] }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
  if (charts.exception) {
    charts.exception.data.datasets[0].data = [
      state.labResults.filter(result => ['Encoded', 'Validated'].includes(result.status)).length,
      state.invoices.filter(invoice => ['Unpaid', 'Partially Paid'].includes(invoice.status)).length,
      state.inventory.filter(item => ['low stock', 'expired', 'expiring'].includes(inventoryStatus(item))).length,
      state.approvals.filter(approval => approval.status === 'Submitted').length
    ];
    charts.exception.update();
  }
  const salesCanvas = document.querySelector('#sales-chart');
  if (salesCanvas && !charts.sales) {
    charts.sales = new window.Chart(salesCanvas, {
      type: 'line',
      data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], datasets: [{ label: 'Collections', data: [18500, 22150, 19800, 24850, 0], borderColor: '#0f766e', backgroundColor: 'rgba(15, 118, 110, .12)', tension: .35, fill: true }] },
      options: { plugins: { legend: { display: false } } }
    });
  }
  if (charts.sales) {
    const todayPaid = state.invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0), 0);
    charts.sales.data.datasets[0].data[4] = 26400 + todayPaid;
    charts.sales.update();
  }
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = String(value);
}

const actions = {
  refreshDashboard: () => { renderAll(); notify('Dashboard refreshed', 'Operational metrics are up to date.'); },
  runDemo,
  exportPatients: () => exportWithAudit('patients', 'patient list'),
  viewPatient: (_, button) => { state.currentPatientId = button.dataset.patientId; addAudit('patients', 'patient.view', state.currentPatientId, 'Patient profile opened'); renderAll(); showScreen('profile'); },
  startOrderForPatient: (_, button) => { state.currentPatientId = button.dataset.patientId; renderAll(); showScreen('orders'); },
  requestMerge: (_, button) => {
    if (!requirePermission('patient.merge.request', 'patients', 'merge.request', button.dataset.patientId)) return;
    askReason({ title: `Request merge for ${button.dataset.patientId}?`, message: 'Patient merges require approval and complete audit trail.', confirmLabel: 'Request merge', tone: 'warning', onConfirm: reason => addApproval('patient_merge', 'patients', button.dataset.patientId, reason) });
  },
  archivePatient: (_, button) => {
    if (!requirePermission('patient.archive', 'patients', 'archive', button.dataset.patientId)) return;
    askReason({ title: `Archive patient ${button.dataset.patientId}?`, message: 'Patients are archived instead of permanently deleted.', confirmLabel: 'Archive', onConfirm: reason => {
      const patient = state.patients.find(item => item.id === button.dataset.patientId);
      if (patient) patient.status = 'archived';
      addAudit('patients', 'patient.archive', button.dataset.patientId, reason);
      renderAll();
    } });
  },
  addService: (_, button) => { state.selectedServices.push(button.dataset.service); renderOrder(); },
  removeService: (_, button) => { state.selectedServices.splice(Number(button.dataset.index), 1); renderOrder(); },
  createOrder: createOrderFromSelection,
  requestVoid,
  requestRefund,
  previewCashierClosing,
  printQueueTicket: () => { addAudit('queue', 'queue.ticket.print', state.queue[0]?.ticket || 'queue', 'Queue ticket printed'); notify('Queue ticket printed', 'Print action was audit logged.'); },
  callQueue: (_, button) => { const ticket = state.queue.find(item => item.ticket === button.dataset.ticket); if (ticket) { ticket.status = 'Called'; addAudit('queue', 'queue.call', ticket.ticket, 'Patient called to station'); renderAll(); } },
  collectSample: (_, button) => collectSample(button.dataset.ticket),
  receiveSample: (_, button) => receiveSample(button.dataset.ticket),
  startProcessing: (_, button) => startProcessing(button.dataset.ticket),
  openLabFromQueue: (_, button) => { const ticket = state.queue.find(item => item.ticket === button.dataset.ticket); if (ticket?.labNo) { state.currentLabNo = ticket.labNo; renderAll(); showScreen('lab'); } },
  encodeResult,
  validateResult,
  releaseResult,
  requestAmendment,
  openVerification: () => {
    const patient = currentPatientForLab();
    const result = currentLabResult();
    addAudit('documents', 'result.verify.view', state.currentLabNo, 'Public QR verification details viewed');
    showInfo('QR verification', `<p><strong>Result:</strong> ${escapeHtml(state.currentLabNo)}</p><p><strong>Valid:</strong> ${result.status === 'Released' ? 'Yes' : 'Not released'}</p><p><strong>Patient:</strong> ${escapeHtml(maskName(patient.name))}</p><p><strong>Status:</strong> ${escapeHtml(result.status)}</p>`);
  },
  printResult: () => {
    const result = currentLabResult();
    if (result.status !== 'Released') {
      notify('Print blocked', 'Only released results can be printed or downloaded.', 'danger');
      addAudit('documents', 'document.print.blocked', state.currentLabNo, 'Unreleased result print blocked');
      return;
    }
    addAudit('documents', 'document.print', state.currentLabNo, 'Released result print/download audit');
    window.print();
  },
  exportInventory: () => exportWithAudit('inventory', 'stock on hand'),
  issueStock: (_, button) => issueStock(button.dataset.itemId),
  requestInventoryAdjustment: (_, button) => requestInventoryAdjustment(button.dataset.itemId),
  exportEmployees: () => exportWithAudit('hr', 'employee list'),
  offboardEmployee: (_, button) => offboardEmployee(button.dataset.employeeId),
  sendResultReadyNotice: () => {
    if (!requirePermission('notification.send', 'notifications', 'send')) return;
    if (currentLabResult().status !== 'Released') {
      notify('Notice blocked', 'Result-ready notices are sent only after release.', 'warning');
      addAudit('notifications', 'notification.blocked', state.currentLabNo, 'Result-ready notice blocked before release');
      return;
    }
    queueNotification(currentPatient().name, 'result_ready', 'Your laboratory result is available. Please log in securely.');
    addAudit('notifications', 'notification.send', currentPatient().id, 'Privacy-safe result-ready notice sent');
    renderAll();
  },
  markNotificationRead: (_, button) => { updateNotification(button.dataset.notificationId, 'read', 'notification.read'); },
  retryNotification: (_, button) => { updateNotification(button.dataset.notificationId, 'queued', 'notification.retry'); },
  sendOtp: () => { queueNotification(currentPatient().name, 'portal_otp', 'Use your one-time code to access your secure patient portal.'); addAudit('notifications', 'otp.send', currentPatient().id, 'OTP sent without medical content'); renderAll(); notify('OTP queued', 'Patient portal OTP notice is privacy-safe.'); },
  portalRequestCopy: () => portalRequest('result copy'),
  portalRequestReschedule: () => portalRequest('appointment reschedule'),
  portalRequestCorrection: () => portalRequest('information correction'),
  portalDownloadDocument: (_, button) => { addAudit('documents', 'document.download', button.dataset.documentId, 'Patient portal private document download logged'); notify('Download logged', 'Private document access was audit logged.'); },
  exportReports: () => exportWithAudit('reports', 'management reports'),
  approveRequest: (_, button) => approveRequest(button.dataset.approvalId),
  rejectRequest: (_, button) => rejectRequest(button.dataset.approvalId),
  createSampleApproval: () => addApproval('manual_discount', 'orders', currentOrder()?.no || 'ORD', 'Sample high-discount approval request for UAT'),
  exportAudit: () => exportWithAudit('audit', 'audit log'),
  clearAuditFilters: () => { document.querySelector('#audit-filter').value = ''; document.querySelector('#audit-module-filter').value = 'all'; renderAudit(); },
  runHealthCheck: () => { addAudit('system', 'health.check', 'system', 'Database, storage, backup, email/SMS, jobs, and login indicators checked'); notify('Health check complete', 'System health indicators are green.'); },
  runBackup: () => {
    if (!requirePermission('backup.run', 'backup', 'run')) return;
    state.backups.unshift({ time: 'Just now', status: 'encrypted', restoreTested: false });
    addAudit('backup', 'backup.run', 'system', 'Manual encrypted backup created');
    renderAll();
    notify('Backup created', 'Encrypted backup is recorded.');
  },
  requestRestore: () => {
    if (!requirePermission('backup.restore.request', 'backup', 'restore.request')) return;
    askReason({ title: 'Request restore?', message: 'Restore requests require reason, approval, and audit record.', confirmLabel: 'Request restore', onConfirm: reason => addApproval('backup_restore', 'backup', 'system', reason) });
  },
  requestPatientCorrection: () => {
    if (!requirePermission('patient.update', 'patients', 'correction.request', state.currentPatientId)) return;
    askReason({ title: 'Request patient correction?', message: 'Identity edits require a reason and audit log.', confirmLabel: 'Submit request', tone: 'warning', onConfirm: reason => { addAudit('patients', 'patient.identity.correction.request', state.currentPatientId, reason); notify('Correction logged', 'Patient correction request was audit logged.'); } });
  },
  previewDocument: (_, button) => {
    const documentItem = currentPatient().documents.find(item => item.id === button.dataset.documentId);
    addAudit('documents', 'document.preview', button.dataset.documentId, 'Private document preview');
    showInfo('Document preview', `<p><strong>${escapeHtml(documentItem?.title || 'Document')}</strong></p><p>Private storage preview. Download and print actions are audit logged.</p>`);
  }
};

function exportWithAudit(module, label) {
  const permission = module === 'audit' ? 'audit.view' : 'report.export';
  if (module !== 'patients' && module !== 'inventory' && module !== 'hr' && !requirePermission(permission, module, 'export')) return;
  if (module === 'patients' && !requirePermission('patient.view', 'patients', 'export')) return;
  if (module === 'inventory' && !requirePermission('report.view', 'inventory', 'export')) return;
  if (module === 'hr' && !requirePermission('report.view', 'hr', 'export')) return;
  const completeExport = reason => {
    addAudit(module, 'report.export', label, reason || 'Export permission checked and audit logged');
    notify('Export logged', `${label} export was audit logged.`);
  };
  if (['patients', 'audit'].includes(module)) {
    askReason({
      title: `Export ${label}?`,
      message: 'Sensitive exports require a reason and are recorded in the audit log.',
      confirmLabel: 'Export',
      tone: 'warning',
      onConfirm: completeExport
    });
    return;
  }
  completeExport('Export permission checked and audit logged');
}

function updateNotification(id, status, action) {
  const notification = state.notifications.find(item => item.id === id);
  if (!notification) return;
  notification.status = status;
  addAudit('notifications', action, id, 'Notification state changed');
  renderAll();
}

function portalRequest(type) {
  addAudit('portal', `request.${type.replace(/\s+/g, '_')}`, currentPatient().id, 'Structured patient request submitted');
  notify('Request submitted', `Patient portal request: ${type}.`);
}

function maskName(name) {
  return name.split(' ').map(part => `${part.slice(0, 1)}${'*'.repeat(Math.max(part.length - 1, 1))}`).join(' ');
}

function bindEvents() {
  document.querySelector('#login-form').addEventListener('submit', event => {
    event.preventDefault();
    const role = document.querySelector('#login-role').value;
    const password = document.querySelector('#login-password').value;
    const mfaRequired = ['super_admin', 'cashier', 'doctor', 'hr_manager', 'branch_manager'].includes(role);
    if (password.length < 12) {
      notify('Weak password blocked', 'Demo password must be at least 12 characters.', 'danger');
      return;
    }
    if (mfaRequired && !document.querySelector('#mfa-check').checked) {
      state.currentUser = { ...DEMO_USERS[role] };
      addAudit('auth', 'login.failed', document.querySelector('#login-email').value, 'MFA required for role');
      notify('MFA required', 'This role must complete MFA.', 'danger');
      return;
    }
    setCurrentUser(role);
    document.querySelector('#login-screen').classList.add('d-none');
    document.querySelector('#app-shell').classList.remove('d-none');
    addAudit('auth', 'login', 'session', mfaRequired ? 'MFA verified' : 'Password verified');
    renderAll();
  });
  document.querySelector('#logout-btn').addEventListener('click', () => {
    addAudit('auth', 'logout', 'session', 'User signed out');
    document.querySelector('#app-shell').classList.add('d-none');
    document.querySelector('#login-screen').classList.remove('d-none');
  });
  document.querySelector('#main-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-screen]');
    if (button) showScreen(button.dataset.screen);
  });
  document.body.addEventListener('click', event => {
    const jump = event.target.closest('[data-jump]');
    if (jump) {
      showScreen(jump.dataset.jump);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const handler = actions[actionButton.dataset.action];
    if (!handler) {
      notify('Missing handler', `${actionButton.dataset.action} is not wired.`, 'danger');
      addAudit('system', 'ui.dead_button', actionButton.dataset.action, 'Missing UI handler detected');
      return;
    }
    try {
      handler(event, actionButton);
    } catch (error) {
      console.error(error);
      notify('Unexpected error', error.message, 'danger');
      addAudit('system', 'ui.error', actionButton.dataset.action, error.message);
    }
  });
  document.querySelector('#registration-form').addEventListener('submit', registerPatient);
  document.querySelector('#payment-form').addEventListener('submit', postPayment);
  document.querySelector('#cashier-form').addEventListener('submit', closeCashier);
  document.querySelector('#lab-form').addEventListener('submit', approveResult);
  document.querySelector('#receive-stock-form').addEventListener('submit', receiveStock);
  document.querySelector('#reason-confirm').addEventListener('click', confirmReason);
  ['#patient-search', '#patient-status-filter'].forEach(selector => document.querySelector(selector).addEventListener('input', renderPatients));
  ['#audit-filter', '#audit-module-filter'].forEach(selector => document.querySelector(selector).addEventListener('input', renderAudit));
  document.querySelector('#global-search').addEventListener('input', event => {
    document.querySelector('#patient-search').value = event.target.value;
    renderPatients();
    if (event.target.value.trim()) showScreen('patients');
  });
  window.addEventListener('error', event => {
    addAudit('system', 'runtime.error', 'window', event.message);
  });
}

function initializeApp() {
  bindEvents();
  renderAll();
}

const HMSRules = {
  createInitialState,
  nextNumber,
  hasPermission,
  canApprove,
  canTransitionLab,
  canPostPayment,
  statusClass,
  money,
  inventoryStatus
};

if (typeof module !== 'undefined') {
  module.exports = HMSRules;
}

if (typeof window !== 'undefined') {
  window.HMSRules = HMSRules;
}

if (typeof document !== 'undefined') {
  initializeApp();
}
