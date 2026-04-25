const CUSTOMER_KEY = 'randevumhazir_customer';

const customerState = {
  customer: Store.get(CUSTOMER_KEY),
  selectedSlot: null,
  selectedCategory: '',
  serviceOptions: [],
  results: []
};

function openModal(id) {
  byId(id)?.classList.add('open');
}

function closeModal(id) {
  byId(id)?.classList.remove('open');
}

function looksNumeric(value) {
  return /^\+?[\d\s()-]{5,}$/.test(String(value || '').trim());
}

function normalizeServiceValue(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

function selectedCityName() {
  return optionText(byId('citySelect')) || 'İstanbul';
}

function getSelectedDate() {
  return byId('dateInput').value || '';
}

function setDateButtonLabel() {
  const date = getSelectedDate();
  const button = byId('datePickerButton');
  if (!button) return;
  button.textContent = date ? formatDate(date) : 'Gün seç';
}

function cleanSearchInput() {
  const input = byId('searchInput');
  if (!input) return;
  const value = String(input.value || '').trim();
  if (looksNumeric(value)) {
    input.value = '';
    input.dataset.userEdited = '0';
  }
}

function currentSearchPayload() {
  cleanSearchInput();
  return {
    q: String(byId('searchInput').value || '').trim(),
    cityId: byId('citySelect').value,
    district: byId('districtSelect').value,
    date: getSelectedDate(),
    time: byId('timeSelect').value,
    category: customerState.selectedCategory
  };
}

function serviceLabel(value) {
  if (!value) return 'Tüm hizmetler';
  const normalized = normalizeServiceValue(value);
  const option = customerState.serviceOptions.find((item) => normalizeServiceValue(item.value) === normalized || normalizeServiceValue(item.label) === normalized);
  return option?.label || value;
}

function resolveServiceQuery(rawValue) {
  const cleaned = String(rawValue || '').trim();
  if (!cleaned || looksNumeric(cleaned)) return '';
  const normalized = normalizeServiceValue(cleaned);
  const exact = customerState.serviceOptions.find((item) => {
    const valueNorm = normalizeServiceValue(item.value);
    const labelNorm = normalizeServiceValue(item.label);
    return valueNorm === normalized || labelNorm === normalized;
  });
  return exact?.value || cleaned;
}

async function loadServiceOptions() {
  const { data } = await API.get('/api/catalog');
  customerState.serviceOptions = (data.services || []).filter((item) => item.label && !looksNumeric(item.label));
  closeServiceSuggestionBox();
  cleanSearchInput();
}

function serviceSuggestionsFor(rawValue = '') {
  const query = normalizeServiceValue(rawValue);
  const pool = customerState.serviceOptions.filter((item) => item.value && !looksNumeric(item.label));
  if (!query) return [];
  return pool
    .filter((item) => normalizeServiceValue(item.label).includes(query) || normalizeServiceValue(item.value).includes(query))
    .slice(0, 8);
}

function renderServiceSuggestionBox(rawValue = byId('searchInput')?.value || '') {
  const box = byId('serviceSuggestionBox');
  if (!box) return;
  const suggestions = serviceSuggestionsFor(rawValue);
  if (!suggestions.length) {
    box.innerHTML = '';
    box.hidden = true;
    return;
  }
  box.innerHTML = suggestions.map((item) => `
    <button type="button" class="service-suggestion-item" data-service-value="${item.label}">${item.label}</button>
  `).join('');
  box.hidden = false;
  box.querySelectorAll('[data-service-value]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = byId('searchInput');
      input.value = button.dataset.serviceValue;
      input.dataset.userEdited = '1';
      box.hidden = true;
      searchStores({ focusResults: true }).catch((error) => showToast(error.message, 'error'));
    });
  });
}

function closeServiceSuggestionBox() {
  const box = byId('serviceSuggestionBox');
  if (box) box.hidden = true;
}

