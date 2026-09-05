import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { TempbanService } from '../../services/tempbanService.js';

export const configtempbanCommand = {
  data: new SlashCommandBuilder()
    .setName('configtempban')
    .setDescription('Configurer le rôle de tempban et les salons visibles pour les membres isolés')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interactionOrMessage, args = []) {
    const isInteraction = typeof interactionOrMessage.isCommand === 'function' || interactionOrMessage.isChatInputCommand?.();
    const guild = interactionOrMessage.guild;
    const author = isInteraction ? interactionOrMessage.user : interactionOrMessage.author;

    if (!guild) {
      const errTxt = '❌ Cette commande doit être exécutée dans un serveur Discord.';
      if (isInteraction) return interactionOrMessage.reply({ content: errTxt, ephemeral: true });
      return interactionOrMessage.reply(errTxt);
    }

    let config = await TempbanService.getConfig();

    const buildEmbed = (statusExtra = '') => {
      const roleDisplay = config.roleId ? `<@&${config.roleId}> (\`${config.roleId}\`)` : '`⚠️ Aucun rôle sélectionné`';
      
      const channelsDisplay = config.allowedChannels && config.allowedChannels.length > 0
        ? config.allowedChannels.map(id => `<#${id}>`).join(', ')
        : '`⚠️ Aucun salon (isolement complet / aveugle)`';

      const syncDisplay = config.lastSyncedAt
        ? `✅ Synchronisé <t:${Math.floor(config.lastSyncedAt / 1000)}:R>`
        : '`⚠️ Non synchronisé sur les salons du serveur`';

      const embed = new EmbedBuilder()
        .setColor(0xD4AF35) // Or Hyori
        .setTitle('⚖️ Configuration du Système Tempban & Isolement')
        .setDescription(
          `Ce module configure le **rôle attribué** lors d'un bannissement temporaire ou d'un isolement, ainsi que les **salons que ces membres ont le droit de voir**.\n\n` +
          `🔒 **Tous les autres salons du serveur leur seront automatiquement masqués et inaccessibles.**\n` +
          (statusExtra ? `\n> ${statusExtra}\n` : '')
        )
        .addFields(
          { name: '🎭 Rôle Tempban / Isolement attribué', value: roleDisplay, inline: false },
          { name: `👁️ Salons autorisés & visibles (${config.allowedChannels.length})`, value: channelsDisplay, inline: false },
          { name: '⚡ Statut des permissions Discord', value: syncDisplay, inline: false }
        )
        .setFooter({ text: 'Hyori RP • Sécurité & Modération • Sélectionnez ci-dessous pour modifier' })
        .setTimestamp();

      return embed;
    };

    const buildComponents = () => {
      // 1. Menu de sélection du rôle Tempban
      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('tb_role_select')
        .setPlaceholder('👉 Choisir le rôle attribué lors d\'un tempban...')
        .setMinValues(1)
        .setMaxValues(1);

      // 2. Menu de sélection des salons autorisés
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('tb_channels_select')
        .setPlaceholder('👉 Choisir les salons qu\'ils ont le droit de voir...')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement)
        .setMinValues(0)
        .setMaxValues(25);

      // 3. Boutons d'Action
      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_tb_apply')
          .setLabel('⚡ Appliquer les permissions sur le serveur')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_tb_refresh')
          .setLabel('🔄 Actualiser')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_tb_reset')
          .setLabel('🗑️ Réinitialiser')
          .setStyle(ButtonStyle.Danger)
      );

      return [
        new ActionRowBuilder().addComponents(roleSelect),
        new ActionRowBuilder().addComponents(channelSelect),
        rowButtons
      ];
    };

    const embed = buildEmbed();
    const components = buildComponents();

    let response;
    if (isInteraction) {
      response = await interactionOrMessage.reply({
        embeds: [embed],
        components,
        fetchReply: true
      });
    } else {
      response = await interactionOrMessage.reply({
        embeds: [embed],
        components
      });
    }

    // Collecteur d'interactions composants
    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === author.id,
      time: 600000 // 10 minutes
    });

    collector.on('collect', async i => {
      try {
        // 1. Choix du rôle
        if (i.customId === 'tb_role_select') {
          const selectedRoleId = i.values[0];
          await TempbanService.saveConfig({ roleId: selectedRoleId });
          config.roleId = selectedRoleId;

          await i.update({
            embeds: [buildEmbed(`✅ Rôle Tempban mis à jour : <@&${selectedRoleId}>. N'oubliez pas de cliquer sur **"Appliquer les permissions"** pour synchroniser.`)],
            components: buildComponents()
          });
          return;
        }

        // 2. Choix des salons autorisés
        if (i.customId === 'tb_channels_select') {
          const selectedChannels = i.values;
          await TempbanService.saveConfig({ allowedChannels: selectedChannels });
          config.allowedChannels = selectedChannels;

          await i.update({
            embeds: [buildEmbed(`✅ **${selectedChannels.length} salon(s) autorisé(s)** enregistrés. Cliquez sur **"Appliquer les permissions"** pour verrouiller le reste du serveur.`)],
            components: buildComponents()
          });
          return;
        }

        // 3. Application des permissions sur tout le serveur
        if (i.customId === 'btn_tb_apply') {
          if (!config.roleId) {
            await i.reply({
              content: '❌ Veuillez d\'abord sélectionner un rôle dans le menu déroulant avant d\'appliquer les permissions.',
              ephemeral: true
            });
            return;
          }

          await i.deferUpdate();

          const result = await TempbanService.applyPermissions(
            guild,
            config.roleId,
            config.allowedChannels
          );

          config.lastSyncedAt = Date.now();

          await i.editReply({
            embeds: [
              buildEmbed(
                `🎉 **Permissions synchronisées avec succès sur le serveur !**\n` +
                `• Salons autorisés & visibles : **${result.allowedCount}**\n` +
                `• Salons verrouillés & masqués pour <@&${config.roleId}> : **${result.hiddenCount}**`
              )
            ],
            components: buildComponents()
          });
          return;
        }

        // 4. Actualiser
        if (i.customId === 'btn_tb_refresh') {
          await i.deferUpdate();
          config = await TempbanService.getConfig();
          await i.editReply({
            embeds: [buildEmbed('🔄 Affichage actualisé avec la dernière configuration.')],
            components: buildComponents()
          });
          return;
        }

        // 5. Réinitialiser
        if (i.customId === 'btn_tb_reset') {
          await i.deferUpdate();
          await TempbanService.saveConfig({ roleId: '', allowedChannels: [], lastSyncedAt: null });
          config = { roleId: null, allowedChannels: [], lastSyncedAt: null };
          await i.editReply({
            embeds: [buildEmbed('🗑️ Configuration Tempban réinitialisée.')],
            components: buildComponents()
          });
          return;
        }
      } catch (err) {
        if (!i.replied && !i.deferred) {
          await i.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true }).catch(() => {});
        } else {
          await i.followUp({ content: `❌ Erreur : ${err.message}`, ephemeral: true }).catch(() => {});
        }
      }
    });

    collector.on('end', () => {
      response.edit({ components: [] }).catch(() => {});
    });
  }
};

export default configtempbanCommand;
