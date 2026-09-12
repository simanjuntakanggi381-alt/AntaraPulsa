import './styles/app.css';
import './styles/dashboard-final.css';
import './styles/dashboard-v5.css';
import './styles/dashboard-v6.css';
import './styles/dashboard-v7.css';
import './styles/dashboard-premium.css';
import './styles/mobile-polish.css';
import './styles/responsive-layout.css';
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
const state = { user: null, products: [], transactions: [], selected: null, selectedType: 'Pulsa', selectedProvider: '', balanceVisible: true, returnPage: 'dashboard' };
const TRANSACTION_DRAFT_KEY = 'antarapulsa-transaction-draft-v1';
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
  guide: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  shield: '<path d="M12 22s8-3.5 8-10V6l-8-3-8 3v6c0 6.5 8 10 8 10Z"/><path d="M12 8v5M12 16h.01"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.3-4A9 9 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'
};
const installIcon = (selector, name) => document.querySelectorAll(selector).forEach(el => { el.classList.add('svg-icon'); el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${appIcons[name]}</svg>`; });
[['.extra-services .service-card:nth-child(1) .service-icon','game'],['.extra-services .service-card:nth-child(2) .service-icon','ticket'],['.extra-services .service-card:nth-child(3) .service-icon','phone'],['.extra-services .service-card:nth-child(4) .service-icon','bill'],['.account-field:nth-child(2)>span','user'],['.account-field:nth-child(3)>span','phone'],['.account-field:nth-child(4)>span','mail'],['.account-menu button:nth-of-type(1) .account-menu-icon','swap'],['.account-menu .topup-icon','plus'],['.account-menu .help-icon','chat'],['.help-card:nth-child(1)>span','guide'],['.help-card:nth-child(2)>span','shield'],['.help-card:nth-child(3)>span','chat']].forEach(([selector,name]) => installIcon(selector,name));

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

function providerColor(name) { return state.products.find(p => p.provider === name)?.color || '#178e69'; }
const providerDomains = {
  telkomsel:'telkomsel.com', indosat:'im3.id', im3:'im3.id', axis:'axis.co.id', xl:'xl.co.id', smartfren:'smartfren.com', 'by.u':'byu.id', byu:'byu.id', tri:'tri.co.id', three:'tri.co.id',
  pln:'pln.co.id', dana:'dana.id', ovo:'ovo.id', gopay:'gojek.com', gojek:'gojek.com', shopeepay:'shopeepay.co.id', shopee:'shopee.co.id', linkaja:'linkaja.id', astrapay:'astrapay.com', grab:'grab.com', maxim:'taximaxim.com',
  bca:'bca.co.id', bri:'bri.co.id', bni:'bni.co.id', mandiri:'bankmandiri.co.id', btn:'btn.co.id', bsi:'bankbsi.co.id', cimb:'cimbniaga.co.id', permata:'permatabank.com', danamon:'danamon.co.id', maybank:'maybank.co.id', panin:'panin.co.id', seabank:'seabank.co.id', jago:'jago.com', neocommerce:'bankneo.co.id',
  bpjs:'bpjs-kesehatan.go.id', indihome:'indihome.co.id', firstmedia:'firstmedia.com', myrepublic:'myrepublic.co.id', netflix:'netflix.com', spotify:'spotify.com', vidio:'vidio.com', viu:'viu.com', steam:'steampowered.com', garena:'garena.co.id', 'mobile legends':'mobilelegends.com', 'free fire':'ff.garena.com', pubg:'pubgmobile.com'
};
const providerAssets = {
  kvision:'/assets/streaming/provider-streaming-kvision-symbol.svg', nexparabola:'/assets/streaming/provider-streaming-nex-symbol.svg',
  vidio:'/assets/streaming/provider-streaming-vidio.png', wetv:'/assets/streaming/provider-streaming-wetv.png',
  arenaofvalor:'/assets/games/provider-game-arena-of-valor.png', bloodstrike:'/assets/games/provider-game-blood-strike.png',
  callofdutymobile:'/assets/games/provider-game-call-of-duty-symbol.svg', fcmobile:'/assets/games/provider-game-fc-mobile.png',
  freefire:'/assets/games/provider-game-free-fire.png',
  honkaiimpact3:'/assets/games/provider-game-honkai-impact-3.png', honorofkings:'/assets/games/provider-game-honor-of-kings.png',
  leagueoflegends:'/assets/games/provider-game-league-of-legends.svg', minecraft:'/assets/games/provider-game-minecraft-symbol.svg',
  mobilelegends:'/assets/games/provider-game-mobile-legends.png', pointblank:'/assets/games/provider-game-point-blank.svg',
  pubgmobile:'/assets/games/provider-game-pubg-official.png', roblox:'/assets/games/provider-game-roblox.png',
  steamwallet:'/assets/games/provider-game-steam.png', valorant:'/assets/games/provider-game-valorant.svg',
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
const providerFallbacks = {
  Pulsa:'service-pulsa-3d-compact.png', 'Paket Data':'service-data-3d-compact.png', 'E-Wallet':'service-wallet-3d-compact.png',
  'Token PLN':'service-listrik-3d-compact.png', Listrik:'service-listrik-3d-compact.png', Game:'service-category-14.png',
  'Aktivasi Perdana':'service-category-01.png', 'Masa Aktif':'service-category-02.png', 'Paket Telepon':'service-category-03.png',
  'HP Pascabayar':'service-category-00.png', 'Transfer Bank':'service-category-05.png', PDAM:'service-category-09.png', BPJS:'service-category-10.png',
  'Internet & TV':'service-category-11.png', 'TV & Streaming':'service-category-15.png', Voucher:'service-category-16.png', 'Voucher Digital':'service-category-16.png'
};
function providerFallback(type) { return `/assets/${providerFallbacks[type] || 'service-lainnya-3d-compact.png'}`; }
function providerDomain(name) {
  const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9. ]/g,'').trim();
  if (providerDomains[normalized]) return providerDomains[normalized];
  const match = Object.keys(providerDomains).find(key => normalized.includes(key));
  return match ? providerDomains[match] : '';
}
function localProviderAsset(name) {
  const normalized = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  if (pdamProviderAssets[normalized]) return pdamProviderAssets[normalized];
  if (bankProviderKeys.has(normalized)) return `/assets/banks/provider-bank-${normalized}.svg`;
  const alias = Object.keys(providerAssets).find(key => normalized === key || normalized.includes(key.replace(/[^a-z0-9]/g, '')));
  return alias ? providerAssets[alias] : '';
}
function providerLogoMarkup(provider, type, className = '') {
  const fallback = providerFallback(type), domain = providerDomain(provider);
  const providerKey = String(provider || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  if (providerKey.includes('biznet') || providerKey.includes('bizznet')) {
    return `<span class="provider-logo-shell provider-logo-biznet ${className}" role="img" aria-label="Biznet"></span>`;
  }
  const source = localProviderAsset(provider) || (domain ? `https://www.google.com/s2/favicons?domain_url=https://${encodeURIComponent(domain)}&sz=128` : fallback);
  const bankClass = source.includes('/assets/banks/') ? 'provider-logo-bank' : '';
  const tvProviderKeys = ['indovision','mncplay','myrepublik','telkomvision','toptv','transvision','yestv'];
  const providerClass = source.includes('/assets/streaming/') ? 'provider-logo-streaming' : source.includes('provider-game-pubg-official') ? 'provider-logo-game provider-logo-pubg' : source.includes('/assets/games/') ? 'provider-logo-game' : source.includes('/assets/pdam/') ? 'provider-logo-pdam' : providerKey === 'pgn' ? 'provider-logo-pgn' : providerKey.includes('indihome') ? 'provider-logo-indihome' : tvProviderKeys.includes(providerKey) ? 'provider-logo-tv' : '';
  return `<span class="provider-logo-shell ${bankClass} ${providerClass} ${className}" style="--provider-color:${providerColor(provider)}"><img src="${source}" data-fallback="${fallback}" alt="" loading="lazy" decoding="async" onerror="if(this.src!==this.dataset.fallback)this.src=this.dataset.fallback"></span>`;
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
  const list = state.products.filter(p => (filter === 'all' || canonicalProductType(p.type) === canonicalProductType(filter)) && (!provider || p.provider === provider));
  $('#productGrid').innerHTML = list.map(p => `<button class="product ${state.selected?.id === p.id ? 'selected':''}" data-product="${p.id}">${providerLogoMarkup(p.provider,p.type,'product-provider-logo')}<small>${escapeText(p.provider)}</small><b>${escapeText(p.name)}</b><strong>${p.price_type === 'OPEN_AMOUNT' ? `Nominal bebas · admin Rp ${money(p.fee)}` : `Rp ${money(p.price)}`}</strong></button>`).join('');
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
    .filter(provider => !(canonicalType === 'Game' && provider.toLowerCase() === 'garena')))]
    .sort((a, b) => a.localeCompare(b, 'id'));
}

