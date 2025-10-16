function errorHandler(err, req, res, next) {
  console.error('ERROR:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.name === 'MongooseError') {
    return res.status(400).json({
      error: 'Database error',
      message: err.message
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(422).json({
      error: 'Validation failed',
      message: err.message
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Unknown error'
  });
}

module.exports = errorHandler;