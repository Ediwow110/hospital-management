'use strict';

/**
 * PgLabResultRepository
 *
 * PostgreSQL implementation of the lab result repository contract.
 * Released lab results are protected from direct UPDATE via a DB-level
 * trigger in 007_governance.sql (or enforced by the service layer).
 * All SQL is isolated here; services must not import pg directly.
 *
 * PR #4 — PostgreSQL Persistence Foundation.
 */

class PgLabResultRepository {
  /**
   * @param {{ pool: import('pg').Pool }} deps
   */
  constructor({ pool }) {
    this._pool = pool;
  }

  /**
   * @param {string} id
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object|null>}
   */
  async findById(id, context) {
    const client = context._tx || this._pool;
    const { rows } = await client.query(
      `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId",
              order_id AS "orderId", patient_id AS "patientId",
              test_name AS "testName", status,
              result_data AS "resultData",
              encoded_by AS "encodedBy", encoded_at AS "encodedAt",
              is_locked AS "isLocked",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM lab_results
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [id, context.tenantId]
    );
    return rows[0] || null;
  }

  /**
   * Persist a lab result. Raises an error if the result is Released (locked).
   *
   * @param {object} labResult
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object>}
   */
  async save(labResult, context) {
    const client = context._tx || this._pool;
    // Guard: do not overwrite released results directly
    if (labResult.isLocked) {
      const existing = await this.findById(labResult.id, context);
      if (existing && existing.isLocked && labResult.status !== existing.status) {
        throw Object.assign(new Error('Lab result is locked after release'), { code: 'WORKFLOW_VIOLATION' });
      }
    }
    const { rows } = await client.query(
      `INSERT INTO lab_results
         (id, tenant_id, branch_id, order_id, patient_id, test_name,
          status, result_data, encoded_by, encoded_at, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = CASE
           WHEN lab_results.is_locked THEN lab_results.status
           ELSE EXCLUDED.status
         END,
         result_data = CASE
           WHEN lab_results.is_locked THEN lab_results.result_data
           ELSE EXCLUDED.result_data
         END,
         encoded_by = EXCLUDED.encoded_by,
         encoded_at = EXCLUDED.encoded_at,
         is_locked  = EXCLUDED.is_locked,
         updated_at = NOW()
       RETURNING id, tenant_id AS "tenantId", branch_id AS "branchId",
                 order_id AS "orderId", patient_id AS "patientId",
                 test_name AS "testName", status,
                 result_data AS "resultData",
                 encoded_by AS "encodedBy", encoded_at AS "encodedAt",
                 is_locked AS "isLocked",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        labResult.id,
        labResult.tenantId,
        labResult.branchId,
        labResult.orderId,
        labResult.patientId,
        labResult.testName,
        labResult.status,
        labResult.resultData ? JSON.stringify(labResult.resultData) : null,
        labResult.encodedBy || null,
        labResult.encodedAt || null,
        labResult.isLocked || false,
      ]
    );
    return rows[0];
  }
}

module.exports = { PgLabResultRepository };
