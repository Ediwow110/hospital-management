'use strict';

const { InMemoryUserRepository } = require('../repositories/memory/InMemoryUserRepository');
const { InMemoryPatientRepository } = require('../repositories/memory/InMemoryPatientRepository');
const { InMemoryOrderRepository } = require('../repositories/memory/InMemoryOrderRepository');
const { InMemoryInvoiceRepository } = require('../repositories/memory/InMemoryInvoiceRepository');
const { InMemoryPaymentRepository } = require('../repositories/memory/InMemoryPaymentRepository');
const { InMemoryCashierSessionRepository } = require('../repositories/memory/InMemoryCashierSessionRepository');
const { InMemoryLabResultRepository } = require('../repositories/memory/InMemoryLabResultRepository');
const { InMemoryInventoryRepository } = require('../repositories/memory/InMemoryInventoryRepository');
const { InMemoryAuditLogRepository } = require('../repositories/memory/InMemoryAuditLogRepository');
const { InMemoryApprovalRepository } = require('../repositories/memory/InMemoryApprovalRepository');
const { InMemoryNotificationRepository } = require('../repositories/memory/InMemoryNotificationRepository');
const { InMemorySettingsRepository } = require('../repositories/memory/InMemorySettingsRepository');
const { InMemoryInvalidatedTokenRepository } = require('../repositories/InvalidatedTokenRepository');

const { AuditService } = require('../services/AuditService');
const { HealthService } = require('../services/HealthService');
const { AuthService } = require('../services/AuthService');
const { PatientService } = require('../services/PatientService');
const { OrderService } = require('../services/OrderService');
const { BillingService } = require('../services/BillingService');
const { QueueService } = require('../services/QueueService');
const { LabService } = require('../services/LabService');
const { InventoryService } = require('../services/InventoryService');
const { SecurityAuditService } = require('../services/SecurityAuditService');

function buildContainer() {
  const adapter = process.env.STORAGE_ADAPTER || 'memory';

  if (adapter === 'postgres') {
    throw new Error(
      'STORAGE_ADAPTER=postgres is not yet implemented. ' +
      'PostgreSQL persistence is deferred to PR #4. ' +
      'Use STORAGE_ADAPTER=memory for local/demo/test.'
    );
  }

  if (adapter !== 'memory') {
    throw new Error(`Unknown STORAGE_ADAPTER: '${adapter}'. Valid values: memory, postgres`);
  }

  const repos = {
    userRepo: new InMemoryUserRepository(),
    patientRepo: new InMemoryPatientRepository(),
    orderRepo: new InMemoryOrderRepository(),
    invoiceRepo: new InMemoryInvoiceRepository(),
    paymentRepo: new InMemoryPaymentRepository(),
    cashierSessionRepo: new InMemoryCashierSessionRepository(),
    labResultRepo: new InMemoryLabResultRepository(),
    inventoryRepo: new InMemoryInventoryRepository(),
    auditLogRepo: new InMemoryAuditLogRepository(),
    approvalRepo: new InMemoryApprovalRepository(),
    notificationRepo: new InMemoryNotificationRepository(),
    settingsRepo: new InMemorySettingsRepository(),
    invalidatedTokenRepository: new InMemoryInvalidatedTokenRepository(),
  };

  const auditService = new AuditService({ auditLogRepo: repos.auditLogRepo });
  const securityAuditService = new SecurityAuditService(null, 'memory');
  const healthService = new HealthService();
  const authService = new AuthService({
    userRepo: repos.userRepo,
    auditService,
    securityAuditService,
  });
  const patientService = new PatientService({ patientRepo: repos.patientRepo, auditService, securityAuditService });
  const orderService = new OrderService({ orderRepo: repos.orderRepo, invoiceRepo: repos.invoiceRepo, auditService, securityAuditService });
  const billingService = new BillingService({
    invoiceRepo: repos.invoiceRepo,
    paymentRepo: repos.paymentRepo,
    cashierSessionRepo: repos.cashierSessionRepo,
    auditService,
    securityAuditService,
  });
  const queueService = new QueueService({ auditService });
  const labService = new LabService({ labResultRepo: repos.labResultRepo, auditService, securityAuditService });
  const inventoryService = new InventoryService({ inventoryRepo: repos.inventoryRepo, auditService });

  _seedDemoUsers(repos.userRepo);

  return {
    repos,
    services: {
      auditService,
      securityAuditService,
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

function _seedDemoUsers(userRepo) {
  const demoCtx = {
    tenantId: 'demo-tenant',
    branchId: 'branch-main',
    userId: 'system',
    roles: ['system'],
    permissions: new Set(),
    can: () => true,
    hasRole: () => false,
    requestId: 'seed',
    ipAddress: '',
    deviceInfo: '',
    idempotencyKey: null,
  };

  const users = [
    {
      id: 'u-admin',
      email: 'admin@demo.local',
      passwordHash: '$2y$12$5OuiRlOmZ1nldrU0kgUJOuJrStu6GfnqhnfRWXLxoAAGQ50ocDfwC',
      name: 'Admin User',
      roles: ['superadmin'],
      branchId: 'branch-main',
      status: 'active',
    },
    {
      id: 'u-manager',
      email: 'manager@demo.local',
      passwordHash: '$2y$12$c13ZqW.QNnIbMFfuC61yEOzWTnv8V06S8VcNxwlHgIxK0mxf5pn1m',
      name: 'Branch Manager',
      roles: ['branch_manager'],
      branchId: 'branch-main',
      status: 'active',
    },
    {
      id: 'u-recept',
      email: 'recept@demo.local',
      passwordHash: '$2y$12$FFjKl4Nz0kGYDGwtKMoXJOdl4iaMviuqCSqxkP11oBA7ozLso2fNa',
      name: 'Receptionist',
      roles: ['receptionist'],
      branchId: 'branch-main',
      status: 'active',
    },
    {
      id: 'u-cashier',
      email: 'cashier@demo.local',
      passwordHash: '$2y$12$fbCwhksKU1WpgFs6RWjyOeoNIRten69OuTtHB4sjGEiF4Idiaffdm',
      name: 'Cashier',
      roles: ['cashier'],
      branchId: 'branch-main',
      status: 'active',
    },
    {
      id: 'u-medtech',
      email: 'medtech@demo.local',
      passwordHash: '$2y$12$MWlnKSxi9Z18kK97UMoBb.zra8rPreAdFP/RDt.V9pgtkBSNWU/M2',
      name: 'Med Tech',
      roles: ['medtech'],
      branchId: 'branch-main',
      status: 'active',
    },
    {
      id: 'u-pathol',
      email: 'pathol@demo.local',
      passwordHash: '$2y$12$GeYdq9sg2CgQhwLhrXhLY.m8XvoxupKuMpWmsNIjgvS0kzf2Ew7Wi',
      name: 'Pathologist',
      roles: ['pathologist'],
      branchId: 'branch-main',
      status: 'active',
    },
  ];

  for (const u of users) {
    userRepo.save({ ...u }, demoCtx);
  }
}

module.exports = { buildContainer };
