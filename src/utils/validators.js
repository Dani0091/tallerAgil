// src/utils/validators.js

function isValidNIF(nif) {
  if (!nif || typeof nif !== 'string') return false;

  const regex = /^([0-9]{8}|[XYZ][0-9]{7})([A-Z])$/i;
  if (!regex.test(nif.toUpperCase())) return false;

  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const nifUpper = nif.toUpperCase();

  let number;
  if (/^[0-9]{8}$/.test(nifUpper.substring(0, 8))) {
    number = parseInt(nifUpper.substring(0, 8));
  } else {
    const firstLetter = nifUpper.charAt(0);
    const map = { X: 0, Y: 1, Z: 2 };
    number = map[firstLetter] * 10000000 + parseInt(nifUpper.substring(1, 8));
  }

  const letter = nifUpper.charAt(nifUpper.length - 1);
  const expectedLetter = letters[number % 23];

  return letter === expectedLetter;
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidPhone(phone) {
  if (!phone) return false;
  const regex = /^(\+34|0034|34)?[6789]\d{8}$/;
  return regex.test(phone.replace(/\s/g, ''));
}

function isValidMatricula(matricula) {
  if (!matricula) return false;
  const regex = /^[0-9]{4}[A-Z]{3}$/i;
  return regex.test(matricula.replace(/\s|-/g, ''));
}

module.exports = {
  isValidNIF,
  isValidEmail,
  isValidPhone,
  isValidMatricula
};