function setupServiceSearch() {
  const input = byId('searchInput');
  if (!input) return;

  // Sadece kullanıcı yazmaya başlayınca öneri göster.
  // Tarayıcının siyah datalist menüsü kapalı; kendi beyaz öneri kutumuz kullanılacak.
  input.removeAttribute('list');
  input.removeAttribute('readonly');

  const showTypedSuggestions = () => {
    cleanSearchInput();
    const value = String(input.value || '').trim();
    if (!value) {
      closeServiceSuggestionBox();
      return;
    }
    renderServiceSuggestionBox(value);
  };

  ['focus', 'click', 'touchstart'].forEach((eventName) => {
    input.addEventListener(eventName, () => {
      if (!String(input.value || '').trim()) closeServiceSuggestionBox();
    }, { passive: eventName === 'touchstart' });
  });

  input.addEventListener('input', (event) => {
    if (looksNumeric(event.target.value)) event.target.value = '';
    event.target.dataset.userEdited = '1';
    showTypedSuggestions();
  });

  input.addEventListener('blur', () => setTimeout(closeServiceSuggestionBox, 180));

  window.addEventListener('pageshow', () => {
    cleanSearchInput();
    closeServiceSuggestionBox();
  });
}


function setupDatePopover() {
  const button = byId('datePickerButton');
  const popover = byId('datePopover');
  const input = byId('dateInput');
  if (!button || !popover || !input) return;

  const closePopover = () => {
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  const openPopover = () => {
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    setTimeout(() => input.showPicker ? input.showPicker() : input.focus(), 10);
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (popover.hidden) openPopover();
    else closePopover();
  });

  input.addEventListener('change', () => {
    setDateButtonLabel();
    closePopover();
    searchStores().catch((error) => showToast(error.message, 'error'));
  });

  byId('clearDateBtn')?.addEventListener('click', () => {
    input.value = '';
    setDateButtonLabel();
    closePopover();
    searchStores().catch((error) => showToast(error.message, 'error'));
  });

  byId('closeDateBtn')?.addEventListener('click', closePopover);

  document.addEventListener('click', (event) => {
    if (!popover.hidden && !popover.contains(event.target) && event.target !== button) {
      closePopover();
    }
  });
}

function updateDistrictHeaders(cityName = selectedCityName()) {
  const eyebrow = byId('districtSectionEyebrow');
  const title = byId('districtSectionTitle');
  if (eyebrow) eyebrow.textContent = `${cityName} ilçeleri`;
  if (title) title.textContent = `${cityName} için direkt geçiş yap`;
}

function searchSummaryText(payload, count) {
  const parts = [];
  parts.push(payload.district || selectedCityName());
  if (payload.q) parts.push(`“${serviceLabel(payload.q)}”`);
  if (payload.date) parts.push(formatDate(payload.date));
  if (payload.time) parts.push(payload.time);
  if (payload.category) parts.push(payload.category);
  return `${parts.join(' · ')} için ${count} salon listeleniyor.`;
}

function attachModalEvents() {
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.close));
  });
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('open');
    });
  });
}

function slotPayload(slot, salon) {
  return {
    id: slot.id,
    salonId: salon.id,
    salonName: salon.name,
    serviceName: slot.service?.name || '',
    staffName: slot.staff?.name || '',
    date: slot.date,
    startTime: slot.startTime,
    price: slot.service?.price || 0
  };
}

function applySelectedVisuals() {
  document.querySelectorAll('[data-category-chip]').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.categoryChip === customerState.selectedCategory);
  });
}

function updateActiveSummary(count) {
  const el = byId('activeSearchSummary');
  if (!el) return;
  el.textContent = searchSummaryText(currentSearchPayload(), count);
}

