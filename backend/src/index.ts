import adminRoutes from './routes/admin';
import eventRoutes from './routes/events';
import availabilityRoutes from './routes/availability';
import cookie from '@fastify/cookie';
import { RawData } from 'ws';
import authRoutes from './routes/auth';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import { db } from './db';
import { redis, redisPublisher, redisSubscriber } from './redis';

const app = Fastify({
  logger: true,
});

app.register(helmet);
app.register(cors, {
  origin: '*',
});

app.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'loti-slepena-atslega-kas-janomaina-produkcija', // Paraksta sīkdatnes drošībai
});

app.register(websocket);

// Iestatām Rate Limiting, izmantojot mūsu Redis instanci
app.register(fastifyRateLimit, {
  global: true, // Attiecas uz visiem maršrutiem (var pārrakstīt konkrētiem)
  max: 100, // Maksimālais pieprasījumu skaits no vienas IP
  timeWindow: '1 minute', // Laika logs
  redis: redis,
});

app.get('/api/health', async (request, reply) => {
  try {
    const result = await db.selectFrom('users').select('id').limit(1).execute();
    // Pievienojam arī Redis statusa pārbaudi
    const redisPing = await redis.ping();
    return { status: 'ok', db_connected: true, redis_status: redisPing };
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ status: 'error', db_connected: false });
  }
});

// Reāllaika WebSockets ar Redis Pub/Sub integrāciju
app.register(async function (fastify) {
  fastify.get('/api/ws', { websocket: true }, (connection, req) => {
    // Kad kāds pieslēdzas, abonējam Redis "heatmap_updates" kanālu
    const channelName = 'heatmap_updates';
    
    // Subscriber klausās izmaiņas no Redis un sūta tās tālāk konkrētajam WS klientam
	redisSubscriber.subscribe(channelName);
    redisSubscriber.on('message', (channel, message) => {
      if (channel === channelName) {
        connection.send(message);
      }
    });

    // Pagaidu loģika: ienākošo ziņu publicējam visiem caur Redis Pub/Sub
	// Pievienojam : RawData tipu mainīgajam
	connection.on('message', async (message: RawData) => {
      app.log.info(`Saņemta ziņa: ${message}`);
      await redisPublisher.publish(channelName, JSON.stringify({ type: 'update', data: message.toString() }));
    });

    connection.on('close', () => {
      redisSubscriber.unsubscribe(channelName);
    });
  });
});


// Reģistrējam API maršrutus
app.register(authRoutes, { prefix: '/api/auth' });

// Reģistrējam events
app.register(eventRoutes, { prefix: '/api/events' });

// Reģistrējam Availability
app.register(availabilityRoutes, { prefix: '/api/availability' });

// Reģistrējam Admin routes
app.register(adminRoutes, { prefix: '/api/admin' });

// Startējam serveri
const start = async () => {
  try {
    // Serveris klausās uz 0.0.0.0, lai Docker konteinerī to varētu sasniegt no ārpuses
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Backend serveris veiksmīgi palaists uz porta 3000!');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();