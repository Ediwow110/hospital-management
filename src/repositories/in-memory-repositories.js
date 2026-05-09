const { assertRepositoryInterfaces } = require('./interfaces');

function createInMemoryRepositories(store) {
  const repositories = {
    users: {
      findActiveByEmail: email => store.users.find(user => user.email === email && user.status === 'active') || null,
      findActiveById: id => store.users.find(user => user.id === id && user.status === 'active') || null
    },
    roles: {
      listRolePermissions: role => store.rolePermissions?.[role] || []
    },
    patients: {
      create: patient => store.patients.push(patient) && patient,
      findByIdOrNumber: id => store.patients.find(patient => patient.id === id || patient.patientNo === id) || null,
      searchByTenant: tenantId => store.patients.filter(patient => patient.tenantId === tenantId)
    },
    orders: {
      create: order => store.orders.push(order) && order,
      findByIdOrNumber: id => store.orders.find(order => order.id === id || order.orderNo === id) || null
    },
    invoices: {
      create: invoice => store.invoices.push(invoice) && invoice,
      findByIdOrNumber: id => store.invoices.find(invoice => invoice.id === id || invoice.invoiceNo === id) || null
    },
    payments: {
      create: payment => store.payments.push(payment) && payment,
      findByInvoiceId: invoiceId => store.payments.filter(payment => payment.invoiceId === invoiceId)
    },
    cashierSessions: {
      create: session => store.cashierSessions.push(session) && session,
      findByIdOrNumber: id => store.cashierSessions.find(session => session.id === id || session.sessionNo === id) || null,
      findActiveByCashier: ({ tenantId, branchId, cashierId }) => store.cashierSessions.find(session =>
        session.tenantId === tenantId &&
        session.branchId === branchId &&
        session.cashierId === cashierId &&
        session.status === 'Open'
      ) || null
    },
    lab: {
      createOrder: labOrder => store.labOrders.push(labOrder) && labOrder,
      createResult: labResult => store.labResults.push(labResult) && labResult,
      findOrderByIdOrNumber: id => store.labOrders.find(order => order.id === id || order.labNo === id) || null,
      findResultByIdOrNumber: id => store.labResults.find(result => result.id === id || result.labNo === id) || null
    },
    inventory: {
      findItemById: id => store.inventory.find(item => item.id === id) || null,
      saveItem: item => item
    },
    audit: {
      create: event => store.auditLogs.push(event) && event,
      searchByTenant: tenantId => store.auditLogs.filter(log => log.tenantId === tenantId)
    },
    approvals: {
      create: approval => store.approvals.push(approval) && approval,
      findById: id => store.approvals.find(approval => approval.id === id) || null
    },
    notifications: {
      create: notification => store.notifications.push(notification) && notification,
      findByRecipient: patientId => store.notifications.filter(notification => notification.recipientPatientId === patientId)
    },
    idempotency: {
      get: key => store.idempotency.get(key),
      set: (key, value) => store.idempotency.set(key, value)
    }
  };
  assertRepositoryInterfaces(repositories);
  return repositories;
}

module.exports = {
  createInMemoryRepositories
};
