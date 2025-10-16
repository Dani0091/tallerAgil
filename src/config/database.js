const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB conectado:', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;