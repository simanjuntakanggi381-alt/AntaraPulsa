import './styles/app.css';
import './styles/dashboard-final.css';
import './styles/dashboard-v5.css';
import './styles/dashboard-v6.css';
import './styles/dashboard-v7.css';
import './styles/dashboard-premium.css';
import './styles/mobile-polish.css';
import './styles/responsive-layout.css';
import './styles/login-polish.css';
import './styles/capital.css';
import './styles/capital-application.css';
import './styles/marketing-capital.css';
import './styles/role-finance.css';
import './styles/network.css';
import './styles/document-review.css';
import './styles/operator.css';
import './styles/operator-credit.css';
import './styles/operator-migration.css';
import './styles/operator-inactive.css';
import './styles/operator-turnover.css';
import './styles/operator-payments.css';
import './styles/balance-polish.css';
import { api, APIError } from './services/api.js';
import { money, dateFmt, initials } from './utils/format.js';
import { createToast } from './components/toast.js';
import { createNavigation } from './components/navigation.js';
import { pdamProviderAssets } from './data/pdam-provider-assets.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const state = { user: null, products: [], transactions: [], selected: null, selectedType: 'Pulsa', selectedProvider: '', electricityMode: 'token', balanceVisible: true, returnPage: 'dashboard' };
const TRANSACTION_DRAFT_KEY = 'antarapulsa-transaction-draft-v1';
const CAPITAL_APPLICATION_KEY = 'antarapulsa-capital-applications-v1';
const CAPITAL_MONITOR_KEY = 'antarapulsa-capital-monitor-v1';
const CAPITAL_PAYMENT_KEY = 'antarapulsa-capital-payments-v1';
const showToast = createToast('#toast');