function renderBookingPreview() {
  const container = byId('customerQuickContent');
  const hint = byId('customerPanelHint');
  const authBtn = byId('openAuthBtn');

  if (!customerState.customer) {
    hint.textContent = 'Giriş yaptıktan sonra yaklaşan randevuların burada görünür.';
    authBtn.textContent = 'Giriş / Kayıt';
    authBtn.onclick = () => openModal('authModal');
    container.innerHTML = '<div class="empty-inline">Henüz giriş yapılmadı.</div>';
    return;
  }

  authBtn.textContent = `${customerState.customer.name.split(' ')[0]} · Çıkış`;
  authBtn.onclick = () => {
    customerState.customer = null;
    Store.remove(CUSTOMER_KEY);
    renderBookingPreview();
    showToast('Çıkış yapıldı.');
  };

  API.get(`/api/customer/dashboard?userId=${customerState.customer.id}`)
    .then(({ data }) => {
      hint.textContent = `${data.user.name} hesabı aktif.`;
      if (!data.bookings.length) {
        container.innerHTML = '<div class="empty-inline">Henüz randevu yok.</div>';
        return;
      }
      container.innerHTML = data.bookings.slice(0, 3).map((booking) => `
        <div class="booking-pill booking-pill-v4">
          <strong>${booking.serviceName}</strong>
          <span>${booking.salonName}</span>
          <span>${formatDate(booking.date)} · ${booking.startTime}</span>
        </div>
      `).join('');
    })
    .catch(() => {
      container.innerHTML = '<div class="empty-inline">Veri alınamadı.</div>';
    });
}

function renderDistrictCloud(items, cityName = selectedCityName()) {
  const container = byId('districtChipList');
  if (!container) return;
  updateDistrictHeaders(cityName);
  container.innerHTML = [`<button class="district-chip district-chip-v4 active" data-district-chip="">Tüm ${cityName}</button>`]
    .concat(items.map((item) => `<button class="district-chip district-chip-v4" data-district-chip="${item.name}">${item.name}</button>`))
    .join('');

  const syncState = () => {
    const current = byId('districtSelect').value || '';
    container.querySelectorAll('[data-district-chip]').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.districtChip === current);
    });
  };

  container.querySelectorAll('[data-district-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      byId('districtSelect').value = chip.dataset.districtChip;
      syncState();
      searchStores({ focusResults: true }).catch((error) => showToast(error.message, 'error'));
    });
  });

  syncState();
}

function timePreviewMarkup(salon) {
  if (!salon.matchingSlotsPreview?.length) return '<div class="slot-pill-row"><span class="slot-pill empty">Açık saat yok</span></div>';
  return `
    <div class="slot-pill-row">
      ${salon.matchingSlotsPreview.map((slot) => `
        <button class="slot-pill slot-pill-v4" data-slot='${JSON.stringify(slotPayload(slot, salon)).replace(/'/g, '&apos;')}'>
          <strong>${slot.startTime}</strong>
        </button>
      `).join('')}
    </div>
  `;
}

