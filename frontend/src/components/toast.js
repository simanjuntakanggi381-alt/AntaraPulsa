import { TOAST_DURATION } from '../config/app.js';

export function createToast(selector) {
  const element = document.querySelector(selector);
  return (title, message) => {
    element.querySelector('#toastTitle').textContent = title;
    element.querySelector('#toastMessage').textContent = message;
    element.classList.add('show');
    window.setTimeout(() => element.classList.remove('show'), TOAST_DURATION);
  };
}

