require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize } = require('./models');
const app = require('./app');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✓ Base de datos conectada');

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✓ Modelos sincronizados');

    app.listen(PORT, '0.0.0.0', () => {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      let localIP = 'localhost';
      for (const ifaces of Object.values(nets)) {
        for (const iface of ifaces) {
          if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
        }
      }
      console.log(`✓ Servidor corriendo en:`);
      console.log(`  Local:   http://localhost:${PORT}`);
      console.log(`  Red:     http://${localIP}:${PORT}`);
    });
  } catch (error) {
    console.error('✗ Error al iniciar:', error.message);
    process.exit(1);
  }
}

start();
