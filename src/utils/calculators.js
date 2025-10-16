// src/utils/calculators.js

function calculateIVA(subtotal, tasa = 21) {
  const iva = Math.round(subtotal * (tasa / 100) * 100) / 100;
  const total = subtotal + iva;

  return { iva, total };
}

function calculateDescuento(subtotal, descuentoPorcentaje) {
  const descuento = Math.round(subtotal * (descuentoPorcentaje / 100) * 100) / 100;
  const subtotalConDescuento = subtotal - descuento;

  return { descuento, subtotalConDescuento };
}

function calculateDiasPendientes(fechaVencimiento) {
  const hoy = new Date();
  const tiempo = fechaVencimiento - hoy;
  const dias = Math.ceil(tiempo / (1000 * 60 * 60 * 24));
  return dias;
}

function calculateDiasEnProceso(fechaInicio) {
  if (!fechaInicio) return 0;
  const hoy = new Date();
  const tiempo = hoy - fechaInicio;
  return Math.floor(tiempo / (1000 * 60 * 60 * 24));
}

module.exports = {
  calculateIVA,
  calculateDescuento,
  calculateDiasPendientes,
  calculateDiasEnProceso
};