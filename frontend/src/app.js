import './styles/app.css';
import './styles/dashboard-final.css';
import './styles/dashboard-v5.css';
import './styles/dashboard-v6.css';
import { api, APIError } from './services/api.js';
import { money, dateFmt, initials } from './utils/format.js';
import { createToast } from './components/toast.js';
import { createNavigation } from './components/navigation.js';

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const state = { user: null, products: [], transactions: [], selected: null, balanceVisible: true, returnPage: 'dashboard' };
const showToast = createToast('#toast');

function setUser(user) {
  state.user = user;
  $('#balance').textContent = money(user.balance); $('#miniName').textContent = user.name;
  $('#mainBalanceDetail').textContent = `Rp ${money(user.balance)}`;
  $('#profileName').textContent = user.name; $('#profileNameInput').value = user.name;
  $('#profilePhone').value = user.phone; $('#profileEmail').value = user.email;
  $$('.avatar, .profile-avatar').forEach(el => el.textContent = initials(user.name));
  const first = user.name.split(' ')[0];
  $('#greeting').textContent = `Halo, ${first}`;
}

async function loadApp() {
  const [user, products, transactions] = await Promise.all([api('/api/me'), api('/api/products'), api('/api/transactions')]);
  setUser(user); state.products = products || []; state.transactions = transactions || [];
  renderProducts(); renderRecent(); renderHistory();
}

function resetViewport() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
function showApp() {
  $('#loginView').hidden = true; $('#loginView').classList.add('hidden');
  $('#appView').hidden = false; $('#appView').classList.remove('hidden');
  resetViewport();
}
function showLogin() {
  $('#appView').hidden = true; $('#appView').classList.add('hidden');
  $('#loginView').hidden = false; $('#loginView').classList.remove('hidden');
  resetViewport();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const button = e.currentTarget.querySelector('button[type=submit]');
  button.disabled = true; button.querySelector('span').textContent = 'Sedang masuk...'; $('#loginError').textContent = '';
  try {
    await api('/api/login', { method:'POST', body:JSON.stringify({ Phone:$('#loginPhone').value, Password:$('#loginPassword').value }) });
    await loadApp(); showApp();
  } catch (err) { $('#loginError').textContent = err.message; }
  finally { button.disabled = false; button.querySelector('span').textContent = 'Masuk ke dashboard'; }
});

$('#togglePassword').onclick = () => { const input = $('#loginPassword'); input.type = input.type === 'password' ? 'text' : 'password'; };
$('.google-login').onclick = () => { window.location.assign('/api/auth/google/login'); };
$('#logoutBtn').onclick = async () => { await api('/api/logout', {method:'POST'}); showLogin(); showPage('dashboard', { replace: true }); };
$('#accountLogout').onclick = () => $('#logoutBtn').click();

const showPage = createNavigation();
$('#menuBtn').onclick = () => $('.sidebar').classList.toggle('open');

function providerLetter(name) { return name === 'PLN' ? 'ϟ' : name.charAt(0); }
function providerColor(name) { return state.products.find(p => p.provider === name)?.color || '#178e69'; }
function txRow(tx, detailed = false) {
  if (detailed) return `<div class="history-row"><div><b>${tx.id}</b><br><small>${dateFmt(tx.created_at)}</small></div><div class="history-product"><span class="tx-logo" style="background:${providerColor(tx.provider)}">${providerLetter(tx.provider)}</span><div><b>${tx.product}</b><br><small>${tx.provider}</small></div></div><span>${tx.target}</span><span class="status">${tx.status}</span><strong>Rp ${money(tx.amount)}</strong></div>`;
  return `<div class="tx-row"><span class="tx-logo" style="background:${providerColor(tx.provider)}">${providerLetter(tx.provider)}</span><div class="tx-info"><b>${tx.product}</b><small>${tx.target} · ${tx.provider}</small></div><div class="tx-amount"><b>Rp ${money(tx.amount)}</b><span class="status">${tx.status}</span></div></div>`;
}
function renderRecent() {
  const recent = state.transactions.slice(0, 3);
  $('#recentTransactions').innerHTML = recent.map(x => txRow(x)).join('');
  $('#recentTransactions').closest('.content-row').classList.toggle('hidden', recent.length === 0);
}
function renderHistory() {
  const query = ($('#historySearch')?.value || '').toLowerCase(), status = $('#statusFilter')?.value || '', date = $('#historyDate')?.value || '';
  const list = state.transactions.filter(tx => (!status || tx.status === status) && (!date || String(tx.created_at).slice(0, 10) === date) && JSON.stringify(tx).toLowerCase().includes(query));
  $('#historyTable').innerHTML = list.length
    ? `<div class="history-row header"><span>ID & WAKTU</span><span>PRODUK</span><span>TUJUAN</span><span>STATUS</span><span style="text-align:right">TOTAL</span></div>${list.map(x => txRow(x, true)).join('')}`
    : '<div class="empty-state"><b>Belum ada riwayat transaksi</b><p>Transaksi asli Anda akan muncul di sini.</p></div>';
}
$('#historySearch').addEventListener('input', renderHistory); $('#statusFilter').addEventListener('change', renderHistory); $('#historyDate').addEventListener('change', renderHistory);
$$('[data-history-status]').forEach(btn => btn.onclick = () => { $$('.history-statuses button').forEach(item => item.classList.remove('active')); btn.classList.add('active'); $('#statusFilter').value = btn.dataset.historyStatus; renderHistory(); });

