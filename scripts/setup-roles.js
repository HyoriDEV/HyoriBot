import { Client, GatewayIntentBits, PermissionsBitField } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
const REQUIRED_ROLES = [
  {
    key: 'ROLE_WHITELIST_ID',
    name: 'Whitelisté',
    color: 0xe9d15c,
  },
  {
    key: 'ROLE_SANCTIONED_ID',
    name: 'Sanctionné (Isolé)',
    color: 0x808080,
  },
  {
    key: 'ROLE_NOBLE_ID',
    name: 'Noble',
    color: 0x9b59b6,
  },
  {
    key: 'ROLE_PAYSAN_ID',
    name: 'Paysan',
    color: 0x2ecc71,
  },
  {
    key: 'ROLE_PECHEUR_ID',
    name: 'Pêcheur',
    color: 0x3498db,
  },
  {
    key: 'ROLE_MINEUR_ID',
    name: 'Mineur',
    color: 0xe67e22,
  },
  {
    key: 'ROLE_ERUDIT_ID',
    name: 'Érudit',
    color: 0x1abc9c,
  },
  {
    key: 'ROLE_GC_ID',
    name: 'Staff - Gestion Conflits',
    color: 0xe74c3c,
  },
  {
    key: 'ROLE_COMMUNICATION_ID',
    name: 'Staff - Communication',
    color: 0xe91e63,
  },
  {
    key: 'ROLE_RP_TRACKING_ID',
    name: 'Staff - Suivi RP',
    color: 0x3f51b5,
  },
  {
    key: 'ROLE_EVENT_ID',
    name: 'Staff - Événementiel',
    color: 0xff9800,
  },
  {
    key: 'ROLE_DEVELOPER_ID',
    name: 'Staff - Développeur',
    color: 0x607d8b,
  },
  {
    key: 'ROLE_ADMIN_ID',
    name: 'Staff - Administrateur',
    color: 0xd32f2f,
  },
];
async function setupRoles() {
  console.log('🤖 Connexion à Discord pour création et configuration automatique des rôles...');
  await client.login(process.env.DISCORD_BOT_TOKEN);
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  console.log(`🏰 Serveur : ${guild.name || guild.id}`);
  const existingRoles = await guild.roles.fetch();
  const roleIdMap = {};
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
      roleIdMap[roleDef.key] = found.id;
    }
  }
  const envPath = path.join(process.cwd(), '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  for (const [key, roleId] of Object.entries(roleIdMap)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${roleId}`);
    } else {
      envContent += `\n${key}=${roleId}`;
    }
  }
  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log('\n✅ Fichier .env mis à jour avec les véritables IDs de rôles !');
  await client.destroy();
  process.exit(0);
}
setupRoles().catch(err => {
  console.error('Erreur lors du setup des rôles :', err);
  process.exit(1);
});
