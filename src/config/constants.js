module.exports = {
  TARIFA_HORA: parseFloat(process.env.TARIFA_HORA || 40),
  IVA_DEFECTO: parseFloat(process.env.IVA_DEFECTO || 21),
  CACHE_TTL: 5 * 60 * 1000,
  
  EMPRESA: {
    nombre: process.env.EMPRESA_NOMBRE || 'R&S Automoción',
    nif: process.env.EMPRESA_NIF || 'B22757140',
    direccion: process.env.EMPRESA_DIRECCION || 'Calle Melitón Comes, 7',
    ciudad: process.env.EMPRESA_CIUDAD || '46960 Aldaia (Valencia)',
    telefono: process.env.EMPRESA_TELEFONO || '',
    email: process.env.EMPRESA_EMAIL || '',
  },

  OT_ESTADOS: {
    ADMITIDO: 'admitido',
    EN_PROCESO: 'en_proceso',
    FINALIZADO: 'finalizado',
    CANCELADO: 'cancelado',
  },

  FACTURA_ESTADOS: {
    PENDIENTE: 'pendiente',
    PARCIAL: 'parcial',
    PAGADO: 'pagado',
    VENCIDO: 'vencido',
  },

  METODOS_PAGO: {
    TRANSFERENCIA: 'transferencia',
    EFECTIVO: 'efectivo',
    CHEQUE: 'cheque',
    TARJETA: 'tarjeta',
    OTRO: 'otro',
  },
};