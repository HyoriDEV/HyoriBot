import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { logger } from '../logger/index.js';

/**
 * Charge dynamiquement tous les écouteurs d'événements depuis le dossier events/.
 * @param {import('discord.js').Client} client
 * @param {string} eventsDir
 */
export async function loadEvents(client, eventsDir) {
  if (!fs.existsSync(eventsDir)) {
    logger.warn({ eventsDir }, 'Dossier des événements inexistant, création automatique');
    fs.mkdirSync(eventsDir, { recursive: true });
    return;
  }

  const readEvents = (dir) => {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(readEvents(fullPath));
      } else if (item.isFile() && item.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  };

  const eventFiles = readEvents(eventsDir);
  let loadedCount = 0;

  for (const filePath of eventFiles) {
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const eventModule = await import(fileUrl);
      const event = eventModule.default || eventModule;

      if (!event.name || typeof event.execute !== 'function') {
        logger.warn(
          { file: path.relative(process.cwd(), filePath) },
          'Événement invalide : "name" ou "execute" manquant'
        );
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      loadedCount++;
    } catch (error) {
      logger.error(
        { file: path.relative(process.cwd(), filePath), error },
        'Erreur lors du chargement de l\'événement'
      );
    }
  }

  logger.info({ count: loadedCount }, 'Event Handler : Événements enregistrés');
}
