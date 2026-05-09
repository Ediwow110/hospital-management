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
      { id: 'u-admin', email: 'admin@hospital.local', password: 'HmsDemo2026!', role: 'super_admin', tenantId: 'tenant-demo', branchIds: ['branch-main'], branchScope: 'all', mfaRequired: true, status: 'active' },
      { id: 'u-reception', email: 'reception@hospital.local', password: 'HmsDemo2026!', role: 'receptionist', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: false, status: 'active' },
      { id: 'u-cashier', email: 'cashier@hospital.local', password: 'HmsDemo2026!', role: 'cashier', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' },
      { id: 'u-medtech', email: 'medtech@hospital.local', password: 'HmsDemo2026!', role: 'med_tech', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: false, status: 'active' },
      { id: 'u-pathologist', email: 'pathologist@hospital.local', password: 'HmsDemo2026!', role: 'pathologist', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' },
      { id: 'u-manager', email: 'manager@hospital.local', password: 'HmsDemo2026!', role: 'manager', tenantId: 'tenant-demo', branchIds: ['branch-main'], mfaRequired: true, status: 'active' }
    ],
    patients: [],
    services: [
      { id: 'svc-cbc', code: 'CBC', name: 'Complete Blood Count', department: 'Laboratory', price: 450, version: 1, tenantId: 'tenant-demo', branchId: 'branch-main' },
      { id: 'svc-fbs', code: 'FBS', name: 'Fasting Blood Sugar', department: 'Laboratory', price: 180, version: 1, tenantId: 'tenant-demo', branchId: 'branch-main' },
      { id: 'svc-xray', code: 'XRAY-CHEST', name: 'Chest X-Ray', department: 'Radiology', price: 650, version: 1, tenantId: 'tenant-demo', branchId: 'branch-main' }
    ],
    orders: [],
    invoices: [],
    payments: [],
    queueTickets: [],
    labOrders: [],
    labResults: [],
    approvals: [],
    inventory: [
      { id: 'inv-cbc-reagent', code: 'CBC-REAGENT', name: 'CBC Reagent', qty: 12, reorderLevel: 10, expiry: '2026-12-31', tenantId: 'tenant-demo', branchId: 'branch-main', status: 'stocked' }
    ],
    notifications: [],
    jobs: [],
    auditLogs: [],
    idempotency: new Map(),
    ids: {
      patient: 1,
      order: 1,
      invoice: 1,
      payment: 1,
      queue: 1,
      lab: 1
    },
    sequences: {
      patient: 1,
      order: 1,
      invoice: 1,
      receipt: 1,
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