function renderProducts(filter = 'all') {
  const list = state.products.filter(p => filter === 'all' || p.type === filter);
  $('#productGrid').innerHTML = list.map(p => `<button class="product ${state.selected?.id === p.id ? 'selected':''}" data-product="${p.id}"><span class="product-logo" style="background:${p.color}">${providerLetter(p.provider)}</span><small>${p.provider}</small><b>${p.name}</b><strong>Rp ${money(p.price)}</strong></button>`).join('');
  $$('[data-product]').forEach(btn => btn.onclick = () => selectProduct(btn.dataset.product));
}
function selectProduct(id) {
  state.selected = state.products.find(p => p.id === id); renderProducts($('.filter-tabs .active').dataset.filter);
  $('#selectedEmpty').classList.add('hidden'); $('#selectedProduct').classList.remove('hidden');
  $('#selectedLogo').textContent = providerLetter(state.selected.provider); $('#selectedLogo').style.background = state.selected.color;
  $('#selectedName').textContent = state.selected.name; $('#selectedProvider').textContent = state.selected.provider;
  $('#selectedPrice').textContent = `Rp ${money(state.selected.price)}`; $('#targetInput').focus();
}
$$('.filter-tabs button').forEach(btn => btn.onclick = () => { $$('.filter-tabs button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderProducts(btn.dataset.filter); });
$$('.service-card').forEach(btn => btn.onclick = () => {
  const type = btn.dataset.type;
  if (type === 'Lainnya') { showPage('services'); return; }
  state.returnPage = showPage.current();
  showPage('transaction');
  const tab = $(`.filter-tabs [data-filter="${type}"]`);
  if (tab) tab.click();
  else {
    $$('.filter-tabs button').forEach(button => button.classList.remove('active'));
    renderProducts(type);
  }
});
$('#allServices').onclick = () => showPage('services');

$('#payBtn').onclick = async () => {
  const target = $('#targetInput').value.trim(); if (!target) { showToast('Nomor belum diisi', 'Masukkan nomor tujuan atau ID pelanggan.'); return; }
  const btn = $('#payBtn'); btn.disabled = true; btn.firstChild.textContent = 'Memproses... ';
  try {
    const tx = await api('/api/purchase', {method:'POST', body:JSON.stringify({ProductID:state.selected.id, Target:target})});
    state.transactions.unshift(tx); setUser(await api('/api/me')); renderRecent(); renderHistory();
    $('#modalDetail').innerHTML = `<div><span>ID transaksi</span><b>${tx.id}</b></div><div><span>Produk</span><b>${tx.product}</b></div><div><span>Tujuan</span><b>${tx.target}</b></div><div><span>Total</span><b>Rp ${money(tx.amount)}</b></div>`;
    $('#modal').classList.add('show'); $('#targetInput').value = '';
  } catch(err) { showToast('Transaksi gagal', err.message); }
  finally { btn.disabled = false; btn.firstChild.textContent = 'Bayar sekarang '; }
};

$('#closeModal').onclick = () => $('#modal').classList.remove('show');
$('#doneBtn').onclick = () => { $('#modal').classList.remove('show'); showPage(state.returnPage || 'transaction'); };
$('#profileForm').addEventListener('submit', async e => { e.preventDefault(); try { const user = await api('/api/me', {method:'PATCH',body:JSON.stringify({Name:$('#profileNameInput').value,Email:$('#profileEmail').value})}); setUser(user); showToast('Profil tersimpan', 'Informasi akun berhasil diperbarui.'); } catch(err) { showToast('Gagal menyimpan', err.message); } });
$('#hideBalance').onclick = () => { state.balanceVisible = !state.balanceVisible; $('#balance').textContent = state.balanceVisible ? money(state.user.balance) : '••••••••'; $('#mainBalanceDetail').textContent = state.balanceVisible ? `Rp ${money(state.user.balance)}` : 'Rp ••••••••'; };
$('#topupBtn').onclick = () => showToast('Isi saldo', 'Fitur deposit otomatis segera tersedia.');
$('#accountPage #topupBtn').onclick = () => showToast('Isi saldo', 'Fitur deposit otomatis segera tersedia.');
$('#walletTopupBtn').onclick = () => showToast('Isi saldo', 'Fitur deposit otomatis segera tersedia.');

document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('.topbar .search input')?.focus(); } });

(async function boot() {
  try {
    await loadApp(); showApp();
  } catch (err) {
    // A temporary API/catalog error must never throw a signed-in user back to login.
    if (err instanceof APIError && err.status === 401) {
      showLogin();
      return;
    }
    showApp();
    showToast('Koneksi terganggu', 'Halaman tetap dibuka. Tarik untuk memuat ulang saat koneksi stabil.');
  }
})();
