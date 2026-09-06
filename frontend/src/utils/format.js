export const money = value => new Intl.NumberFormat('id-ID').format(value);

export const dateFmt = value => new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date(value));

export const initials = name => name
  .split(' ')
  .slice(0, 2)
  .map(part => part[0])
  .join('')
  .toUpperCase();

