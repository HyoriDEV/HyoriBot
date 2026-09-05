import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} from 'discord.js';
import { configStore } from '../../storage/index.js';
import { setupLogsCommand } from './setup-logs.js';
import { LOG_TYPES } from '../../services/logSetupService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config-logs')
    .setDescription('Configurer ou déployer automatiquement les salons de logs d\'audit')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Ouvrir l\'assistant interactif pour créer automatiquement tous les salons de logs')
    )
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Définir manuellement un salon pour un type de logs spécifique')
        .addStringOption(opt =>
          opt
            .setName('categorie')
            .setDescription('La catégorie de logs à configurer')
            .setRequired(true)
            .addChoices(
              { name: '🗑️ Messages Supprimés', value: 'messagesDeleteChannelId' },
              { name: '✏️ Messages Modifiés', value: 'messagesEditChannelId' },
              { name: '🧹 Purges Massives (Clear)', value: 'messagesBulkChannelId' },
              { name: '📥 Arrivées & Départs', value: 'joinsLeavesChannelId' },
              { name: '👤 Profils & Surnoms', value: 'memberProfileChannelId' },
              { name: '🛡️ Rôles des Membres', value: 'memberRolesChannelId' },
              { name: '⚖️ Modération & Sanctions', value: 'moderationChannelId' },
              { name: '📁 Salons Serveur', value: 'channelsChannelId' },
              { name: '🏷️ Rôles Serveur', value: 'rolesChannelId' },
              { name: '🔊 Activité Vocale', value: 'voiceChannelId' },
              { name: '⚙️ Serveur & Emojis', value: 'serverChannelId' },
              { name: '✉️ Invitations', value: 'invitesChannelId' }
            )
        )
        .addChannelOption(opt =>
          opt
            .setName('salon')
            .setDescription('Le salon textuel où envoyer les logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Afficher la configuration actuelle de tous les salons de logs')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      return setupLogsCommand.execute(interaction);
    }

    const config = await configStore.read().catch(() => ({}));
    const logs = config.logs || {};

    if (subcommand === 'view') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📑 Configuration Exhaustive des Salons de Logs')
        .setDescription(
          `Voici l'état actuel de tous les salons de surveillance d'audit configurés sur ce serveur :\n\n` +
          `*💡 Astuce : Tapez \`/setup-logs\` ou \`/config-logs setup\` pour générer tous les salons automatiquement en un clic.*`
        );

      const statusLines = LOG_TYPES.map(t => {
        const id = logs[t.key];
        const display = id ? `<#${id}>` : '*Non configuré*';
        return `${t.emoji} **${t.name}** : ${display}`;
      });

      const mid = Math.ceil(statusLines.length / 2);
      embed.addFields(
        { name: '📋 Salons Dédiés (1/2)', value: statusLines.slice(0, mid).join('\n'), inline: true },
        { name: '📋 Salons Dédiés (2/2)', value: statusLines.slice(mid).join('\n'), inline: true }
      );

      embed.setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'set') {
      const category = interaction.options.getString('categorie');
      const channel = interaction.options.getChannel('salon');

      await configStore.update(data => {
        data.logs = data.logs || {};
        data.logs[category] = channel.id;
        return data;
      });

      return interaction.reply({
        content: `✅ Le salon <#${channel.id}> a été assigné pour la catégorie sélectionnée.`,
        ephemeral: true
      });
    }
  }
};
