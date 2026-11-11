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

    // Composants (Bouton vers le ticket si associé)
    const components = [];
    if (finalTicketUrl) {
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Voir le ticket associé')
          .setStyle(ButtonStyle.Link)
          .setURL(finalTicketUrl)
          .setEmoji('🎫')
      );
      components.push(buttonRow);
    }

    // Formatage markdown strict demandé : titres de niveau 1 pour # Contexte et # Actions
    const content = `# Contexte\n${context.trim()}\n\n# Actions\n${actions.trim()}`;

    if (content.length <= 2000) {
      const message = await channel.send({
        content,
        components,
      });
      try {
        await message.pin();
      } catch (pinErr) {
        logger.warn({ pinErr }, 'Impossible d’épingler le message initial du sujet');
      }
    } else {
      // Si le contenu dépasse la limite d'un message Discord (2000 caractères), envoi propre en deux messages
      const contextMsg = await channel.send({
        content: `# Contexte\n${context.trim()}`.slice(0, 2000),
      });
      const actionsMsg = await channel.send({
        content: `# Actions\n${actions.trim()}`.slice(0, 2000),
        components,
      });
      try {
        await contextMsg.pin();
        await actionsMsg.pin();
      } catch (pinErr) {
        logger.warn({ pinErr }, 'Impossible d’épingler les messages');
      }
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
   * Déplace un salon vers la catégorie "Sujets archivés".
   */
  async archiveTopic({ channelId }) {
    const guild = await this.getStaffGuild();
    const channel = await guild.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      throw new Error(`Salon textuel introuvable sur Discord (ID: ${channelId}).`);
    }

    const archivedCategory = await this.resolveArchivedCategory(guild);

    await channel.setParent(archivedCategory.id, { lockPermissions: true });

    await channel.send({
      content: "🔒 **Ce sujet a été archivé par l'équipe staff.**",
    });

    logger.info({ channelId, channelName: channel.name }, 'Salon de sujet staff archivé');

    return {
      success: true,
      channelId: channel.id,
      isArchived: true,
    };
  }
}

export const staffTopicService = new StaffTopicService();
