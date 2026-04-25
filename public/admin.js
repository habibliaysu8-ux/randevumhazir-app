const ADMIN_KEY = 'randevumhazir_admin';

const adminState = {
  admin: Store.get(ADMIN_KEY),
  dashboard: null
};

function tableTemplate(columns, rowsHtml) {
  return `
    <table class="table">
      <thead><tr>${columns.map((col) => `<th>${col}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="${columns.length}">Kayıt yok.</td></tr>`}</tbody>
    </table>
  `;
}

async function loadAdminDashboard() {
  if (!adminState.admin) {
    adminState.dashboard = null;
    renderAdmin();
    return;
  }
  const { data } = await API.get(`/api/admin/dashboard?userId=${adminState.admin.id}`);
  adminState.dashboard = data;
  renderAdmin();
}

function renderAdmin() {
  const logoutBtn = byId('adminLogoutBtn');
  const summary = byId('adminSummaryText');
  if (!adminState.admin || !adminState.dashboard) {
    logoutBtn.style.visibility = 'hidden';
    summary.textContent = 'Giriş yaptıktan sonra tüm sistem görünür.';
    byId('adminSalonsTable').innerHTML = '<div class="empty-state">Henüz veri yok.</div>';
    byId('adminUsersTable').innerHTML = '<div class="empty-state">Henüz veri yok.</div>';
    byId('adminBookingsTable').innerHTML = '<div class="empty-state">Henüz veri yok.</div>';
    return;
  }

  const data = adminState.dashboard;
  logoutBtn.style.visibility = 'visible';
  summary.textContent = `${data.user.name} olarak giriş yapıldı. Tüm panelleri aynı backend üzerinden izliyorsun.`;

  byId('adminMetrics').innerHTML = `
    <div class="metric-card"><span class="muted">Toplam kullanıcı</span><strong>${data.stats.totalUsers}</strong></div>
    <div class="metric-card"><span class="muted">Partner</span><strong>${data.stats.totalPartners}</strong></div>
    <div class="metric-card"><span class="muted">Salon</span><strong>${data.stats.totalSalons}</strong></div>
    <div class="metric-card"><span class="muted">Rezervasyon</span><strong>${data.stats.totalBookings}</strong></div>
  `;

  byId('adminUsersTable').innerHTML = tableTemplate(
    ['Ad', 'Rol', 'E-posta', 'Telefon'],
    data.users.map((user) => `
      <tr>
        <td>${user.name}</td>
        <td><span class="status-badge ${user.role === 'admin' ? '' : user.role === 'partner' ? 'success' : 'muted'}">${user.role}</span></td>
        <td>${user.email}</td>
        <td>${user.phone || '-'}</td>
      </tr>
    `).join('')
  );

  byId('adminBookingsTable').innerHTML = tableTemplate(
    ['Salon', 'Hizmet', 'Uzman', 'Tarih', 'Durum'],
    data.bookings.map((booking) => `
      <tr>
        <td>${booking.salonName}</td>
        <td>${booking.serviceName}</td>
        <td>${booking.staffName}</td>
        <td>${formatDate(booking.date)} · ${booking.startTime}</td>
        <td><span class="status-badge success">${booking.status}</span></td>
      </tr>
    `).join('')
  );

  byId('adminSalonsTable').innerHTML = tableTemplate(
    ['Salon', 'Konum', 'Kategori', 'Durum', 'Öne çıkar', 'Aksiyon'],
    data.salons.map((salon) => `
      <tr>
        <td>${salon.name}</td>
        <td>${salon.city} / ${salon.district}</td>
        <td>${salon.category}</td>
        <td><span class="status-badge ${salon.status === 'active' ? 'success' : 'muted'}">${salon.status}</span></td>
        <td>${salon.isFeatured ? 'Evet' : 'Hayır'}</td>
        <td>
          <div class="row-actions">
            <button class="button secondary" data-toggle-featured="${salon.id}">${salon.isFeatured ? 'Öne çıkarmayı kapat' : 'Öne çıkar'}</button>
            <button class="button secondary" data-toggle-status="${salon.id}" data-next-status="${salon.status === 'active' ? 'draft' : 'active'}">${salon.status === 'active' ? 'Pasife al' : 'Aktif et'}</button>
          </div>
        </td>
      </tr>
    `).join('')
  );

  document.querySelectorAll('[data-toggle-featured]').forEach((button) => {
    button.addEventListener('click', () => toggleSalon(button.dataset.toggleFeatured, 'featured').catch((error) => showToast(error.message, 'error')));
  });
  document.querySelectorAll('[data-toggle-status]').forEach((button) => {
    button.addEventListener('click', () => toggleSalon(button.dataset.toggleStatus, 'status', button.dataset.nextStatus).catch((error) => showToast(error.message, 'error')));
  });
}

