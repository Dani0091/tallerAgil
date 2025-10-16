// src/utils/formatters.js

function formatEUR(amount) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(date, format = 'es') {
  if (!(date instanceof Date)) return '';

  if (format === 'es') {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  return date.toISOString().split('T')[0];
}

function formatNIF(nif) {
  if (!nif || nif.length < 9) return nif;
  return `${nif.substring(0, 4)} ${nif.substring(4, 8)} ${nif.substring(8)}`;
}

function formatMatricula(matricula) {
  if (!matricula || matricula.length < 7) return matricula;
  return `${matricula.substring(0, 4)}-${matricula.substring(4)}`;
}

module.exports = {
  formatEUR,
  formatDate,
  formatNIF,
  formatMatricula
};