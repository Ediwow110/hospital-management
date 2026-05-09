const REPOSITORY_INTERFACES = Object.freeze({
  users: ['findActiveByEmail', 'findActiveById'],
  roles: ['listRolePermissions'],
  patients: ['create', 'findByIdOrNumber', 'searchByTenant'],
  orders: ['create', 'findByIdOrNumber'],
  invoices: ['create', 'findByIdOrNumber'],
  payments: ['create', 'findByInvoiceId'],
  cashierSessions: ['create', 'findByIdOrNumber', 'findActiveByCashier'],
  lab: ['createOrder', 'createResult', 'findOrderByIdOrNumber', 'findResultByIdOrNumber'],
  inventory: ['findItemById', 'saveItem'],
  audit: ['create', 'searchByTenant'],
  approvals: ['create', 'findById'],
  notifications: ['create', 'findByRecipient'],
  idempotency: ['get', 'set']
});

function assertRepositoryInterfaces(repositories) {
  const violations = [];
  Object.entries(REPOSITORY_INTERFACES).forEach(([name, methods]) => {
    const repository = repositories?.[name];
    if (!repository) {
      violations.push(`${name}: missing repository`);
      return;
    }
    methods.forEach(method => {
      if (typeof repository[method] !== 'function') violations.push(`${name}.${method}: missing method`);
    });
  });
  if (violations.length) {
    throw new Error(`Repository contract violations: ${violations.join(', ')}`);
  }
  return true;
}

module.exports = {
  REPOSITORY_INTERFACES,
  assertRepositoryInterfaces
};
