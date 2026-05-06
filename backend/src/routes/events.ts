import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';
import { WebSocket } from 'ws';


// Glabājam aktīvos savienojumus: Map<eventId, Set<WebSocket>>
const eventConnections = new Map<number, Set<WebSocket>>();

// Palīgfunkcija, kas nosūta ziņu visiem viena pasākuma skatītājiem
export function broadcastEventUpdate(eventId: number) {
  const connections = eventConnections.get(eventId);
  if (connections) {
    connections.forEach(client => {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(JSON.stringify({ type: 'HEATMAP_UPDATED' }));
      }
    });
  }
}

// Validācijas shēmas
const UpdateParticipantTableSchema = z.object({
  availability_table_id: z.number().nullable(), // Atļaujam norādīt ID vai 'null', ja vēlas noņemt
});

const CreateEventSchema = z.object({
  name: z.string().min(1, "Nosaukums ir obligāts").max(64, "Maksimums 64 simboli"),
  description: z.string().optional(),
});

const UpdateEventSchema = z.object({
  name: z.string().min(1, "Nosaukums ir obligāts").max(64, "Maksimums 64 simboli"),
  description: z.string().max(1500, "Maksimums 1500 simboli").optional(),
});

const JoinEventSchema = z.object({
  invite_key: z.string().min(1, "Ielūguma atslēga ir obligāta"),
  availability_table_id: z.number().nullable().optional(),
  is_private: z.boolean().default(false),
});

// Shēmas event table pasākumiem (Plānotie Pasākumi)
const PlannedEventSchema = z.object({
  title: z.string().min(1, "Nosaukums ir obligāts").max(50, "Maksimums 50 simboli"),
  description: z.string().max(370, "Maksimums 370 simboli").optional(),
  start_time: z.coerce.date(), 
  end_time: z.coerce.date(),
});

const UpdateRoleSchema = z.object({
  new_role: z.enum(['Helper', 'User']),
});


