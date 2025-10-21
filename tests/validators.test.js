// tests/validators.test.js

/**
 * Tests básicos para el módulo de validadores
 *
 * Para ejecutar los tests:
 * npm install --save-dev jest
 * npm test
 *
 * O ejecutar directamente con Node.js para verificación rápida
 */

const {
  isValidNIF,
  isValidEmail,
  isValidPhone,
  isValidMatricula,
  isNotEmpty,
  isPositiveNumber,
  isInRange,
  validateClientData,
  validateOTData,
  sanitizeText
} = require('../src/utils/validators');

// Tests para isValidNIF
console.log('=== Tests isValidNIF ===');
console.assert(isValidNIF('12345678Z') === true, 'NIF válido debe pasar');
console.assert(isValidNIF('X1234567L') === true, 'NIE válido debe pasar');
console.assert(isValidNIF('invalid') === false, 'NIF inválido debe fallar');
console.assert(isValidNIF('') === false, 'NIF vacío debe fallar');
console.assert(isValidNIF(null) === false, 'NIF null debe fallar');
console.log('✅ isValidNIF OK');

// Tests para isValidEmail
console.log('\n=== Tests isValidEmail ===');
console.assert(isValidEmail('test@example.com') === true, 'Email válido debe pasar');
console.assert(isValidEmail('user.name+tag@domain.co.uk') === true, 'Email complejo válido debe pasar');
console.assert(isValidEmail('invalid') === false, 'Email sin @ debe fallar');
console.assert(isValidEmail('test@') === false, 'Email incompleto debe fallar');
console.assert(isValidEmail('') === false, 'Email vacío debe fallar');
console.log('✅ isValidEmail OK');

// Tests para isValidPhone
console.log('\n=== Tests isValidPhone ===');
console.assert(isValidPhone('666777888') === true, 'Teléfono válido debe pasar');
console.assert(isValidPhone('+34 666 777 888') === true, 'Teléfono con prefijo y espacios debe pasar');
console.assert(isValidPhone('666 777 888') === true, 'Teléfono con espacios debe pasar');
console.assert(isValidPhone('123456') === false, 'Teléfono corto debe fallar');
console.assert(isValidPhone('') === false, 'Teléfono vacío debe fallar');
console.log('✅ isValidPhone OK');

// Tests para isValidMatricula
console.log('\n=== Tests isValidMatricula ===');
console.assert(isValidMatricula('1234ABC') === true, 'Matrícula válida debe pasar');
console.assert(isValidMatricula('1234 ABC') === true, 'Matrícula con espacio debe pasar');
console.assert(isValidMatricula('1234-ABC') === true, 'Matrícula con guion debe pasar');
console.assert(isValidMatricula('ABC1234') === false, 'Matrícula formato incorrecto debe fallar');
console.assert(isValidMatricula('123ABC') === false, 'Matrícula incompleta debe fallar');
console.log('✅ isValidMatricula OK');

// Tests para isNotEmpty
console.log('\n=== Tests isNotEmpty ===');
console.assert(isNotEmpty('test') === true, 'String no vacío debe pasar');
console.assert(isNotEmpty('test', 3) === true, 'String con longitud suficiente debe pasar');
console.assert(isNotEmpty('te', 3) === false, 'String muy corto debe fallar');
console.assert(isNotEmpty('   ') === false, 'String solo espacios debe fallar');
console.assert(isNotEmpty('') === false, 'String vacío debe fallar');
console.log('✅ isNotEmpty OK');

// Tests para isPositiveNumber
console.log('\n=== Tests isPositiveNumber ===');
console.assert(isPositiveNumber(10) === true, 'Número positivo debe pasar');
console.assert(isPositiveNumber(0.5) === true, 'Decimal positivo debe pasar');
console.assert(isPositiveNumber(0) === false, 'Cero debe fallar');
console.assert(isPositiveNumber(-5) === false, 'Número negativo debe fallar');
console.assert(isPositiveNumber('10') === false, 'String debe fallar');
console.log('✅ isPositiveNumber OK');

// Tests para isInRange
console.log('\n=== Tests isInRange ===');
console.assert(isInRange(5, 0, 10) === true, 'Número en rango debe pasar');
console.assert(isInRange(0, 0, 10) === true, 'Número en límite inferior debe pasar');
console.assert(isInRange(10, 0, 10) === true, 'Número en límite superior debe pasar');
console.assert(isInRange(-1, 0, 10) === false, 'Número fuera de rango debe fallar');
console.assert(isInRange(11, 0, 10) === false, 'Número fuera de rango debe fallar');
console.log('✅ isInRange OK');

// Tests para validateClientData
console.log('\n=== Tests validateClientData ===');
const clientValid = {
  nombre: 'Juan',
  apellidos: 'Pérez',
  nif: '12345678Z',
  email: 'juan@example.com',
  direccion: 'Calle Mayor 1'
};
const resultValid = validateClientData(clientValid);
console.assert(resultValid.valid === true, 'Cliente válido debe pasar');

const clientInvalid = {
  nombre: 'J',
  apellidos: 'Pérez',
  nif: 'invalid',
  email: 'invalid',
  direccion: 'abc'
};
const resultInvalid = validateClientData(clientInvalid);
console.assert(resultInvalid.valid === false, 'Cliente inválido debe fallar');
console.assert(resultInvalid.errors.length > 0, 'Debe retornar errores');
console.log('✅ validateClientData OK');

// Tests para validateOTData
console.log('\n=== Tests validateOTData ===');
const otValid = {
  cliente_id: 'abc-123',
  matricula: '1234ABC',
  marca: 'Ford',
  modelo: 'Focus',
  descripcion: 'Cambio de aceite y filtros'
};
const otResultValid = validateOTData(otValid);
console.assert(otResultValid.valid === true, 'OT válida debe pasar');

const otInvalid = {
  cliente_id: '',
  matricula: 'invalid',
  marca: 'F',
  modelo: 'F',
  descripcion: 'abc'
};
const otResultInvalid = validateOTData(otInvalid);
console.assert(otResultInvalid.valid === false, 'OT inválida debe fallar');
console.assert(otResultInvalid.errors.length > 0, 'Debe retornar errores');
console.log('✅ validateOTData OK');

// Tests para sanitizeText
console.log('\n=== Tests sanitizeText ===');
console.assert(sanitizeText('<script>alert("xss")</script>') === '&lt;script&gt;alert("xss")&lt;/script&gt;', 'Debe escapar HTML');
console.assert(sanitizeText('  test  ') === 'test', 'Debe eliminar espacios');
console.assert(sanitizeText('a & b') === 'a &amp; b', 'Debe escapar &');
console.assert(sanitizeText(null) === '', 'null debe retornar vacío');
console.log('✅ sanitizeText OK');

console.log('\n✅ ¡Todos los tests pasaron correctamente!');
