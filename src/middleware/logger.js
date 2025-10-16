function loggerMiddleware(req, res, next) {
  const start = Date.now();

  const originalJson = res.json.bind(res);

  res.json = function(data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} → ${statusCode} (${duration}ms)`
    );

    return originalJson(data);
  };

  next();
}

module.exports = loggerMiddleware;