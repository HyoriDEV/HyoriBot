import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} from 'discord.js';
import { tempVoiceService } from '../../services/tempVoiceService.js';
import { logger } from '../../logger/index.js';

export const setupVocalCommand = {
  data: new SlashCommandBuilder()
    .setName('setup-vocal')
    .setDescription('Déployer ou configurer le système de salons vocaux temporaires (Join to Create)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Salon vocal existant à utiliser comme déclencheur (laisser vide pour créer automatiquement)')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt
        .setName('categorie')
        .setDescription('Catégorie dans laquelle créer les salons temporaires (laisser vide pour créer automatiquement)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    ),

  async execute(interactionOrMessage, args = []) {
    const isInteraction = typeof interactionOrMessage.isCommand === 'function' || interactionOrMessage.isChatInputCommand?.();
    const guild = interactionOrMessage.guild;

    if (!guild) {
      const err = '❌ Cette commande doit être exécutée sur un serveur.';
      if (isInteraction) return interactionOrMessage.reply({ content: err, ephemeral: true });
      return interactionOrMessage.reply(err);
    }

    if (isInteraction) await interactionOrMessage.deferReply();

    try {
      let chosenChannel = null;
      let chosenCategory = null;

      if (isInteraction) {
        chosenChannel = interactionOrMessage.options.getChannel('salon');
        chosenCategory = interactionOrMessage.options.getChannel('categorie');
      } else {
        // Mode préfixe : ?setup-vocal [channelId/#channel]
        if (args[0]) {
          const cleanId = args[0].replace(/[<#>]/g, '');
          chosenChannel = guild.channels.cache.get(cleanId);
        }
      }

      // 1. Si aucune catégorie n'est fournie, chercher ou créer une catégorie dédiée
      if (!chosenCategory) {
        if (chosenChannel && chosenChannel.parentId) {
          chosenCategory = guild.channels.cache.get(chosenChannel.parentId);
        } else {
          chosenCategory = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('temporaire')
          );
          if (!chosenCategory) {
            chosenCategory = await guild.channels.create({
              name: '🔊 ─── SALONS TEMPORAIRES ───',
              type: ChannelType.GuildCategory,
              reason: 'Catégorie pour les salons vocaux temporaires (Join to Create)'
            });
          }
        }
      }

      // 2. Si aucun salon vocal déclencheur n'est fourni, créer le salon "➕・Créer un salon"
      if (!chosenChannel) {
        chosenChannel = await guild.channels.create({
          name: '➕・Créer un salon',
          type: ChannelType.GuildVoice,
          parent: chosenCategory.id,
          userLimit: 0,
          permissionOverwrites: [
            {
              id: guild.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak
              ]
            }
          ],
          reason: 'Création du salon générateur Join to Create'
        });
      }

      // 3. Enregistrer dans la configuration
      await tempVoiceService.setGenerator(guild.id, chosenChannel.id, chosenCategory.id);

      const embed = new EmbedBuilder()
        .setColor(0xe9d15c)
        .setTitle('🎙️ Système Vocal « Join to Create » Déployé')
        .setDescription(
          `Le système de salons vocaux temporaires automatiques est désormais **actif et prêt à l'emploi** sur votre serveur !\n\n` +
          `**Comment ça fonctionne ?**\n` +
          `1. N'importe quel membre rejoint le salon <#${chosenChannel.id}>.\n` +
          `2. Le bot lui génère instantanément son propre salon vocal privé dans la catégorie **${chosenCategory.name}**.\n` +
          `3. Le membre est automatiquement téléporté dans son salon et reçoit un **panneau de commande interactif** dans le chat du salon pour changer son nom, sa limite, le verrouiller ou expulser des personnes.\n` +
          `4. Dès que le salon devient vide, il est **automatiquement supprimé** pour garder le serveur propre.`
        )
        .addFields(
          { name: '📍 Salon Déclencheur', value: `<#${chosenChannel.id}> (\`${chosenChannel.name}\`)`, inline: true },
          { name: '📁 Catégorie', value: `${chosenCategory.name} (\`${chosenCategory.id}\`)`, inline: true },
          { name: '⚙️ Statut', value: '🟢 Actif', inline: true }
        )
        .setFooter({ text: 'Hyori RP • Salons Vocaux Temporaires' })
        .setTimestamp();

      if (isInteraction) {
        return interactionOrMessage.editReply({ embeds: [embed] });
      } else {
        return interactionOrMessage.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error({ error: err.message }, 'Erreur lors du déploiement de setup-vocal');
      const errTxt = `❌ Une erreur est survenue lors de la configuration du système vocal : ${err.message}`;
      if (isInteraction) {
        return interactionOrMessage.editReply({ content: errTxt });
      } else {
        return interactionOrMessage.reply(errTxt);
      }
    }
  },

  async executePrefix(message, args = []) {
    return this.execute(message, args);
  }
};

export default setupVocalCommand;
