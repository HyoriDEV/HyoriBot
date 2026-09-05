import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

class TempVoiceService {
  constructor() {
    /**
     * Map des salons vocaux temporaires actifs
     * Clé: channelId -> Valeur: { ownerId, guildId, createdAt, locked }
     */
    this.activeChannels = new Map();
  }

  /**
   * Récupère la configuration des vocaux temporaires
   */
  async getConfig() {
    const config = await configStore.read().catch(() => ({}));
    return config.tempVoice || {
      enabled: false,
      channelId: '',
      categoryId: ''
    };
  }

  /**
   * Sauvegarde la configuration du salon générateur
   */
  async setGenerator(guildId, channelId, categoryId) {
    await configStore.update(data => {
      data.tempVoice = {
        enabled: true,
        guildId,
        channelId,
        categoryId
      };
      return data;
    });
  }

  /**
   * Gère les changements de salon vocal (Join to create & Auto-suppression quand vide)
   */
  async handleVoiceStateUpdate(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild || oldState.guild;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    const tempConfig = await this.getConfig();

    // 1. Détection de connexion au salon générateur "Join to Create"
    if (newChannel && tempConfig.enabled && newChannel.id === tempConfig.channelId) {
      await this.createTemporaryChannel(member, newChannel, tempConfig);
    }

    // 2. Détection de déconnexion ou changement de salon : supprimer le salon temporaire s'il est devenu vide
    if (oldChannel && this.activeChannels.has(oldChannel.id)) {
      await this.checkAndDeleteEmptyChannel(oldChannel);
    }
  }

