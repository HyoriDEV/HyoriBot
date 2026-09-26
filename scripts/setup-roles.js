import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { GuildRegistry } from '../src/discord/services/guildRegistry.js';
dotenv.config();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
const REQUIRED_ROLES = [
  {
    configPath: 'roles.whitelist',
    name: 'Whitelisté',
    color: 0xe9d15c,
  },
  {
    configPath: 'roles.sanctioned',
    name: 'Sanctionné (Isolé)',
    color: 0x808080,
  },
  {
    configPath: 'roles.classes.NOBLE',
    name: 'Noble',
    color: 0x9b59b6,
  },
  {
    configPath: 'roles.classes.PAYSAN',
    name: 'Paysan',
    color: 0x2ecc71,
  },
  {
    configPath: 'roles.classes.PECHEUR',
    name: 'Pêcheur',
    color: 0x3498db,
  },
  {
    configPath: 'roles.classes.MINEUR',
    name: 'Mineur',
    color: 0xe67e22,
  },
  {
    configPath: 'roles.classes.ERUDIT',
    name: 'Érudit',
    color: 0x1abc9c,
  },
  {
    configPath: 'roles.staff.GC',
    name: 'Staff - Gestion Conflits',
    color: 0xe74c3c,
  },
  {
    configPath: 'roles.staff.COMMUNICATION',
    name: 'Staff - Communication',
    color: 0xe91e63,
  },
  {
    configPath: 'roles.staff.RP_TRACKING',
    name: 'Staff - Suivi RP',
    color: 0x3f51b5,
  },
  {
    configPath: 'roles.staff.EVENT',
    name: 'Staff - Événementiel',
    color: 0xff9800,
  },
  {
    configPath: 'roles.staff.DEVELOPER',
    name: 'Staff - Développeur',
    color: 0x607d8b,
  },
  {
    configPath: 'roles.staff.ADMIN',
    name: 'Staff - Administrateur',
    color: 0xd32f2f,
  },
];
async function setupRoles() {
  console.log('🤖 Connexion à Discord pour création et configuration automatique des rôles...');
  await client.login(process.env.DISCORD_BOT_TOKEN);
  const guild = await client.guilds.fetch(GuildRegistry.getCommunityGuildId());
  console.log(`🏰 Serveur : ${guild.name || guild.id}`);
  const existingRoles = await guild.roles.fetch();
  const createdRoles = [];
  for (const roleDef of REQUIRED_ROLES) {
    let found = existingRoles.find(r => r.name.toLowerCase() === roleDef.name.toLowerCase());
    if (!found) {
      try {
        console.log(`➕ Création du rôle "${roleDef.name}"...`);
        found = await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color,
          reason: 'Initialisation automatique des rôles Hyori RP',
        });
        console.log(`  ✓ Rôle créé avec succès : ID ${found.id}`);
      } catch (err) {
        console.warn(
          `  ⚠️ Impossible de créer automatiquement le rôle "${roleDef.name}" : ${err.message}`
        );
      }
    } else {
      console.log(`ℹ️ Rôle existant trouvé : "${found.name}" (ID: ${found.id})`);
    }
    if (found) {
      createdRoles.push({ configPath: roleDef.configPath, id: found.id });
    }
  }

  console.log(
    '\n✅ Rôles synchronisés. Reportez ces IDs dans src/config/discordConfig.js :\n'
  );
  for (const { configPath, id } of createdRoles) {
    console.log(`  ${configPath} = '${id}'`);
  }

  await client.destroy();
  process.exit(0);
}
setupRoles().catch(err => {
  console.error('Erreur lors du setup des rôles :', err);
  process.exit(1);
});
