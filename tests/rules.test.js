const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rules = require('../assets/js/app.js');

function testNumbering() {
  const state = rules.createInitialState();
  assert.strictEqual(rules.nextNumber(state, 'patient'), 'P-2026-000002');
  assert.strictEqual(rules.nextNumber(state, 'order'), 'ORD-2026-000002');
  assert.strictEqual(rules.nextNumber(state, 'invoice'), 'INV-2026-000002');
}

function testPermissions() {
  const state = rules.createInitialState();
  state.currentUser.role = 'receptionist';
  assert.strictEqual(rules.hasPermission(state, 'patient.create'), true);
  assert.strictEqual(rules.hasPermission(state, 'lab.result.approve'), false);
  state.currentUser.role = 'cashier';
  assert.strictEqual(rules.hasPermission(state, 'billing.payment.create'), true);
  assert.strictEqual(rules.hasPermission(state, 'lab.result.amend.request'), false);
}

function testMakerChecker() {
  const state = rules.createInitialState();
  const approval = {
    type: 'refund',
    requestedUserId: 'u-cashier'
  };
  state.currentUser = { id: 'u-cashier', role: 'cashier' };
  assert.strictEqual(rules.canApprove(state, approval), false);
  state.currentUser = { id: 'u-manager', role: 'branch_manager' };
  assert.strictEqual(rules.canApprove(state, approval), true);
}

function testWorkflowTransitions() {
  assert.strictEqual(rules.canTransitionLab('Pending Collection', 'Collected'), true);
  assert.strictEqual(rules.canTransitionLab('Pending Collection', 'Approved'), false);
  assert.strictEqual(rules.canTransitionLab('Released', 'Encoded'), false);
  assert.strictEqual(rules.canTransitionLab('Released', 'Amended'), true);
}

function testPaymentRules() {
  const invoice = { no: 'INV-1', status: 'Unpaid', balance: 450, isLocked: false };
  assert.strictEqual(rules.canPostPayment(invoice, 450, { overpaymentEnabled: false }).ok, true);
  assert.strictEqual(rules.canPostPayment(invoice, 451, { overpaymentEnabled: false }).ok, false);
  assert.strictEqual(rules.canPostPayment(invoice, 451, { overpaymentEnabled: true }).ok, true);
  assert.strictEqual(rules.canPostPayment({ ...invoice, status: 'Voided' }, 10, { overpaymentEnabled: false }).ok, false);
}

function testStatusClasses() {
  assert.strictEqual(rules.statusClass('Pending Payment'), 'status-pending-payment');
  assert.strictEqual(rules.statusClass('Low stock'), 'status-low-stock');
}

function testInventoryStatus() {
  assert.strictEqual(rules.inventoryStatus({ expiry: '2020-01-01', qty: 99, reorderLevel: 1 }), 'expired');
  assert.strictEqual(rules.inventoryStatus({ expiry: '2099-01-01', qty: 1, reorderLevel: 5 }), 'low stock');
  assert.strictEqual(rules.inventoryStatus({ expiry: '2099-01-01', qty: 10, reorderLevel: 5 }), 'stocked');
}

function testNoUnwiredStaticActions() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
  const actionNames = new Set([...`${html}\n${js}`.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]));
  const actionBlock = js.match(/const actions = \{([\s\S]*?)\r?\n\};\r?\n\r?\nfunction exportWithAudit/);
  assert.ok(actionBlock, 'actions block should be discoverable');
  const handlerNames = new Set([
    ...[...actionBlock[1].matchAll(/\n\s*([A-Za-z0-9_]+):/g)].map(match => match[1]),
    ...[...actionBlock[1].matchAll(/\n\s*([A-Za-z0-9_]+),/g)].map(match => match[1])
  ]);
  const missing = [...actionNames].filter(action => !handlerNames.has(action));
  assert.deepStrictEqual(missing, []);
}

function testNavigationTargetsExist() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const screens = new Set([...html.matchAll(/id="screen-([^"]+)"/g)].map(match => match[1]));
  const navTargets = [...html.matchAll(/data-screen="([^"]+)"/g)].map(match => match[1]);
  const jumpTargets = [...html.matchAll(/data-jump="([^"]+)"/g)].map(match => match[1]);
  assert.deepStrictEqual(navTargets.filter(target => !screens.has(target)), []);
  assert.deepStrictEqual(jumpTargets.filter(target => !screens.has(target)), []);
}

function testUniqueDomIds() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepStrictEqual(duplicates, []);
}

function testVisibleButtonsHaveBehavior() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const unhandledButtons = [...html.matchAll(/<button\b([^>]*)>/g)]
    .map(match => match[1])
    .filter(attributes => {
      const type = attributes.match(/\btype="([^"]+)"/)?.[1] || 'submit';
      return !['submit', 'reset'].includes(type) &&
        !attributes.includes('data-action=') &&
        !attributes.includes('data-jump=') &&
        !attributes.includes('data-screen=') &&
        !attributes.includes('data-bs-dismiss=') &&
        !attributes.includes('data-bs-toggle=') &&
        !attributes.includes('id="logout-btn"') &&
        !attributes.includes('id="reason-confirm"');
    });
  assert.deepStrictEqual(unhandledButtons, []);
}

function testPatientIdentityHeadersExist() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
  const requiredPatientScreens = ['profile', 'orders', 'billing', 'receipt', 'queue', 'lab', 'lab-approval', 'print', 'portal'];
  const missing = requiredPatientScreens.filter(screen => {
    const pattern = new RegExp(`id="screen-${screen}"[\\s\\S]*?<div class="patient-context" data-patient-header>`);
    return !pattern.test(html);
  });
  assert.deepStrictEqual(missing, []);
  ['Patient', 'Age / Sex', 'Birthdate', 'Contact', 'Category / Alerts'].forEach(label => {
    assert.ok(js.includes(label), `${label} missing from patient identity header renderer`);
  });
}

testNumbering();
testPermissions();
testMakerChecker();
testWorkflowTransitions();
testPaymentRules();
testStatusClasses();
testInventoryStatus();
testNoUnwiredStaticActions();
testNavigationTargetsExist();
testUniqueDomIds();
testVisibleButtonsHaveBehavior();
testPatientIdentityHeadersExist();

console.log('All HMS rule tests passed.');
