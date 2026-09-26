import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { allSlashCommands } from '../src/discord/commands/index.js';
import { GuildRegistry } from '../src/discord/services/guildRegistry.js';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN est requis dans le .env');
  process.exit(1);
}

const commandsData = allSlashCommands.map(cmd => cmd.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  console.log(
    `🚀 Nettoyage et déploiement de ${commandsData.length} commandes Slash officielles...`
  );

  // 1. Purge des commandes globales pour supprimer les commandes résiduelles
  if (clientId) {
    try {
      console.log('🧹 Purge des commandes globales...');
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log('✅ Commandes globales purgées avec succès !');
    } catch (err) {
      console.warn(`⚠️ Purge globale : ${err.message}`);
    }
  }

  // 2. Déploiement sur les serveurs joueurs autorisés (Hyori RP + 5 villages)
  const targetGuilds = GuildRegistry.getPlayerGuildIds();

  if (targetGuilds.length === 0) {
    console.warn("⚠️ Aucun serveur joueur valide configuré dans les variables d'environnement.");
  }

  for (const gId of targetGuilds) {
    try {
      console.log(`📌 Déploiement instantané sur le serveur joueur : ${gId}...`);
      const data = await rest.put(Routes.applicationGuildCommands(clientId, gId), {
        body: commandsData,
      });
      console.log(`✅ ${data.length} commandes actives et à jour sur le serveur ${gId} !`);
    } catch (err) {
      console.warn(`⚠️ Impossible de déployer sur le serveur ${gId} (${err.message})`);
    }
  }

  console.log(
    '\n✨ Synchronisation des commandes terminée sur tous les serveurs joueurs autorisés !'
  );
  process.exit(0);
}

deploy();
