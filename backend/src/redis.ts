import { Redis } from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

// Izmantojam Docker compose vidi (redis://cache:6379) vai localhost, ja testējam ārpus Docker
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// 1. Galvenais klients - izmantosim Rate Limiting, sesijām un kešošanai
export const redis = new Redis(redisUrl);

// 2. Pub/Sub Publisher (ziņojumu sūtītājs)
export const redisPublisher = new Redis(redisUrl);

// 3. Pub/Sub Subscriber (ziņojumu klausītājs)
export const redisSubscriber = new Redis(redisUrl);

redis.on('connect', () => {
  console.log('Veiksmīgi savienots ar Redis!');
});

redis.on('error', (err) => {
  console.error('Redis savienojuma kļūda:', err);
});