function canonicalProductType(type) {
  const normalized = String(type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'listrik' || normalized === 'tokenpln') return 'Token PLN';
  if (normalized === 'rtol') return 'Transfer Bank';
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
  $('#detectedProvider').textContent = provider || (['Pulsa','Paket Data'].includes(state.selectedType) ? 'Nomor belum dikenali' : 'Pilih provider di bawah');
  $('#providerIndicator').innerHTML = provider ? providerLogoMarkup(provider,state.selectedType,'indicator-provider-logo') : '?';
  $('#detectionStatus').textContent = provider ? 'Terpilih' : 'Otomatis';
  $$('#providerChoices button').forEach(button => button.classList.toggle('active', button.dataset.provider === provider));
  hideProductSelection();
  saveTransactionDraft();
}

function renderProviderChoices() {
  const providers = availableProviders(state.selectedType);
  $('#providerCount').textContent = `${providers.length} provider`;
  $('#providerChoices').innerHTML = providers.length
    ? providers.map(provider => {
      const total = state.products.filter(product => canonicalProductType(product.type) === canonicalProductType(state.selectedType) && product.provider === provider).length;
      return `<button type="button" data-provider="${escapeText(provider)}">${providerLogoMarkup(provider,state.selectedType,'picker-provider-logo')}<b>${escapeText(provider)}</b><small>${total} produk</small></button>`;
    }).join('')
    : '<p class="provider-empty">Provider sedang disinkronkan dari Pulsa24Jam.</p>';
  $$('#providerChoices button').forEach(button => button.onclick = () => updateProviderDetection(button.dataset.provider));
}

