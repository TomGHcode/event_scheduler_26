import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { authenticate } from '../middleware/auth';

export default async function adminRoutes(fastify: FastifyInstance) {
  // Pievienojam autentifikācijas starpniekprogrammatūru (Middleware)
  fastify.addHook('preHandler', authenticate);

  // Papildus Middleware, kas stingri pārbauda, vai lietotājs ir Administrators[cite: 1]
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.user!.role !== 'Administrator') {
      return reply.status(403).send({ error: 'Piekļuve liegta. Tikai Administratoriem.' });
    }
  });

  // 1. Iegūt visus lietotājus
  fastify.get('/users', async (request, reply) => {
    try {
      const users = await db.selectFrom('users')
        .select(['id', 'username', 'discord_id', 'role', 'timezone'])
        .orderBy('id', 'asc')
        .execute();
      return reply.status(200).send({ users });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās iegūt lietotājus' });
    }
  });

  // 2. Dzēst lietotāju un visus tā datus
  fastify.delete('/users/:id', async (request, reply) => {
    try {
      const targetId = parseInt((request.params as any).id, 10);
      
      // Neļaujam adminam netīšām izdzēst pašam sevi (tam ir domāta poga Dashboard skatā)
      if (targetId === request.user!.userId) {
        return reply.status(400).send({ error: 'Nevarat izdzēst paši savu kontu caur Admin paneli.' });
      }

      await db.deleteFrom('users').where('id', '=', targetId).execute();
      return reply.status(200).send({ message: 'Lietotājs un viņa dati izdzēsti' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās izdzēst lietotāju' });
    }
  });

  // 3. Mainīt lietotāja lomu
  fastify.patch('/users/:id/role', async (request, reply) => {
    try {
      const targetId = parseInt((request.params as any).id, 10);
      const { role } = request.body as { role: 'Administrator' | 'User' };
      
      if (targetId === request.user!.userId) {
        return reply.status(400).send({ error: 'Nevarat mainīt paši savu lomu.' });
      }

      await db.updateTable('users').set({ role }).where('id', '=', targetId).execute();
      return reply.status(200).send({ message: 'Loma atjaunināta' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās mainīt lomu' });
    }
  });
}