// shared/schemas.ts
import { z } from 'zod';

// Lietotāja reģistrācijas/autorizācijas shēma
export const UserAuthSchema = z.object({
  username: z.string().min(3, "Lietotājvārdam jābūt vismaz 3 simbolus garam"),
  password: z.string().min(6, "Parolei jābūt vismaz 6 simbolus garai"),
});

// Pieejamības intervāla shēma atbilstoši datubāzes prasībām
export const IntervalSchema = z.object({
  start_minute: z.number().min(0).max(10079),
  end_minute: z.number().min(0).max(10079),
  status_level: z.enum(['Pieejams', 'Varbut', 'Nav pieejams']),
});

// Tipi, ko automātiski ģenerē Zod, lietošanai TypeScript
export type UserAuthInput = z.infer<typeof UserAuthSchema>;
export type IntervalInput = z.infer<typeof IntervalSchema>;