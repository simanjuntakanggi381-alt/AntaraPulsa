export function createNavigation() {
  const pageNames = new Set([...document.querySelectorAll('.page')].map(page => page.id.replace('Page', '')));
  let currentPage = pageNames.has(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';

  const renderPage = (name, { scroll = true } = {}) => {
    if (!pageNames.has(name)) name = 'dashboard';
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active-page'));
    document.querySelector(`#${name}Page`)?.classList.add('active-page');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === name));
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === name));
    document.querySelector('.sidebar').classList.remove('open');
    currentPage = name;
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const showPage = (name, { replace = false, scroll = true } = {}) => {
    if (!pageNames.has(name)) name = 'dashboard';
    const nextURL = `#${name}`;
    if (location.hash !== nextURL) {
      history[replace ? 'replaceState' : 'pushState']({ page: name }, '', nextURL);
    }
    renderPage(name, { scroll });
  };
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
  window.addEventListener('popstate', () => renderPage(pageNames.has(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard'));
  showPage(currentPage, { replace: true, scroll: false });
  showPage.current = () => currentPage;
  return showPage;
}
