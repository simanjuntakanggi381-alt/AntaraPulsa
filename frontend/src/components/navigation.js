export function createNavigation() {
  const showPage = name => {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active-page'));
    document.querySelector(`#${name}Page`)?.classList.add('active-page');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === name));
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === name));
    document.querySelector('.sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
  return showPage;
}
