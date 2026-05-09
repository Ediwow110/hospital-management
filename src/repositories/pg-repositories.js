'use strict';

/**
 * pg-repositories.js
 *
 * PostgreSQL repository aggregator.
 * Wire Pg implementations for users, audit, and lab.
 * For entities not yet fully migrated to Pg, provide parameterized SQL stubs
 * that match the repository contract shape required by assertRepositoryInterfaces.
 *
 * Services must NEVER import pg directly. All DB access is here.
 * PR #4 — PostgreSQL Persistence Foundation.
 *
 * Coverage honesty:
 *   - Dedicated Pg repository classes: PgUserRepository, PgAuditLogRepository, PgLabResultRepository
 *   - Remaining namespaces (patients, orders, invoices, payments, cashierSessions, inventory,
 *     approvals, notifications, idempotency, roles) are contract-compatible Pg stubs.
 *   - Stubs require follow-up hardening (tenant_id scoping on all lookups, role_permissions
 *     migration, full CRUD coverage) before production use.
 *   - This file does NOT make the system production-ready.
 */

const { AppError, ERROR_CODES } = require('../core/AppError');
const { PgAuditLogRepository } = require('./pg/PgAuditLogRepository');
const { PgLabResultRepository } = require('./pg/PgLabResultRepository');
const { assertRepositoryInterfaces } = require('./interfaces');

