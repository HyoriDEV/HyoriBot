import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { LogSetupService, LOG_TYPES } from '../../services/logSetupService.js';
import { configStore } from '../../storage/index.js';

export const setupLogsCommand = {
  data: new SlashCommandBuilder()
    .setName('setup-logs')
    .setDescription('Créer et configurer automatiquement tous les salons de logs d\'audit du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ Cette commande doit être exécutée dans un serveur.', ephemeral: true });
    }

    // Récupération de la configuration actuelle
    const config = await configStore.read().catch(() => ({}));
    const logsConfig = config.logs || {};

    const buildOverviewEmbed = (descriptionExtra = '') => {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛠️ Déploiement Automatique des Salons de Logs')
        .setDescription(
          `Ce module analyse et génère une catégorie dédiée (**📁 ─── LOGS SERVEUR ───**) sécurisée (verrouillée pour \`@everyone\`, visible uniquement par le Staff) avec l'ensemble des salons de journalisation d'événements.\n\n` +
          `Sélectionnez les salons souhaités dans le menu ci-dessous, ou cliquez directement sur **"Créer TOUS les Salons"** pour une protection exhaustive instantanée !\n` +
          (descriptionExtra ? `\n${descriptionExtra}` : '')
        );

      // Aperçu de l'état actuel de chaque log
      const statusLines = LOG_TYPES.map(t => {
        const channelId = logsConfig[t.key];
        const status = channelId ? `<#${channelId}>` : '`Non configuré`';
        return `${t.emoji} **${t.name}** ➔ ${status}`;
      });

      // Découper en 2 champs pour un affichage propre
      const mid = Math.ceil(statusLines.length / 2);
      embed.addFields(
        { name: '📋 Salons de Surveillance (1/2)', value: statusLines.slice(0, mid).join('\n'), inline: true },
        { name: '📋 Salons de Surveillance (2/2)', value: statusLines.slice(mid).join('\n'), inline: true }
      );

      embed.setFooter({ text: 'Hyori Discord Bot • Système d\'Audit Exhaustif' });
      embed.setTimestamp();
      return embed;
    };

    // Construction du Menu Déroulant
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('setup_logs_select')
      .setPlaceholder('👉 Cochez les types de logs à créer...')
      .setMinValues(1)
      .setMaxValues(LOG_TYPES.length);

    LOG_TYPES.forEach(t => {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(t.name)
          .setValue(t.id)
          .setDescription(t.desc.slice(0, 100))
          .setEmoji(t.emoji)
      );
    });

    // Boutons d'Action
    const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

    const rowButtons1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_create_all')
        .setLabel('🚀 Créer TOUS les Salons (12)')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('btn_create_selected')
        .setLabel('✅ Créer Salons Sélectionnés')
        .setStyle(ButtonStyle.Primary)
    );

    const rowButtons2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_view_config')
        .setLabel('🔄 Actualiser la Vue')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_delete_all')
        .setLabel('🗑️ Tout Nettoyer / Supprimer')
        .setStyle(ButtonStyle.Danger)
    );

    const initialEmbed = buildOverviewEmbed();

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: [rowMenu, rowButtons1, rowButtons2],
      fetchReply: true
    });

    // Collecteur de composants interactifs
    let currentSelection = LOG_TYPES.map(t => t.id); // Par défaut: tous

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 600000 // 10 minutes
    });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'setup_logs_select') {
          currentSelection = i.values;
          await i.reply({
            content: `🎯 **${currentSelection.length} type(s) de logs sélectionné(s)**. Cliquez maintenant sur **"Créer Salons Sélectionnés"** pour valider la création.`,
            ephemeral: true
          });
          return;
        }

        if (i.customId === 'btn_create_all' || i.customId === 'btn_create_selected') {
          await i.deferUpdate();

          const toCreate = i.customId === 'btn_create_all' ? null : currentSelection;
          const { category, results } = await LogSetupService.setupChannels(guild, toCreate);

          // Recharger la config à jour
          const freshConfig = await configStore.read().catch(() => ({}));
          Object.assign(logsConfig, freshConfig.logs || {});

          const createdCount = results.filter(r => r.isNew).length;
          const reusedCount = results.filter(r => !r.isNew).length;

          const updatedEmbed = buildOverviewEmbed(
            `✅ **Déploiement terminé dans la catégorie <#${category.id}> !**\n` +
            `• Nouveaux salons créés : **${createdCount}**\n` +
            `• Salons existants rattachés : **${reusedCount}**`
          );

          await i.editReply({
            embeds: [updatedEmbed],
            components: [rowMenu, rowButtons1, rowButtons2]
          });
          return;
        }

        if (i.customId === 'btn_view_config') {
          await i.deferUpdate();
          const freshConfig = await configStore.read().catch(() => ({}));
          Object.assign(logsConfig, freshConfig.logs || {});
          await i.editReply({
            embeds: [buildOverviewEmbed('🔄 Affichage actualisé avec la dernière configuration.')],
            components: [rowMenu, rowButtons1, rowButtons2]
          });
          return;
        }

        if (i.customId === 'btn_delete_all') {
          await i.deferUpdate();
          const count = await LogSetupService.deleteAllChannels(guild);
          Object.keys(logsConfig).forEach(k => delete logsConfig[k]);

          const clearedEmbed = buildOverviewEmbed(
            `🗑️ **${count} salon(s) et la catégorie de logs ont été supprimés avec succès.**`
          );

          await i.editReply({
            embeds: [clearedEmbed],
            components: [rowMenu, rowButtons1, rowButtons2]
          });
          return;
        }
      } catch (err) {
        if (!i.replied && !i.deferred) {
          await i.reply({ content: `❌ Erreur lors du traitement : ${err.message}`, ephemeral: true }).catch(() => {});
        }
      }
    });

    collector.on('end', () => {
      // Désactive les boutons quand le collecteur expire
      interaction.editReply({
        components: []
      }).catch(() => {});
    });
  }
};

export default setupLogsCommand;