function renderResults(results) {
  const container = byId('resultsList');
  if (!container) return;

  if (!results.length) {
    container.innerHTML = '<div class="empty-state wide-empty">Bu filtre için salon bulunamadı. Partner panelinden mağaza, hizmet ve saat ekledikten sonra burada görünür.</div>';
    return;
  }

  container.innerHTML = results.map((salon) => `
    <article class="salon-result-card salon-result-card-v4">
      <div class="salon-image-v4" style="background-image:url('${salon.coverImage}')"></div>
      <div class="salon-content-v4">
        <div class="salon-head-v4">
          <div>
            <div class="result-topline-v4">${salon.district}, ${salon.city}</div>
            <h3>${salon.name}</h3>
          </div>
          <div class="rating-badge-v4">★ ${Number(salon.rating || 0).toFixed(1)}</div>
        </div>

        <p class="result-text result-text-v4">${salon.description}</p>

        <div class="tag-row tag-row-v4">
          ${(salon.categories || []).slice(0, 4).map((item) => `<span class="tag tag-v4">${item}</span>`).join('')}
        </div>

        <div class="salon-meta-v4">
          <span>${salon.reviewCount || 0} yorum</span>
          <span>${salon.matchingSlotCount || salon.openSlotCount || 0} uygun saat</span>
          <span>${salon.nextAvailableSlot ? `${formatDate(salon.nextAvailableSlot.date)} · ${salon.nextAvailableSlot.startTime}` : 'Saat yok'}</span>
        </div>

        <div class="salon-service-strip-v4">
          ${(salon.services || []).slice(0, 3).map((service) => `
            <div class="service-mini-v4">
              <strong>${service.name}</strong>
              <span>${service.duration} dk · ${money(service.price)}</span>
            </div>
          `).join('')}
        </div>

        <div class="salon-actions-v4">
          <div class="time-choice-v4">
            <div class="time-choice-label-v4">Uygun saatler</div>
            ${timePreviewMarkup(salon)}
          </div>
          <div class="result-actions-v4">
            <button class="button secondary detail-btn-v4" data-detail-id="${salon.id}">Detay</button>
            <button class="button dark reserve-btn-v4" data-reserve-id="${salon.id}">Rezervasyon yap</button>
          </div>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-detail-id]').forEach((button) => {
    button.addEventListener('click', () => loadSalonDetail(button.dataset.detailId).catch((error) => showToast(error.message, 'error')));
  });

  container.querySelectorAll('[data-reserve-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const salon = customerState.results.find((item) => item.id === button.dataset.reserveId);
      if (!salon?.matchingSlotsPreview?.length) {
        showToast('Bu filtre için uygun saat yok.', 'error');
        return;
      }
      customerState.selectedSlot = slotPayload(salon.matchingSlotsPreview[0], salon);
      startBookingFlow();
    });
  });

  container.querySelectorAll('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      customerState.selectedSlot = JSON.parse(button.dataset.slot.replace(/&apos;/g, "'"));
      startBookingFlow();
    });
  });
}

function renderFeatured(items) {
  const container = byId('featuredList');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="empty-state wide-empty">Henüz öne çıkan salon yok.</div>';
    return;
  }

  container.innerHTML = items.slice(0, 6).map((salon) => `
    <article class="featured-card featured-card-v4">
      <div class="featured-cover-v4" style="background-image:url('${salon.coverImage}')"></div>
      <div class="featured-body featured-body-v4">
        <div class="featured-topline-v4">${salon.district} · ${salon.city}</div>
        <h3>${salon.name}</h3>
        <p>${salon.category}</p>
        <div class="featured-footer-v4">
          <span>★ ${Number(salon.rating || 0).toFixed(1)}</span>
          <button class="button secondary" data-detail-id="${salon.id}">Detay</button>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-detail-id]').forEach((button) => {
    button.addEventListener('click', () => loadSalonDetail(button.dataset.detailId).catch((error) => showToast(error.message, 'error')));
  });
}

function renderSalonDetail(data) {
  byId('salonModalTitle').textContent = data.name;
  byId('salonModalSubtitle').textContent = `${data.address} · ${data.district} / ${data.city}`;

  byId('salonModalBody').innerHTML = `
    <div class="salon-detail-grid">
      <div class="sheet-card no-padding overflow-hidden">
        <div class="detail-cover" style="background-image:url('${data.coverImage}')"></div>
        <div class="detail-body">
          <div class="tag-row">${data.categories.map((item) => `<span class="tag tag-v4">${item}</span>`).join('')}</div>
          <p class="result-text">${data.description}</p>
        </div>
      </div>
      <div class="stack-16">
        <div class="sheet-card">
          <h4>Hizmetler</h4>
          <div class="info-list compact-list">
            ${data.services.map((service) => `
              <div class="info-row">
                <div>
                  <strong>${service.name}</strong>
                  <div class="muted">${service.duration} dk · ${service.category}</div>
                </div>
                <strong>${money(service.price)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="sheet-card">
          <h4>Açık saatler</h4>
          <div class="detail-slot-grid">
            ${data.slots.length ? data.slots.slice(0, 24).map((slot) => `
              <button class="detail-slot detail-slot-v4" data-slot='${JSON.stringify(slotPayload(slot, data)).replace(/'/g, '&apos;')}'>
                <strong>${slot.startTime}</strong>
                <span>${formatDate(slot.date)}</span>
                <span>${slot.service?.name || ''}</span>
              </button>
            `).join('') : '<div class="empty-state">Açık saat yok.</div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  byId('salonModalBody').querySelectorAll('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      customerState.selectedSlot = JSON.parse(button.dataset.slot.replace(/&apos;/g, "'"));
      closeModal('salonModal');
      startBookingFlow();
    });
  });
}

