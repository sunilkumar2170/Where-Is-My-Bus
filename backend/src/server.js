require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const prisma = require('./db');
const gpsSocket = require('./sockets/gpsSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Where Is My Bus Backend Running ✅' });
});

prisma.$connect()
  .then(() => console.log('Database Connected ✅'))
  .catch(err => console.log('DB Error:', err.message));

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const busRoutes = require('./routes/busRoutes');
app.use('/api/buses', busRoutes);

const tripRoutes = require('./routes/tripRoutes');
app.use('/api/trips', tripRoutes);

const stopRoutes = require('./routes/stopRoutes');
app.use('/api/stops', stopRoutes);
// GPS Socket
gpsSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} ✅`));