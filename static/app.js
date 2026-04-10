const state = {
  config: null,
  selectedCategory: '',
  user: null,
  selectedProfessional: null,
  authMode: 'login',
  professionalsById: {},
};

const categoryMeta = {
  'Tırnak': '💅',
  'Saç': '💇',
  'Makyaj': '💄',
  'Kaş & Kirpik': '👁️',
  'Cilt Bakımı': '🧴',
  'Lazer & Epilasyon': '✨',
};

const $ = (s) => document.querySelector(s);
const categoryGrid = $('#categoryGrid');
const serviceSelect = $('#serviceSelect');
const districtSelect = $('#districtSelect');
const timeSelect = $('#timeSelect');
const dateSelect = $('#dateSelect');
const resultList = $('#resultList');
const authBtn = $('#authBtn');
const appointmentsBtn = $('#appointmentsBtn');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function initializeDateInputs() {
  const today = todayISO();
  if (dateSelect) {
    dateSelect.min = today;
    if (!dateSelect.value) dateSelect.value = today;
  }
  const apptDate = $('#apptDate');
  if (apptDate) {
    apptDate.min = today;
    if (!apptDate.value) apptDate.value = today;
  }
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bir hata oluştu.');
  return data;
}

function fillDistricts(list) {
  districtSelect.innerHTML = list.map(d => `<option>${d}</option>`).join('');
}

function fillTimes(list) {
  const options = ['Saat seç', ...list];
  timeSelect.innerHTML = options.map(t => `<option ${t === 'Saat seç' ? 'selected' : ''}>${t}</option>`).join('');
  $('#apptTime').innerHTML = list.map(t => `<option>${t}</option>`).join('');
}

function paletteFromText(text) {
  const palettes = [
    ['#f7d1ff', '#c084fc', '#7c3aed'],
    ['#ffd6e8', '#fb7185', '#be185d'],
    ['#d8f6ff', '#38bdf8', '#0f766e'],
    ['#ffe7c2', '#f59e0b', '#b45309'],
    ['#e4ffd8', '#4ade80', '#15803d'],
    ['#efe3ff', '#a78bfa', '#6d28d9'],
  ];
  let sum = 0;
  for (const ch of text) sum += ch.charCodeAt(0);
  return palettes[sum % palettes.length];
}

