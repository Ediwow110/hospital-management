'use strict';

const { AppError, ERROR_CODES } = require('./AppError');

/**
 * LAB_TRANSITIONS — allowed (from -> to) status transitions for LIS.
 * Key = current status. Value = array of allowed next statuses.
 */
const LAB_TRANSITIONS = Object.freeze({
  'Pending Collection': ['Collected', 'Cancelled'],
  'Collected':          ['Encoded', 'Cancelled'],
  'Encoded':            ['Validated', 'Cancelled'],
  'Validated':          ['Approved', 'Cancelled'],
  'Approved':           ['Released', 'Cancelled'],
  'Released':           ['Amended'],
  'Amended':            ['Encoded'],
  'Cancelled':          [],
});

/**
 * APPOINTMENT_TRANSITIONS — allowed queue/appointment transitions.
 */
const APPOINTMENT_TRANSITIONS = Object.freeze({
  'Scheduled':   ['Checked In', 'Cancelled', 'No Show'],
  'Checked In':  ['In Progress', 'Cancelled'],
  'In Progress': ['Completed', 'Cancelled'],
  'Completed':   [],
  'Cancelled':   [],
  'No Show':     [],
});

/**
 * INVOICE_TRANSITIONS
 */
const INVOICE_TRANSITIONS = Object.freeze({
  'Unpaid':           ['Partially Paid', 'Paid', 'Voided'],
  'Partially Paid':   ['Paid', 'Voided'],
  'Paid':             ['Refunded'],
  'Voided':           [],
  'Refunded':         [],
});

/**
 * assertTransition — throws AppError if transition is not allowed.
 * @param {string} from
 * @param {string} to
 * @param {object} transitionMap
 * @param {string} entityType
 */
function assertTransition(from, to, transitionMap, entityType = 'entity') {
  const allowed = transitionMap[from];
  if (!allowed) {
    throw new AppError(
      ERROR_CODES.INVALID_WORKFLOW_TRANSITION,
      `${entityType}: unknown status '${from}'`,
      { from, to }
    );
  }
  if (!allowed.includes(to)) {
    throw new AppError(
      ERROR_CODES.INVALID_WORKFLOW_TRANSITION,
      `${entityType}: transition '${from}' -> '${to}' is not allowed`,
      { from, to, allowed }
    );
  }
}

function assertLabTransition(from, to) {
  assertTransition(from, to, LAB_TRANSITIONS, 'LabResult');
}

function assertAppointmentTransition(from, to) {
  assertTransition(from, to, APPOINTMENT_TRANSITIONS, 'Appointment');
}

function assertInvoiceTransition(from, to) {
  assertTransition(from, to, INVOICE_TRANSITIONS, 'Invoice');
}

module.exports = {
  LAB_TRANSITIONS,
  APPOINTMENT_TRANSITIONS,
  INVOICE_TRANSITIONS,
  assertTransition,
  assertLabTransition,
  assertAppointmentTransition,
  assertInvoiceTransition,
};