  /**
   * Crée un salon vocal temporaire dédié pour le membre et le déplace dedans
   */
  async createTemporaryChannel(member, generatorChannel, tempConfig) {
    const guild = member.guild;

    try {
      const channelName = `🔊・Salon de ${member.displayName || member.user.username}`;
      const categoryId = generatorChannel.parentId || tempConfig.categoryId || null;

      // Création du salon avec permissions appropriées
      // Le créateur a uniquement les droits sur son propre salon (renommer, taille, déplacer)
      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: 0, // Illimité par défaut
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages
            ]
          },
          {
            id: member.id, // Créateur du salon
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.ManageChannels, // Permet de modifier le nom et la taille de son propre salon
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.SendMessages
            ]
          },
          {
            id: guild.client.user.id, // Le Bot
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.SendMessages
            ]
          }
        ],
        reason: `Salon vocal temporaire créé pour ${member.user.tag}`
      });

      // Enregistrer le salon dans le registre actif
      this.activeChannels.set(newChannel.id, {
        ownerId: member.id,
        guildId: guild.id,
        createdAt: Date.now(),
        locked: false
      });

      // Déplacer immédiatement le membre dans son nouveau salon
      await member.voice.setChannel(newChannel).catch(err => {
        logger.warn({ error: err.message, memberId: member.id }, 'Impossible de déplacer le membre dans son vocal temporaire');
      });

      // Envoyer le panneau de gestion interactif dans le chat textuel du vocal
      await this.sendVoiceControlPanel(newChannel, member);

      logger.info({ channelId: newChannel.id, memberId: member.id }, 'Temporary voice channel created');
    } catch (err) {
      logger.error({ error: err.message, memberId: member.id }, 'Erreur lors de la création du salon vocal temporaire');
    }
  }

  /**
   * Envoie le panneau de contrôle interactif avec boutons dans le chat du salon vocal
   */
  async sendVoiceControlPanel(channel, owner) {
    const embed = new EmbedBuilder()
      .setColor(0xe9d15c)
      .setTitle('🔊 Gestionnaire de votre Salon Vocal')
      .setDescription(
        `Bienvenue dans votre salon vocal temporaire, <@${owner.id}> !\n\n` +
        `Vous êtes le **propriétaire de ce salon**. Utilisez les boutons ci-dessous pour le personnaliser en direct, ou modifiez-le directement via les paramètres Discord de votre salon.`
      )
      .addFields(
        { name: '👑 Propriétaire', value: `<@${owner.id}> (\`${owner.user.tag}\`)`, inline: true },
        { name: '👥 Limite', value: channel.userLimit ? `${channel.userLimit} personnes` : 'Illimitée', inline: true },
        { name: '🔒 Accès', value: '🟢 Ouvert à tous', inline: true }
      )
      .setFooter({ text: 'Le salon sera automatiquement supprimé dès qu\'il sera vide.' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tempvoice_rename_${channel.id}`)
        .setLabel('Renommer')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tempvoice_limit_${channel.id}`)
        .setLabel('Changer la limite')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`tempvoice_lock_${channel.id}`)
        .setLabel('Verrouiller')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tempvoice_kick_${channel.id}`)
        .setLabel('Expulser un membre')
        .setEmoji('🚫')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`tempvoice_transfer_${channel.id}`)
        .setLabel('Transférer la propriété')
        .setEmoji('👑')
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      await channel.send({
        content: `👋 Hey <@${owner.id}>, voici votre panneau de configuration !`,
        embeds: [embed],
        components: [row1, row2]
      });
    } catch (err) {
      logger.warn({ error: err.message, channelId: channel.id }, 'Impossible d\'envoyer le message de contrôle dans le salon vocal');
    }
  }

  /**
   * Vérifie et supprime un salon temporaire s'il n'y a plus personne dedans
   */
  async checkAndDeleteEmptyChannel(channel) {
    try {
      // Re-fetch channel pour avoir le nombre de membres actualisé
      const fetchedChannel = await channel.guild.channels.fetch(channel.id).catch(() => null);
      if (!fetchedChannel) {
        this.activeChannels.delete(channel.id);
        return;
      }

      if (fetchedChannel.members.size === 0) {
        this.activeChannels.delete(fetchedChannel.id);
        await fetchedChannel.delete('Salon vocal temporaire vide').catch(() => null);
        logger.info({ channelId: fetchedChannel.id }, 'Temporary voice channel deleted because it is empty');
      }
    } catch (err) {
      logger.warn({ error: err.message, channelId: channel.id }, 'Erreur lors de la suppression du salon vocal temporaire');
    }
  }

  /**
   * Gestionnaire des interactions (boutons, modales et menus déroulants)
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    // ──────────────────────────────────────────
    // 1. GESTION DES BOUTONS
    // ──────────────────────────────────────────
    if (interaction.isButton() && customId.startsWith('tempvoice_')) {
      const parts = customId.split('_');
      const action = parts[1]; // rename, limit, lock, kick, transfer
      const channelId = parts[2];

      const voiceData = this.activeChannels.get(channelId);
      const channel = interaction.guild.channels.cache.get(channelId);

      if (!channel) {
        return interaction.reply({ content: '❌ Ce salon vocal n\'existe plus.', ephemeral: true });
      }

      // Seul le propriétaire ou un administrateur Discord peut modifier le salon
      const isOwner = voiceData ? voiceData.ownerId === interaction.user.id : false;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        const ownerMention = voiceData ? `<@${voiceData.ownerId}>` : 'son créateur';
        return interaction.reply({
          content: `❌ Seul le propriétaire de ce salon (${ownerMention}) a l'autorisation de le modifier.`,
          ephemeral: true
        });
      }

      // Action: Renommer -> Affiche une Modal
      if (action === 'rename') {
        const modal = new ModalBuilder()
          .setCustomId(`tempvoice_modal_rename_${channelId}`)
          .setTitle('✏️ Renommer votre salon vocal');

        const nameInput = new TextInputBuilder()
          .setCustomId('tempvoice_name_input')
          .setLabel('Nouveau nom du salon')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 🎮・Gaming, 💬・Discussion...')
          .setValue(channel.name.slice(0, 100))
          .setMinLength(1)
          .setMaxLength(100)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return interaction.showModal(modal);
      }

      // Action: Modifier la limite -> Affiche une Modal
      if (action === 'limit') {
        const modal = new ModalBuilder()
          .setCustomId(`tempvoice_modal_limit_${channelId}`)
          .setTitle('👥 Modifier la limite d\'utilisateurs');

        const limitInput = new TextInputBuilder()
          .setCustomId('tempvoice_limit_input')
          .setLabel('Nombre max d\'utilisateurs (0 = illimité)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('0 à 99 (0 pour aucune limite)')
          .setValue(channel.userLimit.toString())
          .setMinLength(1)
          .setMaxLength(2)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
        return interaction.showModal(modal);
      }

      // Action: Verrouiller / Déverrouiller
      if (action === 'lock') {
        const currentData = this.activeChannels.get(channelId) || { locked: false, ownerId: interaction.user.id };
        const newLocked = !currentData.locked;
        currentData.locked = newLocked;
        this.activeChannels.set(channelId, currentData);

        await channel.permissionOverwrites.edit(interaction.guild.id, {
          Connect: newLocked ? false : null
        });

        const statusTxt = newLocked
          ? '🔒 **Votre salon est désormais verrouillé.** Plus aucun nouveau membre ne peut le rejoindre.'
          : '🔓 **Votre salon est désormais déverrouillé.** Tout le monde peut le rejoindre.';

        return interaction.reply({ content: statusTxt, ephemeral: true });
      }

      // Action: Expulser un membre -> Menu déroulant des membres présents
      if (action === 'kick') {
        const connectedMembers = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);
        if (connectedMembers.size === 0) {
          return interaction.reply({
            content: 'ℹ️ Il n\'y a aucun autre membre à expulser dans votre salon.',
            ephemeral: true
          });
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`tempvoice_select_kick_${channelId}`)
          .setPlaceholder('Sélectionnez le membre à expulser du vocal')
          .addOptions(
            connectedMembers.map(m =>
              new StringSelectMenuOptionBuilder()
                .setLabel(m.displayName || m.user.username)
                .setDescription(`ID: ${m.id}`)
                .setValue(m.id)
                .setEmoji('🚫')
            )
          );

        return interaction.reply({
          content: 'Choisissez le membre que vous souhaitez expulser :',
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          ephemeral: true
        });
      }

      // Action: Transférer la propriété
      if (action === 'transfer') {
        const otherMembers = channel.members.filter(m => m.id !== interaction.user.id && !m.user.bot);
        if (otherMembers.size === 0) {
          return interaction.reply({
            content: 'ℹ️ Il n\'y a aucun autre membre à qui transférer la propriété de votre salon.',
            ephemeral: true
          });
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`tempvoice_select_transfer_${channelId}`)
          .setPlaceholder('Sélectionnez le nouveau propriétaire')
          .addOptions(
            otherMembers.map(m =>
              new StringSelectMenuOptionBuilder()
                .setLabel(m.displayName || m.user.username)
                .setDescription(`ID: ${m.id}`)
                .setValue(m.id)
                .setEmoji('👑')
            )
          );

        return interaction.reply({
          content: 'Choisissez à quel membre vous souhaitez céder les commandes du salon :',
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          ephemeral: true
        });
      }
    }

    // ──────────────────────────────────────────
    // 2. GESTION DES MODALES
    // ──────────────────────────────────────────
    if (interaction.isModalSubmit() && customId.startsWith('tempvoice_modal_')) {
      const parts = customId.split('_');
      const action = parts[2]; // rename, limit
      const channelId = parts[3];

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Ce salon vocal n\'existe plus.', ephemeral: true });
      }

      if (action === 'rename') {
        const newName = interaction.fields.getTextInputValue('tempvoice_name_input').trim();
        if (!newName) {
          return interaction.reply({ content: '❌ Le nom ne peut pas être vide.', ephemeral: true });
        }

        await channel.setName(newName);
        return interaction.reply({
          content: `✅ Votre salon vocal a été renommé en : **${newName}** !`,
          ephemeral: true
        });
      }

      if (action === 'limit') {
        const limitStr = interaction.fields.getTextInputValue('tempvoice_limit_input').trim();
        const limit = parseInt(limitStr, 10);

        if (isNaN(limit) || limit < 0 || limit > 99) {
          return interaction.reply({
            content: '❌ La limite doit être un nombre compris entre 0 et 99 (0 pour aucune limite).',
            ephemeral: true
          });
        }

        await channel.setUserLimit(limit);
        return interaction.reply({
          content: `✅ La limite d'utilisateurs a été définie à : **${limit === 0 ? 'Illimitée' : `${limit} membres`}** !`,
          ephemeral: true
        });
      }
    }

    // ──────────────────────────────────────────
    // 3. GESTION DES MENUS DÉROULANTS
    // ──────────────────────────────────────────
    if (interaction.isStringSelectMenu() && customId.startsWith('tempvoice_select_')) {
      const parts = customId.split('_');
      const action = parts[2]; // kick, transfer
      const channelId = parts[3];

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Ce salon vocal n\'existe plus.', ephemeral: true });
      }

      const selectedMemberId = interaction.values[0];
      const targetMember = await interaction.guild.members.fetch(selectedMemberId).catch(() => null);

      if (action === 'kick') {
        if (!targetMember || targetMember.voice.channelId !== channelId) {
          return interaction.update({
            content: '❌ Ce membre n\'est plus dans votre salon vocal.',
            components: []
          });
        }

        await targetMember.voice.disconnect('Expulsé par le propriétaire du salon temporaire');
        return interaction.update({
          content: `🚫 **${targetMember.user.tag}** a été expulsé de votre salon vocal avec succès.`,
          components: []
        });
      }

      if (action === 'transfer') {
        if (!targetMember || targetMember.voice.channelId !== channelId) {
          return interaction.update({
            content: '❌ Ce membre n\'est plus dans votre salon vocal.',
            components: []
          });
        }

        // Mettre à jour les données
        const currentData = this.activeChannels.get(channelId) || { locked: false };
        currentData.ownerId = targetMember.id;
        this.activeChannels.set(channelId, currentData);

        // Ajuster les permissions
        await channel.permissionOverwrites.edit(targetMember.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true,
          MoveMembers: true
        });

        // Retirer les droits spéciaux de l'ancien propriétaire
        await channel.permissionOverwrites.edit(interaction.user.id, {
          ManageChannels: null,
          MoveMembers: null
        });

        await channel.send({
          content: `👑 <@${interaction.user.id}> a transféré la propriété du salon vocal à <@${targetMember.id}> !`
        });

        return interaction.update({
          content: `👑 La propriété de votre salon a été transférée à **${targetMember.user.tag}** avec succès.`,
          components: []
        });
      }
    }
  }
}

export const tempVoiceService = new TempVoiceService();
export default tempVoiceService;
