const state = {
  currentUser: { name: 'A. Reyes', role: 'Super Admin' },
  patientSequence: 2,
  orderSequence: 1,
  invoiceSequence: 1,
  receiptSequence: 0,
  labSequence: 1,
  selectedServices: [],
  patients: [
    { id: 'P-2026-000001', name: 'Juan Dela Cruz', ageSex: '34 / Male', contact: '09170000001', status: 'active' }
  ],
  services: [
    { code: 'CBC', name: 'Complete Blood Count', department: 'Laboratory', price: 450 },
    { code: 'FBS', name: 'Fasting Blood Sugar', department: 'Laboratory', price: 180 },
    { code: 'URINALYSIS', name: 'Urinalysis', department: 'Laboratory', price: 150 },
    { code: 'XRAY-CHEST', name: 'Chest X-Ray', department: 'Radiology', price: 650 }
  ],
  orders: [
    { no: 'ORD-2026-000001', status: 'Pending Payment', total: 450, service: 'Complete Blood Count' }
  ],
  queue: [
    { ticket: 'Q-021', patient: 'Juan Dela Cruz', station: 'Cashier', status: 'pending' },
    { ticket: 'Q-022', patient: 'Ana Reyes', station: 'Laboratory', status: 'processing' },
    { ticket: 'Q-023', patient: 'Mark Lim', station: 'Reception', status: 'pending' }
  ],
  labItems: [
    { analyte: 'Hemoglobin', result: '13.5', unit: 'g/dL', range: '12.0-16.0', flag: '' },
    { analyte: 'WBC', result: '7.2', unit: '10^9/L', range: '4.0-10.0', flag: '' },
    { analyte: 'Platelet', result: '250', unit: '10^9/L', range: '150-400', flag: '' }
  ],
  audit: [
    { time: '08:10', user: 'A. Reyes', module: 'auth', action: 'login', record: 'session', reason: 'MFA verified' },
    { time: '08:18', user: 'M. Santos', module: 'patients', action: 'view', record: 'P-2026-000001', reason: 'Front desk workflow' }
  ]
};

const money = value => `PHP ${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nextNo = (prefix, seq) => `${prefix}-2026-${String(seq).padStart(6, '0')}`;
const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function addAudit(module, action, record, reason = 'Workflow action') {
  state.audit.unshift({ time: nowTime(), user: state.currentUser.name, module, action, record, reason });
  renderAudit();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.querySelector(`#screen-${name}`).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.screen === name));
}

function renderPatients() {
  const body = document.querySelector('#patient-table');
  body.innerHTML = state.patients.map(patient => `
    <tr>
      <td><strong>${patient.id}</strong></td>
      <td>${patient.name}</td>
      <td>${patient.ageSex}</td>
      <td>${patient.contact}</td>
      <td><span class="badge status-${patient.status}">${patient.status}</span></td>
      <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-jump="profile"><i class="bi bi-eye"></i> View</button></td>
    </tr>
  `).join('');
}

function renderServices() {
  const list = document.querySelector('#service-list');
  list.innerHTML = state.services.map(service => `
    <div class="service-item">
      <div><strong>${service.name}</strong><span>${service.department} | ${service.code}</span></div>
      <strong>${money(service.price)}</strong>
      <button class="btn btn-sm btn-outline-primary" data-service="${service.code}"><i class="bi bi-plus-lg"></i> Add</button>
    </div>
  `).join('');
}

function renderOrder() {
  const container = document.querySelector('#order-items');
  if (!state.selectedServices.length) {
    container.innerHTML = '<p class="text-secondary">No services selected.</p>';
  } else {
    container.innerHTML = state.selectedServices.map(service => `
      <div class="document-row">
        <i class="bi bi-clipboard2-pulse"></i>
        <span>${service.name}</span>
        <strong>${money(service.price)}</strong>
      </div>
    `).join('');
  }
  const total = state.selectedServices.reduce((sum, service) => sum + service.price, 0);
  document.querySelector('#order-total').textContent = money(total);
}

function renderProfile() {
  document.querySelector('#profile-orders').innerHTML = state.orders.map(order => `
    <div class="timeline-item">
      <div class="d-flex justify-content-between"><strong>${order.no}</strong><span class="badge status-pending">${order.status}</span></div>
      <div class="text-secondary">${order.service} | ${money(order.total)}</div>
    </div>
  `).join('');
}

function renderQueue() {
  document.querySelector('#queue-board').innerHTML = state.queue.map(item => `
    <div class="queue-ticket">
      <div><span class="badge status-${item.status}">${item.status}</span><strong class="d-block">${item.ticket}</strong></div>
      <div><span>${item.patient}</span><small class="d-block text-secondary">${item.station}</small></div>
    </div>
  `).join('');
}

function renderLabItems() {
  const rows = state.labItems.map(item => `
    <tr>
      <td>${item.analyte}</td>
      <td><input class="form-control form-control-sm" value="${item.result}"></td>
      <td>${item.unit}</td>
      <td>${item.range}</td>
      <td><span class="badge ${item.flag ? 'status-pending' : 'status-approved'}">${item.flag || 'normal'}</span></td>
    </tr>
  `).join('');
  document.querySelector('#lab-items').innerHTML = rows;
  document.querySelector('#print-items').innerHTML = state.labItems.map(item => `
    <tr><td>${item.analyte}</td><td>${item.result}</td><td>${item.unit}</td><td>${item.range}</td><td>${item.flag || 'normal'}</td></tr>
  `).join('');
}

function renderAudit() {
  document.querySelector('#audit-table').innerHTML = state.audit.map(row => `
    <tr><td>${row.time}</td><td>${row.user}</td><td>${row.module}</td><td>${row.action}</td><td>${row.record}</td><td>${row.reason}</td></tr>
  `).join('');
}