export default async function eventRoutes(fastify: FastifyInstance) {
  // Aizsargājam visus notikumu maršrutus
  fastify.addHook('preHandler', authenticate);

	// Iegūt visus pasākumus, kuros aktīvais lietotājs ir dalībnieks
  fastify.get('/', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const events = await db.selectFrom('event_participants as ep')
        .innerJoin('event_tables as e', 'e.id', 'ep.event_table_id')
        .select(['e.id', 'e.name', 'e.description', 'e.invite_key', 'ep.role_type'])
        .where('ep.user_id', '=', userId)
        .execute();

      return reply.status(200).send({ events });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās iegūt pasākumu sarakstu' });
    }
  });

  // 1. Izveidot jaunu Notikumu tabulu
  fastify.post('/', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    
    try {
      const parsedBody = CreateEventSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Nekorekti dati', details: parsedBody.error.format() });
      }

      const { name, description } = parsedBody.data;
      const userId = request.user!.userId;
      const userRole = request.user!.role;

      // LIMITA PĀRBAUDE: max 5 Izveidoti Pasākumi (izņemot Admin)
      if (userRole !== 'Administrator') {
        const eventCountRes = await db.selectFrom('event_tables')
          .select(db.fn.count('id').as('total'))
          .where('owner_id', '=', userId)
          .executeTakeFirst();
        
        if (Number(eventCountRes?.total || 0) >= 5) {
          return reply.status(403).send({ error: 'Sniegts maksimālais izveidoto pasākumu skaits (5).' });
        }
      }
      
      // Ģenerējam unikālu 16 zīmju (HEX) ielūguma atslēgu
      const invite_key = crypto.randomBytes(8).toString('hex');

      const result = await db.transaction().execute(async (trx) => {
        // A. Izveidojam pašu notikumu
        const newEvent = await trx.insertInto('event_tables')
          .values({
            owner_id: userId,
            name,
            description: description || null,
            invite_key,
          })
          .returning(['id', 'invite_key'])
          .executeTakeFirstOrThrow();

        // B. Pievienojam izveidotāju kā Owner
        await trx.insertInto('event_participants')
          .values({
            event_table_id: newEvent.id,
            user_id: userId,
            role_type: 'Owner',
            is_private: false,
          })
          .execute();

        return newEvent;
      });

      return reply.status(201).send({
        message: 'Notikumu tabula izveidota!',
        eventId: result.id,
        inviteKey: result.invite_key
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās izveidot notikumu' });
    }
  });

  // 2. Pievienoties Notikumu tabulai ar Invite Key
  fastify.post('/join', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (request, reply) => {

    try {
      const parsedBody = JoinEventSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Nekorekti dati', details: parsedBody.error.format() });
      }

      const { invite_key, availability_table_id, is_private } = parsedBody.data;
      const userId = request.user!.userId;

      // LIMITA PĀRBAUDE: Max 5 dalības pasākumos
      // Šo piemērojam visiem, lai neviens nevarētu pievienoties 1000 grupām un saņemt masveida WS updeitus
      const joinedCountRes = await db.selectFrom('event_participants')
        .select(db.fn.count('id').as('total'))
        .where('user_id', '=', userId)
        .executeTakeFirst();
      
      if (Number(joinedCountRes?.total || 0) >= 5) {
        return reply.status(403).send({ error: 'Jūs jau esat pievienojies maksimālajam atļautajam pasākumu skaitam (5).' });
      }

      // Atrodam notikumu pēc atslēgas
      const eventTable = await db.selectFrom('event_tables')
        .select('id')
        .where('invite_key', '=', invite_key)
        .executeTakeFirst();

      if (!eventTable) {
        return reply.status(404).send({ error: 'Pasākums ar šādu ielūguma atslēgu neeksistē' });
      }

      // Pārbaudām, vai lietotājs jau nav dalībnieks
      const existingParticipant = await db.selectFrom('event_participants')
        .select('id')
        .where('event_table_id', '=', eventTable.id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (existingParticipant) {
        return reply.status(409).send({ error: 'Jūs jau esat pievienojies šim pasākumam' });
      }

      // Pievienojam lietotāju kā 'User'
      await db.insertInto('event_participants')
        .values({
          event_table_id: eventTable.id,
          user_id: userId,
          role_type: 'User',
          is_private,
          availability_table_id: availability_table_id || null,
        })
        .execute();
	
	// REĀLLAIKA SIGNĀLS: visiem tabulas lietotājiem atjauno dalībnieku sarakstu.
	broadcastEventUpdate(eventTable.id);


      return reply.status(200).send({ message: 'Veiksmīgi pievienojāties pasākumam!' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās pievienoties pasākumam' });
    }
  });
  // 3. Iegūt datus Siltumkartei (Heatmap)
  fastify.get('/:id/heatmap', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const eventId = parseInt(id, 10);
      const userId = request.user!.userId;

      if (isNaN(eventId)) {
        return reply.status(400).send({ error: 'Nekorekts pasākuma ID' });
      }

      // A. Pārbaudām, vai pieprasītājs vispār ir šī pasākuma dalībnieks
      const membership = await db.selectFrom('event_participants')
        .select(['id', 'availability_table_id', 'role_type'])
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!membership) {
        return reply.status(403).send({ error: 'Jums nav piekļuves šim pasākumam' });
      }

      // Iegūstam pasākuma datus (nosaukumu un aprakstu)
      const eventDetails = await db.selectFrom('event_tables')
        .select(['name', 'description'])
        .where('id', '=', eventId)
        .executeTakeFirst();

      if (!eventDetails) return reply.status(404).send({ error: 'Pasākums nav atrasts' });

      // B. Iegūstam visus dalībniekus un viņu intervālus
      const rawData = await db.selectFrom('event_participants as ep')
        .innerJoin('users as u', 'u.id', 'ep.user_id')
        .leftJoin('intervals as i', 'i.table_id', 'ep.availability_table_id')
        .select([
          'ep.user_id',
          'ep.role_type',
          'ep.is_private',
          'u.username',
          'i.start_minute',
          'i.end_minute',
          'i.status_level'
        ])
        .where('ep.event_table_id', '=', eventId)
        .execute();

      // C. Apstrādājam un grupējam datus, piemērojot privātuma noteikumus
      const participantsMap = new Map();

      for (const row of rawData) {
        // Unikāls ID dalībniekam (ja is_private, aizstājam ar anonīmu ID, lai frontend to nevar atšifrēt)
        const participantKey = row.is_private ? `anonymous_${row.user_id}` : row.user_id;

        if (!participantsMap.has(participantKey)) {
          participantsMap.set(participantKey, {
            userId: row.user_id,
            username: row.is_private ? 'Anonīms Dalībnieks' : row.username, // Ja ieķeksēts kā anonīms, slēpjam username
            role: row.role_type,
            is_private: row.is_private,
            intervals: []
          });
        }

        // Pievienojam intervālu, ja tāds eksistē
        if (row.start_minute !== null && row.end_minute !== null && row.status_level) {
          participantsMap.get(participantKey).intervals.push({
            start: row.start_minute,
            end: row.end_minute,
            status: row.status_level
          });
        }
      }

      const heatmapData = Array.from(participantsMap.values());

      return reply.status(200).send({ 
        eventId,
        eventName: eventDetails.name,
        eventDescription: eventDetails.description,
        totalParticipants: heatmapData.length,
		    myTableId: membership.availability_table_id,
        myRole: membership.role_type,
        data: heatmapData 
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās ģenerēt siltumkartes datus' });
    }
  });
  
  // 4. Savas piesaistītās tabulas nomainīšanai pasākumā
  fastify.put('/:id/my-table', {
     config: { rateLimit: { max: 15, timeWindow: '1 minute' } } 
    }, async (request, reply) => {
      
    try {
      const { id } = request.params as { id: string };
      const eventId = parseInt(id, 10);
      const userId = request.user!.userId;

      const parsedBody = UpdateParticipantTableSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: 'Nekorekti dati' });
      }

      const { availability_table_id } = parsedBody.data;

      const membership = await db.selectFrom('event_participants')
        .select('id')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!membership) {
        return reply.status(403).send({ error: 'Jums nav piekļuves šim pasākumam' });
      }

      // Ja lietotājs mēģina piesaistīt tabulu, pārbaudām, vai tā tiešām pieder viņam
      if (availability_table_id !== null) {
        const table = await db.selectFrom('availability_tables')
          .select('id')
          .where('id', '=', availability_table_id)
          .where('user_id', '=', userId)
          .executeTakeFirst();
          
        if (!table) {
          return reply.status(403).send({ error: 'Šī tabula jums nepieder' });
        }
      }

      // Atjauninām dalībnieka ierakstu
      await db.updateTable('event_participants')
        .set({ availability_table_id })
        .where('id', '=', membership.id)
        .execute();
	
	// REĀLLAIKA SIGNĀLS: Paziņojam visiem, ka šis pasākums ir mainījies!
    broadcastEventUpdate(eventId);
	
      return reply.status(200).send({ message: 'Tabula veiksmīgi nomainīta!' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās nomainīt tabulu' });
    }
  });
  
  // 5. WebSocket maršruts reāllaika atjauninājumiem
  fastify.get('/:id/ws', { websocket: true }, (connection, request) => {
    const { id } = request.params as { id: string };
    const eventId = parseInt(id, 10);

    // Pievienojam jauno klientu šī pasākuma sarakstam
    if (!eventConnections.has(eventId)) {
      eventConnections.set(eventId, new Set());
    }
    eventConnections.get(eventId)!.add(connection);

    // Kad klients aizver lapu, izdzēšam savienojumu, lai netērētu atmiņu
    connection.on('close', () => {
      eventConnections.get(eventId)?.delete(connection);
    });
  });
  
  // 6. Atjaunot ielūguma atslēgu (pieejams tikai Īpašniekam)
  fastify.patch('/:id/invite-key', {
     config: { rateLimit: { max: 5, timeWindow: '1 minute' } } 
    }, async (request, reply) => {
      
    try {
      const { id } = request.params as { id: string };
      const eventId = parseInt(id, 10);
      const userId = request.user!.userId;

      // Pārbaudām, vai lietotājs tiešām ir šī pasākuma Īpašnieks (Owner)
      const membership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!membership || membership.role_type !== 'Owner') {
        return reply.status(403).send({ error: 'Tikai pasākuma īpašnieks var mainīt atslēgu' });
      }

      // Ģenerējam jaunu atslēgu
      const newInviteKey = crypto.randomBytes(8).toString('hex');

      await db.updateTable('event_tables')
        .set({ invite_key: newInviteKey })
        .where('id', '=', eventId)
        .execute();

      return reply.status(200).send({ message: 'Atslēga atjaunināta', inviteKey: newInviteKey });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās atjaunināt atslēgu' });
    }
  });

  // 7. Dzēst pasākumu (Tikai Owner)
  fastify.delete('/:id', {
     config: { rateLimit: { max: 10, timeWindow: '1 minute' } } 
    }, async (request, reply) => {

    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      const userId = request.user!.userId;

      const membership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!membership || membership.role_type !== 'Owner') {
        return reply.status(403).send({ error: 'Tikai pasākuma īpašnieks var dzēst pasākumu' });
      }

      await db.deleteFrom('event_tables').where('id', '=', eventId).execute();
      return reply.status(200).send({ message: 'Pasākums izdzēsts' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās izdzēst pasākumu' });
    }
  });

  // 8. Pamest pasākumu vai izmest dalībnieku
  fastify.delete('/:id/participants/:targetId', async (request, reply) => {
    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      const targetId = parseInt((request.params as any).targetId as string, 10);
      const userId = request.user!.userId;

      // Iegūstam manu lomu
      const myMembership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!myMembership) return reply.status(403).send({ error: 'Nav piekļuves' });

      // Ja mēģina izmest citu cilvēku
      if (userId !== targetId) {
        if (myMembership.role_type !== 'Owner' && myMembership.role_type !== 'Helper') {
          return reply.status(403).send({ error: 'Tikai īpašnieks vai palīgs var izmest dalībniekus' });
        }

        // Iegūstam mērķa lomu, lai neļautu Helperim izmest Owneri vai citu Helperi
        const targetMembership = await db.selectFrom('event_participants')
          .select('role_type')
          .where('event_table_id', '=', eventId)
          .where('user_id', '=', targetId)
          .executeTakeFirst();

        if (targetMembership) {
          if (myMembership.role_type === 'Helper' && (targetMembership.role_type === 'Owner' || targetMembership.role_type === 'Helper')) {
            return reply.status(403).send({ error: 'Palīgs nevar izmest īpašnieku vai citu palīgu' });
          }
        }
      } else {
        // Lietotājs pamet pats
        if (myMembership.role_type === 'Owner') {
          return reply.status(400).send({ error: 'Īpašnieks nevar pamest pasākumu, tas ir jādzēš' });
        }
      }

      await db.deleteFrom('event_participants')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', targetId)
        .execute();
        
      broadcastEventUpdate(eventId);
      return reply.status(200).send({ message: 'Dalībnieks noņemts' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās noņemt dalībnieku' });
    }
  });

  // 9. Rediģēt pasākuma nosaukumu un aprakstu (Tikai Owner)
  fastify.patch('/:id', {
     config: { rateLimit: { max: 15, timeWindow: '1 minute' } } 
    }, async (request, reply) => {
    
    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      const userId = request.user!.userId;

      const parsedBody = UpdateEventSchema.safeParse(request.body);
      if (!parsedBody.success) return reply.status(400).send({ error: 'Nekorekti dati' });

      const membership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!membership || membership.role_type !== 'Owner') {
        return reply.status(403).send({ error: 'Tikai īpašnieks var rediģēt pasākumu' });
      }

      await db.updateTable('event_tables')
        .set({ 
          name: parsedBody.data.name, 
          description: parsedBody.data.description || null 
        })
        .where('id', '=', eventId)
        .execute();

      // Paziņojam visiem caur WebSocket, lai uzreiz atjaunojas nosaukums un apraksts
      broadcastEventUpdate(eventId); 

      return reply.status(200).send({ message: 'Pasākums veiksmīgi atjaunināts' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās atjaunināt pasākumu' });
    }
  });

  // 10. Mainīt dalībnieka lomu (Tikai Owner var iedot Helper)
  fastify.patch('/:id/participants/:targetId/role', {
     config: { rateLimit: { max: 5, timeWindow: '1 minute' } } 
    }, async (request, reply) => {

    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      const targetId = parseInt((request.params as any).targetId as string, 10);
      const userId = request.user!.userId;

      const parsedBody = UpdateRoleSchema.safeParse(request.body);
      if (!parsedBody.success) return reply.status(400).send({ error: 'Nekorekti dati' });

      // Pārbaudām, vai pieprasītājs ir Owner
      const myMembership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!myMembership || myMembership.role_type !== 'Owner') {
        return reply.status(403).send({ error: 'Tikai īpašnieks var mainīt lomas' });
      }

      await db.updateTable('event_participants')
        .set({ role_type: parsedBody.data.new_role })
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', targetId)
        .execute();

      broadcastEventUpdate(eventId);
      return reply.status(200).send({ message: 'Loma veiksmīgi nomainīta' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās nomainīt lomu' });
    }
  });

  // 11. Iegūt plānotos pasākumus (Visiem dalībniekiem)
  fastify.get('/:id/planned-events', async (request, reply) => {
    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      
      const plannedEvents = await db.selectFrom('planned_events')
        .selectAll()
        .where('event_table_id', '=', eventId)
        .orderBy('start_time', 'asc')
        .execute();

      return reply.status(200).send({ plannedEvents });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās iegūt plānotos pasākumus' });
    }
  });

  // 12. Pievienot jaunu plānoto pasākumu (Tikai Owner / Helper)
  fastify.post('/:id/planned-events', {
    config: { rateLimit: { max: 5, timeWindow: '3 minutes' } }
  }, async (request, reply) => {

    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      const userId = request.user!.userId;

      // LIMITA PĀRBAUDE: Max 5 plānotie pasākumi vienā Event tabulā
      const plannedCountRes = await db.selectFrom('planned_events')
        .select(db.fn.count('id').as('total'))
        .where('event_table_id', '=', eventId)
        .executeTakeFirst();

      if (Number(plannedCountRes?.total || 0) >= 5) {
        return reply.status(403).send({ error: 'Šajā pasākumā ir sasniegts maksimālais aktīvo plānoto notikumu skaits (5).' });
      }

      const parsedBody = PlannedEventSchema.safeParse(request.body);
      if (!parsedBody.success) return reply.status(400).send({ error: 'Nekorekti dati', details: parsedBody.error.format() });

      const myMembership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!myMembership || (myMembership.role_type !== 'Owner' && myMembership.role_type !== 'Helper')) {
        return reply.status(403).send({ error: 'Tikai Īpašnieks vai Palīgs var pievienot pasākumus' });
      }

      await db.insertInto('planned_events')
        .values({
          event_table_id: eventId,
          start_time: parsedBody.data.start_time, // Zod to jau konvertēja!
          end_time: parsedBody.data.end_time,
          metadata: JSON.stringify({
            title: parsedBody.data.title,
            description: parsedBody.data.description || null
          })
        })
        .execute();

      broadcastEventUpdate(eventId); // Atjauninām visiem ekrānus
      return reply.status(201).send({ message: 'Pasākums veiksmīgi pievienots' });
    } catch (error) {
      request.server.log.error(error);
      return reply.status(500).send({ error: 'Neizdevās izveidot pasākumu' });
    }
  });

  // 13. Dzēst plānoto pasākumu (Tikai Owner / Helper)
  fastify.delete('/:id/planned-events/:plannedId', async (request, reply) => {
    try {
      const eventId = parseInt((request.params as any).id as string, 10);
      const plannedId = parseInt((request.params as any).plannedId as string, 10);
      const userId = request.user!.userId;

      const myMembership = await db.selectFrom('event_participants')
        .select('role_type')
        .where('event_table_id', '=', eventId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!myMembership || (myMembership.role_type !== 'Owner' && myMembership.role_type !== 'Helper')) {
        return reply.status(403).send({ error: 'Nav atļaujas' });
      }

      await db.deleteFrom('planned_events')
        .where('id', '=', plannedId)
        .where('event_table_id', '=', eventId)
        .execute();

      broadcastEventUpdate(eventId);
      return reply.status(200).send({ message: 'Pasākums dzēsts' });
    } catch (error) {
      return reply.status(500).send({ error: 'Neizdevās dzēst' });
    }
  });
}