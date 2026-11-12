import {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { discordBot } from '../discord/client.js';
import { discordConfig } from '../config/discordConfig.js';
import { GuildRegistry } from '../discord/services/guildRegistry.js';
import { getEnv } from '../config/env.js';
import { logger } from '../logger/index.js';

/**
 * Normalise un texte en slug pour salon textuel Discord (kebab-case, max 100 caractères).
 */
export function formatTopicSlug(input) {
  if (!input) return 'sujet';
  let slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Remplace tout ce qui n'est pas alphanumérique par un tiret
    .replace(/^-+|-+$/g, ''); // Supprime les tirets au début et à la fin

  if (!slug) slug = 'sujet';
  return slug.slice(0, 100);
}

export class StaffTopicService {
  /**
   * Récupère le serveur Discord du staff.
   */
  async getStaffGuild() {
    const staffGuildId = GuildRegistry.getStaffGuildId();
    if (!staffGuildId) {
      throw new Error("L'identifiant du serveur staff Discord n'est pas configuré.");
    }
    const guild = await discordBot.client.guilds.fetch(staffGuildId);
    if (!guild) {
      throw new Error(`Serveur staff introuvable sur Discord (ID: ${staffGuildId}).`);
    }
    return guild;
  }

  /**
   * Trouve ou crée la catégorie "Sujets" active.
   */
  async resolveActiveCategory(guild) {
    // 1. Vérification par ID configuré dans discordConfig
    const configuredId =
      discordConfig.categories?.topics ||
      discordConfig.channels?.topicsCategory;

    if (configuredId) {
      try {
        const cat = await guild.channels.fetch(configuredId);
        if (cat && cat.type === ChannelType.GuildCategory) {
          return cat;
        }
      } catch (err) {
        logger.warn({ configuredId, err }, 'Catégorie Sujets par ID introuvable, repli par nom');
      }
    }

    // 2. Recherche par nom
    const channels = await guild.channels.fetch();
    const existing = channels.find(
      c =>
        c &&
        c.type === ChannelType.GuildCategory &&
        (c.name.trim().toLowerCase() === 'sujets' ||
          c.name.trim().toLowerCase() === '📁 sujets' ||
          c.name.trim().toLowerCase().includes('sujet')) &&
        !c.name.toLowerCase().includes('archiv')
    );

    if (existing) {
      return existing;
    }

    // 3. Création automatique si absente
    logger.info('Création de la catégorie Sujets sur le serveur staff');
    return await guild.channels.create({
      name: 'Sujets',
      type: ChannelType.GuildCategory,
      reason: 'Catégorie pour les salons de discussion staff (Hyori Atlas)',
    });
  }

  /**
   * Trouve ou crée la catégorie "Sujets archivés".
   */
  async resolveArchivedCategory(guild) {
    // 1. Vérification par ID configuré dans discordConfig
    const configuredId =
      discordConfig.categories?.archivedTopics ||
      discordConfig.channels?.archivedTopicsCategory;

    if (configuredId) {
      try {
        const cat = await guild.channels.fetch(configuredId);
        if (cat && cat.type === ChannelType.GuildCategory) {
          return cat;
        }
      } catch (err) {
        logger.warn(
          { configuredId, err },
          'Catégorie Sujets archivés par ID introuvable, repli par nom'
        );
      }
    }

    // 2. Recherche par nom
    const channels = await guild.channels.fetch();
    const existing = channels.find(
      c =>
        c &&
        c.type === ChannelType.GuildCategory &&
        (c.name.toLowerCase().includes('archiv') ||
          c.name.toLowerCase().includes('sujets archives') ||
          c.name.toLowerCase().includes('sujets archivés'))
    );

    if (existing) {
      return existing;
    }

    // 3. Création automatique si absente
    logger.info('Création de la catégorie Sujets archivés sur le serveur staff');
    return await guild.channels.create({
      name: 'Sujets archivés',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.SendMessages],
        },
      ],
      reason: 'Catégorie pour les salons de discussion staff archivés (Hyori Atlas)',
    });
  }

  /**
   * Crée un nouveau salon de sujet dans la catégorie active.
   */
  async createTopic({ title, slug, context, actions, ticketId, ticketSubject, ticketUrl }) {
    const guild = await this.getStaffGuild();
    const activeCategory = await this.resolveActiveCategory(guild);

    const channelSlug = formatTopicSlug(slug || title);
    const channelTopic = ticketSubject
      ? `Sujet staff lié au ticket #${ticketId || ''} : ${ticketSubject}`.slice(0, 1024)
      : `Sujet staff : ${title}`.slice(0, 1024);

    const channel = await guild.channels.create({
      name: channelSlug,
      type: ChannelType.GuildText,
      parent: activeCategory.id,
      topic: channelTopic,
      reason: `Sujet créé via Hyori Atlas par le staff${ticketId ? ` (Ticket #${ticketId})` : ''}`,
    });

    const env = getEnv();
    const atlasBaseUrl = env.ATLAS_BASE_URL || 'https://hyori-rp.fr';
    const finalTicketUrl =
      ticketUrl || (ticketId ? `${atlasBaseUrl}/staff/tickets/${ticketId}` : null);

    // Composants (Bouton "Voir le ticket" si associé + Bouton "Archiver" rapide)
    const buttonRow = new ActionRowBuilder();
    if (finalTicketUrl) {
      buttonRow.addComponents(
        new ButtonBuilder()
          .setLabel('Voir le ticket')
          .setStyle(ButtonStyle.Link)
          .setURL(finalTicketUrl)
      );
    }

    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('topic_archive')
        .setLabel('Archiver')
        .setStyle(ButtonStyle.Secondary)
    );

    const components = [buttonRow];

    // Formatage markdown strict demandé : titres de niveau 1 pour # Contexte et # Actions
    const content = `# Contexte\n${context.trim()}\n\n# Actions\n${actions.trim()}`;

    if (content.length <= 2000) {
      await channel.send({
        content,
        components,
      });
    } else {
      // Si le contenu dépasse la limite d'un message Discord (2000 caractères), envoi propre en deux messages
      await channel.send({
        content: `# Contexte\n${context.trim()}`.slice(0, 2000),
      });
      await channel.send({
        content: `# Actions\n${actions.trim()}`.slice(0, 2000),
        components,
      });
    }

    logger.info(
      {
        channelId: channel.id,
        channelName: channel.name,
        ticketId,
      },
      'Salon de sujet staff créé avec succès'
    );

    return {
      success: true,
      channelId: channel.id,
      slug: channel.name,
      channelUrl: `https://discord.com/channels/${guild.id}/${channel.id}`,
    };
  }

  /**
   * Déplace un salon vers la catégorie "Sujets archivés" et préfixe son nom par ✔️.
   */
  async archiveTopic({ channelId, user = null }) {
    const guild = await this.getStaffGuild();
    const channel = await guild.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      throw new Error(`Salon textuel introuvable sur Discord (ID: ${channelId}).`);
    }

    const archivedCategory = await this.resolveArchivedCategory(guild);

    // Vérifier si le salon n'est pas déjà archivé
    if (channel.parentId === archivedCategory.id && channel.name.startsWith('✔️')) {
      return {
        success: true,
        channelId: channel.id,
        newName: channel.name,
        isArchived: true,
        alreadyArchived: true,
      };
    }

    // Normalisation du nom en préfixant avec l'émoji ✔️ (ex: ✔️haevan-plainte)
    const cleanName = channel.name.replace(/^(✔️|✔)+/, '');
    const newName = `✔️${cleanName}`.slice(0, 100);

    const editData = {
      parent: archivedCategory.id,
      lockPermissions: true,
    };
    if (channel.name !== newName) {
      editData.name = newName;
    }

    try {
      await channel.edit(editData);
    } catch (editErr) {
      logger.warn({ editErr, channelId }, 'Échec de l’édition groupée du salon, tentative par étapes');
      await channel.setParent(archivedCategory.id, { lockPermissions: true });
      if (channel.name !== newName) {
        await channel.setName(newName).catch(nameErr => {
          logger.warn({ nameErr, channelId }, 'Impossible de renommer le salon (possible rate-limit Discord)');
        });
      }
    }

    const archiverText = user ? `par ${user.toString()}` : "par l'équipe staff";

    await channel.send({
      content: `🔒 **Ce sujet a été archivé ${archiverText}.**`,
    });

    logger.info({ channelId, oldName: channel.name, newName }, 'Salon de sujet staff archivé');

    if (user) {
      this.notifyAtlasTopicArchived({ channelId, user }).catch(err => {
        logger.warn({ err, channelId }, 'Échec de la notification d’archivage vers Atlas');
      });
    }

    return {
      success: true,
      channelId: channel.id,
      newName,
      isArchived: true,
    };
  }

  /**
   * Notifie Hyori Atlas (best-effort) lorsqu'un sujet est archivé depuis Discord.
   */
  async notifyAtlasTopicArchived({ channelId, user }) {
    try {
      const env = getEnv();
      const atlasUrl = (process.env.ATLAS_INTERNAL_URL || env.ATLAS_BASE_URL || 'https://hyori-rp.fr').replace(/\/$/, '');
      const response = await fetch(`${atlasUrl}/api/bot/topics/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.INTERNAL_BOT_API_KEY}`,
        },
        body: JSON.stringify({
          channelId,
          archivedBy: user ? (user.globalName || user.username || user.tag) : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.warn({ status: response.status, errorText, channelId }, 'Atlas a retourné une erreur lors de la synchronisation d’archivage');
      } else {
        logger.info({ channelId }, 'Atlas synchronisé avec succès pour l’archivage du sujet');
      }
    } catch (err) {
      logger.warn({ err: err?.message || err, channelId }, 'Impossible de contacter Atlas pour synchroniser l’archivage du sujet');
    }
  }
}

export const staffTopicService = new StaffTopicService();
