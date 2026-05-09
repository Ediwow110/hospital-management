const { hashPassword } = require('../core/passwords');

const DEMO_PASSWORD = 'HmsDemo2026!';
const DEMO_PASSWORD_HASHES = Object.freeze({
  admin: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-admin-2026' }),
  reception: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-reception-2026' }),
  cashier: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-cashier-2026' }),
  cashierB: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-cashier-b-2026' }),
  medTech: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-medtech-2026' }),
  pathologist: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-pathologist-2026' }),
  manager: hashPassword(DEMO_PASSWORD, { salt: 'hms-demo-manager-2026' })
});

function createInMemoryStore() {
  return {
    tenant: {
      id: 'tenant-demo',
      code: 'demo-clinic',
      featureFlags: [
        'enable_lis',
        'enable_inventory',
        'enable_patient_portal',
        'enable_hr',
        'enable_sms',
        'enable_pharmacy',
        'enable_radiology'
      ]
    },
    users: [
      { id: 'u-admin', email: 'admin@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.admin, role: 'super_admin', tenantId: 'tenant-demo', branchIds: ['branch-main'], branchScope: 'all', mfaRequired: true, status: 'active' },
      { id: 'u-reception', email: 'reception@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.reception, role: 'receptionist', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: false, status: 'active' },
      { id: 'u-cashier', email: 'cashier@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.cashier, role: 'cashier', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' },
      { id: 'u-cashier-b', email: 'cashier.b@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.cashierB, role: 'cashier', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' },
      { id: 'u-medtech', email: 'medtech@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.medTech, role: 'med_tech', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: false, status: 'active' },
      { id: 'u-pathologist', email: 'pathologist@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.pathologist, role: 'pathologist', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' },
      { id: 'u-manager', email: 'manager@hospital.local', passwordHash: DEMO_PASSWORD_HASHES.manager, role: 'manager', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' }
    ],
    roles: [
      { id: 'role-receptionist', code: 'receptionist', tenantId: 'tenant-demo', branchId: 'branch-main', permissions: ['patient.view', 'patient.create', 'appointment.create', 'order.create', 'queue.manage'] },
      { id: 'role-cashier', code: 'cashier', tenantId: 'tenant-demo', branchId: 'branch-main', permissions: ['billing.payment.create', 'billing.refund.request', 'order.void.request', 'cashier.close'] }
    ],
    patients: [],
    appointments: [],
    services: [
      { id: 'svc-cbc', code: 'CBC', name: 'Complete Blood Count', department: 'Laboratory', price: 450, version: 1, tenantId: 'tenant-demo', branchId: 'branch-main' },
      { id: 'svc-fbs', code: 'FBS', name: 'Fasting Blood Sugar', department: 'Laboratory', price: 180, version: 1, tenantId: 'tenant-demo', branchId: 'branch-main' },
      { id: 'svc-xray', code: 'XRAY-CHEST', name: 'Chest X-Ray', department: 'Radiology', price: 650, version: 1, tenantId: 'tenant-demo', branchId: 'branch-main' }
    ],
    orders: [],
    invoices: [],
    payments: [],
    cashierSessions: [],
    queueTickets: [],
    labOrders: [],
    labResults: [],
    approvals: [],
    inventory: [
      { id: 'inv-cbc-reagent', code: 'CBC-REAGENT', name: 'CBC Reagent', qty: 12, reorderLevel: 10, expiry: '2026-12-31', tenantId: 'tenant-demo', branchId: 'branch-main', status: 'stocked' }
    ],
    employees: [
      { id: 'employee-1', employeeNo: 'EMP-2026-000001', fullName: 'Maria Santos', userId: 'u-medtech', tenantId: 'tenant-demo', branchId: 'branch-main', status: 'active' }
    ],
    notifications: [],
    backups: [],
    jobs: [],
    auditLogs: [],
    idempotency: new Map(),
    ids: {
      patient: 1,
      user: 1,
      appointment: 1,
      order: 1,
      invoice: 1,
      payment: 1,
      cashier: 1,
      cashierSession: 1,
      queue: 1,
      lab: 1,
      backup: 1
    },
    sequences: {
      patient: 1,
      order: 1,
      invoice: 1,
      receipt: 1,
      cashierSession: 1,
      queue: 1,
      lab: 1,
      approval: 1,
      job: 1,
      audit: 1,
      notification: 1
    }
  };
}

module.exports = {
  createInMemoryStore
};
