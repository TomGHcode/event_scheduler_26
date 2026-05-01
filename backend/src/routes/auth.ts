import { authenticate } from '../middleware/auth';
import crypto from 'crypto';
import { redis } from '../redis';
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from '../db';

// Zod validācijas shēma (atbilstoši specifikācijai) [cite: 11]
const UserAuthSchema = z.object({
  username: z.string().min(3, "Lietotājvārdam jābūt vismaz 3 simbolus garam"),
  password: z.string().min(6, "Parolei jābūt vismaz 6 simbolus garai"),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    try {
      // 1. Validējam ienākošos datus ar Zod [cite: 11]
      const parsedBody = UserAuthSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ 
          error: 'Nekorekti dati', 
          details: parsedBody.error.format() 
        });
      }

      const { username, password } = parsedBody.data;

      // 2. Pārbaudām, vai lietotājs jau eksistē datubāzē
      const existingUser = await db.selectFrom('users')
        .select('id')
        .where('username', '=', username)
        .executeTakeFirst();

      if (existingUser) {
        return reply.status(409).send({ error: 'Lietotājvārds jau ir aizņemts' });
      }

      // 3. Šifrējam paroli
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // 4. Saglabājam lietotāju tabulā (Kysely Type-Safe SQL) [cite: 8]
      const newUser = await db.insertInto('users')
        .values({
          username,
          password_hash,
          role: 'User', // Atbilstoši specifikācijas lomām [cite: 27]
          timezone: 'UTC', // Noklusējuma laika zona [cite: 40]
          settings_json: JSON.stringify({}),
        })
        .returning(['id', 'username', 'role', 'timezone']) // Drošības nolūkos atgriežam datus BEZ paroles
        .executeTakeFirstOrThrow();

      return reply.status(201).send({ 
        message: 'Lietotājs veiksmīgi reģistrēts!', 
        user: newUser 
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Iekšēja servera kļūda' });
    }
  });
  fastify.post('/login', async (request, reply) => {
    try {
      // 1. Validējam datus ar to pašu Zod shēmu
      const parsedBody = UserAuthSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Nekorekti dati' });
      }

      const { username, password } = parsedBody.data;

      // 2. Atrodam lietotāju datubāzē
      const user = await db.selectFrom('users')
        .select(['id', 'username', 'password_hash', 'role'])
        .where('username', '=', username)
        .executeTakeFirst();

      if (!user) {
        return reply.status(401).send({ error: 'Nepareizs lietotājvārds vai parole' });
      }

      // 3. Pārbaudām paroli
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Nepareizs lietotājvārds vai parole' });
      }

      // 4. Izveidojam drošu sesiju un saglabājam to Redis 
      const sessionId = crypto.randomUUID();
      // Saglabājam Redis uz 7 dienām (604800 sekundēm)
      await redis.set(`session:${sessionId}`, JSON.stringify({ userId: user.id, role: user.role }), 'EX', 604800);

      // 5. Nosūtām sīkdatni klientam
      reply.setCookie('sessionId', sessionId, {
        path: '/',
        httpOnly: true, // Aizsargā pret XSS uzbrukumiem (JavaScript nevar nolasīt)
        secure: process.env.NODE_ENV === 'production', // Produkcijā atļauts tikai caur HTTPS
        sameSite: 'lax',
        maxAge: 604800, // 7 dienas
      });

      return reply.status(200).send({
        message: 'Veiksmīga pieteikšanās!',
        user: { id: user.id, username: user.username, role: user.role }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Iekšēja servera kļūda' });
    }
  });
  // Aizsargāts maršruts - prasa autorizāciju
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    // Ja mēs nokļūstam šeit, authenticate middleware ir veiksmīgi izgājis
    // un request.user eksistē!
    const user = request.user;
    
    return reply.status(200).send({ 
      message: 'Jums ir piekļuve šim aizsargātajam maršrutam!',
      currentUser: user 
    });
  });
}