async function loginAdmin() {
  const email = byId('adminEmail').value.trim();
  const password = byId('adminPassword').value.trim();
  const { user } = await API.post('/api/auth/login', { email, password, role: 'admin' });
  adminState.admin = user;
  Store.set(ADMIN_KEY, user);
  await loadAdminDashboard();
  showToast('Admin girişi başarılı.', 'success');
}

function resetAdminAuthInputs() {
  ['adminEmail', 'adminPassword', 'adminForgotEmail'].forEach((id) => { const el = byId(id); if (el) el.value = ''; });
  const box = byId('adminForgotBox'); const input = byId('adminForgotEmail'); const message = byId('adminForgotMessage'); const sendBtn = byId('adminForgotSendBtn'); const field = input?.closest('.field');
  if (message) { message.textContent = ''; message.style.color = ''; }
  if (field) field.hidden = false;
  if (sendBtn) { sendBtn.hidden = false; sendBtn.disabled = false; sendBtn.textContent = 'Gönder'; }
  if (box) { box.hidden = true; box.style.display = ''; }
}

function openAdminForgotPassword() {
  const box = byId('adminForgotBox');
  const input = byId('adminForgotEmail');
  const loginEmail = byId('adminEmail');
  const message = byId('adminForgotMessage');
  const sendBtn = byId('adminForgotSendBtn');
  const field = input?.closest('.field');
  if (!box) return;
  if (field) field.hidden = false;
  if (sendBtn) { sendBtn.hidden = false; sendBtn.disabled = false; sendBtn.textContent = 'Gönder'; }
  box.hidden = false;
  box.style.display = 'grid';
  if (input) input.value = loginEmail?.value.trim() || '';
  if (message) { message.textContent = ''; message.style.color = ''; }
  setTimeout(() => input?.focus(), 0);
}

async function sendAdminForgotPassword() {
  const input = byId('adminForgotEmail');
  const email = (input?.value || byId('adminEmail')?.value || '').trim();
  const message = byId('adminForgotMessage');
  const sendBtn = byId('adminForgotSendBtn');
  const field = input?.closest('.field');
  if (message) { message.textContent = ''; message.style.color = ''; }
  if (!email) {
    if (message) { message.textContent = 'Mail adresini yaz.'; message.style.color = '#b42318'; }
    showToast('Mail adresini yaz.', 'error');
    input?.focus();
    return;
  }
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Gönderiliyor...'; }
  try {
    await API.post('/api/auth/forgot-password', { email, role: 'admin' });
    if (input) input.value = '';
    if (byId('adminEmail')) byId('adminEmail').value = '';
    if (byId('adminPassword')) byId('adminPassword').value = '';
    if (field) field.hidden = true;
    if (sendBtn) sendBtn.hidden = true;
    if (message) { message.textContent = 'Şifre yenilemek için mailinizi kontrol edin.'; message.style.color = '#256b3a'; }
    showToast('Şifre yenileme maili gönderildi.', 'success');
  } catch (error) {
    if (message) { message.textContent = error.message || 'Mail gönderilemedi.'; message.style.color = '#b42318'; }
    throw error;
  } finally {
    if (sendBtn && !sendBtn.hidden) { sendBtn.disabled = false; sendBtn.textContent = 'Gönder'; }
  }
}

async function toggleSalon(salonId, mode, nextStatus) {
  const salon = adminState.dashboard.salons.find((item) => item.id === salonId);
  await API.patch(`/api/admin/salons/${salonId}`, {
    adminId: adminState.admin.id,
    ...(mode === 'featured' ? { isFeatured: !salon.isFeatured } : {}),
    ...(mode === 'status' ? { status: nextStatus } : {})
  });
  await loadAdminDashboard();
  showToast('Salon durumu güncellendi.', 'success');
}

function bindAdminEvents() {
  byId('adminLoginBtn').addEventListener('click', () => loginAdmin().catch((error) => showToast(error.message, 'error')));
  byId('adminForgotBtn')?.addEventListener('click', openAdminForgotPassword);
  byId('adminForgotSendBtn')?.addEventListener('click', () => sendAdminForgotPassword().catch((error) => showToast(error.message, 'error')));
  byId('adminLogoutBtn').addEventListener('click', () => {
    adminState.admin = null;
    adminState.dashboard = null;
    Store.remove(ADMIN_KEY);
    renderAdmin();
    showToast('Çıkış yapıldı.');
  });
}

async function initAdminPage() {
  byId('adminLogoutBtn').style.visibility = 'hidden';
  bindAdminEvents();
  await loadAdminDashboard();
}

initAdminPage().catch((error) => showToast(error.message, 'error'));
