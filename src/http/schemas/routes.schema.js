import { z } from 'zod';
const discordIdRegex = /^\d{16,21}$/;
export const RegistrationStatusNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  status: z.enum(['NEW', 'WAITLIST', 'WHITELIST_IN_PROGRESS', 'WHITELISTED', 'REJECTED']),
  playerSpaceUrl: z.string().url('playerSpaceUrl must be a valid URL').optional(),
});
export const CharacterSheetStatusNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  status: z.enum(['DRAFT', 'PENDING_STAFF', 'VALIDATED', 'PENDING_PLAYER']),
  playerSpaceUrl: z.string().url('playerSpaceUrl must be a valid URL').optional(),
});
export const SanctionNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  type: z.enum(['WARNING', 'SUSPENSION', 'EXCLUSION']),
  reason: z.string().min(1, 'Reason must not be empty').max(1000),
  duration: z.string().max(100).optional(),
  appealUrl: z.string().url('appealUrl must be a valid URL').optional(),
});
export const ApplySanctionSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  type: z.enum(['SUSPENSION', 'EXCLUSION']),
  reason: z.string().min(1, 'Reason must not be empty').max(1000),
  durationSeconds: z.number().int().positive().optional().nullable(),
  durationString: z.string().max(100).optional(),
  notifyDm: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});
export const RollbackSanctionSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  backupId: z.string().optional().nullable(),
  reason: z.string().max(500).default('Levée de sanction manuelle via API'),
});
export const SyncWhitelistClassSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  whitelisted: z.boolean(),
  classRole: z
    .enum([
      'NOBLE',
      'PAYSAN',
      'PECHEUR',
      'MINEUR',
      'ERUDIT',
      'ROLE_NOBLE',
      'ROLE_PAYSAN',
      'ROLE_PECHEUR',
      'ROLE_MINEUR',
      'ROLE_ERUDIT',
    ])
    .optional()
    .nullable(),
});
export const SyncStaffRoleSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  staffRole: z
    .enum([
      'GC',
      'ROLE_GC',
      'CONFLICT_MANAGEMENT',
      'COMMUNICATION',
      'ROLE_COMMUNICATION',
      'RP_TRACKING',
      'ROLE_RP_TRACKING',
      'EVENT',
      'ROLE_EVENT',
      'DEVELOPER',
      'ROLE_DEVELOPER',
      'ADMIN',
      'ROLE_ADMIN',
      'NONE',
      'PLAYER',
    ])
    .optional()
    .nullable(),
});
