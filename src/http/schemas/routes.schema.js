import { z } from 'zod';
const discordIdRegex = /^\d{16,21}$/;

export const RegistrationStatusNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  status: z.enum(['NEW', 'WAITLIST', 'WHITELIST_IN_PROGRESS', 'WHITELISTED', 'REJECTED']),
  playerSpaceUrl: z.string().url('playerSpaceUrl must be a valid URL').optional(),
  assignedClass: z.string().max(50).optional().nullable(),
});

export const BroadcastVillageInvitesSchema = z
  .object({
    dryRun: z.boolean().optional().default(false),
  })
  .optional();

export const CharacterSheetStatusNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  status: z.enum(['DRAFT', 'PENDING_STAFF', 'VALIDATED', 'PENDING_PLAYER', 'REOPENED']),
  playerSpaceUrl: z.string().url('playerSpaceUrl must be a valid URL').optional(),
});

export const InterviewReminderNotificationSchema = z
  .object({
    discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional(),
    discordIds: z.array(z.string().regex(discordIdRegex, 'Invalid Discord ID format')).optional(),
    interviewUrl: z.string().url('interviewUrl must be a valid URL').optional(),
  })
  .refine(data => Boolean(data.discordId || (data.discordIds && data.discordIds.length > 0)), {
    message: 'Either discordId or discordIds must be provided',
  });

export const SanctionNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  type: z.enum(['WARNING', 'SUSPENSION', 'EXCLUSION']),
  reason: z.string().min(1, 'Reason must not be empty').max(1000),
  duration: z.string().max(100).optional(),
  appealUrl: z.string().url('appealUrl must be a valid URL').optional(),
});

export const TicketMessageNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  ticketId: z.string().min(1, 'ticketId must not be empty'),
  ticketSubject: z.string().min(1, 'ticketSubject must not be empty').max(200),
  authorName: z.string().min(1, 'authorName must not be empty').max(100),
  messagePreview: z.string().max(1000).optional().nullable(),
  ticketUrl: z.string().url('ticketUrl must be a valid URL').optional(),
});

export const RpTrackingMessageNotificationSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  authorName: z.string().min(1, 'authorName must not be empty').max(100),
  messagePreview: z.string().max(1000).optional().nullable(),
  rpTrackingUrl: z.string().url('rpTrackingUrl must be a valid URL').optional(),
  characterName: z.string().max(100).optional().nullable(),
});

export const TicketCreatedNotificationSchema = z.object({
  channelId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  mentionRoleId: z
    .string()
    .regex(discordIdRegex, 'Invalid Discord ID format')
    .optional()
    .nullable(),
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  avatarUrl: z.string().url('avatarUrl must be a valid URL').optional().nullable(),
  ticketId: z.string().min(1, 'ticketId must not be empty'),
  ticketSubject: z.string().min(1, 'ticketSubject must not be empty').max(200),
  ticketCategory: z.string().min(1, 'ticketCategory must not be empty').max(50),
  authorName: z.string().min(1, 'authorName must not be empty').max(100),
  ticketDescription: z.string().max(2000).optional().nullable(),
  ticketStaffUrl: z.string().url('ticketStaffUrl must be a valid URL').optional().nullable(),
});

export const WaitlistRegistrationNotificationSchema = z.object({
  channelId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  mentionRoleId: z
    .string()
    .regex(discordIdRegex, 'Invalid Discord ID format')
    .optional()
    .nullable(),
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  playerName: z.string().min(1, 'playerName must not be empty').max(100),
  minecraftUsername: z.string().max(50).optional().nullable(),
  minecraftUuid: z.string().max(64).optional().nullable(),
  avatarUrl: z.string().url('avatarUrl must be a valid URL').optional().nullable(),
  waitlistStaffUrl: z.string().url('waitlistStaffUrl must be a valid URL').optional().nullable(),
});

export const CharacterSheetSubmittedNotificationSchema = z.object({
  channelId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  mentionRoleId: z
    .string()
    .regex(discordIdRegex, 'Invalid Discord ID format')
    .optional()
    .nullable(),
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  playerName: z.string().min(1, 'playerName must not be empty').max(100),
  minecraftUsername: z.string().max(50).optional().nullable(),
  characterName: z.string().min(1, 'characterName must not be empty').max(100),
  characterClass: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url('avatarUrl must be a valid URL').optional().nullable(),
  evaluationStaffUrl: z.string().url('evaluationStaffUrl must be a valid URL').optional().nullable(),
});

export const InterviewSlotBookedNotificationSchema = z.object({
  channelId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  mentionRoleId: z
    .string()
    .regex(discordIdRegex, 'Invalid Discord ID format')
    .optional()
    .nullable(),
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format').optional().nullable(),
  playerName: z.string().min(1, 'playerName must not be empty').max(100),
  minecraftUsername: z.string().max(50).optional().nullable(),
  slotDate: z.string().min(1, 'slotDate must not be empty'),
  avatarUrl: z.string().url('avatarUrl must be a valid URL').optional().nullable(),
  interviewStaffUrl: z.string().url('interviewStaffUrl must be a valid URL').optional().nullable(),
});

export const ApplySanctionSchema = z.object({
  discordId: z.string().regex(discordIdRegex, 'Invalid Discord ID format'),
  type: z.enum(['SUSPENSION', 'EXCLUSION']),
  reason: z.string().min(1, 'Reason must not be empty').max(1000),
  durationSeconds: z.number().int().positive().optional().nullable(),
  durationString: z.string().max(100).optional(),
  notifyDm: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
  ignoreIfNotInGuild: z.boolean().optional(),
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

export const BatchMembersRolesSchema = z.object({
  discordIds: z.array(z.string().regex(discordIdRegex, 'Invalid Discord ID format')).optional(),
});

export const CreateTopicSchema = z.object({
  title: z.string().min(1, 'Le titre est obligatoire').max(120),
  slug: z.string().max(100).optional().nullable(),
  context: z.string().min(1, 'Le contexte est obligatoire'),
  actions: z.string().min(1, 'Les actions sont obligatoires'),
  ticketId: z.string().optional().nullable(),
  ticketSubject: z.string().optional().nullable(),
  ticketUrl: z.string().url('ticketUrl must be a valid URL').optional().nullable(),
});

export const ArchiveTopicSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
});