async function loadSalonDetail(salonId) {
  const { data } = await API.get(`/api/stores/${salonId}`);
  renderSalonDetail(data);
  openModal('salonModal');
}

function startBookingFlow() {
  if (!customerState.selectedSlot) return;
  byId('bookingSummaryText').textContent = `${customerState.selectedSlot.salonName} · ${customerState.selectedSlot.serviceName} · ${formatDate(customerState.selectedSlot.date)} ${customerState.selectedSlot.startTime}`;
  if (!customerState.customer) {
    openModal('authModal');
    showToast('Randevu için önce giriş yap.', 'error');
    return;
  }
  openModal('bookingModal');
}

function setInlineFeedback(targetId, message = '', type = 'error') {
  const el = byId(targetId);
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'inline-feedback';
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `inline-feedback ${type}`;
}

function clearAuthInlineFeedback() {
  setInlineFeedback('loginInlineFeedback');
  setInlineFeedback('registerInlineFeedback');
  setInlineFeedback('forgotInlineFeedback');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function loginCustomer() {
  clearAuthInlineFeedback();
  const email = byId('loginEmail').value.trim();
  const password = byId('loginPassword').value.trim();

  if (!email && !password) {
    setInlineFeedback('loginInlineFeedback', 'Giriş için e-posta ve şifreyi doldur.');
    return;
  }
  if (!email) {
    setInlineFeedback('loginInlineFeedback', 'E-posta alanını doldur.');
    return;
  }
  if (!isValidEmail(email)) {
    setInlineFeedback('loginInlineFeedback', 'Geçerli bir e-posta adresi yaz.');
    return;
  }
  if (!password) {
    setInlineFeedback('loginInlineFeedback', 'Şifre alanını doldur.');
    return;
  }

  try {
    const { user } = await API.post('/api/auth/login', { email, password, role: 'customer' });
    customerState.customer = user;
    Store.set(CUSTOMER_KEY, user);
    closeModal('authModal');
    renderBookingPreview();
    showToast('Giriş başarılı.', 'success');
    if (customerState.selectedSlot) openModal('bookingModal');
  } catch (error) {
    setInlineFeedback('loginInlineFeedback', error.message || 'Giriş yapılamadı.');
  }
}

async function registerCustomer() {
  clearAuthInlineFeedback();
  const name = byId('registerName').value.trim();
  const phone = byId('registerPhone').value.trim();
  const email = byId('registerEmail').value.trim();
  const password = byId('registerPassword').value.trim();
  const legalConsent = byId('registerLegalConsent');

  if (!name || !phone || !email || !password) {
    setInlineFeedback('registerInlineFeedback', 'Kayıt için tüm alanları doldur.');
    return;
  }
  if (!isValidEmail(email)) {
    setInlineFeedback('registerInlineFeedback', 'Geçerli bir e-posta adresi yaz.');
    return;
  }
  if (password.length < 6) {
    setInlineFeedback('registerInlineFeedback', 'Şifre en az 6 karakter olmalı.');
    return;
  }
  if (legalConsent && !legalConsent.checked) {
    setInlineFeedback('registerInlineFeedback', 'Kayıt için sözleşme ve KVKK onayını işaretle.');
    return;
  }

  try {
    const { user } = await API.post('/api/auth/register', { role: 'customer', name, phone, email, password });
    customerState.customer = user;
    Store.set(CUSTOMER_KEY, user);
    closeModal('authModal');
    renderBookingPreview();
    showToast('Kayıt tamamlandı.', 'success');
  } catch (error) {
    setInlineFeedback('registerInlineFeedback', error.message || 'Kayıt tamamlanamadı.');
  }
}

async function confirmBooking() {
  if (!customerState.customer || !customerState.selectedSlot) {
    showToast('Önce giriş yap ve saat seç.', 'error');
    return;
  }
  await API.post('/api/bookings', {
    customerId: customerState.customer.id,
    slotId: customerState.selectedSlot.id,
    notes: byId('bookingNotes').value.trim()
  });
  byId('bookingNotes').value = '';
  customerState.selectedSlot = null;
  closeModal('bookingModal');
  await searchStores();
  renderBookingPreview();
  showToast('Randevu oluşturuldu.', 'success');
}

async function searchStores({ focusResults = false } = {}) {
  const params = new URLSearchParams();
  const payload = currentSearchPayload();
  const resolvedQuery = resolveServiceQuery(payload.q);
  if (resolvedQuery) params.set('q', resolvedQuery);
  if (payload.cityId) params.set('cityId', payload.cityId);
  if (payload.district) params.set('district', payload.district);
  if (payload.date) params.set('date', payload.date);
  if (payload.time) params.set('time', payload.time);
  if (payload.category) params.set('category', payload.category);

  const { data } = await API.get(`/api/stores?${params.toString()}`);
  customerState.results = data;
  renderResults(data);
  updateActiveSummary(data.length);
  byId('todayBookingCount').textContent = data.reduce((sum, item) => sum + (item.matchingSlotCount || item.openSlotCount || 0), 0);
  if (focusResults) {
    (byId('resultsSection') || byId('resultsAnchor'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadFeatured() {
  const cityId = byId('citySelect')?.value || '34';
  const { data } = await API.get(`/api/stores?featured=1&cityId=${cityId}`);
  renderFeatured(data);
}

async function refreshDistrictsAndCloud() {
  const provinceId = Number(byId('citySelect').value || 34);
  await fillDistrictSelect(byId('districtSelect'), provinceId, '', 'Tüm ilçeler');
  const districtResponse = await API.get(`/api/geo/districts?provinceId=${provinceId}`);
  renderDistrictCloud(districtResponse.data, optionText(byId('citySelect')));
}

function bindEvents() {
  byId('searchBtn').addEventListener('click', () => searchStores({ focusResults: true }).catch((error) => showToast(error.message, 'error')));
  byId('loginBtn').addEventListener('click', loginCustomer);
  byId('registerBtn').addEventListener('click', registerCustomer);
  byId('confirmBookingBtn').addEventListener('click', () => confirmBooking().catch((error) => showToast(error.message, 'error')));

  document.querySelectorAll('[data-time-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      byId('dateInput').value = todayLocalDate();
      setDateButtonLabel();
      byId('timeSelect').value = chip.dataset.timeChip;
      searchStores().catch((error) => showToast(error.message, 'error'));
    });
  });

  document.querySelectorAll('[data-query-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      byId('searchInput').value = chip.dataset.queryChip;
      searchStores().catch((error) => showToast(error.message, 'error'));
    });
  });

  document.querySelectorAll('[data-category-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      customerState.selectedCategory = customerState.selectedCategory === chip.dataset.categoryChip ? '' : chip.dataset.categoryChip;
      applySelectedVisuals();
      searchStores().catch((error) => showToast(error.message, 'error'));
    });
  });

  ['districtSelect', 'timeSelect'].forEach((id) => {
    byId(id).addEventListener('change', () => searchStores().catch((error) => showToast(error.message, 'error')));
  });

  byId('searchInput').addEventListener('change', () => {
    cleanSearchInput();
    closeServiceSuggestionBox();
  });

  ['searchInput', 'districtSelect', 'timeSelect', 'citySelect'].forEach((id) => {
    byId(id).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchStores({ focusResults: true }).catch((error) => showToast(error.message, 'error'));
      }
    });
  });

  byId('citySelect').addEventListener('change', async () => {
    await refreshDistrictsAndCloud();
    await Promise.all([loadFeatured(), searchStores()]);
  });
}

