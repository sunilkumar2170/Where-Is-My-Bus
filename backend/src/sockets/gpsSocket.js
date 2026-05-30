const prisma = require('../db');

const gpsSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Driver GPS bhejta hai
    socket.on('sendLocation', async (data) => {
      const { busId, lat, lng, speed } = data;

      try {
        // Database mein save karo
        await prisma.liveLocation.create({
          data: { busId, lat, lng, speed }
        });

        // Sab parents ko broadcast karo
        io.emit('locationUpdate', { busId, lat, lng, speed });

        console.log(`Bus ${busId} → ${lat}, ${lng} @ ${speed}km/h`);
      } catch (err) {
        console.log('GPS Error:', err.message);
      }
    });

    // Driver trip start karta hai
    socket.on('startTrip', async (data) => {
      const { busId } = data;
      await prisma.bus.update({
        where: { id: busId },
        data: { status: 'ON_TRIP' }
      });
      io.emit('tripStarted', { busId });
      console.log(`Trip started: Bus ${busId}`);
    });

    // Driver trip end karta hai
    socket.on('endTrip', async (data) => {
      const { busId } = data;
      await prisma.bus.update({
        where: { id: busId },
        data: { status: 'ACTIVE' }
      });
      io.emit('tripEnded', { busId });
      console.log(`Trip ended: Bus ${busId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

module.exports = gpsSocket;