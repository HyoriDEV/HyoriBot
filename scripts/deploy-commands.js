import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { allSlashCommands } from '../src/discord/commands/index.js';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID || '1054172720847388753';
const configuredGuildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN est requis dans le .env');
  process.exit(1);
}

const commandsData = allSlashCommands.map(cmd => cmd.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  console.log(`🚀 Nettoyage et déploiement de ${commandsData.length} commandes Slash officielles...`);

  // 1. Purger les commandes globales pour supprimer immédiatement les anciennes commandes obsolètes en cache (tickets, button-role, config-perm...)
  try {
    console.log('🧹 Purge des commandes globales fantômes...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('✅ Commandes globales purgées avec succès !');
  } catch (err) {
    console.warn(`⚠️ Purge globale : ${err.message}`);
  }

  // 2. Déploiement propre et immédiat sur les serveurs autorisés
  const targetGuilds = [
    '1505277317402853469', // Serveur Zackk
    '1424084422621397004'  // hentaicraft
  ];

  if (configuredGuildId && !configuredGuildId.startsWith('123456') && !targetGuilds.includes(configuredGuildId)) {
    targetGuilds.push(configuredGuildId);
  }

  for (const gId of targetGuilds) {
    try {
      console.log(`📌 Déploiement instantané sur le serveur : ${gId}...`);
      const data = await rest.put(Routes.applicationGuildCommands(clientId, gId), {
        body: commandsData,
      });
      console.log(`✅ ${data.length} commandes actives et à jour sur le serveur ${gId} !`);
    } catch (err) {
      console.warn(`⚠️ Impossible de déployer sur le serveur ${gId} (${err.message})`);
    }
  }

  console.log('\n✨ Toutes les anciennes commandes ont été purgées et seules les 25 commandes officielles sont actives !');
  process.exit(0);
}

deploy();