async function initPage() {
  attachModalEvents();
  await fillProvinceSelect(byId('citySelect'), 34);
  await fillDistrictSelect(byId('districtSelect'), 34, '', 'Tüm ilçeler');
  await loadServiceOptions();
  await refreshDistrictsAndCloud();
  populateTimeSelect(byId('timeSelect'), 'Saat fark etmez', '');
  byId('dateInput').value = '';
  byId('dateInput').min = todayLocalDate();
  setDateButtonLabel();
  cleanSearchInput();
  setTimeout(cleanSearchInput, 200);
  setTimeout(cleanSearchInput, 1000);
  setupServiceSearch();
  setupDatePopover();
  bindEvents();
  applySelectedVisuals();
  renderBookingPreview();
  await Promise.all([loadFeatured(), searchStores()]);
}


// Randevumhazır 25.04 şifremi unuttum mail bağlantısı
async function requestCustomerPasswordResetFixed() {
  const forgotInput = byId('forgotEmail');
  const loginInput = byId('loginEmail');
  const email = String((forgotInput && forgotInput.value) || (loginInput && loginInput.value) || '').trim();
  if (!email) {
    showToast('E-posta adresini yaz.', 'error');
    return;
  }
  await API.post('/api/auth/forgot-password', { email, role: 'customer' });
  const inlineBox = byId('forgotInlineBox');
  if (inlineBox) inlineBox.hidden = true;
  showToast('Şifre yenileme maili gönderildi. Gelen kutusu ve spam klasörünü kontrol et.', 'success');
}