const appIcons = {
  game: '<path d="M8 7h8a6 6 0 0 1 5.5 8.4l-1.2 2.8a2 2 0 0 1-3.2.7L15 17H9l-2.1 1.9a2 2 0 0 1-3.2-.7l-1.2-2.8A6 6 0 0 1 8 7Z"/><path d="M7 12v4M5 14h4M16.5 12.5h.01M18.5 15h.01"/>',
  ticket: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M13 8.5v1M13 12v1M13 15.5v1"/>',
  phone: '<path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.8 2 2 0 0 1 3.1 1.6h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L7 9.5a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z"/>',
  bill: '<path d="M3 21h18M5 21V9l7-5 7 5v12M8 12h2v2H8zM14 12h2v2h-2zM10 21v-4h4v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  swap: '<path d="m7 7 3-3 3 3M10 4v12M17 17l-3 3-3-3M14 20V8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ledger: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h4M8 16h3M15 14v5M12.5 16.5h5"/>',
  walletPlus: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 9h16M15 13v4M13 15h4"/>',
  capital: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  fees: '<path d="M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7Z"/><path d="M9 12h6"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM18 17h2v3h-3M13 19h2"/>',
  withdraw: '<path d="M4 9h16v11H4zM2 9l10-5 10 5M8 12v5M12 12v5M16 12v5M3 20h18"/>',
  network: '<circle cx="12" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m10 9-2.5 5M14 9l2.5 5M9 17h6"/>',
  guide: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  shield: '<path d="M12 22s8-3.5 8-10V6l-8-3-8 3v6c0 6.5 8 10 8 10Z"/><path d="M12 8v5M12 16h.01"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.3-4A9 9 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'
};
const installIcon = (selector, name) => document.querySelectorAll(selector).forEach(el => { el.classList.add('svg-icon'); el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${appIcons[name]}</svg>`; });
[['.extra-services .service-card:nth-child(1) .service-icon','game'],['.extra-services .service-card:nth-child(2) .service-icon','ticket'],['.extra-services .service-card:nth-child(3) .service-icon','phone'],['.extra-services .service-card:nth-child(4) .service-icon','bill'],['.account-field:nth-child(2)>span','user'],['.account-field:nth-child(3)>span','phone'],['.account-field:nth-child(4)>span','mail'],['.account-menu button:nth-of-type(1) .account-menu-icon','ledger'],['.account-menu .topup-icon','walletPlus'],['.help-card:nth-child(1)>span','guide'],['.help-card:nth-child(2)>span','shield'],['.help-card:nth-child(3)>span','chat']].forEach(([selector,name]) => installIcon(selector,name));

function renderAccountMenu(user) {
  const role = String(user?.level || '').toLowerCase();
  const privileged = role === 'agent' || role === 'marketing';
  const items = privileged
    ? [
        ['capital','Kredit Modal','Pengajuan dan informasi kredit modal','capital'],
        ['ledger','Mutasi Saldo','Riwayat pemasukan dan pengeluaran saldo','balance'],
        ['fees','Fees Retail','Ringkasan fee transaksi retail','fees'],
        ['qr','Topup Saldo','Tambahkan saldo akun AntaraPulsa','topup'],
        ['withdraw','Withdraw Fee','Pencairan fee yang tersedia','withdraw'],
        ['network','Jaringan Retail','Kelola dan pantau jaringan retail','network']
      ]
    : [
        ['ledger','Mutasi saldo','Lihat pemasukan dan pengeluaran saldo','balance'],
        ['walletPlus','Isi saldo','Tambahkan saldo akun AntaraPulsa','topup']
      ];
  $('#accountMenu').innerHTML = `<h2>Menu akun</h2>${items.map(([icon,title,description,action], index) => `<button type="button" data-account-action="${action}" class="account-role-item account-role-item-${index + 1}"><span class="account-menu-icon"></span><div><b>${title}</b><small>${description}</small></div><i>›</i></button>`).join('')}`;
  items.forEach(([icon], index) => installIcon(`.account-role-item-${index + 1} .account-menu-icon`, icon));
  $('#accountMenu').classList.toggle('role-menu', privileged);
}

function setUser(user) {
  state.user = user;
  $('#balance').textContent = money(user.balance); $('#miniName').textContent = user.name;
  const mainBalanceDetail = $('#mainBalanceDetail');
  if (mainBalanceDetail) mainBalanceDetail.textContent = `Rp ${money(user.balance)}`;
  $('#profileName').textContent = user.name; $('#profileNameInput').value = user.name;
  $('#profilePhone').value = user.phone; $('#profileEmail').value = user.email;
  $('#accountHandle').textContent = user.level || 'Agen terpercaya';
  renderAccountMenu(user);
  $$('.avatar, .profile-avatar').forEach(el => el.textContent = initials(user.name));
  const first = user.name.split(' ')[0];
  $('#greeting').textContent = `Halo, ${first}`;
}

async function loadApp() {
  const [user, products, transactions] = await Promise.all([api('/api/me'), api('/api/products'), api('/api/transactions')]);
  setUser(user); state.products = products || []; state.transactions = transactions || []; renderServiceCategories();
  if (location.hash === '#transaction') restoreTransactionDraft();
  else prepareProductFinder('Pulsa');
  renderRecent(); renderHistory();
}

function resetViewport() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
function showApp() {
  $('#loginView').hidden = true; $('#loginView').classList.add('hidden');
  if (String(state.user?.level || '').toLowerCase() === 'operator') {
    $('#appView').hidden = true; $('#appView').classList.add('hidden');
    $('#operatorView').hidden = false; $('#operatorView').classList.remove('hidden');
    $('#operatorName').textContent = state.user?.name || 'Operator AntaraPulsa';
    resetViewport(); return;
  }
  $('#operatorView').hidden = true; $('#operatorView').classList.add('hidden');
  $('#appView').hidden = false; $('#appView').classList.remove('hidden');
  resetViewport();
}
function showLogin() {
  $('#appView').hidden = true; $('#appView').classList.add('hidden');
  $('#operatorView').hidden = true; $('#operatorView').classList.add('hidden');
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
$('#operatorLogout').onclick = () => $('#logoutBtn').click();
$('#operatorMenuToggle').onclick = () => $('.operator-sidebar').classList.toggle('open');
$$('[data-operator-page]').forEach(button => button.onclick = () => {
  const page = button.dataset.operatorPage; $$('[data-operator-page]').forEach(item => item.classList.toggle('active', item.dataset.operatorPage === page)); $('.operator-sidebar').classList.remove('open');
  const dedicatedPage = ['credit', 'migration', 'inactive', 'turnover'].includes(page);
  $('.operator-main').classList.toggle('hidden', dedicatedPage);
  $('#operatorCreditView').classList.toggle('hidden', page !== 'credit');
  $('#operatorMigrationView').classList.toggle('hidden', page !== 'migration');
  $('#operatorInactiveView').classList.toggle('hidden', page !== 'inactive');
  $('#operatorTurnoverView').classList.toggle('hidden', page !== 'turnover');
  if (page === 'credit') syncCreditApplications().then(renderOperatorCredit); else if (page === 'inactive') renderInactiveCounters(); else if (page === 'turnover') syncCreditApplications().then(renderTurnover); else if (!['dashboard', 'migration'].includes(page)) showToast('Menu siap diisi', 'Isi halaman ini dapat dilanjutkan sesuai konsep berikutnya.');
});
$('#addMarketingBtn').onclick = () => showToast('Tambah Marketing', 'Form akun Marketing akan dibuat pada tahap berikutnya.');
$('#operatorCreditMenu').onclick = () => $('.operator-sidebar').classList.toggle('open');
$('#operatorMigrationMenu').onclick = () => $('.operator-sidebar').classList.toggle('open');
$('#operatorInactiveMenu').onclick = () => $('.operator-sidebar').classList.toggle('open');
$('#operatorTurnoverMenu').onclick = () => $('.operator-sidebar').classList.toggle('open');
$('#legacySearchForm').onsubmit = event => {
  event.preventDefault();
  const query = $('#legacyMasterSearch').value.trim();
  if (!query) { showToast('Masukkan data master', 'Isi nama atau email master yang ingin dicari.'); $('#legacyMasterSearch').focus(); return; }
  const result = $('#legacySearchResult');
  result.classList.remove('hidden');
  result.innerHTML = '<b>Master tidak ditemukan</b><p>Belum ada data lama yang cocok dengan pencarian tersebut.</p>';
};

let inactiveDays = 3;
const whatsappLink = phone => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits.startsWith('0') ? `62${digits.slice(1)}` : digits}` : '';
};
async function renderInactiveCounters() {
  const list = $('#inactiveList');
  list.innerHTML = '<div class="inactive-empty"><b>Memuat data konter...</b></div>';
  const query = $('#inactiveSearch').value.trim();
  try {
    const rows = await api(`/api/operator/inactive-counters?days=${inactiveDays}&q=${encodeURIComponent(query)}`);
    $('#inactiveDescription').textContent = `Tidak transaksi minimal ${inactiveDays} hari`;
    $('#inactiveCount').textContent = `${rows.length} konter`;
    list.innerHTML = rows.length ? rows.map(item => {
      const wa = whatsappLink(item.phone);
      const last = item.last_transaction ? dateFmt(item.last_transaction) : 'Belum pernah transaksi';
      return `<article class="inactive-counter"><div><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.email || item.phone)}</small><em>${escapeHTML(item.level)}${wa ? ` · <a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</em><strong>${item.inactive_days ? `Tidak transaksi ${item.inactive_days} hari` : 'Belum pernah transaksi'}</strong><small>Transaksi terakhir: ${escapeHTML(last)}</small></div><aside><span>Saldo</span><b>Rp ${money(item.balance)}</b><span>Tagihan kredit</span><strong>Rp 0</strong></aside></article>`;
    }).join('') : '<div class="inactive-empty"><b>Tidak ada konter tidak transaksi</b><p>Semua konter masih aktif pada periode yang dipilih.</p></div>';
  } catch (error) { list.innerHTML = `<div class="inactive-empty"><b>Data belum dapat dimuat</b><p>${escapeHTML(error.message)}</p></div>`; }
}
$$('[data-inactive-days]').forEach(button => button.onclick = () => { inactiveDays = Number(button.dataset.inactiveDays); $$('[data-inactive-days]').forEach(item => item.classList.toggle('active', item === button)); $('#inactiveCustomDays').value = ''; renderInactiveCounters(); });
$('#applyInactiveDays').onclick = () => { const value = Number($('#inactiveCustomDays').value); if (value < 3 || value > 365) { showToast('Jumlah hari tidak valid', 'Gunakan rentang 3 sampai 365 hari.'); return; } inactiveDays = value; $$('[data-inactive-days]').forEach(item => item.classList.remove('active')); renderInactiveCounters(); };
$('#inactiveFilterForm').onsubmit = event => { event.preventDefault(); renderInactiveCounters(); };
$('#inactiveSearch').oninput = () => { clearTimeout($('#inactiveSearch')._timer); $('#inactiveSearch')._timer = setTimeout(renderInactiveCounters, 350); };
$('#refreshInactive').onclick = renderInactiveCounters;

let turnoverDays = 3;
function renderTurnover() {
  const query = $('#turnoverSearch').value.trim().toLowerCase();
  const rows = getMonitoredApplications().filter(item => ['aktif', 'lunas'].includes(String(item.status).toLowerCase()) && `${item.owner} ${item.shop || ''}`.toLowerCase().includes(query));
  $('#turnoverPeriodLabel').textContent = `Total perputaran ${turnoverDays} hari`;
  $('#turnoverCount').textContent = `${rows.length} konter`;
  $('#turnoverTotal').textContent = 'Rp 0';
  $('#turnoverList').innerHTML = rows.length ? rows.map(item => {
    const wa = whatsappLink(item.whatsapp);
    const paid = Number(item.paid || 0); const remaining = Math.max(0, Number(item.amount || 0) - paid);
    return `<article class="turnover-counter"><header><div><b>${escapeHTML(item.owner)}</b><small>${escapeHTML(item.shop || item.owner)} · ${escapeHTML(item.date || '')}</small>${wa ? `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div><section><span>Transaksi sukses<b>0</b></span><span>Perputaran<b>Rp 0</b></span><span>Rata-rata/hari<b>Rp 0</b></span><span>Dari periode lalu<b>0.00%</b></span></section></header><footer><span>Kredit dicairkan<b>Rp ${money(item.amount)}</b></span><span>Dibayar<b>Rp ${money(paid)}</b></span><span>Sisa kredit<b>Rp ${money(remaining)}</b></span><span>Sisa saldo<b>Rp 0</b></span></footer></article>`;
  }).join('') : '<div class="inactive-empty"><b>Belum ada konter penerima modal</b><p>Konter baru muncul setelah pengajuan disetujui Operator.</p></div>';
}
$$('[data-turnover-days]').forEach(button => button.onclick = () => { turnoverDays=Number(button.dataset.turnoverDays); $$('[data-turnover-days]').forEach(item=>item.classList.toggle('active',item===button)); $('#turnoverCustomDays').value=''; renderTurnover(); });
$('#applyTurnoverDays').onclick = () => { const value=Number($('#turnoverCustomDays').value); if(value<3||value>365){showToast('Jumlah hari tidak valid','Gunakan rentang 3 sampai 365 hari.');return;} turnoverDays=value; $$('[data-turnover-days]').forEach(item=>item.classList.remove('active')); renderTurnover(); };
$('#turnoverSearch').oninput = renderTurnover; $('#refreshTurnover').onclick = renderTurnover;

const showPage = createNavigation();
$('#menuBtn').onclick = () => $('.sidebar').classList.toggle('open');

function providerColor(name) { return state.products.find(p => p.provider === name)?.color || '#178e69'; }
const providerDomains = {
  telkomsel:'telkomsel.com', indosat:'im3.id', im3:'im3.id', axis:'axis.co.id', xl:'xl.co.id', smartfren:'smartfren.com', 'by.u':'byu.id', byu:'byu.id', tri:'tri.co.id', three:'tri.co.id',
  pln:'pln.co.id', dana:'dana.id', ovo:'ovo.id', gopay:'gojek.com', gojek:'gojek.com', shopeepay:'shopeepay.co.id', shopee:'shopee.co.id', linkaja:'linkaja.id', astrapay:'astrapay.com', grab:'grab.com', maxim:'taximaxim.com',
  bca:'bca.co.id', bri:'bri.co.id', bni:'bni.co.id', mandiri:'bankmandiri.co.id', btn:'btn.co.id', bsi:'bankbsi.co.id', cimb:'cimbniaga.co.id', permata:'permatabank.com', danamon:'danamon.co.id', maybank:'maybank.co.id', panin:'panin.co.id', seabank:'seabank.co.id', jago:'jago.com', neocommerce:'bankneo.co.id',
  bpjs:'bpjs-kesehatan.go.id', 'bpjs kesehatan':'bpjs-kesehatan.go.id', 'bpjs ketenagakerjaan':'bpjsketenagakerjaan.go.id',
  indihome:'indihome.co.id', telkom:'telkom.co.id', firstmedia:'firstmedia.com', myrepublic:'myrepublic.co.id', bnetfit:'bnetfit.id', bstation:'bilibili.tv', cbn:'cbn.id', centrin:'centrin.net.id', globalxtreme:'globalxtreme.net', iconnet:'iconnet.id', oxygen:'oxygen.id', transvision:'transvision.co.id', wetv:'wetv.vip', 'xl home':'xlhome.co.id',
  vidio:'vidio.com', garena:'garena.co.id', 'tix id':'tix.id', steam:'steampowered.com', 'mobile legend':'mobilelegends.com', 'free fire':'ff.garena.com', pubg:'pubgmobile.com', roblox:'roblox.com', valorant:'playvalorant.com',
  'acc finance':'acc.co.id', 'adira finance':'adira.co.id', 'aeon cicilan':'aeon.co.id', 'baf':'baf.id', 'bca finance':'bcafinance.co.id', 'bfi finance':'bfi.co.id', 'clipan finance':'clipan.co.id', 'fifgroup':'fifgroup.co.id', 'home credit':'homecredit.co.id', 'indomobil finance':'indomobilfinance.com', 'kredit plus (finansia)':'kreditplus.com', 'mandala finance':'mandalafinance.com', 'mandiri tunas finance':'mtf.co.id', 'mega auto finance':'maf.co.id', 'oto kredit motor':'oto.co.id', 'suzuki finance':'suzukifinance.co.id', 'wom finance':'wom.co.id',
  'prudential':'prudential.co.id', 'ifg life':'ifg-life.id', 'jiwasraya':'jiwasraya.co.id', 'tokio marine':'tokiomarine.com',
  '8 ball pool':'miniclip.com', 'age of empires mobile':'aoemobile.com', 'arena breakout':'arenabreakout.com', 'arena of valor':'arenaofvalor.com', 'black clover m':'bcm.garena.com', 'blood strike':'blood-strike.com', 'call of duty mobile':'callofduty.com', 'crystal of atlan':'coa.nvsgames.com', 'delta force':'playdeltaforce.com', 'dragon raja':'dragonraja.archosaur.com', 'farlight 84':'farlight84.com', 'fc mobile':'ea.com', 'football master 2':'footballmaster2.com', 'genshin impact':'genshin.hoyoverse.com', growtopia:'growtopiagame.com', hago:'hago.me', 'honkai impact 3':'honkaiimpact3.hoyoverse.com', 'honkai star rail':'hsr.hoyoverse.com', 'honor of king':'honorofkings.com', 'identity v':'identityvgame.com', 'lords mobile':'lordsmobile.igg.com', 'magic chess':'magicchessgogo.com', 'marvel rivals':'marvelrivals.com', 'marvel snap':'marvelsnap.com', 'metal slug awakening':'metalslugawk.vnggames.com', 'point blank':'pointblank.id', 'pokemon unite':'unite.pokemon.com', 'racing master':'racingmaster.game', 'sausage man':'sausageman.com', 'speed drifters':'speed.garena.co.id', 'state of survival':'stateofsurvival.com', 'super sus':'supersus.io', undawn:'undawn.garena.com', 'wuthering waves':'wutheringwaves.kurogames.com', 'zenless zone zero':'zenless.hoyoverse.com'
};
const providerAssets = {
  axis:'/assets/providers/provider-axis.png', byu:'/assets/providers/provider-byu.png', smartfren:'/assets/providers/provider-smartfren.png',
  telkomsel:'/assets/providers/provider-telkomsel.png', tri:'/assets/providers/provider-tri.png', three:'/assets/providers/provider-tri.png',
  xl:'/assets/providers/provider-xl.png', xlaxis:'/assets/providers/provider-xl.png',
  kvision:'/assets/streaming/provider-streaming-kvision-symbol.png', nexparabola:'/assets/streaming/provider-streaming-nex-symbol.png',
  vidio:'/assets/streaming/provider-streaming-vidio.png', wetv:'/assets/streaming/provider-streaming-wetv.png',
  canva:'/assets/digital/provider-digital-canva.png', chatgpt:'/assets/digital/provider-digital-chatgpt.png',
  disneyplus:'/assets/digital/provider-digital-disneyplus.png', googleplay:'/assets/digital/provider-digital-googleplay.png',
  tiktok:'/assets/digital/provider-digital-tiktok.png', unipin:'/assets/digital/provider-digital-unipin.png',
  arenaofvalor:'/assets/games/provider-game-arena-of-valor.png', bloodstrike:'/assets/games/provider-game-blood-strike.png',
  callofdutymobile:'/assets/games/provider-game-call-of-duty-symbol.svg', fcmobile:'/assets/games/provider-game-fc-mobile.png',
  freefire:'/assets/games/provider-game-free-fire.png',
  honkaiimpact3:'/assets/games/provider-game-honkai-impact-3.png', honorofkings:'/assets/games/provider-game-honor-of-kings.png',
  leagueoflegends:'/assets/games/provider-game-league-of-legends.svg', minecraft:'/assets/games/provider-game-minecraft-symbol.svg',
  mobilelegend:'/assets/games/provider-game-mobile-legends.png', mobilelegends:'/assets/games/provider-game-mobile-legends.png', pointblank:'/assets/games/provider-game-point-blank.svg',
  pubgmobile:'/assets/games/provider-game-pubg-official.png', roblox:'/assets/games/provider-game-roblox.png',
  steam:'/assets/games/provider-game-steam.png', steamwallet:'/assets/games/provider-game-steam.png', valorant:'/assets/games/provider-game-valorant.svg',
  indosat:'/assets/provider-indosat.png?v=2', im3:'/assets/provider-indosat.png?v=2',
  iconnet:'/assets/provider-iconnet-symbol.png?v=3',
  indihome:'/assets/provider-indihome.svg',
  indovision:'/assets/provider-indovision.png', mncplay:'/assets/provider-mnc-play.png', myrepublik:'/assets/provider-myrepublic.svg',
  telkomvision:'/assets/provider-telkomvision.svg', toptv:'/assets/provider-top-tv.svg', transvision:'/assets/provider-transvision.svg', yestv:'/assets/provider-yes-tv.png',
  pln:'/assets/provider-pln.png',
  pgn:'/assets/provider-pgn.svg',
  brizzi:'/assets/provider-brizzi.png', dana:'/assets/provider-dana.png', emoneymandiri:'/assets/provider-emoney-mandiri.png',
  gopay:'/assets/provider-gopay.png', grab:'/assets/provider-grab.png', isaku:'/assets/provider-isaku.png',
  kaspro:'/assets/provider-kaspro.png', linkaja:'/assets/provider-linkaja.png', maxim:'/assets/provider-maxim.png',
  ovo:'/assets/provider-ovo.png', sakuku:'/assets/provider-sakuku.png', shopeepay:'/assets/provider-shopeepay.png',
  tapcash:'/assets/provider-tapcash.png'
};
const bankProviderKeys = new Set([
  'allobank','bca','bjb','bni','bpdbali','bri','bsi','btn','btpn','bankaceh','bankaladinsyariah','bankarthagraha','bankbanten','bankbengkulu','bankbumiarta','bankctbc','bankcapital','bankchinaconstruction','bankdbs','bankdiy','bankdki','bankganesha','bankhana','bankibk','bankinaperdana','bankindex','bankjago','bankjambi','bankjateng','bankjatim','bankkalbar','bankkalsel','bankkalteng','bankkaltim','banklampung','bankmnc','bankmalukumalut','bankmandiritaspen','bankmaspion','bankmayora','bankmestika','bankntb','bankntt','banknagari','banknobu','bankpapua','bankqnb','bankrayabriagro','bankresonaperdania','bankriaukepri','banksahabatsampoerna','bankshinhan','banksulselbar','banksulteng','banksultra','banksulut','banksumselbabel','banksumut','bankvictoria','bankwoorisaudara','blubcadigital','bukopin','cimbniaga','citibank','commonwealth','danamon','hsbc','hibank','mandiri','maybank','mega','muamalat','neocommerce','ocbcnisp','panin','permata','seabank','sinarmas','superbank','uob'
]);
const bankSymbolAssets = {
  bankaceh:'/assets/banks/symbols/provider-bank-bankaceh-symbol.png',
  bankaladinsyariah:'/assets/banks/symbols/provider-bank-bankaladinsyariah-symbol.png',
  bankdiy:'/assets/banks/symbols/provider-bank-bankdiy-symbol.png',
  bankdki:'/assets/banks/symbols/provider-bank-bankdki-symbol.png'
};
const providerFallbacks = {
  Pulsa:'service-pulsa-3d-compact.png', 'Paket Data':'service-data-3d-compact.png', 'E-Wallet':'service-wallet-3d-compact.png',
  'Token PLN':'service-listrik-3d-compact.png', Listrik:'service-listrik-3d-compact.png', Game:'service-category-14.png',
  'Aktivasi Perdana':'service-category-01.png', 'Masa Aktif':'service-category-02.png', 'Paket Telepon':'service-category-03.png',
  'HP Pascabayar':'service-category-00.png', Pascabayar:'service-category-00.png', 'Transfer Bank':'service-category-05.png', 'Bank Transfer':'service-category-05.png', PDAM:'service-category-09.png', 'Tagihan Air':'service-category-09.png', BPJS:'service-category-10.png', PLN:'service-listrik-3d-compact.png',
  'Internet & TV':'service-category-11.png', 'TV & Streaming':'service-category-15.png', Voucher:'service-category-16.png', 'Voucher Digital':'service-category-16.png'
};
function providerFallback(type) { return `/assets/${providerFallbacks[type] || 'service-lainnya-3d-compact.png'}`; }
function providerDomain(name) {
  const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9. ]/g,'').trim();
  return providerDomains[normalized] || '';
}
function pdamLookupKey(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
    .replace(/^(?:pdam|pam|perumdam|perumda|ptair)/, '')
    .replace(/(?:kabupaten|kab|kota|perusahaan|daerah|airminum|tirta|jateng|jatim|jabar)/g, '');
}
function localProviderAsset(name) {
  const normalized = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  if (pdamProviderAssets[normalized]) return pdamProviderAssets[normalized];
  if (bankSymbolAssets[normalized]) return bankSymbolAssets[normalized];
  if (bankProviderKeys.has(normalized)) return `/assets/banks/provider-bank-${normalized}.svg`;
  if (providerAssets[normalized]) return providerAssets[normalized];
  return '';
}
function providerLogoMarkup(provider, type, className = '') {
  const providerKey = String(provider || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  if (providerKey.includes('biznet') || providerKey.includes('bizznet')) {
    return `<span class="provider-logo-shell provider-logo-biznet ${className}" role="img" aria-label="Biznet"></span>`;
  }
  const domain = providerDomain(provider);
  // Every regional PDAM uses one clear water-utility mark. This keeps the
  // catalogue consistent and avoids a mix of crests and initial placeholders.
  const source = canonicalProductType(type) === 'PDAM'
    ? '/assets/pdam/provider-pdam-generic.png'
    : localProviderAsset(provider) || (domain ? `https://www.google.com/s2/favicons?domain_url=https://${encodeURIComponent(domain)}&sz=128` : '');
  const initials = String(provider || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase();
  if (!source) return `<span class="provider-logo-shell provider-logo-initials ${className}" style="--provider-color:${providerColor(provider)}" role="img" aria-label="${escapeText(provider)}">${escapeText(initials)}</span>`;
  const bankClass = source.includes('/assets/banks/') ? 'provider-logo-bank' : '';
  const tvProviderKeys = ['indovision','mncplay','myrepublik','telkomvision','toptv','transvision','yestv'];
  const providerClass = source.includes('/assets/streaming/') ? 'provider-logo-streaming' : source.includes('provider-game-pubg-official') ? 'provider-logo-game provider-logo-pubg' : source.includes('/assets/games/') ? 'provider-logo-game' : source.includes('/assets/pdam/') ? 'provider-logo-pdam' : providerKey === 'pgn' ? 'provider-logo-pgn' : providerKey.includes('indihome') ? 'provider-logo-indihome' : tvProviderKeys.includes(providerKey) ? 'provider-logo-tv' : '';
  return `<span class="provider-logo-shell ${bankClass} ${providerClass} ${className}" style="--provider-color:${providerColor(provider)}"><img src="${source}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span class="provider-logo-initials-fallback" hidden>${escapeText(initials)}</span></span>`;
}
function txRow(tx, detailed = false) {
  if (detailed) return `<div class="history-row"><div><b>${tx.id}</b><br><small>${dateFmt(tx.created_at)}</small></div><div class="history-product">${providerLogoMarkup(tx.provider,tx.type,'tx-provider-logo')}<div><b>${tx.product}</b><br><small>${tx.provider}</small></div></div><span>${tx.target}</span><span class="status">${tx.status}</span><strong>Rp ${money(tx.amount)}</strong></div>`;
  return `<div class="tx-row">${providerLogoMarkup(tx.provider,tx.type,'tx-provider-logo')}<div class="tx-info"><b>${tx.product}</b><small>${tx.target} · ${tx.provider}</small></div><div class="tx-amount"><b>Rp ${money(tx.amount)}</b><span class="status">${tx.status}</span></div></div>`;
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

function renderProducts(filter = state.selectedType, provider = state.selectedProvider) {
  const list = state.products.filter(p => (filter === 'all' || canonicalProductType(p.type) === canonicalProductType(filter)) && (!provider || productMatchesProvider(p, provider, filter)) && (canonicalProductType(filter) !== 'Token PLN' || (state.electricityMode === 'bill' ? /CEK PLN/i.test(p.name) : /TOKEN/i.test(p.name))));
  $('#productGrid').innerHTML = list.map(p => `<button class="product ${state.selected?.id === p.id ? 'selected':''}" data-product="${p.id}">${providerLogoMarkup(p.provider,p.type,'product-provider-logo')}<small>${escapeText(p.provider)}</small><b>${escapeText(p.name)}</b><strong>${/CEK PLN/i.test(p.name) ? 'Cek tagihan' : p.price_type === 'OPEN_AMOUNT' ? `Isi nominal · admin Rp ${money(p.fee)}` : p.price <= 0 ? 'Harga belum tersedia' : `Rp ${money(p.price)}`}</strong></button>`).join('');
  $$('[data-product]').forEach(btn => btn.onclick = () => selectProduct(btn.dataset.product));
  $('#productResultCount').textContent = `${list.length} produk`;
  $('#productResultsTitle').textContent = provider ? `${filter} ${provider}` : filter;
}

const operatorPrefixes = [
  ['Telkomsel', ['0811','0812','0813','0821','0822','0823','0851','0852','0853']],
  ['Indosat', ['0814','0815','0816','0855','0856','0857','0858']],
  ['XL', ['0817','0818','0819','0859','0877','0878']],
  ['Axis', ['0831','0832','0833','0838']],
  ['Tri', ['0895','0896','0897','0898','0899']],
  ['Smartfren', ['0881','0882','0883','0884','0885','0886','0887','0888','0889']]
];

function normalizedPhone(value) {
  let phone = value.replace(/\D/g, '');
  if (phone.startsWith('62')) phone = `0${phone.slice(2)}`;
  return phone;
}

function detectOperator(value) {
  const phone = normalizedPhone(value);
  return operatorPrefixes.find(([, prefixes]) => prefixes.some(prefix => phone.startsWith(prefix)))?.[0] || '';
}

function availableProviders(type) {
  const canonicalType = canonicalProductType(type);
  return [...new Set(state.products
    .filter(product => canonicalProductType(product.type) === canonicalType)
    .map(product => product.provider)
    .filter(provider => !(canonicalType === 'Pulsa' && provider.toLowerCase() === 'xl/axis'))
    .filter(provider => !(canonicalType === 'Game' && provider.toLowerCase() === 'garena')))]
    .sort((a, b) => a.localeCompare(b, 'id'));
}

// XL/Axis is one shared upstream brand, not a third mobile operator. Keep all
// 40 real H2HR SKUs visible inside both operator pages without a duplicate card.
function productMatchesProvider(product, provider, type) {
  if (product.provider === provider) return true;
  return canonicalProductType(type) === 'Pulsa'
    && product.provider.toLowerCase() === 'xl/axis'
    && ['xl', 'axis'].includes(provider.toLowerCase());
}

function canonicalProductType(type) {
  const normalized = String(type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'listrik' || normalized === 'tokenpln' || normalized === 'pln') return 'Token PLN';
  if (normalized === 'rtol' || normalized === 'banktransfer') return 'Transfer Bank';
  if (normalized === 'tagihanair') return 'PDAM';
  if (normalized === 'tagihangas') return 'Gas';
  if (normalized === 'pajakdaerah' || normalized === 'samsat') return 'Pajak';
  if (normalized === 'pascabayar') return 'HP Pascabayar';
  if (normalized === 'internettelco') return 'Internet & TV';
  if (normalized === 'emoney') return 'E-Wallet';
  if (normalized === 'pembayaran') return 'PPOB';
  if (normalized === 'tv' || normalized === 'tvstreaming') return 'TV & Streaming';
  return String(type || 'Lainnya');
}

function matchingAvailableProvider(provider) {
  return availableProviders(state.selectedType).find(item => item.toLowerCase() === provider.toLowerCase()) || '';
}

function transactionInputConfig(type) {
  if (['Pulsa','Paket Data','HP Pascabayar','Masa Aktif','Paket Telepon'].includes(type)) {
    return { label:'Nomor handphone', prefix:'+62', placeholder:'Contoh: 081234567890', autocomplete:'tel' };
  }
  if (type === 'E-Wallet') return { label:'Nomor E-Wallet', prefix:'HP', placeholder:'Masukkan nomor e-wallet aktif', autocomplete:'tel' };
  if (type === 'Token PLN') return { label:'Nomor meter / ID pelanggan', prefix:'ID', placeholder:'Masukkan nomor meter atau ID pelanggan', autocomplete:'off' };
  if (type === 'Game') return { label:'User ID / Zone ID', prefix:'ID', placeholder:'Masukkan user ID tujuan', autocomplete:'off' };
  if (canonicalProductType(type) === 'Transfer Bank') return { label:'Nomor rekening tujuan', prefix:'BANK', placeholder:'Masukkan nomor rekening sesuai bank yang dipilih', autocomplete:'off' };
  return { label:'Nomor tujuan / ID pelanggan', prefix:'ID', placeholder:'Masukkan nomor atau ID tujuan', autocomplete:'off' };
}

function hideProductSelection() {
  $('#productResults').classList.add('hidden');
  state.selected = null;
  $('.checkout-card').classList.add('hidden');
  $('#selectedProduct').classList.add('hidden');
  $('#selectedEmpty').classList.add('hidden');
}

function readTransactionDraft() {
  try { return JSON.parse(sessionStorage.getItem(TRANSACTION_DRAFT_KEY) || 'null'); }
  catch { return null; }
}

function saveTransactionDraft() {
  sessionStorage.setItem(TRANSACTION_DRAFT_KEY, JSON.stringify({
    type: state.selectedType,
    provider: state.selectedProvider,
    target: $('#targetInput').value,
    productsVisible: !$('#productResults').classList.contains('hidden')
  }));
}

function restoreTransactionDraft() {
  const draft = readTransactionDraft();
  prepareProductFinder(draft?.type || 'Pulsa');
  if (!draft) return;
  // PDAM must always reopen on the searchable provider catalogue. Restoring
  // the previous provider skips the first step and makes an old area look
  // permanently selected after a refresh or a new login.
  if (canonicalProductType(state.selectedType) === 'PDAM') {
    $('#targetInput').value = '';
    updateProviderDetection('');
    renderProviderChoices();
    saveTransactionDraft();
    return;
  }
  $('#targetInput').value = draft.target || '';
  const provider = availableProviders(state.selectedType).find(item => item.toLowerCase() === String(draft.provider || '').toLowerCase()) || '';
  updateProviderDetection(provider);
  if (draft.productsVisible && provider && draft.target) {
    $('#productResults').classList.remove('hidden');
    renderProducts(state.selectedType, provider);
  }
  saveTransactionDraft();
}

function updateProviderDetection(provider = '') {
  state.selectedProvider = provider;
  const pdamFlow = canonicalProductType(state.selectedType) === 'PDAM';
  $('.product-finder').classList.toggle('pdam-provider-first', pdamFlow);
  $('.product-finder').classList.toggle('pdam-provider-selected', pdamFlow && !!provider);
  $('#detectedProvider').innerHTML = pdamFlow && provider ? `${providerLogoMarkup(provider,state.selectedType,'pdam-selected-logo')}<span><strong>${escapeText(provider)}</strong><em>Masukkan nomor pelanggan untuk cek tagihan air</em></span>` : escapeText(provider || 'Pilih provider di atas');
  if (pdamFlow && provider) $('#targetLabel').before($('.provider-detection'));
  $('#providerIndicator').innerHTML = provider ? providerLogoMarkup(provider,state.selectedType,'indicator-provider-logo') : '?';
  $('#detectionStatus').textContent = pdamFlow && provider ? 'Ganti provider' : provider ? 'Terpilih' : (['Pulsa','Paket Data'].includes(state.selectedType) ? 'Deteksi prefix' : 'Pilih manual');
  $$('#providerChoices button').forEach(button => button.classList.toggle('active', button.dataset.provider === provider));
  hideProductSelection();
  saveTransactionDraft();
}

$('#detectionStatus').onclick = () => {
  if (canonicalProductType(state.selectedType) === 'PDAM' && state.selectedProvider) {
    updateProviderDetection('');
    renderProviderChoices();
    $('#providerSearch').focus();
  }
};

function renderProviderChoices(query = '') {
  const providers = availableProviders(state.selectedType);
  const needle = String(query).trim().toLocaleLowerCase('id');
  const visible = needle ? providers.filter(provider => provider.toLocaleLowerCase('id').includes(needle)) : providers;
  $('#providerCount').textContent = needle ? `${visible.length} dari ${providers.length}` : `${providers.length} provider`;
  $('#providerChoices').innerHTML = visible.length
    ? visible.map(provider => {
      const total = state.products.filter(product => canonicalProductType(product.type) === canonicalProductType(state.selectedType) && productMatchesProvider(product, provider, state.selectedType)).length;
      const pdamArrow = canonicalProductType(state.selectedType) === 'PDAM' ? '<i class="pdam-provider-arrow" aria-hidden="true">›</i>' : '';
      return `<button type="button" class="${state.selectedProvider === provider ? 'active' : ''}" data-provider="${escapeText(provider)}">${providerLogoMarkup(provider,state.selectedType,'picker-provider-logo')}<b>${escapeText(provider)}</b><small>${total} produk</small>${pdamArrow}</button>`;
    }).join('')
    : '<p class="provider-empty">Provider tidak ditemukan.</p>';
  $$('#providerChoices button').forEach(button => button.onclick = () => {
    updateProviderDetection(button.dataset.provider);
    $('#targetInput').focus();
  });
}

function prepareProductFinder(type) {
  state.selectedType = type || 'Pulsa';
  state.selected = null;
  state.selectedProvider = '';
  $$('.filter-tabs button').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === state.selectedType));
  const heading = $('#transactionPage .simple-head h1');
  if (heading) heading.textContent = state.selectedType;
  $('#electricityModes').classList.toggle('hidden', canonicalProductType(state.selectedType) !== 'Token PLN');
  const pdamFlow = canonicalProductType(state.selectedType) === 'PDAM';
  const providerHead = $('.provider-picker-head');
  if (pdamFlow) {
    $('#electricityModes').after(providerHead, $('#providerSearch'), $('#providerChoices'), $('#targetLabel'), $('.finder-input'), $('.provider-detection'));
    $('.provider-choice-label').textContent = '1 · CARI & PILIH PDAM';
    $('#showProductsBtn span').textContent = 'Cek Tagihan';
    $('#providerSearch').placeholder = 'Cari nama PDAM atau daerah';
    $('#providerSearch').setAttribute('aria-label', 'Cari nama PDAM atau daerah');
    if (heading) heading.textContent = 'Cari PDAM';
    $('#transactionPage .simple-head p').textContent = 'Pilih daerah dari katalog H2HR, lalu masukkan ID pelanggan.';
  } else {
    providerHead.before($('#targetLabel'), $('.finder-input'), $('.provider-detection'));
    $('#providerSearch').placeholder = 'Cari nama provider';
    $('#providerSearch').setAttribute('aria-label', 'Cari nama provider');
    $('.provider-choice-label').textContent = '2 · PILIH PROVIDER';
    $('#showProductsBtn span').textContent = '3 · Lihat produk tersedia';
    $('#transactionPage .simple-head p').textContent = 'Masukkan nomor tujuan terlebih dahulu, lalu pilih provider dan produk yang tersedia.';
  }
  const inputConfig = transactionInputConfig(state.selectedType);
  $('#targetLabel').textContent = `1 · ${inputConfig.label}`;
  $('#targetPrefix').textContent = inputConfig.prefix;
  $('#targetInput').placeholder = inputConfig.placeholder;
  $('#targetInput').autocomplete = inputConfig.autocomplete;
  if (pdamFlow) {
    $('#targetLabel').textContent = '2 · ID pelanggan PDAM';
    $('#targetInput').placeholder = 'Masukkan nomor pelanggan PDAM';
  }
  $('#providerSearch').value = '';
  hideProductSelection();
  $('#targetInput').value = '';
  renderProviderChoices();
  updateProviderDetection('');
  saveTransactionDraft();
}

function openTransaction(type) {
  state.returnPage = showPage.current();
  showPage('transaction');
  prepareProductFinder(type);
  setTimeout(() => (canonicalProductType(type) === 'PDAM' ? $('#providerSearch') : $('#targetInput')).focus(), 0);
}

const serviceSymbols = {
  pulsa: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 5h4M10 18.5h4"/>',
  data: '<path d="M5 12.5a10 10 0 0 1 14 0M8 16a5.8 5.8 0 0 1 8 0M11 19.5a1.5 1.5 0 0 1 2 0"/>',
  wallet: '<path d="M4 7h15a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12M16 12h5"/><circle cx="16" cy="12" r=".8"/>',
  power: '<path d="m13.5 2-8 12h6L10.5 22l8-12h-6z"/>',
  game: '<path d="M8 7h8a6 6 0 0 1 5.5 8.4l-1.2 2.8a2 2 0 0 1-3.2.7L15 17H9l-2.1 1.9a2 2 0 0 1-3.2-.7l-1.2-2.8A6 6 0 0 1 8 7Z"/><path d="M7 12v4M5 14h4M16.5 12.5h.01M18.5 15h.01"/>',
  ticket: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M13 8.5v1M13 12v1M13 15.5v1"/>',
  bill: '<path d="M3 21h18M5 21V9l7-5 7 5v12M8 12h2v2H8zM14 12h2v2h-2zM10 21v-4h4v4"/>',
  shield: '<path d="M12 21s8-3.5 8-10V5l-8-3-8 3v6c0 6.5 8 10 8 10Z"/><path d="m8.5 11.5 2.2 2.2 4.8-5"/>',
  water: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M9 16a3 3 0 0 0 3 2"/>',
  tv: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m9 2 3 3 3-3M9 15l6-3-6-3z"/>',
  phone: '<path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.8 2 2 0 0 1 3.1 1.6h3a2 2 0 0 1 2 1.7"/>',
  sim: '<path d="M7 2h8l4 4v16H5V4a2 2 0 0 1 2-2Z"/><path d="M9 10h6v7H9zM12 10v7M9 13.5h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h3M8 17h6"/>',
  bank: '<path d="m3 9 9-6 9 6M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18"/>',
  heart: '<path d="M12 21S3 16 3 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 2.5C21 16 12 21 12 21Z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
  flame: '<path d="M13 2s1 4-2 6c-2-3-5-2-5 3a6 6 0 1 0 12 0c0-4-2-7-5-9Z"/><path d="M12 12c2 2 2 5 0 7-3-1-4-5 0-7Z"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="2"/><rect x="14" y="4" width="6" height="6" rx="2"/><rect x="4" y="14" width="6" height="6" rx="2"/><rect x="14" y="14" width="6" height="6" rx="2"/>'
};

function serviceSymbol(category) {
  const value = category.toLowerCase();
  if (value.includes('pulsa')) return serviceSymbols.pulsa;
  if (value.includes('data') || value.includes('internet')) return serviceSymbols.data;
  if (value.includes('wallet') || value.includes('money')) return serviceSymbols.wallet;
  if (value.includes('pln') || value.includes('listrik')) return serviceSymbols.power;
  if (value.includes('game')) return serviceSymbols.game;
  if (value.includes('voucher')) return serviceSymbols.ticket;
  if (value.includes('bpjs') || value.includes('asuransi')) return serviceSymbols.shield;
  if (value.includes('pdam') || value.includes('air')) return serviceSymbols.water;
  if (value.includes('tv') || value.includes('stream')) return serviceSymbols.tv;
  if (value.includes('aktivasi') || value.includes('perdana')) return serviceSymbols.sim;
  if (value.includes('masa aktif')) return serviceSymbols.calendar;
  if (value.includes('transfer') || value.includes('bank')) return serviceSymbols.bank;
  if (value.includes('donasi') || value.includes('zakat')) return serviceSymbols.heart;
  if (value.includes('gas')) return serviceSymbols.flame;
  if (value.includes('telepon') || value.includes('sms')) return serviceSymbols.phone;
  if (value.includes('ppob') || value.includes('tagihan') || value.includes('pajak')) return serviceSymbols.bill;
  const initials = category.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'AP';
  return `<rect x="3" y="3" width="18" height="18" rx="6"/><text x="12" y="15" text-anchor="middle">${initials}</text>`;
}

function escapeText(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function serviceCategoryVisual(service) {
  if (Number.isInteger(service.sprite)) {
    const filename = String(service.sprite).padStart(2, '0');
    return `<span class="service-category-logo service-category-logo-3d"><img src="/assets/service-category-${filename}.png" alt="" width="44" height="44" loading="lazy" decoding="async"></span>`;
  }
  return `<span class="service-category-logo"><svg viewBox="0 0 24 24" aria-hidden="true">${serviceSymbol(service.label)}</svg></span>`;
}

function renderServiceCategories() {
  const grid = $('#allServiceGrid');
  if (!grid) return;
  const counts = state.products.reduce((out, product) => {
    const category = canonicalProductType(product.type);
    out[category] = (out[category] || 0) + 1;
    return out;
  }, {});
  const dashboardServices = new Set(['Pulsa', 'Paket Data', 'E-Wallet', 'Token PLN']);
  const serviceGroups = [
    { title:'Komunikasi', services:[
      { label:'HP Pascabayar', category:'HP Pascabayar', sprite:0 }, { label:'Aktivasi Perdana', category:'Aktivasi Perdana', sprite:1 },
      { label:'Masa Aktif', category:'Masa Aktif', sprite:2 }, { label:'Paket Telepon', category:'Paket Telepon', sprite:3 }
    ]},
    { title:'Keuangan', services:[
      { label:'Asuransi', category:'Asuransi', sprite:4 }, { label:'Transfer Bank', category:'Transfer Bank', sprite:5 },
      { label:'Donasi & Zakat', category:'Donasi & Zakat', sprite:6 }, { label:'Multifinance', category:'Multifinance', sprite:7 }
    ]},
    { title:'Rumah Tangga', services:[
      { label:'Gas Negara', category:'Gas', sprite:8 }, { label:'PDAM', category:'PDAM', sprite:9 },
      { label:'BPJS', category:'BPJS', sprite:10 }, { label:'Internet & TV', category:'Internet & TV', sprite:11 },
      { label:'Pajak', category:'Pajak', sprite:12 }, { label:'PPOB', category:'PPOB', sprite:13 }
    ]},
    { title:'Hiburan', services:[
      { label:'Top Up Game', category:'Game', sprite:14 }, { label:'TV & Streaming', category:'TV & Streaming', sprite:15 },
      { label:'Voucher Digital', category:'Voucher Digital', sprite:16 }
    ]},
    { title:'Transportasi', services:[
      { label:'Transportasi', category:'Transportasi', sprite:17 }, { label:'Tiket', category:'Tiket', sprite:18 }, { label:'E-Toll', category:'E-Toll', sprite:19 }
    ]},
    { title:'Layanan Publik', services:[
      { label:'Pendidikan', category:'Pendidikan', sprite:20 }, { label:'Kesehatan', category:'Kesehatan', sprite:21 }
    ]}
  ];
  const declared = new Set(serviceGroups.flatMap(group => group.services.map(service => service.category)));
  const extras = Object.keys(counts)
    .filter(category => !dashboardServices.has(category) && !declared.has(category))
    .sort((a,b) => a.localeCompare(b,'id'))
    .map(category => ({ label:category, category }));
  if (extras.length) serviceGroups.push({ title:'Layanan Lainnya', services:extras });
  const activeGroups = serviceGroups
    .map(group => ({ ...group, services: group.services.filter(service => (counts[service.category] || 0) > 0) }))
    .filter(group => group.services.length > 0);
  grid.innerHTML = activeGroups.map(group => `<section class="service-group"><div class="service-group-head"><h2>${group.title}</h2><span>${group.services.length} layanan</span></div><div class="service-group-grid">${group.services.map(service => `<button class="service-category-card" data-service-category="${escapeText(service.category)}">${serviceCategoryVisual(service)}<b>${escapeText(service.label)}</b><small>${counts[service.category]} produk</small></button>`).join('')}</div></section>`).join('');
  $$('[data-service-category]', grid).forEach(button => button.onclick = () => openTransaction(button.dataset.serviceCategory));
}
$('.filter-tabs').insertAdjacentHTML('beforebegin', '<div id="electricityModes" class="electricity-modes hidden"><button type="button" class="active" data-electricity-mode="token"><b>⚡ Beli Token Listrik</b><small>Isi token prabayar PLN</small></button><button type="button" data-electricity-mode="bill"><b>▤ Bayar Tagihan PLN</b><small>Cek tagihan pascabayar</small></button></div>');
const providerPickerHead = $('.provider-picker-head');
providerPickerHead.before($('#targetLabel'), $('.finder-input'), $('.provider-detection'));
$('.provider-choice-label').textContent = '2 · PILIH PROVIDER';
$('#transactionPage .simple-head p').textContent = 'Masukkan nomor tujuan terlebih dahulu, lalu pilih provider dan produk yang tersedia.';
$$('[data-electricity-mode]').forEach(button => button.onclick = () => { state.electricityMode = button.dataset.electricityMode; $$('[data-electricity-mode]').forEach(item => item.classList.toggle('active', item === button)); state.selectedProvider = 'PLN'; hideProductSelection(); updateProviderDetection('PLN'); $('#targetLabel').textContent = '1 · Nomor meter / ID pelanggan PLN'; $('#showProductsBtn span').textContent = state.electricityMode === 'bill' ? '3 · Cek tagihan PLN' : '3 · Lihat token tersedia'; });
$('#selectedProduct .price-row').insertAdjacentHTML('beforebegin', '<label id="openAmountRow" class="open-amount-row hidden" for="openAmountInput"><span>Nominal transaksi (Rp)</span><input id="openAmountInput" type="number" inputmode="numeric" min="1" max="1000000000" step="1" placeholder="Masukkan nominal"></label>');
const isPLNInquiry = product => /CEK PLN/i.test(product?.name || '');
function updateCheckoutAmount() {
  if (!state.selected) return;
  const openAmount = state.selected.price_type === 'OPEN_AMOUNT';
  const qty = Number($('#openAmountInput').value);
  const validQty = Number.isSafeInteger(qty) && qty > 0 && qty <= 1_000_000_000;
  const inquiry = isPLNInquiry(state.selected);
  const unavailable = inquiry ? false : openAmount ? !validQty : state.selected.price <= 0;
  $('#selectedPrice').textContent = inquiry ? 'Cek tagihan tanpa potong saldo' : openAmount ? (validQty ? `Rp ${money(qty + state.selected.fee)} (termasuk admin Rp ${money(state.selected.fee)})` : 'Isi nominal untuk melihat total') : unavailable ? 'Harga belum tersedia' : `Rp ${money(state.selected.price)}`;
  $('#payBtn').disabled = unavailable;
  $('#payBtn').firstChild.textContent = inquiry ? 'Cek Tagihan PLN ' : unavailable ? (openAmount ? 'Isi nominal dahulu ' : 'Harga belum tersedia ') : 'Lanjut Pembayaran ';
}
$('#openAmountInput').addEventListener('input', updateCheckoutAmount);
function selectProduct(id) {
  state.selected = state.products.find(p => p.id === id);
  renderProducts(state.selectedType, state.selectedProvider);
  $('.checkout-card').classList.remove('hidden');
  $('#selectedEmpty').classList.add('hidden'); $('#selectedProduct').classList.remove('hidden');
  $('#selectedLogo').innerHTML = providerLogoMarkup(state.selected.provider,state.selected.type,'selected-provider-logo'); $('#selectedLogo').style.background = 'transparent';
  $('#selectedName').textContent = state.selected.name; $('#selectedProvider').textContent = state.selected.provider;
  const openAmount = state.selected.price_type === 'OPEN_AMOUNT';
  $('#openAmountRow').classList.toggle('hidden', !openAmount);
  $('#openAmountInput').value = '';
  updateCheckoutAmount();
  $('#checkoutTarget').textContent = $('#targetInput').value.trim();
  $('.checkout-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
}
$$('.filter-tabs button').forEach(btn => btn.onclick = () => prepareProductFinder(btn.dataset.filter));
$$('.service-card').forEach(btn => btn.onclick = () => {
  const type = btn.dataset.type;
  if (type === 'Lainnya') { showPage('services'); return; }
  openTransaction(type);
});
$('#allServices').onclick = () => showPage('services');

$('#targetInput').addEventListener('input', event => {
  if (['Pulsa','Paket Data'].includes(state.selectedType)) {
    const detected = matchingAvailableProvider(detectOperator(event.target.value));
    if (detected) updateProviderDetection(detected);
    else saveTransactionDraft();
  } else saveTransactionDraft();
});

$('#providerSearch').addEventListener('input', event => renderProviderChoices(event.target.value));

$('#showProductsBtn').onclick = () => {
  const target = $('#targetInput').value.trim();
  if (!target) { showToast('Tujuan belum diisi', 'Masukkan nomor tujuan atau ID pelanggan terlebih dahulu.'); return; }
  if (!state.selectedProvider) { showToast('Provider belum dipilih', 'Pilih salah satu provider yang tersedia.'); return; }
  $('#productResults').classList.remove('hidden');
  renderProducts(state.selectedType, state.selectedProvider);
  saveTransactionDraft();
  $('#productResults').scrollIntoView({ behavior:'smooth', block:'start' });
};

document.body.insertAdjacentHTML('beforeend', `<div id="checkoutSheet" class="checkout-sheet hidden" role="dialog" aria-modal="true" aria-labelledby="checkoutSheetTitle"><div class="checkout-sheet-card"><div class="checkout-sheet-head"><div><small>CHECKOUT</small><h2 id="checkoutSheetTitle">Konfirmasi pembelian</h2></div><button id="closeCheckoutSheet" type="button" aria-label="Tutup checkout">×</button></div><div id="checkoutSheetDetails" class="checkout-sheet-details"></div><label class="checkout-sheet-label" for="checkoutSheetTarget">Nomor tujuan / ID pelanggan</label><input id="checkoutSheetTarget" class="checkout-sheet-target" autocomplete="off"><p id="checkoutSheetWarning" class="checkout-sheet-warning hidden"></p><button id="confirmPayBtn" class="primary-btn" type="button">Bayar</button><button id="checkoutTopupBtn" class="primary-btn hidden" type="button">Isi saldo dahulu</button><p class="checkout-sheet-note">Transaksi diproses melalui Pulsa24Jam. Pembayaran tidak dikirim ulang otomatis.</p></div></div>`);
function checkoutTotal() {
  return state.selected?.price_type === 'OPEN_AMOUNT' ? Number($('#openAmountInput').value) + Number(state.selected.fee || 0) : Number(state.selected?.price || 0);
}
function refreshCheckoutSheet() {
  if (!state.selected) return;
  const product = state.selected;
  const total = checkoutTotal();
  const balance = Number(state.user?.balance || 0);
  const shortfall = Math.max(0, total - balance);
  const rows = [
    ['Produk', product.name],
    ...(product.price_type === 'OPEN_AMOUNT' ? [['Nominal', `Rp ${money(Number($('#openAmountInput').value))}`], ['Fee admin', `Rp ${money(product.fee)}`]] : [['Harga', `Rp ${money(product.price)}`]]),
    ['Saldo utama', `Rp ${money(balance)}`],
    ['Total bayar', `Rp ${money(total)}`],
  ];
  $('#checkoutSheetTitle').textContent = product.name;
  $('#checkoutSheetDetails').innerHTML = rows.map(([label,value]) => `<div><span>${escapeText(label)}</span><b>${escapeText(value)}</b></div>`).join('');
  $('#checkoutSheetWarning').textContent = shortfall ? `Saldo kurang Rp ${money(shortfall)}. Isi saldo untuk melanjutkan pembelian.` : '';
  $('#checkoutSheetWarning').classList.toggle('hidden', !shortfall);
  $('#confirmPayBtn').classList.toggle('hidden', !!shortfall);
  $('#checkoutTopupBtn').classList.toggle('hidden', !shortfall);
}
function closeCheckoutSheet() { $('#checkoutSheet').classList.add('hidden'); }
$('#closeCheckoutSheet').onclick = closeCheckoutSheet;
$('#checkoutSheet').onclick = event => { if (event.target.id === 'checkoutSheet') closeCheckoutSheet(); };
$('#checkoutTopupBtn').onclick = () => { closeCheckoutSheet(); showPage('topup'); };
$('#payBtn').onclick = () => {
  if (!state.selected) return;
  const openAmount = state.selected.price_type === 'OPEN_AMOUNT';
  const qty = openAmount ? Number($('#openAmountInput').value) : 0;
  if (!isPLNInquiry(state.selected) && (openAmount ? !Number.isSafeInteger(qty) || qty <= 0 || qty > 1_000_000_000 : state.selected.price <= 0)) return;
  const target = $('#targetInput').value.trim(); if (!target) { showToast('Nomor belum diisi', 'Masukkan nomor tujuan atau ID pelanggan.'); return; }
  $('#checkoutSheetTarget').value = target;
  refreshCheckoutSheet();
  $('#checkoutSheet').classList.remove('hidden');
};
$('#confirmPayBtn').onclick = async () => {
  if (!state.selected) return;
  const qty = state.selected.price_type === 'OPEN_AMOUNT' ? Number($('#openAmountInput').value) : 0;
  const target = $('#checkoutSheetTarget').value.trim();
  if (!target) { showToast('Tujuan belum diisi', 'Masukkan nomor tujuan atau ID pelanggan.'); return; }
  if (checkoutTotal() > Number(state.user?.balance || 0)) { refreshCheckoutSheet(); return; }
  const btn = $('#confirmPayBtn'); btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    if (isPLNInquiry(state.selected)) {
      const result = await api('/api/h2hr/inquiry', {method:'POST', body:JSON.stringify({ProductID:state.selected.id, Target:target})});
      const detail = result.transaksi_member || {};
      $('#modal .success-ring').textContent = '⚡';
      $('#modal h2').textContent = 'Hasil cek tagihan PLN';
      $('#modal .modal-card > p').textContent = result.msg || detail.keterangan || 'Hasil pengecekan diterima dari Pulsa24Jam.';
      $('#modalDetail').innerHTML = `<div><span>ID pelanggan</span><b>${escapeText(target)}</b></div><div><span>Produk</span><b>${escapeText(state.selected.name)}</b></div><div><span>Status</span><b>${escapeText(detail.keterangan || result.msg || 'Diterima')}</b></div>`;
      closeCheckoutSheet(); $('#modal').classList.add('show'); return;
    }
    const tx = await api('/api/purchase', {method:'POST', body:JSON.stringify({ProductID:state.selected.id, Target:target, Qty:qty})});
    state.transactions.unshift(tx); setUser(await api('/api/me')); renderRecent(); renderHistory();
    const refunded = tx.status === 'Dana dikembalikan';
    const success = tx.status === 'Berhasil';
    $('#modal .success-ring').textContent = refunded ? '↺' : success ? '✓' : '…';
    $('#modal h2').textContent = refunded ? 'Dana dikembalikan ke saldo' : success ? 'Transaksi berhasil!' : 'Transaksi sedang diproses';
    $('#modal .modal-card > p').textContent = refunded ? 'P24 menolak transaksi. Saldo utama sudah dikembalikan.' : success ? 'Produk telah berhasil diproses.' : 'Jangan bayar ulang. Pantau statusnya di riwayat transaksi.';
    $('#modalDetail').innerHTML = `<div><span>Invoice</span><b>${escapeText(tx.id)}</b></div><div><span>Produk</span><b>${escapeText(tx.product)}</b></div><div><span>Tujuan</span><b>${escapeText(tx.target)}</b></div><div><span>Status</span><b>${escapeText(tx.status)}</b></div><div><span>Total bayar</span><b>Rp ${money(tx.amount)}</b></div><div><span>Metode bayar</span><b>Saldo utama</b></div>`;
    closeCheckoutSheet(); $('#modal').classList.add('show'); $('#targetInput').value = '';
  } catch(err) { showToast('Transaksi gagal', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Bayar'; updateCheckoutAmount(); }
};

$('#closeModal').onclick = () => $('#modal').classList.remove('show');
$('#doneBtn').onclick = () => { $('#modal').classList.remove('show'); showPage(state.returnPage || 'transaction'); };
$('#profileForm').addEventListener('submit', async e => { e.preventDefault(); try { const user = await api('/api/me', {method:'PATCH',body:JSON.stringify({Name:$('#profileNameInput').value,Email:$('#profileEmail').value})}); setUser(user); showToast('Profil tersimpan', 'Informasi akun berhasil diperbarui.'); } catch(err) { showToast('Gagal menyimpan', err.message); } });
if ($('#hideBalance')) $('#hideBalance').onclick = () => { state.balanceVisible = !state.balanceVisible; $('#balance').textContent = state.balanceVisible ? money(state.user.balance) : '••••••••'; const detail = $('#mainBalanceDetail'); if (detail) detail.textContent = state.balanceVisible ? `Rp ${money(state.user.balance)}` : 'Rp ••••••••'; };
const updateTopupSummary = () => {
  const amount = Number($('#topupAmount').value.replace(/\D/g, '')) || 0;
  $('#topupAmount').value = amount ? money(amount) : '';
  $('#topupNet').textContent = `Rp ${money(amount)}`;
  $('#topupFee').textContent = 'Rp 0';
  $('#topupTotal').textContent = `Rp ${money(amount)}`;
  $('#clearTopup').classList.toggle('visible', amount > 0);
  $('#createQrisBtn').disabled = amount < 10000;
};
$('#topupAmount').addEventListener('input', updateTopupSummary);
$$('[data-topup]').forEach(btn => btn.onclick = () => { $('#topupAmount').value = btn.dataset.topup; updateTopupSummary(); });
$('#clearTopup').onclick = () => { $('#topupAmount').value = ''; updateTopupSummary(); $('#topupAmount').focus(); };
$('#qrisTopupForm').addEventListener('submit', e => { e.preventDefault(); showToast('QRIS segera tersedia', 'Integrasi mitra pembayaran sedang dipersiapkan.'); });
$('#refreshTopup').onclick = () => showToast('Riwayat diperbarui', 'Belum ada top up QRIS pada akun ini.');
$('#topupBtn').onclick = () => showPage('topup');
$('#accountMenu').addEventListener('click', event => {
  const button = event.target.closest('[data-account-action]');
  if (button?.dataset.accountAction === 'topup') showPage('topup');
  if (button?.dataset.accountAction === 'balance') showPage('balance');
  if (button?.dataset.accountAction === 'fees') showPage('fees');
  if (button?.dataset.accountAction === 'withdraw') showPage('withdraw');
  if (button?.dataset.accountAction === 'network') { renderDownlines(); showPage('network'); }
  if (button?.dataset.accountAction === 'capital') {
    if (String(state.user?.level || '').toLowerCase() === 'marketing') {
      syncCreditApplications().then(renderMarketingCapital);
      showPage('marketingCapital');
      return;
    }
    syncCreditApplications().catch(()=>getMonitoredApplications()).then(renderCapitalPage);
    showPage('capital');
  }
});
if ($('#walletTopupBtn')) $('#walletTopupBtn').onclick = () => showPage('topup');

const capitalStorageKey = () => `${CAPITAL_APPLICATION_KEY}:${state.user?.phone || state.user?.id || 'agent'}`;
const getCapitalApplications = () => {
  try { return JSON.parse(localStorage.getItem(capitalStorageKey()) || '[]'); }
  catch { return []; }
};
const getMonitoredApplications = () => {
  try { return JSON.parse(localStorage.getItem(CAPITAL_MONITOR_KEY) || '[]'); }
  catch { return []; }
};
async function syncCreditApplications(){const applications=await api('/api/credit-applications');localStorage.setItem(CAPITAL_MONITOR_KEY,JSON.stringify(applications||[]));return applications||[];}
setInterval(()=>{const role=String(state.user?.level||'').toLowerCase();if($('#operatorView')&&!$('#operatorView').classList.contains('hidden')&&role==='operator'){syncCreditApplications().then(()=>{if(!$('#operatorCreditView').classList.contains('hidden'))renderOperatorCredit();if(!$('#operatorTurnoverView').classList.contains('hidden'))renderTurnover();}).catch(()=>{});}if(role==='marketing'&&!$('#marketingCapitalPage').classList.contains('active'))return;if(role==='marketing')syncCreditApplications().then(renderMarketingCapital).catch(()=>{});},4000);
const getCapitalPayments = () => { try { return JSON.parse(localStorage.getItem(CAPITAL_PAYMENT_KEY) || '[]'); } catch { return []; } };
const applicationRemaining = item => Math.max(0, Number(item.remaining ?? item.amount ?? 0));
const agentKey = item => String(item.agentKey || item.whatsapp || item.owner || '').toLowerCase();
function renderMarketingCapital() {
  const applications = getMonitoredApplications();
  const empty = '<div class="marketing-monitor-empty"><span><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 15a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/><path d="m15 18 2 2"/></svg></span><b>Belum ada pengajuan Agent</b><p>Dokumen dan pengajuan Agent akan tampil otomatis setelah dikirim.</p></div>';
  $('#marketingDocuments').innerHTML = applications.length ? applications.map((item,index) => `<div class="monitor-document"><button type="button" data-monitor-doc="${index}"><div><b>${escapeHTML(item.owner)}</b><small>${item.documents?.length || 0} dokumen · klik untuk melihat semua</small></div><strong>${escapeHTML(item.status)}</strong><i>⌄</i></button><div class="monitor-document-files hidden">${renderDocumentFiles(item.documents)}</div></div>`).join('') : empty;
  $('#marketingApplications').innerHTML = applications.length ? applications.map(item => `<article><div><span>${escapeHTML(item.id)}</span><b>${escapeHTML(item.owner)}</b><small>${escapeHTML(item.shop || '-')} · ${escapeHTML(item.date)}</small></div><div><strong>Rp ${money(item.amount)}</strong><i>${escapeHTML(item.status)}</i></div></article>`).join('') : empty;
}
let operatorCreditTab = 'applications';
let previewApplicationIndex = -1;
async function updateOperatorApplication(index, status) {
  const applications = getMonitoredApplications(); if (!applications[index]) return;
  try { await api(`/api/operator/credit-applications/${encodeURIComponent(applications[index].id)}`,{method:'PATCH',body:JSON.stringify({status})}); } catch(error) { showToast('Status gagal disimpan',error.message); return; }
  applications[index].status = status; if (status === 'Aktif') { applications[index].approvedAt = new Date().toISOString(); applications[index].remaining ??= Number(applications[index].amount || 0); } localStorage.setItem(CAPITAL_MONITOR_KEY, JSON.stringify(applications)); renderOperatorCredit();
  showToast(status === 'Aktif' ? 'Pengajuan disetujui' : 'Pengajuan ditolak', `Status ${applications[index].id} berhasil diperbarui.`);
}
function renderOperatorCredit() {
  const query = ($('#creditSearch')?.value || '').toLowerCase(); const filter = $('#creditStatus')?.value || 'Pending';
  const all = getMonitoredApplications(); const rows = all.map((item,index)=>({item,index})).filter(({item}) => (filter === 'Semua' || item.status === filter) && `${item.id} ${item.owner} ${item.shop || ''}`.toLowerCase().includes(query));
  if (!rows.length) { $('#operatorCreditList').innerHTML = '<div class="operator-credit-empty"><b>Belum ada pengajuan nyata</b><p>Pengajuan Agent akan muncul otomatis setelah benar-benar dikirim.</p></div>'; return; }
  const groups = Object.values(rows.reduce((out,row)=>{ const key=agentKey(row.item); out[key] ||= {key,owner:row.item.owner,shop:row.item.shop,items:[]}; out[key].items.push(row); return out; },{}));
  $('#operatorCreditList').innerHTML = operatorCreditTab === 'documents'
    ? groups.map(group=>{const source=group.items.find(row=>row.item.documents?.length);if(!source)return '';const readonly=!['Pending','Ditolak'].includes(source.item.status);return `<section class="operator-doc-agent"><header><div><b>${escapeHTML(group.owner)}</b><small>${source.item.documents.length} dokumen · ${escapeHTML(group.shop||'-')}</small></div><span>${escapeHTML(source.item.status)}</span></header><div>${source.item.documents.map((doc,docIndex)=>`<article><div><b>${escapeHTML(documentNames[docIndex])}</b><small>${escapeHTML(doc.name)}</small></div><i>${readonly?'Disetujui':escapeHTML(source.item.status)}</i><button data-open-document="${source.index}:${docIndex}" data-readonly="${readonly}">Buka</button>${readonly?'':`<button class="approve" data-credit-action="Aktif:${source.index}">Approve</button><button class="reject" data-credit-action="Ditolak:${source.index}">Reject</button>`}</article>`).join('')}</div></section>`}).join('')
    : groups.map(group=>`<section class="operator-application credit-agent-group"><button data-credit-expand="${escapeHTML(group.key)}"><div><b>${escapeHTML(group.owner)}</b><small>${escapeHTML(group.shop||'-')} · ${group.items.length} riwayat kredit</small></div><i>⌄</i></button><div class="hidden"><nav><button data-payment-agent="${escapeHTML(group.key)}">Catat Pembayaran</button><button data-payment-history="${escapeHTML(group.key)}">Riwayat Pembayaran</button></nav>${group.items.map(({item,index})=>`<article><div><b>${escapeHTML(item.id)} · ${escapeHTML(item.owner)}</b><small>Tujuan: ${escapeHTML(item.shop||'Modal usaha')}</small></div><aside><strong>Rp ${money(item.amount)}</strong><small>Dibayar Rp ${money(Number(item.amount)-applicationRemaining(item))} · Sisa Rp ${money(applicationRemaining(item))}</small><span>${escapeHTML(item.status)}</span></aside>${item.status==='Pending'?`<footer><button class="approve" data-credit-action="Aktif:${index}">Approve</button><button class="reject" data-credit-action="Ditolak:${index}">Reject</button></footer>`:''}</article>`).join('')}</div></section>`).join('');
}
$$('[data-credit-tab]').forEach(button => button.onclick = () => { operatorCreditTab=button.dataset.creditTab; $$('[data-credit-tab]').forEach(item=>item.classList.toggle('active',item===button)); renderOperatorCredit(); });
$('#creditStatus').onchange = renderOperatorCredit; $('#creditSearch').oninput = renderOperatorCredit; $('#refreshOperatorCredit').onclick = renderOperatorCredit;
$('#operatorCreditList').addEventListener('click', event => {
  const expand=event.target.closest('[data-credit-expand]'); if(expand){ expand.classList.toggle('open'); expand.nextElementSibling.classList.toggle('hidden'); return; }
  const action=event.target.closest('[data-credit-action]'); if(action){ const [status,index]=action.dataset.creditAction.split(':'); updateOperatorApplication(Number(index),status); return; }
  const payment=event.target.closest('[data-payment-agent]'); if(payment){ openPaymentModal(payment.dataset.paymentAgent); return; }
  const history=event.target.closest('[data-payment-history]'); if(history){ openPaymentHistory(history.dataset.paymentHistory); return; }
  const open=event.target.closest('[data-open-document]'); if(open){ const [appIndex,docIndex]=open.dataset.openDocument.split(':').map(Number); const app=getMonitoredApplications()[appIndex]; if(!app?.documents?.[docIndex])return; previewApplicationIndex=appIndex; $('#operatorPreviewImage').src=app.documents[docIndex].data; $$('[data-preview-action]').forEach(button=>button.classList.toggle('hidden',open.dataset.readonly==='true')); $('#operatorDocumentPreview').classList.remove('hidden'); }
});
const closeOperatorPreview=()=>$('#operatorDocumentPreview').classList.add('hidden'); $('#closeDocumentPreview').onclick=closeOperatorPreview; $('#closePreviewFooter').onclick=closeOperatorPreview;
$$('[data-preview-action]').forEach(button=>button.onclick=()=>{ updateOperatorApplication(previewApplicationIndex,button.dataset.previewAction); closeOperatorPreview(); });
let paymentAgentKey = '';
const closePaymentModal=()=>$('#paymentModal').classList.add('hidden');
function openPaymentModal(key){ const app=getMonitoredApplications().find(item=>agentKey(item)===key); if(!app)return; paymentAgentKey=key; $('#paymentAgentLabel').textContent=`${app.owner} · Modal berjalan Rp ${money(getMonitoredApplications().filter(item=>agentKey(item)===key&&item.status==='Aktif').reduce((sum,item)=>sum+applicationRemaining(item),0))}`; $('#paymentDate').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16); $('#paymentModal').classList.remove('hidden'); }
$('#closePaymentModal').onclick=closePaymentModal;
const fileData=file=>new Promise((resolve,reject)=>{if(!file)return resolve(null);const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve({name:file.name,type:file.type,data:reader.result});reader.readAsDataURL(file)});
$('#paymentForm').onsubmit=async event=>{event.preventDefault();const amount=Number($('#paymentAmount').value.replace(/\D/g,''))||0;if(!amount)return;const applications=getMonitoredApplications();let allocation=amount;const loans=applications.map((item,index)=>({item,index})).filter(row=>agentKey(row.item)===paymentAgentKey&&row.item.status==='Aktif').sort((a,b)=>new Date(a.item.approvedAt||0)-new Date(b.item.approvedAt||0));const source=loans[0]?.item||applications.find(item=>agentKey(item)===paymentAgentKey);if(!source)return;try{await api('/api/operator/credit-payment',{method:'POST',body:JSON.stringify({username:source.agentLogin||source.whatsapp,amount})});}catch(error){showToast('Pembayaran gagal',error.message);return;}for(const loan of loans){if(!allocation)break;const remaining=applicationRemaining(loan.item);const paid=Math.min(remaining,allocation);loan.item.remaining=remaining-paid;allocation-=paid;if(loan.item.remaining===0)loan.item.status='Lunas';}applications.unshift({...source,id:`RBG-${Date.now().toString(36).slice(-8).toUpperCase()}`,amount,remaining:amount,status:'Aktif',documents:source.documents||[],approvedAt:new Date().toISOString(),date:new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date()),revolving:true});localStorage.setItem(CAPITAL_MONITOR_KEY,JSON.stringify(applications));const payments=getCapitalPayments();payments.unshift({id:`PAY-${Date.now().toString(36).slice(-8).toUpperCase()}`,agentKey:paymentAgentKey,owner:source.owner,amount,date:$('#paymentDate').value,bank:$('#paymentBank').value,account:$('#paymentAccount').value,accountOwner:$('#paymentAccountOwner').value,sender:$('#paymentSender').value,note:$('#paymentNote').value,proof:await fileData($('#paymentProof').files[0])});localStorage.setItem(CAPITAL_PAYMENT_KEY,JSON.stringify(payments));event.target.reset();closePaymentModal();renderOperatorCredit();showToast('Pembayaran tersimpan',`Rp ${money(amount)} dialokasikan dan saldo Agent bertambah.`);};
function openPaymentHistory(key){const app=getMonitoredApplications().find(item=>agentKey(item)===key);const rows=getCapitalPayments().filter(item=>item.agentKey===key);$('#paymentHistoryAgent').textContent=app?.owner||'';$('#paymentHistoryList').innerHTML=rows.length?rows.map(item=>`<article><div><b>Rp ${money(item.amount)}</b><small>${escapeHTML(item.date)} · ${escapeHTML(item.bank)} · ${escapeHTML(item.sender)}</small>${item.note?`<p>${escapeHTML(item.note)}</p>`:''}</div>${item.proof?.data?`<a href="${item.proof.data}" target="_blank" rel="noopener">Buka bukti</a>`:'<span>Tanpa bukti</span>'}</article>`).join(''):'<div class="inactive-empty"><b>Belum ada pembayaran</b></div>';$('#paymentHistoryModal').classList.remove('hidden');}
$('#closePaymentHistory').onclick=()=>$('#paymentHistoryModal').classList.add('hidden');
const documentNames = ['KTP pemilik konter','Foto konter','Foto bersama marketing','Dokumen pengajuan kredit'];
const renderDocumentFiles = documents => (documents?.length ? documents.map((doc,index) => `<figure><img src="${doc.data}" alt="${escapeHTML(documentNames[index])}"><figcaption>${escapeHTML(documentNames[index])}<b>Terkirim</b></figcaption></figure>`).join('') : '<p class="document-unavailable">Dokumen foto belum tersedia.</p>');
const imageData = file => new Promise((resolve,reject) => { const reader=new FileReader(); reader.onerror=reject; reader.onload=()=>{ const img=new Image(); img.onerror=reject; img.onload=()=>{ const scale=Math.min(1,720/Math.max(img.width,img.height)); const canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale); canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); resolve({name:file.name,data:canvas.toDataURL('image/jpeg',.68)}); }; img.src=reader.result; }; reader.readAsDataURL(file); });
function renderCapitalPage() {
  const applications = getCapitalApplications();
  const monitored = getMonitoredApplications();
  applications.forEach(local=>{const live=monitored.find(item=>item.id===local.id);if(live)Object.assign(local,{status:live.status,remaining:live.remaining,approvedAt:live.approvedAt});});
  const currentKey=String(state.user?.phone||state.user?.name||'').toLowerCase();
  const agentLoans=monitored.filter(item=>agentKey(item)===currentKey||String(item.owner).toLowerCase()===String(state.user?.name||'').toLowerCase());
  const activeLoans=agentLoans.filter(item=>item.status==='Aktif'); const payments=getCapitalPayments().filter(item=>item.agentKey===currentKey||String(item.owner).toLowerCase()===String(state.user?.name||'').toLowerCase());
  const overview=$('.capital-overview'); overview.querySelector('.capital-overview-title strong').textContent=`Rp ${money(activeLoans.reduce((sum,item)=>sum+applicationRemaining(item),0))}`; overview.querySelector('.capital-overview-title>b').textContent=`${activeLoans.length} fasilitas aktif`; const stats=overview.querySelectorAll('.capital-overview-stats strong'); stats[0].textContent=`Rp ${money(payments.reduce((sum,item)=>sum+Number(item.amount),0))}`; stats[1].textContent=`Rp ${money(activeLoans.reduce((sum,item)=>sum+applicationRemaining(item),0))}`;
  $('#capitalOwner').value ||= state.user?.name || '';
  $('#capitalWhatsapp').value ||= /^\d+$/.test(state.user?.phone || '') ? state.user.phone : '';
  $('#capitalDocumentCount').textContent = applications.length ? '4 dokumen · tersimpan pada pengajuan terakhir' : '0 dokumen · klik untuk melihat semua';
  $('#capitalDocumentStatus').textContent = applications.length ? 'Lengkap' : 'Belum ada';
  const visibleLoans=agentLoans.length?agentLoans:applications;
  $('#capitalHistory').innerHTML = visibleLoans.length
    ? visibleLoans.map(item => `<article><div><span>${escapeHTML(item.id)}</span><b>Rp ${money(item.amount)}</b><small>${escapeHTML(item.date)} · Sisa Rp ${money(applicationRemaining(item))}</small></div><strong>${escapeHTML(item.status)}</strong></article>`).join('')
    : '<div class="capital-empty"><span>Belum ada riwayat pengajuan kredit.</span></div>';
  $('#agentPaymentHistory').innerHTML=payments.length?payments.map(item=>`<article><div><span>${escapeHTML(item.id)}</span><b>Rp ${money(item.amount)}</b><small>${escapeHTML(item.date)} · ${escapeHTML(item.bank)}</small></div>${item.proof?.data?`<a href="${item.proof.data}" target="_blank" rel="noopener">Buka bukti</a>`:'<strong>Tercatat</strong>'}</article>`).join(''):'<div class="capital-empty"><span>Belum ada riwayat pembayaran.</span></div>';
  const latest = applications[0];
  $('#capitalPendingPanel').classList.toggle('hidden', !latest);
  $('#capitalPendingPanel').innerHTML = latest ? `<span>PENGAJUAN DIPROSES</span><h2>1 pengajuan menunggu Operator</h2><article><div><b>Pengajuan Kredit</b><small>${escapeHTML(latest.id)} · Status diperbarui otomatis</small></div><strong>Rp ${money(latest.amount)}<i>${escapeHTML(latest.status)}</i></strong></article>` : '';
  $('#capitalDocumentDetails').innerHTML = latest ? renderDocumentFiles(latest.documents) : '';
}
$('#capitalDocToggle').onclick = () => { if (!getCapitalApplications().length) return; $('#capitalDocumentDetails').classList.toggle('hidden'); $('#capitalDocToggle').classList.toggle('open'); };
$('#marketingDocuments').addEventListener('click', event => { const button=event.target.closest('[data-monitor-doc]'); if (!button) return; button.classList.toggle('open'); button.nextElementSibling.classList.toggle('hidden'); });
$('#capitalBack').onclick = () => showPage('account');
$('#capitalAmount').addEventListener('input', event => {
  const amount = Number(event.target.value.replace(/\D/g, '')) || 0;
  event.target.value = amount ? money(amount) : '';
});
$$('.capital-upload input').forEach(input => input.addEventListener('change', () => {
  const label = input.closest('.capital-upload');
  label.classList.toggle('uploaded', Boolean(input.files?.length));
  label.querySelector('b').textContent = input.files?.[0]?.name || 'Belum diunggah';
}));
$('#openCapitalApplication').onclick = () => {
  const previous=getMonitoredApplications().find(item=>(agentKey(item)===String(state.user?.phone||'').toLowerCase()||String(item.owner).toLowerCase()===String(state.user?.name||'').toLowerCase())&&['Aktif','Lunas'].includes(item.status)&&item.documents?.length);
  if(previous){$('#quickLimitModal').classList.remove('hidden');return;}
  $('#applyAgentName').value = state.user?.name || $('#capitalOwner').value || '';
  $('#applyWhatsapp').value = $('#capitalWhatsapp').value || (/^\d+$/.test(state.user?.phone || '') ? state.user.phone : '');
  $('#applyEmail').value = state.user?.email || '';
  $('#applyAmount').value = $('#capitalAmount').value;
  $('#signatureName').textContent = state.user?.name || 'Agent';
  showPage('capitalApply');
  requestAnimationFrame(resetSignatureCanvas);
};
$('#closeQuickLimit').onclick=()=>$('#quickLimitModal').classList.add('hidden');
$('#quickLimitAmount').oninput=event=>{const amount=Number(event.target.value.replace(/\D/g,''))||0;event.target.value=amount?money(amount):'';};
$('#quickLimitForm').onsubmit=async event=>{event.preventDefault();const monitored=getMonitoredApplications();const previous=monitored.find(item=>(agentKey(item)===String(state.user?.phone||'').toLowerCase()||String(item.owner).toLowerCase()===String(state.user?.name||'').toLowerCase())&&['Aktif','Lunas'].includes(item.status)&&item.documents?.length);const amount=Number($('#quickLimitAmount').value.replace(/\D/g,''))||0;if(!previous||!amount)return;const item={...previous,id:`KSA-${Date.now().toString(36).slice(-8).toUpperCase()}`,amount,remaining:amount,status:'Pending',note:$('#quickLimitNote').value.trim(),date:new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date()),approvedAt:null,revolving:false};const submit=event.currentTarget.querySelector('[type=submit]');submit.disabled=true;try{const saved=await api('/api/credit-applications',{method:'POST',body:JSON.stringify(item)});monitored.unshift(saved);localStorage.setItem(CAPITAL_MONITOR_KEY,JSON.stringify(monitored));event.target.reset();$('#quickLimitModal').classList.add('hidden');renderCapitalPage();showToast('Pengajuan limit terkirim','Dokumen lama digunakan kembali dan pengajuan menunggu Operator.');}catch(error){showToast('Pengajuan gagal dikirim',error.message);}finally{submit.disabled=false;}};
$('#capitalApplyBack').onclick = () => showPage('capital');
$('#applyAmount').addEventListener('input', event => {
  const amount = Number(event.target.value.replace(/\D/g, '')) || 0;
  event.target.value = amount ? money(amount) : '';
});
$$('.camera-documents input').forEach(input => input.addEventListener('change', () => {
  const row = input.closest('label');
  row.classList.toggle('captured', Boolean(input.files?.length));
  row.querySelector('span b').textContent = input.files?.length ? 'Foto siap' : 'Ambil Foto';
}));
const signatureCanvas = $('#signatureCanvas');
const signatureContext = signatureCanvas.getContext('2d');
let signing = false;
let hasSignature = false;
function resetSignatureCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const bounds = signatureCanvas.getBoundingClientRect();
  signatureCanvas.width = Math.max(1, bounds.width * ratio);
  signatureCanvas.height = Math.max(1, bounds.height * ratio);
  signatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  signatureContext.lineWidth = 2.2; signatureContext.lineCap = 'round'; signatureContext.strokeStyle = '#087c47';
  hasSignature = false; $('#signatureHint').hidden = false;
}
const signaturePoint = event => { const rect = signatureCanvas.getBoundingClientRect(); const touch = event.touches?.[0] || event; return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }; };
const startSignature = event => { event.preventDefault(); signing = true; const point = signaturePoint(event); signatureContext.beginPath(); signatureContext.moveTo(point.x, point.y); };
const drawSignature = event => { if (!signing) return; event.preventDefault(); const point = signaturePoint(event); signatureContext.lineTo(point.x, point.y); signatureContext.stroke(); hasSignature = true; $('#signatureHint').hidden = true; };
['pointerdown'].forEach(name => signatureCanvas.addEventListener(name, startSignature));
signatureCanvas.addEventListener('pointermove', drawSignature); window.addEventListener('pointerup', () => { signing = false; });
$('#clearSignature').onclick = resetSignatureCanvas;
$('#capitalDetailForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!hasSignature) { showToast('Tanda tangan belum ada', 'Tanda tangan Agent diperlukan sebelum pengajuan dikirim.'); return; }
  const amount = Number($('#applyAmount').value.replace(/\D/g, '')) || 0;
  if (!amount) { showToast('Nominal belum sesuai', 'Masukkan nominal modal yang ingin diajukan.'); return; }
  const submit=event.currentTarget.querySelector('[type=submit]');submit.disabled=true;submit.textContent='Mengirim pengajuan...';
  try {
    const documents = await Promise.all($$('.camera-documents input').map(input => imageData(input.files[0])));
    const item={id:`KSA-${Date.now().toString(36).slice(-8).toUpperCase()}`,agentLogin:state.user?.phone||'',owner:$('#applyAgentName').value.trim(),whatsapp:$('#applyWhatsapp').value.trim(),shop:$('#applyShopName').value.trim(),email:$('#applyEmail').value.trim(),nik:$('#applyNik').value.trim(),amount,documents,status:'Pending',date:new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date())};
    const saved=await api('/api/credit-applications',{method:'POST',body:JSON.stringify(item)});
    const applications=getCapitalApplications();applications.unshift(saved);localStorage.setItem(capitalStorageKey(),JSON.stringify(applications));
    await syncCreditApplications();renderCapitalPage();event.target.reset();$$('.camera-documents label').forEach(row=>row.classList.remove('captured'));showPage('capital');showToast('Pengajuan terkirim','Pengajuan langsung masuk ke Operator dan Marketing pembina dengan status Pending.');
  } catch(error) { showToast('Pengajuan gagal dikirim',error.message||'Periksa koneksi lalu coba kembali.'); }
  finally { submit.disabled=false;submit.innerHTML='<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg> Kirim Pengajuan Kemitraan'; }
});
$('#marketingCapitalBack').onclick = () => showPage('account');
$('#refreshMarketingCapital').onclick = async () => { try { await syncCreditApplications(); renderMarketingCapital(); showToast('Pemantauan diperbarui', 'Data pengajuan Agent sudah dimuat ulang.'); } catch(error) { showToast('Gagal memperbarui',error.message); } };
const todayISO = new Date().toISOString().slice(0, 10);
$('#balanceTo').value = todayISO;
$('#balanceFrom').value = `${todayISO.slice(0, 8)}01`;
$('#applyBalanceFilter').onclick = () => showToast('Filter diterapkan', 'Riwayat mutasi diperbarui sesuai rentang tanggal.');
$('#resetBalanceFilter').onclick = () => { $('#balanceFrom').value = `${todayISO.slice(0, 8)}01`; $('#balanceTo').value = todayISO; };
$('#refreshBalance').onclick = () => showToast('Mutasi diperbarui', 'Belum ada riwayat mutasi saldo.');
$('#refreshFees').onclick = () => showToast('Fee diperbarui', 'Belum ada fee retail yang dibukukan.');
$('#requestWithdraw').onclick = () => showToast('Saldo fee belum tersedia', 'Withdraw dapat diajukan setelah saldo fee tersedia.');
async function renderDownlines() {
  try {
    const users = await api('/api/downlines');
    $('#downlineCount').textContent = `${users.length} downline terhubung`;
    $('#downlineList').innerHTML = users.length ? users.map(user => `<article><span>${escapeHTML(initials(user.name))}</span><div><b>${escapeHTML(user.name)}</b><small>${escapeHTML(user.email || user.phone)}</small><em>${escapeHTML(user.level)} · Downline aktif</em></div><aside><strong>AKTIF</strong><small>Rp ${money(user.balance)}</small></aside></article>`).join('') : '<div class="network-empty"><b>Belum ada downline</b><p>Tambahkan akun pertama ke jaringanmu.</p></div>';
  } catch (err) { showToast('Gagal memuat jaringan', err.message); }
}
const closeDownlineModal = () => { $('#downlineModal').classList.remove('show'); $('#downlineModal').setAttribute('aria-hidden','true'); };
$('#openDownlineModal').onclick = () => {
  const marketing = String(state.user?.level || '').toLowerCase() === 'marketing';
  $('#downlineRole').innerHTML = `<option value="Member">User / Member</option>${marketing ? '<option value="Agent">Agent</option>' : ''}`;
  $('#downlineError').textContent = ''; $('#downlineModal').classList.add('show'); $('#downlineModal').setAttribute('aria-hidden','false');
};
$('#closeDownlineModal').onclick = closeDownlineModal;
$('#downlineModal').addEventListener('click', event => { if (event.target === $('#downlineModal')) closeDownlineModal(); });
$('#downlineForm').addEventListener('submit', async event => {
  event.preventDefault(); const submit = event.currentTarget.querySelector('.downline-submit'); submit.disabled = true; $('#downlineError').textContent = '';
  try { await api('/api/downlines',{method:'POST',body:JSON.stringify({name:$('#downlineName').value.trim(),username:$('#downlineUsername').value.trim(),email:$('#downlineEmail').value.trim(),password:$('#downlinePassword').value,level:$('#downlineRole').value})}); event.currentTarget.reset(); closeDownlineModal(); await renderDownlines(); showToast('Akun berhasil dibuat','Username dan password baru sudah dapat digunakan untuk login.'); }
  catch(err) { $('#downlineError').textContent = err.message; } finally { submit.disabled = false; }
});

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
