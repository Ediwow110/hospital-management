const {
  assertTransition,
  buildApprovalRequest,
  buildNumber,
  canAccessRecord,
  canReviewApproval,
  createAuditEvent,
  hasPermission,
  isNotificationPrivacySafe,
  redactMedicalContent,
  requireFeature,
  validatePayment
} = require('../core/production-rules');
const { AppError } = require('../core/app-error');
const { normalizeMoney, requireFields } = require('../core/validation');

const YEAR = 2026;

class HmsService {
  constructor(store) {
    this.store = store;
  }

  authenticate({ email, password, mfaVerified = false, ipAddress = null, deviceInfo = null }) {
    requireFields({ email, password }, ['email', 'password']);
    const user = this.store.users.find(item => item.email === email && item.status === 'active');
    if (!user || user.password !== password) {
      this.audit({ user: user || this.systemUser(), module: 'auth', action: 'login.failed', recordType: 'user', recordId: email, reason: 'Invalid credentials', ipAddress, deviceInfo });
      throw new AppError('invalid_credentials', 'Invalid credentials', 401);
    }
    if (user.mfaRequired && !mfaVerified) {
      this.audit({ user, module: 'auth', action: 'login.failed', recordType: 'user', recordId: user.id, reason: 'MFA required', ipAddress, deviceInfo });
      throw new AppError('mfa_required', 'MFA verification is required for this role', 401);
    }
    this.audit({ user, module: 'auth', action: 'login', recordType: 'session', recordId: user.id, reason: user.mfaRequired ? 'MFA verified' : 'Password verified', ipAddress, deviceInfo });
    return { accessToken: `demo-token-${user.id}`, user: this.publicUser(user) };
  }

  logout({ user }) {
    this.audit({ user, module: 'auth', action: 'logout', recordType: 'session', recordId: user.id, reason: 'User ended session' });
    return null;
  }

  verifyMfa({ challengeId, otp }) {
    requireFields({ challengeId, otp }, ['challengeId', 'otp']);
    if (String(otp).length < 6) throw new AppError('validation_failed', 'OTP must contain at least 6 characters', 422);
    return { accessToken: `demo-token-${challengeId}`, mfaVerified: true };
  }

  listUsers({ user }) {
    this.assertPermission(user, 'admin.user.view', null);
    return { data: this.store.users.filter(item => item.tenantId === user.tenantId).map(item => this.publicUser(item)) };
  }

