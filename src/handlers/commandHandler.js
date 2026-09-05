import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../logger/index.js';

/**
 * Charge dynamiquement toutes les commandes slash depuis le dossier commands/.
 * @param {import('discord.js').Client} client
 * @param {string} commandsDir
 */
export async function loadCommands(client, commandsDir) {
  client.commands = new Collection();

  if (!fs.existsSync(commandsDir)) {
    logger.warn({ commandsDir }, 'Dossier des commandes inexistant, création automatique');
    fs.mkdirSync(commandsDir, { recursive: true });
    return;
  }

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
  let loadedCount = 0;

  for (const filePath of commandFiles) {
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const commandModule = await import(fileUrl);
      const command = commandModule.default || commandModule;

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        loadedCount++;
      } else {
        logger.warn(
          { file: path.relative(process.cwd(), filePath) },
          'Commande invalide : "data" ou "execute" manquant'
        );
      }
    } catch (error) {
      logger.error(
        { file: path.relative(process.cwd(), filePath), error },
        'Erreur lors du chargement de la commande'
      );
    }
  }

  logger.info({ count: loadedCount }, 'Command Handler : Commandes Slash chargées');
}
