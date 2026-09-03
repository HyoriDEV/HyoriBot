import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
dotenv.config();
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
    DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
    DISCORD_CLIENT_ID: z.string().optional(),
    PREFIX: z.string().default('!'),
    CHANNEL_MOD_LOGS_ID: z.string().optional(),
    CHANNEL_LOGS_MODERATION_ID: z.string().optional(),
    CHANNEL_MEMBER_LOGS_ID: z.string().optional(),
    CHANNEL_LOGS_MEMBERS_ID: z.string().optional(),
    INTERNAL_BOT_API_KEY: z.string().min(8, 'INTERNAL_BOT_API_KEY must be at least 8 characters'),
    HTTP_PORT: z.coerce.number().int().positive().default(4000),
    HTTP_HOST: z.string().default('127.0.0.1'),
    ATLAS_BASE_URL: z.string().url().default('https://hyori.fr'),
    ATLAS_PLAYER_SPACE_URL: z.string().url().default('https://hyori.fr/espace-joueur'),
    DATA_DIR: z.string().default(path.join(process.cwd(), 'data')),
    ROLE_WHITELIST_ID: z.string().min(1, 'ROLE_WHITELIST_ID is required'),
    ROLE_SANCTIONED_ID: z.string().min(1, 'ROLE_SANCTIONED_ID is required'),
    ROLE_NOBLE_ID: z.string().min(1, 'ROLE_NOBLE_ID is required'),
    ROLE_PAYSAN_ID: z.string().min(1, 'ROLE_PAYSAN_ID is required'),
    ROLE_PECHEUR_ID: z.string().min(1, 'ROLE_PECHEUR_ID is required'),
    ROLE_MINEUR_ID: z.string().min(1, 'ROLE_MINEUR_ID is required'),
    ROLE_ERUDIT_ID: z.string().min(1, 'ROLE_ERUDIT_ID is required'),
    ROLE_GC_ID: z.string().min(1, 'ROLE_GC_ID is required'),
    ROLE_COMMUNICATION_ID: z.string().min(1, 'ROLE_COMMUNICATION_ID is required'),
    ROLE_RP_TRACKING_ID: z.string().min(1, 'ROLE_RP_TRACKING_ID is required'),
    ROLE_EVENT_ID: z.string().min(1, 'ROLE_EVENT_ID is required'),
    ROLE_DEVELOPER_ID: z.string().min(1, 'ROLE_DEVELOPER_ID is required'),
    ROLE_ADMIN_ID: z.string().min(1, 'ROLE_ADMIN_ID is required'),
  })
  .transform(data => ({
    ...data,
    CHANNEL_MOD_LOGS_ID: data.CHANNEL_MOD_LOGS_ID || data.CHANNEL_LOGS_MODERATION_ID || undefined,
    CHANNEL_MEMBER_LOGS_ID:
      data.CHANNEL_MEMBER_LOGS_ID || data.CHANNEL_LOGS_MEMBERS_ID || undefined,
  }));
let parsedEnv = null;
export function getEnv() {
  if (parsedEnv) {
    return parsedEnv;
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.format();
    console.error(
      '❌ Configuration error in environment variables:',
      JSON.stringify(errorDetails, null, 2)
    );
    throw new Error(`Invalid environment variables: ${result.error.message}`);
  }
  parsedEnv = result.data;
  return parsedEnv;
}
export function setEnvForTesting(overrides) {
  const current = parsedEnv || {};
  parsedEnv = {
    ...current,
    ...overrides,
  };
  return parsedEnv;
}
