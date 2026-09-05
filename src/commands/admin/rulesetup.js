import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le fichier de règlement
const DEFAULT_RULES_PATH = path.resolve(__dirname, '../../../data/reglement.md');
const ALT_RULES_PATH = path.resolve(__dirname, '../../../reglement.md');

/**
 * Récupère le texte du règlement depuis les fichiers du bot
 */
function loadRulesFile() {
  if (fs.existsSync(DEFAULT_RULES_PATH)) {
    return fs.readFileSync(DEFAULT_RULES_PATH, 'utf-8');
  }
  if (fs.existsSync(ALT_RULES_PATH)) {
    return fs.readFileSync(ALT_RULES_PATH, 'utf-8');
  }
  throw new Error('Fichier data/reglement.md introuvable.');
}

/**
 * Découpe un texte volumineux en plusieurs messages texte standards Discord (limite 2000 caractères)
 * Découpe intelligemment aux séparateurs d'articles et de sections (##, ### ou doubles retours)
 */
function splitRulesIntoMessageChunks(fullText, maxChunkSize = 1850) {
  // Découpage par blocs de sections / articles
  const rawBlocks = fullText.split(/\n(?=## |\n### )/g).map(b => b.trim()).filter(Boolean);
  const chunks = [];
  let currentChunk = '';

  for (const block of rawBlocks) {
    // Si le bloc lui-même dépasse la taille maximale, le découper par lignes
    if (block.length > maxChunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const lines = block.split('\n');
      for (const line of lines) {
        if ((currentChunk + '\n' + line).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = line;
        } else {
          currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
        }
      }
    } else {
      if ((currentChunk + '\n\n' + block).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = block;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${block}` : block;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [fullText];
}

export const rulesetupCommand = {
  data: new SlashCommandBuilder()
    .setName('rulesetup')
    .setDescription('Publier le règlement sous forme de messages texte depuis data/reglement.md')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Le salon où envoyer le règlement (par défaut le salon actuel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),

  async execute(interactionOrMessage, args = []) {
    const isInteraction = typeof interactionOrMessage.isCommand === 'function' || interactionOrMessage.isChatInputCommand?.();
    const guild = interactionOrMessage.guild;

    if (!guild) {
      const errTxt = '❌ Cette commande doit être exécutée dans un serveur Discord.';
      if (isInteraction) return interactionOrMessage.reply({ content: errTxt, ephemeral: true });
      return interactionOrMessage.reply(errTxt);
    }

    let targetChannel;
    if (isInteraction) {
      targetChannel = interactionOrMessage.options.getChannel('salon') || interactionOrMessage.channel;
    } else {
      if (args[0] && args[0].startsWith('<#') && args[0].endsWith('>')) {
        const chanId = args[0].replace(/[<#>]/g, '');
        targetChannel = guild.channels.cache.get(chanId) || interactionOrMessage.channel;
      } else {
        targetChannel = interactionOrMessage.channel;
      }
    }

    if (isInteraction) {
      await interactionOrMessage.deferReply({ ephemeral: true });
    }

    try {
      // 1. Lecture du fichier de règlement
      const rulesRaw = loadRulesFile();

      // 2. Découpage automatique en messages simples (< 1900 caractères)
      const chunks = splitRulesIntoMessageChunks(rulesRaw, 1850);

      // 3. Envoi séquentiel sous forme de messages purs (pas d'embeds)
      for (let i = 0; i < chunks.length; i++) {
        await targetChannel.send({
          content: chunks[i]
        });

        // Pause de 400ms pour garantir l'ordre chronologique exact dans Discord
        await new Promise(res => setTimeout(res, 400));
      }

      const successMsg = `✅ **Règlement déployé avec succès dans <#${targetChannel.id}> !**\n` +
        `• Format : **Messages texte standards** (aucun embed)\n` +
        `• Source : \`data/reglement.md\`\n` +
        `• Nombre de messages envoyés : **${chunks.length} messages** consécutifs ordonnés.`;

      if (isInteraction) {
        return interactionOrMessage.editReply({ content: successMsg });
      } else {
        return interactionOrMessage.reply(successMsg);
      }
    } catch (err) {
      const errTxt = `❌ Erreur lors de l'envoi du règlement : ${err.message}`;
      if (isInteraction) {
        return interactionOrMessage.editReply({ content: errTxt });
      } else {
        return interactionOrMessage.reply(errTxt);
      }
    }
  }
};

export default rulesetupCommand;
