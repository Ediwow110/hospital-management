'use strict';

/**
 * Dependency Injection container.
 *
 * STORAGE_ADAPTER env variable controls which adapter is loaded.
 *   memory   — demo/test only (default)
 *   postgres — uses PostgreSQL-backed security repositories
 */

const { Pool } = require('pg');

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
const { InMemoryInvalidatedTokenRepository } = require('../repositories/memory/InMemoryInvalidatedTokenRepository');
const { InMemorySecurityAuditEventRepository } = require('../repositories/memory/InMemorySecurityAuditEventRepository');

const { PgInvalidatedTokenRepository } = require('../repositories/pg/PgInvalidatedTokenRepository');
const { PgSecurityAuditEventRepository } = require('../repositories/pg/PgSecurityAuditEventRepository');

const { AuditService } = require('../services/AuditService');
const { SecurityAuditService } = require('../services/SecurityAuditService');
const { HealthService } = require('../services/HealthService');
const { AuthService } = require('../services/AuthService');
const { PatientService } = require('../services/PatientService');
const { OrderService } = require('../services/OrderService');
const { BillingService } = require('../services/BillingService');
const { QueueService } = require('../services/QueueService');
const { LabService } = require('../services/LabService');
const { InventoryService } = require('../services/InventoryService');

const DEMO_USER_PASSWORD_HASHES = Object.freeze({
  admin: '$2a$12$DDkxyC6KvO5NMeGfwx3Qf.MRmLtY.QQQXRMT8TJ8Oe.daIpnwZORC',
  manager: '$2a$12$u5xZZLsvwGOhh4CNQ2BLduW99fvwNT18TmECfPwZKSEz1eRAs6JUe',
  recept: '$2a$12$MYx.PP5erVWDgtcFwoI/Ou3ZKBqhZIfE92AcgHNk6Ag2ZPtWIOHlu',
  cashier: '$2a$12$t5CBB0Z4PTVS4vuMkmsRl.o5r2Z.J5Y9UZQOZ28FlHpALIAUHaqeK',
  medtech: '$2a$12$sqh3XR/xOgVNFBnndM9ItuJv5Tzfp/A47E17c18BIt5wmtF2F.3sy',
  pathol: '$2a$12$Q.GNcfQJLyRoM4xNyYyjKu86yuSZuEoxVE4h3U1gicynu5dD4AwYC',
});

function buildContainer() {
  const adapter = process.env.STORAGE_ADAPTER || 'memory';
  if (!['memory', 'postgres'].includes(adapter)) {
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
  };

  const securityRepos = _buildSecurityRepos(adapter);

  const auditService = new AuditService({ auditLogRepo: repos.auditLogRepo });
  const securityAuditService = new SecurityAuditService({ adapter, repo: securityRepos.securityAuditRepo });
  const healthService = new HealthService();
  const authService = new AuthService({
    userRepo: repos.userRepo,
    auditService,
    securityAuditService,
    invalidatedTokenRepo: securityRepos.invalidatedTokenRepo,
  });
  const patientService = new PatientService({ patientRepo: repos.patientRepo, auditService });
  const orderService = new OrderService({ orderRepo: repos.orderRepo, invoiceRepo: repos.invoiceRepo, auditService });
  const billingService = new BillingService({
    invoiceRepo: repos.invoiceRepo,
    paymentRepo: repos.paymentRepo,
    cashierSessionRepo: repos.cashierSessionRepo,
    auditService,
  });
  const queueService = new QueueService({ auditService });
  const labService = new LabService({ labResultRepo: repos.labResultRepo, auditService });
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

function _buildSecurityRepos(adapter) {
  if (adapter === 'postgres') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required when STORAGE_ADAPTER=postgres');
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return {
      invalidatedTokenRepo: new PgInvalidatedTokenRepository({ pool }),
      securityAuditRepo: new PgSecurityAuditEventRepository({ pool }),
    };
  }

  return {
    invalidatedTokenRepo: new InMemoryInvalidatedTokenRepository(),
    securityAuditRepo: new InMemorySecurityAuditEventRepository(),
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
    { id: 'u-admin', email: 'admin@demo.local', passwordHash: DEMO_USER_PASSWORD_HASHES.admin, name: 'Admin User', roles: ['superadmin'], branchId: 'branch-main', status: 'active' },
    { id: 'u-manager', email: 'manager@demo.local', passwordHash: DEMO_USER_PASSWORD_HASHES.manager, name: 'Branch Manager', roles: ['branch_manager'], branchId: 'branch-main', status: 'active' },
    { id: 'u-recept', email: 'recept@demo.local', passwordHash: DEMO_USER_PASSWORD_HASHES.recept, name: 'Receptionist', roles: ['receptionist'], branchId: 'branch-main', status: 'active' },
    { id: 'u-cashier', email: 'cashier@demo.local', passwordHash: DEMO_USER_PASSWORD_HASHES.cashier, name: 'Cashier', roles: ['cashier'], branchId: 'branch-main', status: 'active' },
    { id: 'u-medtech', email: 'medtech@demo.local', passwordHash: DEMO_USER_PASSWORD_HASHES.medtech, name: 'Med Tech', roles: ['medtech'], branchId: 'branch-main', status: 'active' },
    { id: 'u-pathol', email: 'pathol@demo.local', passwordHash: DEMO_USER_PASSWORD_HASHES.pathol, name: 'Pathologist', roles: ['pathologist'], branchId: 'branch-main', status: 'active' },
  ];

  for (const user of users) {
    userRepo.save({ ...user }, demoCtx);
  }
}

module.exports = { buildContainer };