function bindForgotPasswordFixed() {
  const openBtn = byId('forgotPasswordBtn') || document.querySelector('[data-forgot-password], .forgot-password-btn');
  const sendBtn = byId('sendForgotPasswordBtn') || document.querySelector('[data-send-forgot-password], .send-forgot-password-btn');
  const inlineBox = byId('forgotInlineBox');

  if (openBtn && !openBtn.dataset.fixedBound) {
    openBtn.dataset.fixedBound = '1';
    openBtn.addEventListener('click', () => {
      const forgotInput = byId('forgotEmail');
      const loginInput = byId('loginEmail');
      if (forgotInput && loginInput && loginInput.value && !forgotInput.value) forgotInput.value = loginInput.value;
      if (inlineBox) inlineBox.hidden = !inlineBox.hidden;
      if (forgotInput && inlineBox && !inlineBox.hidden) forgotInput.focus();
    });
  }

  if (sendBtn && !sendBtn.dataset.fixedBound) {
    sendBtn.dataset.fixedBound = '1';
    sendBtn.addEventListener('click', () => requestCustomerPasswordResetFixed().catch((error) => showToast(error.message, 'error')));
  }
}


const originalBindEventsFixed = typeof bindEvents === 'function' ? bindEvents : null;
if (originalBindEventsFixed && !window.__forgotFixedWrapped) {
  window.__forgotFixedWrapped = true;
  bindEvents = function bindEventsWithForgotFixed() {
    originalBindEventsFixed();
    bindForgotPasswordFixed();
  };
}

initPage().catch((error) => showToast(error.message, 'error'));


// Randevumhazır final UI guard - eski yazıları JS tekrar yazarsa geri düzeltir
function applyFinalCustomerUiFixes() {
  const authBtn = byId('openAuthBtn');
  if (authBtn && !customerState.customer) authBtn.textContent = 'Giriş / Kayıt';

  const chipRow = document.querySelector('.filter-chip-row-v4');
  if (chipRow) chipRow.remove();

  const districtSection = document.querySelector('.district-section-v4');
  if (districtSection) districtSection.remove();

  document.querySelectorAll('.modal-header .eyebrow').forEach((el) => {
    if ((el.textContent || '').trim() === 'Müşteri hesabı') el.remove();
  });
  document.querySelectorAll('.modal-title').forEach((el) => {
    if ((el.textContent || '').trim() === 'Giriş yap veya kayıt ol') el.remove();
  });
  document.querySelectorAll('.auth-switch, .auth-footer, .login-switch, .register-switch').forEach((el) => el.remove());
}

