import { authenticate } from '../middleware/auth';
import crypto from 'crypto';
import { redis } from '../redis';
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from '../db';


// Discord autentifikācijas slepenie piekļuves dati
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost/api/auth/discord/callback';


// Zod validācijas shēma
const UserAuthSchema = z.object({
  username: z.string().min(3, "Lietotājvārdam jābūt vismaz 3 simbolus garam"),
  password: z.string().min(6, "Parolei jābūt vismaz 6 simbolus garai"),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    try {
      // 1. Validējam ienākošos datus ar Zod
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

      // 4. Saglabājam lietotāju tabulā (Kysely Type-Safe SQL)
      const newUser = await db.insertInto('users')
        .values({
          username,
          password_hash,
          role: 'User', // Atbilstoši specifikācijas lomām
          timezone: 'UTC', // Noklusējuma laika zona
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
  
  fastify.post('/logout', async (request, reply) => {
    try {
      const sessionId = request.cookies.sessionId;
      
      if (sessionId) {
        // 1. Izdzēšam sesiju no Redis
        await redis.del(`session:${sessionId}`);
        
        // 2. Iztīram sīkdatni no lietotāja pārlūka
        reply.clearCookie('sessionId', { path: '/' });
      }

      return reply.status(200).send({ message: 'Veiksmīgi iziets no sistēmas' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Iekšēja servera kļūda' });
    }
  });
  
  // Aizsargāts maršruts - prasa autorizāciju
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    // Iegūstam svaigākos datus no datubāzes, ieskaitot iestatījumus
    const user = await db.selectFrom('users')
      .select(['id', 'username', 'role', 'timezone', 'settings_json'])
      .where('id', '=', request.user!.userId)
      .executeTakeFirst();

    if (!user) {
      return reply.status(404).send({ error: 'Lietotājs nav atrasts' });
    }
    
	return reply.status(200).send({ 
      currentUser: {
        userId: user.id,
        username: user.username,
        role: user.role,
        timezone: user.timezone,
        settings: user.settings_json // { timeFormat: '24h' vai '12h' }
      } 
    });
  });
	
  // Lietotāja iestatījumu saglabāšana
  fastify.put('/settings', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { timezone, timeFormat } = request.body as any; // (vēlāk jāpievieno Zod validācija)
      
      const settings_json = JSON.stringify({ timeFormat: timeFormat || '24h' });

      await db.updateTable('users')
        .set({ timezone: timezone || 'UTC', settings_json })
        .where('id', '=', request.user!.userId)
        .execute();

      return reply.status(200).send({ message: 'Iestatījumi saglabāti' });
    } catch (error) {
      request.server.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās saglabāt iestatījumus' });
    }
  });

  // Konta un visu tā datu dzēšana
  fastify.delete('/account', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const sessionId = request.cookies.sessionId;

      // 1. Izdzēšam lietotāju no datubāzes (PostgreSQL CASCADE izdzēsīs visu pārējo)
      await db.deleteFrom('users').where('id', '=', userId).execute();

      // 2. Iznīcinām sesiju
      if (sessionId) {
        await redis.del(`session:${sessionId}`);
        reply.clearCookie('sessionId', { path: '/' });
      }

      return reply.status(200).send({ message: 'Konts veiksmīgi izdzēsts' });
    } catch (error) {
      request.server.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās izdzēst kontu' });
    }
  });
  
  // -- DISCORD INTEGRĀCIJA --
  // 1. Maršruts: Lietotāja novirzīšana uz Discord login lapu
  fastify.get('/discord/login', async (request, reply) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
    return reply.redirect(url);
  });

  // 2. Maršruts: Discord atgriež lietotāju ar "code"
  fastify.get('/discord/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send({ error: 'Nav autorizācijas koda no Discord' });

    try {
      // A. Apmainām kodu pret Access Token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: DISCORD_REDIRECT_URI,
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) return reply.status(400).send({ error: 'Neizdevās iegūt token no Discord' });

      // B. Iegūstam lietotāja datus no Discord
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { authorization: `Bearer ${tokenData.access_token}` }
      });
      const discordUser = await userResponse.json();

      // C. Pārbaudām, vai šāds Discord ID jau eksistē datubāzē[cite: 1]
      let user = await db.selectFrom('users')
        .selectAll()
        .where('discord_id', '=', discordUser.id)
        .executeTakeFirst();

      if (!user) {
        // Lietotājs neeksistē - izveidojam jaunu!
        // Tā kā password_hash ir obligāts lauks, ģenerējam drošu nejaušu rindu, 
        // ko neviens nezina (lietotājs turpmāk slēgsies tikai caur Discord).
        const randomPass = crypto.randomBytes(32).toString('hex');
        const password_hash = await bcrypt.hash(randomPass, 10);

        // Lai izvairītos no vienādiem lietotājvārdiem, varam pielikt identifikatoru
        const safeUsername = `${discordUser.username}_${crypto.randomBytes(2).toString('hex')}`;

        user = await db.insertInto('users')
          .values({
            username: safeUsername,
            password_hash,
            discord_id: discordUser.id, // Saglabājam viņa Discord ID[cite: 1, 2]
            role: 'User',
            timezone: 'UTC',
            settings_json: JSON.stringify({}),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      // D. Izveidojam drošu sesiju (tieši tāpat kā lokālajā Login)
      const sessionId = crypto.randomUUID();
      await redis.set(`session:${sessionId}`, JSON.stringify({ userId: user.id, role: user.role }), 'EX', 604800);

      reply.setCookie('sessionId', sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 604800,
      });

      // E. Veiksmīgi pabeigts, novirzām uz frontend sākumlapu
      return reply.redirect('/');

    } catch (error) {
      request.server.log.error(error);
      return reply.redirect('/login?error=discord_failed');
    }
  });
}