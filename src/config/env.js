import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().optional(),
  PREFIX: z.string().default('?'),

  // HTTP & Atlas
  INTERNAL_BOT_API_KEY: z.string().min(8, 'INTERNAL_BOT_API_KEY must be at least 8 characters'),
  HTTP_PORT: z.coerce.number().int().positive().default(4000),
  HTTP_HOST: z.string().default('127.0.0.1'),
  ATLAS_BASE_URL: z.string().url().default('https://hyori.fr'),
  ATLAS_PLAYER_SPACE_URL: z.string().url().default('https://hyori.fr/espace-joueur'),
  DATA_DIR: z.string().default(path.join(process.cwd(), 'data')),
});

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