const originalRenderBookingPreviewFinalFix = typeof renderBookingPreview === 'function' ? renderBookingPreview : null;
if (originalRenderBookingPreviewFinalFix && !window.__finalUiFixWrapped) {
  window.__finalUiFixWrapped = true;
  renderBookingPreview = function renderBookingPreviewWithFinalFix() {
    const result = originalRenderBookingPreviewFinalFix.apply(this, arguments);
    applyFinalCustomerUiFixes();
    setTimeout(applyFinalCustomerUiFixes, 50);
    setTimeout(applyFinalCustomerUiFixes, 300);
    return result;
  };
}

document.addEventListener('DOMContentLoaded', () => {
  applyFinalCustomerUiFixes();
  setTimeout(applyFinalCustomerUiFixes, 500);
  setTimeout(applyFinalCustomerUiFixes, 1500);
});


// auth form temizleme son fix
function clearCustomerAuthInputsFinal() {
  ['loginEmail', 'loginPassword', 'registerName', 'registerPhone', 'registerEmail', 'registerPassword', 'forgotEmail'].forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.value = '';
    el.defaultValue = '';
    el.setAttribute('autocomplete', 'off');
  });
  const legalConsent = byId('registerLegalConsent');
  if (legalConsent) legalConsent.checked = false;
  const forgotBox = byId('forgotInlineBox');
  if (forgotBox) forgotBox.hidden = true;
}
function forceLegalConsentBlackFinal() {
  document.querySelectorAll('.legal-consent-row, .legal-consent-row span, .legal-consent-row a, .legal-footer-v4 a').forEach((el) => {
    el.style.color = '#111111';
  });
  document.querySelectorAll('.legal-footer-v4 a').forEach((el) => {
    el.style.fontSize = '10px';
    el.style.fontWeight = '400';
  });
}
const originalOpenModalForClearFinal = typeof openModal === 'function' ? openModal : null;
if (originalOpenModalForClearFinal && !window.__authClearFinalWrapped) {
  window.__authClearFinalWrapped = true;
  openModal = function openModalWithAuthClearFinal(id) {
    originalOpenModalForClearFinal(id);
    if (id === 'authModal') {
      clearCustomerAuthInputsFinal();
      setTimeout(clearCustomerAuthInputsFinal, 120);
      setTimeout(clearCustomerAuthInputsFinal, 600);
      setTimeout(forceLegalConsentBlackFinal, 0);
    }
  };
}
const originalCloseModalForClearFinal = typeof closeModal === 'function' ? closeModal : null;
if (originalCloseModalForClearFinal && !window.__authCloseClearFinalWrapped) {
  window.__authCloseClearFinalWrapped = true;
  closeModal = function closeModalWithAuthClearFinal(id) {
    originalCloseModalForClearFinal(id);
    if (id === 'authModal') clearCustomerAuthInputsFinal();
  };
}
document.addEventListener('DOMContentLoaded', () => {
  forceLegalConsentBlackFinal();
  clearCustomerAuthInputsFinal();
  setTimeout(forceLegalConsentBlackFinal, 400);
});


// Randevumhazır service search final guard: siyah tarayıcı menüsünü kapat, önerileri sadece yazınca göster.
function applyServiceSearchFinalGuard() {
  const input = byId('searchInput');
  if (input) {
    input.removeAttribute('list');
    input.removeAttribute('readonly');
  }
  const datalist = byId('serviceSuggestions');
  if (datalist) datalist.remove();
  const box = byId('serviceSuggestionBox');
  if (box && (!input || !String(input.value || '').trim())) box.hidden = true;
}
window.addEventListener('load', applyServiceSearchFinalGuard);
setTimeout(applyServiceSearchFinalGuard, 250);
setTimeout(applyServiceSearchFinalGuard, 1000);
