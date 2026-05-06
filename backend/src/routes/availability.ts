import { broadcastEventUpdate } from './events';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { authenticate } from '../middleware/auth';

// Validācijas shēmas
const IntervalSchema = z.object({
  start_minute: z.number().min(0).max(10079), // Minūtes no nedēļas sākuma
  end_minute: z.number().min(0).max(10079),
  status_level: z.enum(['Pieejams', 'Varbut', 'Nav pieejams']), // Statusu līmeņi 
});

const CreateTableSchema = z.object({
  name: z.string().min(1, "Tabulas nosaukums ir obligāts").max(64, "Maksimāli 64 simboli"),
  is_active: z.boolean().default(true),
  intervals: z.array(IntervalSchema).max(42, "Maksimāli atļauti 42 intervāli"),
});

export default async function availabilityRoutes(fastify: FastifyInstance) {
  // Pievienojam mūsu authenticate middleware visiem šīs grupas maršrutiem
  fastify.addHook('preHandler', authenticate);

  // 1. Izveidot jaunu pieejamības tabulu ar intervāliem
  fastify.post('/', {
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } }
  }, async (request, reply) => {
	  
    try {
      const parsedBody = CreateTableSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Nekorekti dati', details: parsedBody.error.format() });
      }

      const { name, is_active, intervals } = parsedBody.data;
      const userId = request.user!.userId;
	  const userRole = request.user!.role;

      // Izmantojam datubāzes transakciju
      const result = await db.transaction().execute(async (trx) => {
        // A. Izveidojam pašu tabulu
        const newTable = await trx.insertInto('availability_tables')
          .values({
            user_id: userId,
            name,
            is_active,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
		
	  // LIMITA PĀRBAUDE: max 5 Tabulas (izņemot Admin)
		if (userRole !== 'Administrator') {
			const tableCountRes = await db.selectFrom('availability_tables')
			  .select(db.fn.count('id').as('total'))
			  .where('user_id', '=', userId)
			  .executeTakeFirst();
			
			if (Number(tableCountRes?.total || 0) >= 5) {
			  return reply.status(403).send({ error: 'Sasniegts maksimālais pieejamības tabulu skaits (5).' });
			  }
		 }

        // B. Pievienojam intervālus, ja tādi ir norādīti
        if (intervals.length > 0) {
          const intervalsToInsert = intervals.map(interval => ({
            table_id: newTable.id,
            start_minute: interval.start_minute,
            end_minute: interval.end_minute,
            status_level: interval.status_level,
          }));

          await trx.insertInto('intervals')
            .values(intervalsToInsert)
            .execute();
        }

        return newTable;
      });

      return reply.status(201).send({ message: 'Pieejamības tabula veiksmīgi izveidota!', tableId: result.id });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās izveidot pieejamības tabulu' });
    }
  });

  // 2. Iegūt visas aktīvā lietotāja tabulas
  fastify.get('/', async (request, reply) => {
    try {
      const userId = request.user!.userId;

      // Iegūstam tabulas
      const tables = await db.selectFrom('availability_tables')
        .selectAll()
        .where('user_id', '=', userId)
        .execute();

      return reply.status(200).send({ tables });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās iegūt pieejamības tabulas' });
    }
  });
  
  // 3. Iegūt vienu konkrētu tabulu ar tās intervāliem
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tableId = parseInt(id, 10);
      const userId = request.user!.userId;

      // Iegūstam tabulu (pārbaudot, vai tā pieder lietotājam)
      const table = await db.selectFrom('availability_tables')
        .selectAll()
        .where('id', '=', tableId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!table) {
        return reply.status(404).send({ error: 'Tabula nav atrasta vai jums nav piekļuves' });
      }

      // Iegūstam tabulas intervālus
      const intervals = await db.selectFrom('intervals')
        .selectAll()
        .where('table_id', '=', tableId)
        .execute();

      return reply.status(200).send({ table, intervals });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās iegūt tabulas datus' });
    }
  });

  // 4. Dzēst pieejamības tabulu
  fastify.delete('/:id', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
	  
    try {
      const { id } = request.params as { id: string };
      const tableId = parseInt(id, 10);
      const userId = request.user!.userId;

      const result = await db.deleteFrom('availability_tables')
        .where('id', '=', tableId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (Number(result.numDeletedRows) === 0) {
        return reply.status(404).send({ error: 'Tabula nav atrasta vai nevar tikt dzēsta' });
      }

      return reply.status(200).send({ message: 'Tabula veiksmīgi izdzēsta' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās izdzēst tabulu' });
    }
  });

  // 5. Atjaunināt tabulu (dzēšam vecos intervālus un liekam jaunos)
  fastify.put('/:id', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
	  
    try {
      const { id } = request.params as { id: string };
      const tableId = parseInt(id, 10);
      const userId = request.user!.userId;
      
      const parsedBody = CreateTableSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Nekorekti dati', details: parsedBody.error.format() });
      }

      const { name, is_active, intervals } = parsedBody.data;

      await db.transaction().execute(async (trx) => {
        // Pārbaudām piederību un atjauninām pamatdatus
        const updateResult = await trx.updateTable('availability_tables')
          .set({ name, is_active })
          .where('id', '=', tableId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (Number(updateResult.numUpdatedRows) === 0) {
          throw new Error('NOT_FOUND');
        }

        // Dzēšam vecos intervālus
        await trx.deleteFrom('intervals').where('table_id', '=', tableId).execute();

        // Pievienojam jaunos
        if (intervals.length > 0) {
          const intervalsToInsert = intervals.map(interval => ({
            table_id: tableId,
            start_minute: interval.start_minute,
            end_minute: interval.end_minute,
            status_level: interval.status_level,
          }));
          await trx.insertInto('intervals').values(intervalsToInsert).execute();
        }
      });
	  
	  // Atrodam visus pasākumus, kuros šī tabula ir piesaistīta
	  const affectedEvents = await db.selectFrom('event_participants')
        .select('event_table_id')
        .where('availability_table_id', '=', tableId)
        .distinct() // Izvairāmies no dublikātiem
        .execute();

      // Izsūtām WebSocket signālu katram no šiem pasākumiem
      affectedEvents.forEach(ev => {
        broadcastEventUpdate(ev.event_table_id);
      });

      return reply.status(200).send({ message: 'Tabula veiksmīgi atjaunināta!' });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return reply.status(404).send({ error: 'Tabula nav atrasta' });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās atjaunināt tabulu' });
    }
  });
}