function prepareProductFinder(type) {
  state.selectedType = type || 'Pulsa';
  state.selected = null;
  state.selectedProvider = '';
  $$('.filter-tabs button').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === state.selectedType));
  const heading = $('#transactionPage .simple-head h1');
  if (heading) heading.textContent = state.selectedType;
  const inputConfig = transactionInputConfig(state.selectedType);
  $('#targetLabel').textContent = inputConfig.label;
  $('#targetPrefix').textContent = inputConfig.prefix;
  $('#targetInput').placeholder = inputConfig.placeholder;
  $('#targetInput').autocomplete = inputConfig.autocomplete;
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
  setTimeout(() => $('#targetInput').focus(), 0);
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
function selectProduct(id) {
  state.selected = state.products.find(p => p.id === id);
  renderProducts(state.selectedType, state.selectedProvider);
  $('.checkout-card').classList.remove('hidden');
  $('#selectedEmpty').classList.add('hidden'); $('#selectedProduct').classList.remove('hidden');
  $('#selectedLogo').innerHTML = providerLogoMarkup(state.selected.provider,state.selected.type,'selected-provider-logo'); $('#selectedLogo').style.background = 'transparent';
  $('#selectedName').textContent = state.selected.name; $('#selectedProvider').textContent = state.selected.provider;
  const openAmount = state.selected.price_type === 'OPEN_AMOUNT';
  $('#selectedPrice').textContent = openAmount ? `Nominal bebas + admin Rp ${money(state.selected.fee)}` : `Rp ${money(state.selected.price)}`;
  $('#payBtn').disabled = openAmount;
  $('#payBtn').firstChild.textContent = openAmount ? 'Nominal bebas segera tersedia ' : 'Bayar sekarang ';
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
    updateProviderDetection(matchingAvailableProvider(detectOperator(event.target.value)));
  } else saveTransactionDraft();
});

$('#showProductsBtn').onclick = () => {
  const target = $('#targetInput').value.trim();
  if (!target) { showToast('Tujuan belum diisi', 'Masukkan nomor tujuan atau ID pelanggan terlebih dahulu.'); return; }
  if (!state.selectedProvider) { showToast('Provider belum dipilih', 'Pilih salah satu provider yang tersedia.'); return; }
  $('#productResults').classList.remove('hidden');
  renderProducts(state.selectedType, state.selectedProvider);
  saveTransactionDraft();
  $('#productResults').scrollIntoView({ behavior:'smooth', block:'start' });
};

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
$('#accountPage #topupBtn').onclick = () => showPage('topup');
$('#walletTopupBtn').onclick = () => showPage('topup');

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
