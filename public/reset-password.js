const params = new URLSearchParams(window.location.search);
const pathToken = window.location.pathname.startsWith('/sifre-yenile/') ? decodeURIComponent(window.location.pathname.split('/sifre-yenile/')[1] || '') : '';
const token = params.get('token') || pathToken || '';
const message = document.getElementById('resetMessage');
const btn = document.getElementById('resetPasswordBtn');

function showResetMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#b42318' : '#067647';
}

btn.addEventListener('click', async () => {
  const password = document.getElementById('newPassword').value.trim();
  const again = document.getElementById('newPasswordAgain').value.trim();
  if (!token) return showResetMessage('Şifre yenileme linki eksik veya hatalı.', true);
  if (password.length < 6) return showResetMessage('Şifre en az 6 karakter olmalı.', true);
  if (password !== again) return showResetMessage('Şifreler aynı değil.', true);

  try {
    await API.post('/api/auth/reset-password', { token, password });
    showResetMessage('Şifren yenilendi. Artık giriş yapabilirsin.');
    setTimeout(() => { window.location.href = '/'; }, 1600);
  } catch (error) {
    showResetMessage(error.message || 'Şifre yenilenemedi.', true);
  }
});
