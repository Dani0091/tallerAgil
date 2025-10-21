// src/utils/validators.js

/**
 * Valida un NIF/NIE español según el algoritmo oficial
 * @param {string} nif - NIF/NIE a validar
 * @returns {boolean} True si es válido, false en caso contrario
 * @example
 * isValidNIF('12345678Z') // true
 * isValidNIF('X1234567L') // true
 * isValidNIF('invalid') // false
 */
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

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido, false en caso contrario
 * @example
 * isValidEmail('test@example.com') // true
 * isValidEmail('invalid') // false
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida número de teléfono español
 * @param {string} phone - Teléfono a validar
 * @returns {boolean} True si es válido, false en caso contrario
 * @example
 * isValidPhone('666777888') // true
 * isValidPhone('+34 666 777 888') // true
 * isValidPhone('invalid') // false
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const regex = /^(\+34|0034|34)?[6789]\d{8}$/;
  return regex.test(phone.replace(/\s/g, ''));
}

/**
 * Valida matrícula de vehículo española (formato: 1234ABC)
 * @param {string} matricula - Matrícula a validar
 * @returns {boolean} True si es válido, false en caso contrario
 * @example
 * isValidMatricula('1234ABC') // true
 * isValidMatricula('1234 ABC') // true
 * isValidMatricula('invalid') // false
 */
function isValidMatricula(matricula) {
  if (!matricula) return false;
  const regex = /^[0-9]{4}[A-Z]{3}$/i;
  return regex.test(matricula.replace(/\s|-/g, ''));
}

/**
 * Valida que una cadena no esté vacía y tenga longitud mínima
 * @param {string} str - Cadena a validar
 * @param {number} minLength - Longitud mínima requerida (default: 1)
 * @returns {boolean} True si es válido, false en caso contrario
 */
function isNotEmpty(str, minLength = 1) {
  if (typeof str !== 'string') return false;
  return str.trim().length >= minLength;
}

/**
 * Valida que un número sea positivo
 * @param {number} num - Número a validar
 * @returns {boolean} True si es válido, false en caso contrario
 */
function isPositiveNumber(num) {
  return typeof num === 'number' && !isNaN(num) && num > 0;
}

/**
 * Valida que un número esté en un rango
 * @param {number} num - Número a validar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {boolean} True si está en rango, false en caso contrario
 */
function isInRange(num, min, max) {
  return typeof num === 'number' && !isNaN(num) && num >= min && num <= max;
}

/**
 * Valida datos de cliente completos
 * @param {Object} data - Datos del cliente
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateClientData(data) {
  const errors = [];

  if (!isNotEmpty(data.nombre, 2)) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }

  if (!isNotEmpty(data.apellidos, 2)) {
    errors.push('Los apellidos deben tener al menos 2 caracteres');
  }

  if (!isValidNIF(data.nif)) {
    errors.push('El NIF/NIE no es válido');
  }

  if (!isValidEmail(data.email)) {
    errors.push('El email no es válido');
  }

  if (!isNotEmpty(data.direccion, 5)) {
    errors.push('La dirección debe tener al menos 5 caracteres');
  }

  if (data.telefono && !isValidPhone(data.telefono)) {
    errors.push('El teléfono no es válido');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de OT
 * @param {Object} data - Datos de la OT
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateOTData(data) {
  const errors = [];

  if (!data.cliente_id || !isNotEmpty(data.cliente_id)) {
    errors.push('El ID de cliente es requerido');
  }

  if (!isValidMatricula(data.matricula)) {
    errors.push('La matrícula no es válida (formato: 1234ABC)');
  }

  if (!isNotEmpty(data.marca, 2)) {
    errors.push('La marca es requerida');
  }

  if (!isNotEmpty(data.modelo, 2)) {
    errors.push('El modelo es requerido');
  }

  if (!isNotEmpty(data.descripcion, 10)) {
    errors.push('La descripción debe tener al menos 10 caracteres');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida línea de OT/Factura
 * @param {Object} linea - Línea a validar
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateLineaData(linea) {
  const errors = [];

  if (!linea.tipo || !['mano_obra', 'repuesto', 'otro'].includes(linea.tipo)) {
    errors.push('Tipo debe ser: mano_obra, repuesto o otro');
  }

  if (!isNotEmpty(linea.descripcion, 3)) {
    errors.push('La descripción debe tener al menos 3 caracteres');
  }

  if (!isPositiveNumber(linea.cantidad)) {
    errors.push('La cantidad debe ser un número positivo');
  }

  if (!isPositiveNumber(linea.precio_unitario)) {
    errors.push('El precio unitario debe ser un número positivo');
  }

  if (linea.descuento_porcentaje !== undefined && !isInRange(linea.descuento_porcentaje, 0, 100)) {
    errors.push('El descuento debe estar entre 0 y 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitiza texto para prevenir inyección HTML en mensajes de Telegram
 * @param {string} text - Texto a sanitizar
 * @returns {string} Texto sanitizado
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

module.exports = {
  isValidNIF,
  isValidEmail,
  isValidPhone,
  isValidMatricula,
  isNotEmpty,
  isPositiveNumber,
  isInRange,
  validateClientData,
  validateOTData,
  validateLineaData,
  sanitizeText
};