function svgPhoto(label, kind = 'work') {
  const [bg1, bg2, accent] = paletteFromText(label + kind);
  const safe = String(label || '').slice(0, 18);
  const emoji = kind === 'profile' ? '✨' : '💅';
  const sub = kind === 'profile' ? 'BeautyHub' : 'El işi';
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${kind === 'profile' ? 240 : 180}" height="${kind === 'profile' ? 240 : 220}" viewBox="0 0 ${kind === 'profile' ? 240 : 180} ${kind === 'profile' ? 240 : 220}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" rx="28" fill="url(#g)"/>
    <circle cx="${kind === 'profile' ? 120 : 90}" cy="${kind === 'profile' ? 88 : 78}" r="${kind === 'profile' ? 52 : 40}" fill="rgba(255,255,255,0.74)"/>
    <text x="50%" y="${kind === 'profile' ? 97 : 86}" text-anchor="middle" font-size="${kind === 'profile' ? 34 : 26}">${emoji}</text>
    <rect x="${kind === 'profile' ? 40 : 24}" y="${kind === 'profile' ? 154 : 144}" width="${kind === 'profile' ? 160 : 132}" height="${kind === 'profile' ? 42 : 36}" rx="18" fill="rgba(255,255,255,0.82)"/>
    <text x="50%" y="${kind === 'profile' ? 180 : 166}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${kind === 'profile' ? 18 : 14}" font-weight="700" fill="${accent}">${safe}</text>
    <text x="50%" y="${kind === 'profile' ? 206 : 191}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${kind === 'profile' ? 11 : 10}" fill="#5b476f">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function portfolioItemMeta(item, ownerName = '', i = 0) {
  if (item && typeof item === 'object') {
    return {
      title: item.title || item.name || `El işi ${i + 1}`,
      image: item.image_data || item.image || svgPhoto(ownerName + (item.title || item.name || i), 'work'),
    };
  }
  return {
    title: item || `El işi ${i + 1}`,
    image: svgPhoto(ownerName + (item || i), 'work'),
  };
}

function renderWorksGallery(items = [], ownerName = '') {
  return `<div class="works-scroller">${items.map((item, i) => {
    const meta = portfolioItemMeta(item, ownerName, i);
    return `
      <figure class="work-card">
        <img src="${meta.image}" alt="${meta.title}" />
        <figcaption>${meta.title}</figcaption>
      </figure>
    `;
  }).join('')}</div>`;
}

function renderProfileVisual(name, category) {
  return `<div class="pro-visual"><img class="pro-avatar" src="${svgPhoto(name + category, 'profile')}" alt="${name}" /></div>`;
}

function renderCategories() {
  categoryGrid.innerHTML = Object.keys(state.config.services).map(name => `
    <button class="category-card ${state.selectedCategory === name ? 'active' : ''}" data-category="${name}">
      <div class="emoji">${categoryMeta[name] || '✨'}</div>
      <strong>${name}</strong>
    </button>
  `).join('');

  categoryGrid.querySelectorAll('.category-card').forEach(btn => {
    btn.onclick = () => {
      state.selectedCategory = btn.dataset.category;
      renderCategories();
      populateServices();
    };
  });
}

function populateServices() {
  if (!state.selectedCategory) {
    serviceSelect.innerHTML = '<option>Önce hazır seçimlerden birini seç</option>';
    serviceSelect.disabled = true;
    return;
  }
  const items = state.config.services[state.selectedCategory] || [];
  serviceSelect.disabled = false;
  serviceSelect.innerHTML = items.map(s => `<option>${s}</option>`).join('');
}

function renderResults(items) {
  state.professionalsById = Object.fromEntries(items.map(item => [String(item.id), item]));
  if (!items.length) {
    resultList.className = 'result-list empty-state';
    resultList.innerHTML = '<div class="empty-emoji">🫧</div><strong>Uygun uzman bulunamadı</strong><p>İlçe, hizmet veya saati değiştirip tekrar dene.</p>';
    return;
  }

  resultList.className = 'result-list';
  resultList.innerHTML = items.map(item => `
    <article class="pro-card">
      <div class="pro-card-main">
        <div class="pro-top-wrap">
          ${renderProfileVisual(item.name, item.category)}
          <div class="pro-copy">
            <h4>${item.name}</h4>
            <div class="subline">
              <span class="pill">${item.category}</span>
              <span class="pill">${item.district}</span>
              <span class="pill">⭐ ${item.rating}</span>
            </div>
            <p class="muted">${item.description || ''}</p>
            <div class="price-badge">💸 ${item.price_range}</div>
          </div>
        </div>
        <div class="mini-title" style="margin-top:12px">Uyguladığı işler</div>
        <div class="service-chips">${item.services.map(s => `<span class="mini-chip">${s}</span>`).join('')}</div>
        <div class="mini-title" style="margin-top:12px">El işleri</div>
        ${renderWorksGallery(item.portfolio, item.name)}
      </div>
      <div class="card-actions">
        <button class="secondary message-btn" data-name="${item.name}">Mesaj</button>
        <button class="primary book-btn" data-id="${item.id}" data-name="${item.name}" style="width:auto">Randevu Al</button>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.book-btn').forEach(btn => btn.onclick = () => openAppointment(btn.dataset.id, btn.dataset.name));
  document.querySelectorAll('.message-btn').forEach(btn => btn.onclick = () => alert(`${btn.dataset.name} ile mesajlaşma sonraki adımda genişletilebilir.`));
}

async function findProfessionals() {
  if (!state.selectedCategory) return alert('Önce hazır seçimlerden bir alan seç.');
  if (!dateSelect.value) return alert('Bir tarih seç.');
  if (timeSelect.value === 'Saat seç') return alert('Bir saat seç.');
  const district = districtSelect.value;
  const service = serviceSelect.value;
  const time = timeSelect.value;
  const data = await api(`/customer-api/professionals?category=${encodeURIComponent(state.selectedCategory)}&district=${encodeURIComponent(district)}&service=${encodeURIComponent(service)}&date=${encodeURIComponent(dateSelect.value)}&time=${encodeURIComponent(time)}`);
  renderResults(data.items);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
  $('#newPasswordWrap').classList.toggle('hidden', mode !== 'forgot');
  $('#passwordInput').parentElement.classList.toggle('hidden', mode === 'forgot');
  $('#authSubmit').textContent = mode === 'login' ? 'Giriş Yap' : mode === 'register' ? 'Kayıt Ol' : 'Şifreyi Güncelle';
  $('#authMessage').textContent = '';
}

async function refreshMe() {
  const data = await api('/customer-api/me');
  state.user = data.user;
  if (state.user) {
    authBtn.textContent = `Hesabım / Çıkış`;
    appointmentsBtn.classList.remove('hidden');
  } else {
    authBtn.textContent = 'Giriş / Kayıt';
    appointmentsBtn.classList.add('hidden');
  }
}

async function submitAuth(e) {
  e.preventDefault();
  const phone = $('#phoneInput').value.trim();
  const password = $('#passwordInput').value.trim();
  const newPassword = $('#newPasswordInput').value.trim();
  const message = $('#authMessage');
  const cleanPhone = phone.replace(/\D/g, '');
  message.textContent = '';

  if (cleanPhone.length < 10) {
    message.textContent = 'Geçerli bir telefon numarası yaz.';
    return;
  }
  if (state.authMode !== 'forgot' && password.length < 6) {
    message.textContent = 'Şifre en az 6 karakter olmalı.';
    return;
  }
  if (state.authMode === 'forgot' && newPassword.length < 6) {
    message.textContent = 'Yeni şifre en az 6 karakter olmalı.';
    return;
  }

  try {
    if (state.authMode === 'login') {
      const res = await api('/customer-api/login', { method: 'POST', body: JSON.stringify({ phone: cleanPhone, password }) });
      message.textContent = 'Giriş başarılı.';
      state.user = res.user || null;
    } else if (state.authMode === 'register') {
      const res = await api('/customer-api/register', { method: 'POST', body: JSON.stringify({ phone: cleanPhone, password }) });
      message.textContent = 'Kayıt başarılı.';
      state.user = res.user || null;
    } else {
      await api('/customer-api/forgot-password', { method: 'POST', body: JSON.stringify({ phone: cleanPhone, new_password: newPassword }) });
      message.textContent = 'Şifre güncellendi.';
    }
    await refreshMe();
    if ((state.authMode === 'login' || state.authMode === 'register') && !state.user) {
      message.textContent = 'Oturum açılamadı. Tekrar dene.';
      return;
    }
    if (state.authMode !== 'forgot') setTimeout(() => closeModal('authModal'), 550);
  } catch (err) {
    message.textContent = err.message;
  }
}

function openAppointment(id, name) {
  if (!state.user) {
    openModal('authModal');
    setAuthMode('login');
    $('#authMessage').textContent = 'Randevu için önce giriş yap.';
    return;
  }
  const expert = state.professionalsById[String(id)] || { id, name, portfolio: [], services: [], price_range: '' };
  state.selectedProfessional = expert;
  $('#apptProfessional').textContent = `${name} için randevu oluşturuyorsun.`;
  $('#apptSummary').innerHTML = `
    <div class="appt-summary-card">
      <div class="pro-top-wrap compact-pro-top">
        ${renderProfileVisual(expert.name || name, expert.category || '')}
        <div class="pro-copy">
          <div class="subline">
            <span class="pill">${expert.category || ''}</span>
            <span class="pill">${expert.district || ''}</span>
            <span class="pill">⭐ ${expert.rating || ''}</span>
          </div>
          ${expert.price_range ? `<div class="price-badge">💸 ${expert.price_range}</div>` : ''}
        </div>
      </div>
      <div class="mini-title" style="margin-top:10px">El işleri</div>
      ${renderWorksGallery((expert.portfolio || []), expert.name || name)}
      <div class="mini-title" style="margin-top:10px">Uyguladığı işlemler</div>
      <div class="service-chips">${(expert.services || []).map(s => `<span class="mini-chip">${s}</span>`).join('')}</div>
    </div>
  `;
  $('#apptDate').min = todayISO();
  $('#apptDate').value = dateSelect.value || todayISO();
  $('#apptTime').value = timeSelect.value === 'Saat seç' ? state.config.time_slots[0] : timeSelect.value;
  $('#apptMessage').textContent = '';
  openModal('appointmentModal');
}

async function submitAppointment(e) {
  e.preventDefault();
  const payload = {
    professional_id: state.selectedProfessional.id,
    category: state.selectedCategory,
    service: serviceSelect.value,
    district: districtSelect.value,
    time_range: $('#apptTime').value,
    appointment_date: $('#apptDate').value,
    note: $('#apptNote').value.trim(),
  };
  try {
    const data = await api('/customer-api/appointments', { method: 'POST', body: JSON.stringify(payload) });
    $('#apptMessage').textContent = data.message;
    setTimeout(() => closeModal('appointmentModal'), 700);
  } catch (err) {
    $('#apptMessage').textContent = err.message;
  }
}

async function openAppointments() {
  try {
    const data = await api('/customer-api/appointments');
    const wrap = $('#appointmentsList');
    if (!data.items.length) {
      wrap.innerHTML = '<div class="appointment-card">Henüz randevun yok.</div>';
    } else {
      wrap.innerHTML = data.items.map(item => `
        <div class="appointment-card">
          <div class="appointment-top">
            <div>
              <h4>${item.professional_name}</h4>
              <div class="subline">
                <span class="pill">${item.category}</span>
                <span class="pill">${item.district}</span>
                <span class="pill">⭐ ${item.rating || ''}</span>
              </div>
            </div>
            ${item.price_range ? `<div class="price-badge">💸 ${item.price_range}</div>` : ''}
          </div>
          <div class="muted"><strong>Seçtiğin işlem:</strong> ${item.service}</div>
          <div class="muted">${item.appointment_date} • ${item.time_range}</div>
          <div class="muted status-line">Durum: ${item.status}</div>
          <div class="mini-title" style="margin-top:10px">El işleri</div>
          ${renderWorksGallery((item.portfolio || []), item.professional_name)}
          <div class="mini-title" style="margin-top:10px">Uyguladığı işlemler</div>
          <div class="service-chips">${(item.services || []).map(s => `<span class="mini-chip">${s}</span>`).join('')}</div>
          <div class="appointment-actions">
            ${item.status === 'İptal Edildi' ? '' : `<button class="secondary edit-appt" data-id="${item.id}" data-date="${item.appointment_date}" data-time="${item.time_range}">Değiştir</button>
            <button class="secondary cancel-appt" data-id="${item.id}">İptal Et</button>`}
          </div>
        </div>
      `).join('');
      wrap.querySelectorAll('.cancel-appt').forEach(btn => btn.onclick = async () => {
        await api(`/customer-api/appointments/${btn.dataset.id}`, { method: 'DELETE' });
        openAppointments();
      });
      wrap.querySelectorAll('.edit-appt').forEach(btn => btn.onclick = async () => {
        const newDate = prompt('Yeni tarih (YYYY-MM-DD)', btn.dataset.date);
        if (!newDate) return;
        const newTime = prompt('Yeni saat', btn.dataset.time);
        if (!newTime) return;
        await api(`/customer-api/appointments/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ appointment_date: newDate, time_range: newTime, status: 'Beklemede' }) });
        openAppointments();
      });
    }
    openModal('appointmentsModal');
  } catch (err) {
    alert(err.message);
  }
}

async function init() {
  state.config = await api('/customer-api/config');
  fillDistricts(state.config.districts);
  fillTimes(state.config.time_slots);
  initializeDateInputs();
  renderCategories();
  populateServices();
  await refreshMe();

  $('#showExpertsBtn').onclick = findProfessionals;
  authBtn.onclick = async () => {
    if (state.user) {
      await api('/customer-api/logout', { method: 'POST' });
      await refreshMe();
      return;
    }
    openModal('authModal');
  };
  appointmentsBtn.onclick = openAppointments;
  document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => closeModal(btn.dataset.close));
  document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => setAuthMode(btn.dataset.tab));
  $('#authForm').addEventListener('submit', submitAuth);
  $('#appointmentForm').addEventListener('submit', submitAppointment);
}

init();