function createPgRepositories(pool) {
  const auditRepo = new PgAuditLogRepository({ pool });
  const labRepo = new PgLabResultRepository({ pool });

  const repositories = {
    users: {
      /**
       * Find an active user by email, scoped to context.tenantId.
       *
       * SECURITY: User lookup MUST be tenant-scoped in a multi-tenant healthcare system.
       * Missing tenantId throws immediately — no silent fallback to cross-tenant lookup.
       *
       * @param {string} email
       * @param {{ tenantId: string }} context
       * @returns {Promise<object|null>}
       */
      findActiveByEmail: async (email, context) => {
        if (!context || !context.tenantId) {
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            'context.tenantId is required for user lookup'
          );
        }
        const { rows } = await pool.query(
          `SELECT id,
                  tenant_id        AS "tenantId",
                  branch_id        AS "branchId",
                  email,
                  password_hash    AS "passwordHash",
                  name,
                  roles,
                  status
             FROM users
            WHERE email     = $1
              AND tenant_id = $2
              AND status    = 'active'
            LIMIT 1`,
          [email, context.tenantId]
        );
        return rows[0] || null;
      },

      findActiveById: async (id) => {
        const { rows } = await pool.query(
          `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId",
                  email, password_hash AS "passwordHash", name,
                  roles, status
           FROM users
           WHERE id = $1 AND status = 'active'
           LIMIT 1`,
          [id]
        );
        return rows[0] || null;
      }
    },

    roles: {
      /**
       * TODO (follow-up hardening): confirm role_permissions table exists in migrations.
       * Migration 002_access_users_roles.sql must include this table before production use.
       */
      listRolePermissions: async (role) => {
        const { rows } = await pool.query(
          'SELECT permission FROM role_permissions WHERE role = $1',
          [role]
        );
        return rows.map(r => r.permission);
      }
    },

    patients: {
      /**
       * TODO (follow-up hardening): findByIdOrNumber lacks tenant_id scoping — cross-tenant
       * patient data leak risk. Add tenant_id = $2 filter before production use.
       */
      create: async (patient) => {
        const { rows } = await pool.query(
          `INSERT INTO patients
             (id, tenant_id, branch_id, patient_no, full_name, date_of_birth, sex,
              contact_number, address, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            patient.id, patient.tenantId, patient.branchId, patient.patientNo,
            patient.fullName, patient.dateOfBirth, patient.sex,
            patient.contactNumber, patient.address, patient.createdAt
          ]
        );
        return rows[0];
      },
      findByIdOrNumber: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM patients WHERE id = $1 OR patient_no = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      },
      searchByTenant: async (tenantId) => {
        const { rows } = await pool.query(
          'SELECT * FROM patients WHERE tenant_id = $1 ORDER BY created_at DESC',
          [tenantId]
        );
        return rows;
      }
    },

    orders: {
      /**
       * TODO (follow-up hardening): findByIdOrNumber lacks tenant_id scoping.
       */
      create: async (order) => {
        const { rows } = await pool.query(
          `INSERT INTO orders
             (id, tenant_id, branch_id, order_no, patient_id, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [
            order.id, order.tenantId, order.branchId, order.orderNo,
            order.patientId, order.status, order.createdAt
          ]
        );
        return rows[0];
      },
      findByIdOrNumber: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM orders WHERE id = $1 OR order_no = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      }
    },

    invoices: {
      /**
       * TODO (follow-up hardening): findByIdOrNumber lacks tenant_id scoping.
       */
      create: async (invoice) => {
        const { rows } = await pool.query(
          `INSERT INTO invoices
             (id, tenant_id, branch_id, invoice_no, order_id, patient_id,
              total_amount, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            invoice.id, invoice.tenantId, invoice.branchId, invoice.invoiceNo,
            invoice.orderId, invoice.patientId, invoice.totalAmount,
            invoice.status, invoice.createdAt
          ]
        );
        return rows[0];
      },
      findByIdOrNumber: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM invoices WHERE id = $1 OR invoice_no = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      }
    },

    payments: {
      create: async (payment) => {
        const { rows } = await pool.query(
          `INSERT INTO payments
             (id, tenant_id, invoice_id, amount, method, reference_no, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [
            payment.id, payment.tenantId, payment.invoiceId, payment.amount,
            payment.method, payment.referenceNo, payment.createdAt
          ]
        );
        return rows[0];
      },
      findByInvoiceId: async (invoiceId) => {
        const { rows } = await pool.query(
          'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at ASC',
          [invoiceId]
        );
        return rows;
      }
    },

    cashierSessions: {
      /**
       * TODO (follow-up hardening): findByIdOrNumber lacks tenant_id scoping.
       * findActiveByCashier is correctly scoped by tenant_id + branch_id + cashier_id.
       */
      create: async (session) => {
        const { rows } = await pool.query(
          `INSERT INTO cashier_sessions
             (id, tenant_id, branch_id, cashier_id, session_no, status, opened_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [
            session.id, session.tenantId, session.branchId, session.cashierId,
            session.sessionNo, session.status, session.openedAt
          ]
        );
        return rows[0];
      },
      findByIdOrNumber: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM cashier_sessions WHERE id = $1 OR session_no = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      },
      findActiveByCashier: async ({ tenantId, branchId, cashierId }) => {
        const { rows } = await pool.query(
          `SELECT * FROM cashier_sessions
           WHERE tenant_id = $1 AND branch_id = $2 AND cashier_id = $3
             AND status = 'Open'
           LIMIT 1`,
          [tenantId, branchId, cashierId]
        );
        return rows[0] || null;
      }
    },

    lab: {
      createOrder: async (labOrder) => {
        const { rows } = await pool.query(
          `INSERT INTO lab_orders
             (id, tenant_id, branch_id, lab_no, order_id, patient_id,
              test_code, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            labOrder.id, labOrder.tenantId, labOrder.branchId, labOrder.labNo,
            labOrder.orderId, labOrder.patientId, labOrder.testCode,
            labOrder.status, labOrder.createdAt
          ]
        );
        return rows[0];
      },
      createResult: (labResult, context) => labRepo.create(labResult, context || { _tx: pool }),
      findOrderByIdOrNumber: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM lab_orders WHERE id = $1 OR lab_no = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      },
      findResultByIdOrNumber: (id) => labRepo.findByIdOrNumber(id, { _tx: pool })
    },

    inventory: {
      findItemById: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM inventory_items WHERE id = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      },
      saveItem: async (item) => {
        const { rows } = await pool.query(
          `INSERT INTO inventory_items (id, tenant_id, name, quantity, unit, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE
             SET quantity = EXCLUDED.quantity, updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [item.id, item.tenantId, item.name, item.quantity, item.unit, item.updatedAt]
        );
        return rows[0];
      }
    },

    audit: {
      create: (event, context) => auditRepo.create(event, context || { _tx: pool }),
      searchByTenant: (tenantId, context) => auditRepo.searchByTenant(tenantId, context || { _tx: pool })
    },

    approvals: {
      create: async (approval) => {
        const { rows } = await pool.query(
          `INSERT INTO approvals
             (id, tenant_id, entity_type, entity_id, requested_by, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [
            approval.id, approval.tenantId, approval.entityType, approval.entityId,
            approval.requestedBy, approval.status, approval.createdAt
          ]
        );
        return rows[0];
      },
      findById: async (id) => {
        const { rows } = await pool.query(
          'SELECT * FROM approvals WHERE id = $1 LIMIT 1',
          [id]
        );
        return rows[0] || null;
      }
    },

    notifications: {
      create: async (notification) => {
        const { rows } = await pool.query(
          `INSERT INTO notifications
             (id, tenant_id, recipient_patient_id, type, payload, sent_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            notification.id, notification.tenantId,
            notification.recipientPatientId, notification.type,
            JSON.stringify(notification.payload), notification.sentAt
          ]
        );
        return rows[0];
      },
      findByRecipient: async (patientId) => {
        const { rows } = await pool.query(
          'SELECT * FROM notifications WHERE recipient_patient_id = $1 ORDER BY sent_at DESC',
          [patientId]
        );
        return rows;
      }
    },

    idempotency: {
      get: async (key) => {
        const { rows } = await pool.query(
          'SELECT value FROM idempotency_keys WHERE key = $1 LIMIT 1',
          [key]
        );
        return rows[0] ? rows[0].value : undefined;
      },
      set: async (key, value) => {
        await pool.query(
          `INSERT INTO idempotency_keys (key, value, created_at)
           VALUES ($1,$2,now())
           ON CONFLICT (key) DO NOTHING`,
          [key, JSON.stringify(value)]
        );
      }
    }
  };

  assertRepositoryInterfaces(repositories);
  return repositories;
}

module.exports = { createPgRepositories };
