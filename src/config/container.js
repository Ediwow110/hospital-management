'use strict';

/**
 * Dependency Injection container.
 *
 * STORAGE_ADAPTER env variable controls which adapter is loaded.
 *   memory   — demo/test only (default)
 *   postgres — durable staging/production (PR #4)
 *
 * Services NEVER import adapter modules directly.
 * All repository access goes through this container.
 */

const { InMemoryUserRepository }          = require('../repositories/memory/InMemoryUserRepository');
const { InMemoryPatientRepository }       = require('../repositories/memory/InMemoryPatientRepository');
const { InMemoryOrderRepository }         = require('../repositories/memory/InMemoryOrderRepository');
const { InMemoryInvoiceRepository }       = require('../repositories/memory/InMemoryInvoiceRepository');
const { InMemoryPaymentRepository }       = require('../repositories/memory/InMemoryPaymentRepository');
const { InMemoryCashierSessionRepository } = require('../repositories/memory/InMemoryCashierSessionRepository');
const { InMemoryLabResultRepository }     = require('../repositories/memory/InMemoryLabResultRepository');
const { InMemoryInventoryRepository }     = require('../repositories/memory/InMemoryInventoryRepository');
const { InMemoryAuditLogRepository }      = require('../repositories/memory/InMemoryAuditLogRepository');
const { InMemoryApprovalRepository }      = require('../repositories/memory/InMemoryApprovalRepository');
const { InMemoryNotificationRepository }  = require('../repositories/memory/InMemoryNotificationRepository');
const { InMemorySettingsRepository }      = require('../repositories/memory/InMemorySettingsRepository');

const { AuditService }     = require('../services/AuditService');
const { HealthService }    = require('../services/HealthService');
const { AuthService }      = require('../services/AuthService');
const { PatientService }   = require('../services/PatientService');
const { OrderService }     = require('../services/OrderService');
const { BillingService }   = require('../services/BillingService');
const { QueueService }     = require('../services/QueueService');
const { LabService }       = require('../services/LabService');
const { InventoryService } = require('../services/InventoryService');

function buildContainer() {
  const adapter = process.env.STORAGE_ADAPTER || 'memory';

  if (adapter === 'postgres') {
    // PR #4: load PostgreSQL repositories here.
    throw new Error(
      'STORAGE_ADAPTER=postgres is not yet implemented. ' +
      'PostgreSQL persistence is deferred to PR #4. ' +
      'Use STORAGE_ADAPTER=memory for local/demo/test.'
    );
  }

  if (adapter !== 'memory') {
    throw new Error(`Unknown STORAGE_ADAPTER: '${adapter}'. Valid values: memory, postgres`);
  }

  // --- Repositories ---
  const repos = {
    userRepo:            new InMemoryUserRepository(),
    patientRepo:         new InMemoryPatientRepository(),
    orderRepo:           new InMemoryOrderRepository(),
    invoiceRepo:         new InMemoryInvoiceRepository(),
    paymentRepo:         new InMemoryPaymentRepository(),
    cashierSessionRepo:  new InMemoryCashierSessionRepository(),
    labResultRepo:       new InMemoryLabResultRepository(),
    inventoryRepo:       new InMemoryInventoryRepository(),
    auditLogRepo:        new InMemoryAuditLogRepository(),
    approvalRepo:        new InMemoryApprovalRepository(),
    notificationRepo:    new InMemoryNotificationRepository(),
    settingsRepo:        new InMemorySettingsRepository(),
  };

  // --- Services (order matters: AuditService first, others depend on it) ---
  const auditService  = new AuditService({ auditLogRepo: repos.auditLogRepo });
  const healthService = new HealthService();
  const authService   = new AuthService({ userRepo: repos.userRepo, auditService });
  const patientService = new PatientService({ patientRepo: repos.patientRepo, auditService });
  const orderService  = new OrderService({ orderRepo: repos.orderRepo, invoiceRepo: repos.invoiceRepo, auditService });
  const billingService = new BillingService({
    invoiceRepo: repos.invoiceRepo,
    paymentRepo: repos.paymentRepo,
    cashierSessionRepo: repos.cashierSessionRepo,
    auditService,
  });
  const queueService    = new QueueService({ auditService });
  const labService      = new LabService({ labResultRepo: repos.labResultRepo, auditService });
  const inventoryService = new InventoryService({ inventoryRepo: repos.inventoryRepo, auditService });

  // Seed demo users (in-memory only)
  _seedDemoUsers(repos.userRepo);

  return {
    repos,
    services: {
      auditService,
      healthService,
      authService,
      patientService,
      orderService,
      billingService,
      queueService,
      labService,
      inventoryService,
    },
  };
}

/**
 * Seed demo users for local/demo/test use.
 * WARNING: plaintext passwords. PR #4 must replace with hashed passwords from DB.
 */
function _seedDemoUsers(userRepo) {
  const demoCtx = {
    tenantId: 'demo-tenant',
    branchId: 'branch-main',
    userId:   'system',
    roles:    ['system'],
    permissions: new Set(),
    can: () => true,
    hasRole: () => false,
    requestId: 'seed',
    ipAddress: '',
    deviceInfo: '',
    idempotencyKey: null,
  };

  const users = [
    { id: 'u-admin',    email: 'admin@demo.local',    passwordHash: 'admin123',    name: 'Admin User',       roles: ['superadmin'],    branchId: 'branch-main', status: 'active' },
    { id: 'u-manager',  email: 'manager@demo.local',  passwordHash: 'manager123',  name: 'Branch Manager',   roles: ['branch_manager'], branchId: 'branch-main', status: 'active' },
    { id: 'u-recept',   email: 'recept@demo.local',   passwordHash: 'recept123',   name: 'Receptionist',     roles: ['receptionist'],  branchId: 'branch-main', status: 'active' },
    { id: 'u-cashier',  email: 'cashier@demo.local',  passwordHash: 'cashier123',  name: 'Cashier',          roles: ['cashier'],       branchId: 'branch-main', status: 'active' },
    { id: 'u-medtech',  email: 'medtech@demo.local',  passwordHash: 'medtech123',  name: 'Med Tech',         roles: ['medtech'],       branchId: 'branch-main', status: 'active' },
    { id: 'u-pathol',   email: 'pathol@demo.local',   passwordHash: 'pathol123',   name: 'Pathologist',      roles: ['pathologist'],   branchId: 'branch-main', status: 'active' },
  ];

  for (const u of users) {
    userRepo.save({ ...u }, demoCtx);
  }
}

module.exports = { buildContainer };