  createUser({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'admin.user.create', null);
      requireFields(body, ['email', 'fullName', 'roleCodes', 'branchIds']);
      if (!Array.isArray(body.roleCodes) || !body.roleCodes.length) throw new AppError('validation_failed', 'At least one role is required', 422);
      if (!Array.isArray(body.branchIds) || !body.branchIds.length) throw new AppError('validation_failed', 'At least one branch is required', 422);
      if (this.store.users.some(item => item.email === body.email)) throw new AppError('duplicate_user', 'A named user with this email already exists', 409);
      const created = {
        id: this.nextId('user'),
        email: body.email,
        fullName: body.fullName,
        role: body.roleCodes[0],
        roleCodes: body.roleCodes,
        tenantId: user.tenantId,
        branchIds: body.branchIds,
        mfaRequired: ['super_admin', 'manager', 'doctor', 'hr_manager', 'cashier'].includes(body.roleCodes[0]),
        status: 'active'
      };
      this.store.users.push(created);
      this.audit({ user, module: 'users', action: 'user.create', recordType: 'user', recordId: created.id, newValues: this.publicUser(created), reason: 'Named user created; shared staff accounts are prohibited' });
      return { data: this.publicUser(created) };
    });
  }

  deactivateUser({ user, targetUserId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'user.deactivate', null);
      requireFields(body, ['reason']);
      const target = this.store.users.find(item => item.id === targetUserId && item.tenantId === user.tenantId);
      if (!target) throw new AppError('user_not_found', 'User is unavailable for this scope', 404);
      return this.createApproval({ user, type: 'user_deactivate', module: 'users', recordType: 'user', recordId: target.id, reason: body.reason });
    });
  }

  requestRolePermissionChange({ user, roleId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'admin.role.change', null);
      requireFields(body, ['permissionCodes', 'reason']);
      const role = this.store.roles.find(item => item.id === roleId || item.code === roleId);
      if (!role || !canAccessRecord(user, role, 'admin.role.change')) throw new AppError('role_not_found', 'Role is unavailable for this scope', 404);
      return this.createApproval({ user, type: 'role_change', module: 'roles', recordType: 'role', recordId: role.id, reason: body.reason, newValues: { permissionCodes: body.permissionCodes } });
    });
  }

  searchPatients({ user }) {
    this.assertPermission(user, 'patient.view', null);
    return { data: this.store.patients.filter(patient => canAccessRecord(user, patient, 'patient.view')) };
  }

  registerPatient({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'patient.create', null);
      requireFields(body, ['firstName', 'lastName', 'birthdate', 'sex', 'mobile']);
      const duplicateRisk = this.store.patients.some(patient =>
        patient.tenantId === user.tenantId &&
        patient.firstName.toLowerCase() === body.firstName.toLowerCase() &&
        patient.lastName.toLowerCase() === body.lastName.toLowerCase() &&
        patient.mobile === body.mobile
      );
      const patient = {
        id: this.nextId('patient'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        patientNo: this.nextNumber('patient', 'P'),
        firstName: body.firstName,
        lastName: body.lastName,
        fullName: `${body.firstName} ${body.lastName}`,
        birthdate: body.birthdate,
        sex: body.sex,
        mobile: body.mobile,
        email: body.email || null,
        status: 'active',
        duplicateRisk,
        timeline: []
      };
      patient.timeline.push({ type: 'patient.registered', title: 'Patient registered', at: this.now(), userId: user.id });
      this.store.patients.push(patient);
      this.audit({ user, module: 'patients', action: 'patient.create', recordType: 'patient', recordId: patient.patientNo, newValues: patient, reason: duplicateRisk ? 'Patient registered with duplicate risk' : 'Patient registration' });
      return { data: patient };
    });
  }

  archivePatient({ user, patientId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'patient.archive', null);
      requireFields(body, ['reason']);
      const patient = this.getScopedPatient(user, patientId);
      return this.createApproval({ user, type: 'patient_archive', module: 'patients', recordType: 'patient', recordId: patient.patientNo, reason: body.reason });
    });
  }

  requestPatientMerge({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'patient.merge.request', null);
      requireFields(body, ['sourcePatientId', 'targetPatientId', 'reason']);
      const source = this.getScopedPatient(user, body.sourcePatientId);
      const target = this.getScopedPatient(user, body.targetPatientId);
      if (source.id === target.id) throw new AppError('validation_failed', 'Source and target patients must be different', 422);
      return this.createApproval({
        user,
        type: 'patient_merge',
        module: 'patients',
        recordType: 'patient_merge',
        recordId: `${source.patientNo}->${target.patientNo}`,
        reason: body.reason,
        newValues: { sourcePatientId: source.id, targetPatientId: target.id }
      });
    });
  }

  createAppointment({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'appointment.create', null);
      requireFields(body, ['patientId', 'appointmentAt', 'serviceIds']);
      const patient = this.getScopedPatient(user, body.patientId);
      if (!Array.isArray(body.serviceIds) || !body.serviceIds.length) throw new AppError('validation_failed', 'Appointment requires at least one service', 422);
      const services = body.serviceIds.map(serviceId => {
        const service = this.store.services.find(item => item.id === serviceId);
        if (!service || !canAccessRecord(user, service, 'order.create')) throw new AppError('service_not_found', 'Service is unavailable for this scope', 404);
        return { id: service.id, code: service.code, name: service.name };
      });
      const appointment = {
        id: this.nextId('appointment'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        patientId: patient.id,
        appointmentAt: body.appointmentAt,
        services,
        status: 'Scheduled',
        createdBy: user.id
      };
      this.store.appointments.push(appointment);
      this.queueNotification({ user, recipientPatientId: patient.id, templateCode: 'appointment_created', body: 'Your appointment information is available in your secure patient portal.' });
      this.audit({ user, module: 'appointments', action: 'appointment.create', recordType: 'appointment', recordId: appointment.id, newValues: appointment, reason: 'Appointment created with privacy-safe reminder queued' });
      return { data: appointment };
    });
  }

  createOrder({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'order.create', null);
      requireFields(body, ['patientId', 'items']);
      const patient = this.getScopedPatient(user, body.patientId);
      if (!Array.isArray(body.items) || body.items.length === 0) throw new AppError('validation_failed', 'Order requires at least one item', 422);
      const itemRows = body.items.map(item => {
        const service = this.store.services.find(row => row.id === item.serviceId);
        if (!service || !canAccessRecord(user, service, 'order.create')) throw new AppError('service_not_found', 'Service is unavailable for this scope', 404);
        const quantity = Number(item.quantity || 1);
        return {
          serviceId: service.id,
          serviceCode: service.code,
          serviceName: service.name,
          serviceVersion: service.version,
          department: service.department,
          quantity,
          unitPrice: service.price,
          lineTotal: Number((service.price * quantity).toFixed(2))
        };
      });
      const total = itemRows.reduce((sum, item) => sum + item.lineTotal, 0);
      const order = {
        id: this.nextId('order'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        orderNo: this.nextNumber('order', 'ORD'),
        patientId: patient.id,
        status: 'Pending Payment',
        paymentStatus: 'Unpaid',
        items: itemRows,
        total,
        createdBy: user.id
      };
      const invoice = {
        id: this.nextId('invoice'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        invoiceNo: this.nextNumber('invoice', 'INV'),
        orderId: order.id,
        patientId: patient.id,
        status: 'Unpaid',
        total,
        balance: total,
        isLocked: false
      };
      this.store.orders.push(order);
      this.store.invoices.push(invoice);
      itemRows.filter(item => item.department === 'Laboratory').forEach(item => this.createLabWork(user, patient, order, item));
      this.audit({ user, module: 'orders', action: 'order.create', recordType: 'order', recordId: order.orderNo, newValues: { order, invoice }, reason: 'Order and invoice created with service price versions locked' });
      return { data: { order, invoice } };
    });
  }

  postPayment({ user, invoiceId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'billing.payment.create', null);
      requireFields(body, ['paymentMode', 'amount']);
      const invoice = this.getScopedInvoice(user, invoiceId);
      const amount = normalizeMoney(body.amount);
      const validation = validatePayment({
        invoice,
        amount,
        overpaymentEnabled: false,
        idempotencyKey,
        priorIdempotencyKeys: new Set()
      });
      if (!validation.ok) throw new AppError('payment_blocked', validation.reason, 409);
      const payment = {
        id: this.nextId('payment'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        receiptNo: this.nextNumber('receipt', 'OR'),
        invoiceId: invoice.id,
        paymentMode: body.paymentMode,
        referenceNo: body.referenceNo || null,
        amount,
        status: 'Posted',
        cashierId: user.id
      };
      invoice.balance = Number((invoice.balance - amount).toFixed(2));
      invoice.status = invoice.balance === 0 ? 'Paid' : 'Partially Paid';
      invoice.isLocked = invoice.balance === 0;
      const order = this.store.orders.find(item => item.id === invoice.orderId);
      if (order) {
        order.paymentStatus = invoice.status;
        if (invoice.status === 'Paid') {
          order.status = 'Paid';
          this.createQueueTickets(user, order);
        }
      }
      this.store.payments.push(payment);
      this.audit({ user, module: 'billing', action: 'billing.payment.create', recordType: 'payment', recordId: payment.receiptNo, oldValues: { invoiceBalance: invoice.balance + amount }, newValues: { invoice, payment }, reason: 'Payment posted and receipt number locked' });
      return { data: { invoice, payment } };
    });
  }

  requestOrderVoid({ user, orderId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'order.void.request', null);
      requireFields(body, ['reason']);
      const order = this.getScopedOrder(user, orderId, 'order.void.request');
      if (['Voided', 'Completed'].includes(order.status)) throw new AppError('order_not_voidable', `Order ${order.status} cannot be voided through this request`, 409);
      return this.createApproval({ user, type: 'order_void', module: 'orders', recordType: 'order', recordId: order.orderNo, reason: body.reason });
    });
  }

  requestRefund({ user, paymentId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'billing.refund.request', null);
      requireFields(body, ['reason']);
      const payment = this.getScopedPayment(user, paymentId, 'billing.refund.request');
      if (payment.status !== 'Posted') throw new AppError('payment_not_refundable', 'Only posted payments can be refunded', 409);
      return this.createApproval({ user, type: 'refund', module: 'billing', recordType: 'payment', recordId: payment.receiptNo, reason: body.reason });
    });
  }

  closeCashierSession({ user, cashierSessionId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'cashier.close', null);
      requireFields(body, ['actualCash', 'remarks']);
      const session = this.store.cashierSessions.find(item => item.id === cashierSessionId && canAccessRecord(user, item, 'cashier.close'));
      if (!session) throw new AppError('cashier_session_not_found', 'Cashier session is unavailable for this scope', 404);
      if (session.status === 'Closed') throw new AppError('cashier_session_closed', 'Cashier session is already closed', 409);
      const cashPayments = this.store.payments.filter(payment => payment.cashierId === user.id && payment.paymentMode === 'Cash' && payment.status === 'Posted');
      const expectedCash = Number((session.openingCash + cashPayments.reduce((sum, payment) => sum + payment.amount, 0)).toFixed(2));
      const actualCash = normalizeMoney(body.actualCash, 'actualCash');
      session.status = 'Closed';
      session.expectedCash = expectedCash;
      session.actualCash = actualCash;
      session.variance = Number((actualCash - expectedCash).toFixed(2));
      session.closedBy = user.id;
      session.closedAt = this.now();
      session.remarks = body.remarks;
      this.audit({ user, module: 'billing', action: 'cashier.close', recordType: 'cashier_session', recordId: session.id, newValues: session, reason: body.remarks });
      return { data: session };
    });
  }

  callQueueTicket({ user, queueTicketId, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'queue.manage', null);
      const ticket = this.getScopedQueueTicket(user, queueTicketId);
      if (['Completed', 'Cancelled'].includes(ticket.status)) throw new AppError('queue_ticket_closed', 'Closed queue tickets cannot be called', 409);
      ticket.status = 'Called';
      ticket.calledBy = user.id;
      ticket.calledAt = this.now();
      this.audit({ user, module: 'queue', action: 'queue.call', recordType: 'queue_ticket', recordId: ticket.ticketNo, newValues: ticket, reason: 'Queue ticket called to station' });
      return { data: ticket };
    });
  }

  collectSpecimen({ user, labOrderId, idempotencyKey }) {
    return this.transitionLab({ user, labOrderId, targetStatus: 'Collected', permission: 'lab.result.encode', action: 'lab.specimen.collect', idempotencyKey });
  }

  receiveSpecimen({ user, labOrderId, idempotencyKey }) {
    return this.transitionLab({ user, labOrderId, targetStatus: 'Received', permission: 'lab.result.encode', action: 'lab.specimen.receive', idempotencyKey });
  }

  processSpecimen({ user, labOrderId, idempotencyKey }) {
    return this.transitionLab({ user, labOrderId, targetStatus: 'Processing', permission: 'lab.result.encode', action: 'lab.specimen.process', idempotencyKey });
  }

  encodeLabResult({ user, labResultId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'lab.result.encode', null);
      requireFields(body, ['items']);
      const result = this.getScopedLabResult(user, labResultId);
      if (result.isLocked) throw new AppError('result_locked', 'Released results require amendment workflow', 409);
      assertTransition('labResult', result.status, 'Encoded');
      result.items = body.items;
      result.comments = body.comments || null;
      result.status = 'Encoded';
      result.encodedBy = user.id;
      this.labOrderForResult(result).status = 'Encoded';
      this.audit({ user, module: 'lab', action: 'lab.result.encode', recordType: 'lab_result', recordId: result.labNo, newValues: result, reason: 'Result values encoded' });
      return { data: result };
    });
  }

  validateLabResult({ user, labResultId, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'lab.result.validate', null);
      const result = this.getScopedLabResult(user, labResultId);
      assertTransition('labResult', result.status, 'Validated');
      result.status = 'Validated';
      result.validatedBy = user.id;
      this.labOrderForResult(result).status = 'Validated';
      this.audit({ user, module: 'lab', action: 'lab.result.validate', recordType: 'lab_result', recordId: result.labNo, newValues: result, reason: 'Result validated' });
      return { data: result };
    });
  }

  approveLabResult({ user, labResultId, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'lab.result.approve', null);
      const result = this.getScopedLabResult(user, labResultId);
      assertTransition('labResult', result.status, 'Approved');
      if (result.encodedBy === user.id) throw new AppError('dual_approval_required', 'Encoder cannot approve own result', 409);
      result.status = 'Approved';
      result.approvedBy = user.id;
      this.labOrderForResult(result).status = 'Approved';
      this.audit({ user, module: 'lab', action: 'lab.result.approve', recordType: 'lab_result', recordId: result.labNo, newValues: result, reason: 'Result approved' });
      return { data: result };
    });
  }

  releaseLabResult({ user, labResultId, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'lab.result.release', null);
      const result = this.getScopedLabResult(user, labResultId);
      assertTransition('labResult', result.status, 'Released');
      result.status = 'Released';
      result.releasedBy = user.id;
      result.isLocked = true;
      this.labOrderForResult(result).status = 'Released';
      this.queueNotification({ user, recipientPatientId: result.patientId, templateCode: 'result_ready', body: 'Your laboratory result is available. Please log in securely.' });
      this.audit({ user, module: 'lab', action: 'lab.result.release', recordType: 'lab_result', recordId: result.labNo, newValues: result, reason: 'Result released, locked, and notification queued' });
      return { data: result };
    });
  }

  requestResultAmendment({ user, labResultId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'lab.result.amend.request', null);
      requireFields(body, ['reason']);
      const result = this.getScopedLabResult(user, labResultId);
      if (result.status !== 'Released' || !result.isLocked) throw new AppError('result_not_released', 'Only released locked results can enter amendment workflow', 409);
      return this.createApproval({ user, type: 'result_amendment', module: 'lab', recordType: 'lab_result', recordId: result.labNo, reason: body.reason });
    });
  }

  requestApproval({ user, type, module, recordType, recordId, reason, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'approval.request', null);
      return this.createApproval({ user, type, module, recordType, recordId, reason });
    });
  }

  receiveInventory({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      requireFeature(this.store.tenant, 'enable_inventory');
      this.assertPermission(user, 'inventory.receive', null);
      requireFields(body, ['inventoryItemId', 'supplierId', 'batchNo', 'expiryDate', 'quantity']);
      const item = this.store.inventory.find(record => record.id === body.inventoryItemId);
      if (!item || !canAccessRecord(user, item, 'inventory.receive')) throw new AppError('inventory_not_found', 'Inventory item is unavailable for this scope', 404);
      item.qty += normalizeMoney(body.quantity, 'quantity');
      item.batchNo = body.batchNo;
      item.expiry = body.expiryDate;
      item.status = item.qty <= item.reorderLevel ? 'low stock' : 'stocked';
      this.audit({ user, module: 'inventory', action: 'inventory.receive', recordType: 'inventory_item', recordId: item.id, newValues: item, reason: `Received batch ${body.batchNo}` });
      return { data: item };
    });
  }

  requestInventoryAdjustment({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      requireFeature(this.store.tenant, 'enable_inventory');
      this.assertPermission(user, 'inventory.adjust.request', null);
      requireFields(body, ['inventoryItemId', 'quantity', 'reason']);
      const item = this.store.inventory.find(record => record.id === body.inventoryItemId);
      if (!item || !canAccessRecord(user, item, 'inventory.adjust.request')) throw new AppError('inventory_not_found', 'Inventory item is unavailable for this scope', 404);
      return this.createApproval({ user, type: 'inventory_adjustment', module: 'inventory', recordType: 'inventory_item', recordId: item.id, reason: body.reason, newValues: { quantity: body.quantity } });
    });
  }

  offboardEmployee({ user, employeeId, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      requireFeature(this.store.tenant, 'enable_hr');
      this.assertPermission(user, 'hr.offboard.request', null);
      requireFields(body, ['reason']);
      const employee = this.getScopedEmployee(user, employeeId);
      return this.createApproval({
        user,
        type: 'user_deactivate',
        module: 'hr',
        recordType: 'employee',
        recordId: employee.employeeNo || employee.id,
        reason: body.reason,
        newValues: { employeeStatus: 'offboarding_requested', linkedUserId: employee.userId }
      });
    });
  }

  exportReport({ user, code, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'report.export', null);
      requireFields(body, ['format', 'filters']);
      if (!body.reason) throw new AppError('reason_required', 'Report exports require a reason', 422);
      const job = {
        id: this.nextNumber('job', 'JOB'),
        type: 'report_export',
        code,
        format: body.format,
        filters: body.filters,
        status: 'queued',
        requestedBy: user.id
      };
      this.store.jobs.push(job);
      this.audit({ user, module: 'reports', action: 'report.export', recordType: 'report', recordId: code, reason: body.reason });
      return { job };
    });
  }

  sendNotification({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'notification.send', null);
      requireFields(body, ['recipientType', 'recipientId', 'templateCode']);
      const recipientPatientId = body.recipientType === 'patient' ? this.getScopedPatient(user, body.recipientId).id : null;
      const notification = this.queueNotification({
        user,
        recipientPatientId,
        templateCode: body.templateCode,
        body: body.body || 'A new secure notification is available in your portal.'
      });
      this.audit({ user, module: 'notifications', action: 'notification.send', recordType: 'notification', recordId: notification.id, newValues: notification, reason: 'Privacy-safe notification queued' });
      return { job: { id: notification.id, type: 'notification_send', status: notification.status } };
    });
  }

  runBackup({ user, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'backup.run', null);
      const job = {
        id: this.nextId('backup'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        type: 'encrypted_backup',
        status: 'queued',
        requestedBy: user.id,
        createdAt: this.now()
      };
      this.store.backups.push(job);
      this.store.jobs.push(job);
      this.audit({ user, module: 'backup', action: 'backup.run', recordType: 'backup_job', recordId: job.id, newValues: job, reason: 'Encrypted backup queued before deployment or maintenance work' });
      return { job };
    });
  }

  requestRestore({ user, body, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, 'backup.restore.request', null);
      requireFields(body, ['reason']);
      return this.createApproval({ user, type: 'backup_restore', module: 'backup', recordType: 'backup_job', recordId: body.backupId || 'latest', reason: body.reason });
    });
  }

  health({ user }) {
    this.assertPermission(user, 'system.health.view', null);
    return {
      status: 'ok',
      components: {
        application: 'ok',
        database: 'configured',
        storage: 'private',
        backup: 'encrypted',
        email: 'configured',
        sms: 'configured',
        failedJobs: this.store.jobs.filter(job => job.status === 'failed').length,
        auditEvents: this.store.auditLogs.length
      }
    };
  }

  auditSearch({ user }) {
    this.assertPermission(user, 'audit.view', null);
    return { data: this.store.auditLogs.filter(log => log.tenantId === user.tenantId) };
  }

  queueNotification({ user, recipientPatientId, templateCode, body }) {
    const safeBody = redactMedicalContent(body);
    if (!isNotificationPrivacySafe(safeBody)) throw new AppError('unsafe_notification', 'Notification body contains medical content', 422);
    const notification = {
      id: this.nextNumber('notification', 'NTF'),
      tenantId: user.tenantId,
      branchId: user.branchIds[0],
      recipientPatientId,
      templateCode,
      body: safeBody,
      status: 'queued'
    };
    this.store.notifications.push(notification);
    return notification;
  }

  createLabWork(user, patient, order, orderItem) {
    const labNo = this.nextNumber('lab', 'LAB');
    const labOrder = {
      id: this.nextId('lab'),
      tenantId: user.tenantId,
      branchId: user.branchIds[0],
      patientId: patient.id,
      orderId: order.id,
      labNo,
      serviceCode: orderItem.serviceCode,
      status: 'Pending Collection',
      barcode: labNo
    };
    const labResult = {
      id: this.nextId('lab'),
      tenantId: user.tenantId,
      branchId: user.branchIds[0],
      patientId: patient.id,
      labOrderId: labOrder.id,
      labNo,
      version: 1,
      status: 'Pending Collection',
      isLocked: false,
      items: []
    };
    this.store.labOrders.push(labOrder);
    this.store.labResults.push(labResult);
  }

  createQueueTickets(user, order) {
    this.store.labOrders.filter(labOrder => labOrder.orderId === order.id).forEach(labOrder => {
      if (this.store.queueTickets.some(ticket => ticket.labOrderId === labOrder.id)) return;
      this.store.queueTickets.push({
        id: this.nextId('queue'),
        tenantId: user.tenantId,
        branchId: user.branchIds[0],
        ticketNo: this.nextNumber('queue', 'Q'),
        patientId: order.patientId,
        orderId: order.id,
        labOrderId: labOrder.id,
        station: 'Laboratory',
        status: 'Pending'
      });
    });
  }

  transitionLab({ user, labOrderId, targetStatus, permission, action, idempotencyKey }) {
    return this.withIdempotency(idempotencyKey, () => {
      this.assertPermission(user, permission, null);
      const labOrder = this.getScopedLabOrder(user, labOrderId);
      const result = this.store.labResults.find(item => item.labOrderId === labOrder.id);
      assertTransition('labResult', result.status, targetStatus);
      labOrder.status = targetStatus;
      result.status = targetStatus;
      this.audit({ user, module: 'lab', action, recordType: 'lab_order', recordId: labOrder.labNo, newValues: labOrder, reason: `Moved to ${targetStatus}` });
      return { data: labOrder };
    });
  }

  createApproval({ user, type, module, recordType, recordId, reason, newValues = null }) {
    const approval = buildApprovalRequest({
      id: this.nextNumber('approval', 'APR'),
      type,
      module,
      recordType,
      recordId,
      reason,
      requestedByUserId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchIds[0]
    });
    if (newValues) approval.newValues = newValues;
    this.store.approvals.push(approval);
    this.audit({ user, module, action: `${type}.request`, recordType, recordId, newValues, reason });
    return { approvalRequest: approval };
  }

  withIdempotency(key, operation) {
    if (!key) throw new AppError('idempotency_key_required', 'Idempotency key is required', 400);
    if (this.store.idempotency.has(key)) return this.store.idempotency.get(key);
    const result = operation();
    this.store.idempotency.set(key, result);
    return result;
  }

  assertPermission(user, permission, record) {
    if (record ? !canAccessRecord(user, record, permission) : !hasPermission(user, permission)) {
      throw new AppError('permission_denied', `Missing permission ${permission}`, 403);
    }
  }

  audit({ user, module, action, recordType, recordId, oldValues = null, newValues = null, reason, ipAddress = null, deviceInfo = null }) {
    const event = createAuditEvent({
      id: this.nextNumber('audit', 'AUD'),
      user,
      module,
      action,
      recordType,
      recordId,
      oldValues,
      newValues,
      reason,
      ipAddress,
      deviceInfo,
      now: this.now()
    });
    this.store.auditLogs.push(event);
    return event;
  }

  getScopedPatient(user, patientId) {
    const patient = this.store.patients.find(item => item.id === patientId || item.patientNo === patientId);
    if (!patient || !canAccessRecord(user, patient, 'patient.view')) throw new AppError('patient_not_found', 'Patient is unavailable for this scope', 404);
    return patient;
  }

  getScopedInvoice(user, invoiceId) {
    const invoice = this.store.invoices.find(item => item.id === invoiceId || item.invoiceNo === invoiceId);
    if (!invoice || !canAccessRecord(user, invoice, 'billing.payment.create')) throw new AppError('invoice_not_found', 'Invoice is unavailable for this scope', 404);
    return invoice;
  }

  getScopedOrder(user, orderId, permission = 'order.create') {
    const order = this.store.orders.find(item => item.id === orderId || item.orderNo === orderId);
    if (!order || !canAccessRecord(user, order, permission)) throw new AppError('order_not_found', 'Order is unavailable for this scope', 404);
    return order;
  }

  getScopedPayment(user, paymentId, permission = 'billing.payment.create') {
    const payment = this.store.payments.find(item => item.id === paymentId || item.receiptNo === paymentId);
    if (!payment || !canAccessRecord(user, payment, permission)) throw new AppError('payment_not_found', 'Payment is unavailable for this scope', 404);
    return payment;
  }

  getScopedQueueTicket(user, queueTicketId) {
    const ticket = this.store.queueTickets.find(item => item.id === queueTicketId || item.ticketNo === queueTicketId);
    if (!ticket || !canAccessRecord(user, ticket, 'queue.manage')) throw new AppError('queue_ticket_not_found', 'Queue ticket is unavailable for this scope', 404);
    return ticket;
  }

  getScopedEmployee(user, employeeId) {
    const employee = this.store.employees.find(item => item.id === employeeId || item.employeeNo === employeeId);
    if (!employee || !canAccessRecord(user, employee, 'hr.offboard.request')) throw new AppError('employee_not_found', 'Employee is unavailable for this scope', 404);
    return employee;
  }

  getScopedLabOrder(user, labOrderId) {
    const labOrder = this.store.labOrders.find(item => item.id === labOrderId || item.labNo === labOrderId);
    if (!labOrder || !canAccessRecord(user, labOrder, 'patient.view')) throw new AppError('lab_order_not_found', 'Lab order is unavailable for this scope', 404);
    return labOrder;
  }

  getScopedLabResult(user, labResultId) {
    const result = this.store.labResults.find(item => item.id === labResultId || item.labNo === labResultId);
    if (!result || !canAccessRecord(user, result, 'patient.view')) throw new AppError('lab_result_not_found', 'Lab result is unavailable for this scope', 404);
    return result;
  }

  labOrderForResult(result) {
    return this.store.labOrders.find(item => item.id === result.labOrderId);
  }

  nextNumber(type, prefix) {
    const nextValue = this.store.sequences[type]++;
    return buildNumber({ prefix, year: YEAR, nextValue });
  }

  nextId(type) {
    if (!this.store.ids[type]) this.store.ids[type] = 1;
    const nextValue = this.store.ids[type]++;
    return `${type}-${nextValue}`;
  }

  now() {
    return new Date().toISOString();
  }

  publicUser(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      branchIds: user.branchIds
    };
  }

  systemUser() {
    return {
      id: 'system',
      role: 'system',
      tenantId: 'system',
      branchIds: ['system']
    };
  }
}

module.exports = {
  HmsService
};
