import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_BOT_TOKEN et DISCORD_CLIENT_ID doivent être définis dans .env');
  process.exit(1);
}

const commandsDir = path.resolve(__dirname, '../commands');
const commands = [];

const readCommands = (dir) => {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(readCommands(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
};

const commandFiles = readCommands(commandsDir);

for (const file of commandFiles) {
  const fileUrl = pathToFileURL(file).href;
  const commandModule = await import(fileUrl);
  const command = commandModule.default || commandModule;
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`🚀 Déploiement de ${commands.length} commandes Slash...`);

    if (guildId) {
      console.log(`📌 Enregistrement immédiat pour la guilde : ${guildId}`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands
      });
    } else {
      console.log('🌍 Enregistrement global...');
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands
      });
    }

    console.log('✅ Commandes Slash enregistrées avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes :', error);
  }
})();
