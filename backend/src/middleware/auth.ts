import { FastifyReply, FastifyRequest } from 'fastify';
import { redis } from '../redis';

// 1. Paplašinām TypeScript tipu, lai atļautu request.user īpašību
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: number;
      role: string;
    };
  }
}

// 2. Pati starpniekprogrammatūra (Middleware)
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Iegūstam sesijas ID no sīkdatnēm
    const sessionId = request.cookies.sessionId;

    if (!sessionId) {
      return reply.status(401).send({ error: 'Lūdzu, pieslēdzieties sistēmai (nav sesijas)' });
    }

    // Pārbaudām sesiju iekš Redis
    const sessionData = await redis.get(`session:${sessionId}`);

    if (!sessionData) {
      // Sīkdatne ir, bet Redis datu vairs nav (piem., beidzies termiņš)
      return reply.status(401).send({ error: 'Sesija ir beigusies, lūdzu, pieslēdzieties no jauna' });
    }

    // Parsējam datus un pievienojam request objektam turpmākai izmantošanai
    request.user = JSON.parse(sessionData);

  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ error: 'Iekšēja servera kļūda autorizācijas laikā' });
  }
}