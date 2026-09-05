import fs from 'fs';
import path from 'path';
import { getEnv, setEnvForTesting } from '../config/env.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

export const GAME_ROLES_MAP = {
  whitelist: { envKey: 'ROLE_WHITELIST_ID', label: 'Whitelist', emoji: '📜' },
  sanctioned: { envKey: 'ROLE_SANCTIONED_ID', label: 'Sanctionné', emoji: '⛓️' },
  noble: { envKey: 'ROLE_NOBLE_ID', label: 'Noble', emoji: '👑' },
  paysan: { envKey: 'ROLE_PAYSAN_ID', label: 'Paysan', emoji: '🌾' },
  pecheur: { envKey: 'ROLE_PECHEUR_ID', label: 'Pêcheur', emoji: '🎣' },
  mineur: { envKey: 'ROLE_MINEUR_ID', label: 'Mineur', emoji: '⛏️' },
  erudit: { envKey: 'ROLE_ERUDIT_ID', label: 'Érudit', emoji: '📚' },
  gc: { envKey: 'ROLE_GC_ID', label: 'Garde Civique (GC)', emoji: '🛡️' },
  communication: { envKey: 'ROLE_COMMUNICATION_ID', label: 'Communication', emoji: '📢' },
  rp_tracking: { envKey: 'ROLE_RP_TRACKING_ID', label: 'Suivi RP', emoji: '🗺️' },
  event: { envKey: 'ROLE_EVENT_ID', label: 'Événements / Animation', emoji: '🎉' },
  developer: { envKey: 'ROLE_DEVELOPER_ID', label: 'Développeur', emoji: '💻' },
  admin: { envKey: 'ROLE_ADMIN_ID', label: 'Administrateur', emoji: '⚡' }
};

export class EnvRoleService {
  /**
   * Met à jour un rôle à la fois en mémoire process.env et dans le fichier .env physique.
   * @param {string} roleType
   * @param {string} roleId
   */
  static async setRole(roleType, roleId) {
    const roleDef = GAME_ROLES_MAP[roleType];
    if (!roleDef) {
      throw new Error(`Type de rôle inconnu : ${roleType}`);
    }

    const envKey = roleDef.envKey;
    process.env[envKey] = roleId;

    // Réinitialiser le cache parsedEnv
    setEnvForTesting({ [envKey]: roleId });

    // 1. Sauvegarder dans config.json pour traçabilité locale
    await configStore.update(data => {
      data.roles = data.roles || {};
      data.roles[envKey] = roleId;
      return data;
    });

    // 2. Mettre à jour le fichier .env physique pour persistance au redémarrage
    const envPath = path.resolve(process.cwd(), '.env');
    try {
      if (fs.existsSync(envPath)) {
        let envContent = await fs.promises.readFile(envPath, 'utf-8');
        const regex = new RegExp(`^${envKey}=.*$`, 'm');

        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${envKey}=${roleId}`);
        } else {
          envContent += `\n${envKey}=${roleId}`;
        }

        await fs.promises.writeFile(envPath, envContent, 'utf-8');
        logger.info({ envKey, roleId }, 'Mise à jour persistante du rôle dans .env');
      }
    } catch (err) {
      logger.error({ err, envKey }, 'Erreur lors de l\'écriture dans .env');
    }

    return roleDef;
  }

  /**
   * Retourne tous les rôles configurés avec leur ID actuel.
   */
  static getAllRoles() {
    const env = getEnv();
    const result = {};

    for (const [key, def] of Object.entries(GAME_ROLES_MAP)) {
      result[key] = {
        ...def,
        currentId: env[def.envKey] || process.env[def.envKey] || null
      };
    }

    return result;
  }
}
