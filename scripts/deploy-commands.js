import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { allSlashCommands } from '../src/discord/commands/index.js';
dotenv.config();
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID || '1054172720847388753';
if (!token || !guildId) {
  console.error('❌ DISCORD_BOT_TOKEN et DISCORD_GUILD_ID sont requis dans le .env');
  process.exit(1);
}
const commandsData = allSlashCommands.map(cmd => cmd.data.toJSON());
const rest = new REST({
  version: '10',
}).setToken(token);
async function deploy() {
  console.log(
    `🚀 Déploiement de ${commandsData.length} commandes Slash sur le serveur (${guildId})...`
  );
  try {
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandsData,
    });
    console.log(`✅ ${data.length} commandes Slash enregistrées avec succès sur Discord !`);
    data.forEach(c => console.log(`  • /${c.name} : ${c.description}`));
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes :', error);
    process.exit(1);
  }
}
deploy();
