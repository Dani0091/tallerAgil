// Middleware de autenticación (simplificado por ahora)
function authMiddleware(req, res, next) {
  // Por ahora pasa todas las peticiones
  // En producción aquí validarías el token de Telegram
  next();
}

module.exports = authMiddleware;