function initCharts() {
  if (!window.Chart) return;
  const exception = document.querySelector('#exception-chart');
  if (exception) {
    new Chart(exception, {
      type: 'bar',
      data: { labels: ['Lab delay', 'Unpaid', 'Low stock', 'Failed notices'], datasets: [{ data: [8, 5, 4, 2], backgroundColor: ['#2563eb', '#b7791f', '#b42318', '#64748b'] }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
  const sales = document.querySelector('#sales-chart');
  if (sales) {
    new Chart(sales, {
      type: 'line',
      data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], datasets: [{ label: 'Collections', data: [18500, 22150, 19800, 24850, 26400], borderColor: '#0f766e', backgroundColor: 'rgba(15, 118, 110, .12)', tension: .35, fill: true }] },
      options: { plugins: { legend: { display: false } } }
    });
  }
}

function registerPatient(event) {
  event.preventDefault();
  const id = nextNo('P', state.patientSequence++);
  const patient = {
    id,
    name: `${document.querySelector('#reg-first').value} ${document.querySelector('#reg-last').value}`,
    ageSex: `35 / ${document.querySelector('#reg-sex').value}`,
    contact: document.querySelector('#reg-mobile').value,
    status: 'active'
  };
  state.patients.unshift(patient);
  document.querySelector('#profile-name').textContent = patient.name;
  document.querySelector('#profile-id').textContent = patient.id;
  addAudit('patients', 'create', patient.id, 'Patient registration');
  renderPatients();
  showScreen('profile');
}

function createOrder() {
  if (!state.selectedServices.length) return;
  const no = nextNo('ORD', ++state.orderSequence);
  const total = state.selectedServices.reduce((sum, service) => sum + service.price, 0);
  state.orders.unshift({ no, status: 'Pending Payment', total, service: state.selectedServices.map(service => service.code).join(', ') });
  document.querySelector('#order-status').textContent = 'Pending Payment';
  document.querySelector('#invoice-no').textContent = nextNo('INV', ++state.invoiceSequence);
  document.querySelector('#invoice-total').textContent = money(total);
  document.querySelector('#payment-amount').value = total.toFixed(2);
  addAudit('orders', 'create', no, 'Order created from services');
  renderProfile();
  showScreen('billing');
}

function postPayment(event) {
  event.preventDefault();
  const receipt = nextNo('OR', ++state.receiptSequence);
  document.querySelector('#invoice-status').textContent = 'Paid';
  document.querySelector('#invoice-status').className = 'badge text-bg-success';
  state.queue.unshift({ ticket: 'Q-024', patient: document.querySelector('#profile-name').textContent, station: 'Laboratory', status: 'pending' });
  document.querySelector('#metric-unpaid').textContent = '4';
  addAudit('billing', 'payment.create', receipt, `${document.querySelector('#payment-mode').value} payment posted`);
  renderQueue();
  showScreen('queue');
}

function runDemo() {
  showScreen('dashboard');
  addAudit('demo', 'start', 'CBC workflow', 'Demo script started');
  state.queue.unshift({ ticket: 'Q-025', patient: 'Maria Santos', station: 'Laboratory', status: 'processing' });
  document.querySelector('#metric-queue').textContent = String(Number(document.querySelector('#metric-queue').textContent) + 1);
  document.querySelector('#metric-lab').textContent = '9';
  renderQueue();
}

function requestVoid() {
  const reason = document.querySelector('#void-reason').value.trim() || 'Reason captured in approval request';
  addAudit('orders', 'void.request', 'ORD-2026-000001', reason);
  alert('Void request submitted. Maker-checker rule prevents requester self-approval.');
}

function bindEvents() {
  document.querySelector('#login-form').addEventListener('submit', event => {
    event.preventDefault();
    document.querySelector('#login-screen').classList.add('d-none');
    document.querySelector('#app-shell').classList.remove('d-none');
    addAudit('auth', 'login', 'session', 'MFA verified');
  });
  document.querySelector('#logout-btn').addEventListener('click', () => location.reload());
  document.querySelector('#main-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-screen]');
    if (button) showScreen(button.dataset.screen);
  });
  document.body.addEventListener('click', event => {
    const jump = event.target.closest('[data-jump]');
    if (jump) showScreen(jump.dataset.jump);
    const serviceButton = event.target.closest('[data-service]');
    if (serviceButton) {
      const service = state.services.find(item => item.code === serviceButton.dataset.service);
      state.selectedServices.push(service);
      renderOrder();
    }
  });
  document.querySelector('#registration-form').addEventListener('submit', registerPatient);
  document.querySelector('#create-order').addEventListener('click', createOrder);
  document.querySelector('#payment-form').addEventListener('submit', postPayment);
  document.querySelector('#validate-result').addEventListener('click', () => {
    document.querySelector('#lab-status').textContent = 'Validated';
    document.querySelector('#lab-status').className = 'badge text-bg-warning';
    addAudit('laboratory', 'result.validate', 'LAB-2026-000001', 'Validated by authorized approver');
  });
  document.querySelector('#lab-form').addEventListener('submit', event => {
    event.preventDefault();
    document.querySelector('#lab-status').textContent = 'Approved';
    document.querySelector('#lab-status').className = 'badge text-bg-success';
    addAudit('laboratory', 'result.approve', 'LAB-2026-000001', 'Approved for release');
    showScreen('print');
  });
  document.querySelector('#request-void').addEventListener('click', requestVoid);
  document.querySelector('#run-demo').addEventListener('click', runDemo);
}

renderPatients();
renderServices();
renderOrder();
renderProfile();
renderQueue();
renderLabItems();
renderAudit();
bindEvents();
initCharts();
