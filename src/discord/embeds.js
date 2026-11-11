import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getEnv } from '../config/env.js';

export const HYORI_COLOR = 0xe9d15c;
export const HYORI_FOOTER = 'Hyori RP';

export function createHyoriEmbed() {
  return new EmbedBuilder()
    .setColor(HYORI_COLOR)
    .setFooter({
      text: HYORI_FOOTER,
    })
    .setTimestamp();
}

export function createPlayerSpaceButton(customUrl, customLabel) {
  const env = getEnv();
  const url = customUrl || env.ATLAS_PLAYER_SPACE_URL;
  const label = customLabel || 'Accéder à mon espace joueur';
  const button = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);
  return new ActionRowBuilder().addComponents(button);
}

export function buildRegistrationStatusEmbed(status, customUrl, village = null) {
  const env = getEnv();
  const url = customUrl || env.ATLAS_PLAYER_SPACE_URL;
  const embed = createHyoriEmbed();

  switch (status) {
    case 'WHITELIST_IN_PROGRESS':
      embed
        .setTitle('Candidature acceptée')
        .setDescription(
          "Votre candidature pour rejoindre Hyori RP a été acceptée par l'équipe staff.\n\nVous pouvez dès à présent accéder à votre espace joueur pour préparer votre fiche personnage et réserver votre entretien vocal."
        );
      break;
    case 'WHITELISTED': {
      let desc =
        "Votre inscription sur Hyori RP a été validée.\n\nVous disposez désormais d'un accès complet au site, au serveur Discord communautaire et au serveur Minecraft.";
      if (village?.inviteUrl) {
        desc += `\n\nServeur Discord de votre classe (${village.name}) :\n${village.inviteUrl}`;
      }
      embed.setTitle('Validation whitelist').setDescription(desc);
      break;
    }
    case 'REJECTED':
      embed
        .setTitle('Candidature non retenue')
        .setDescription(
          "Votre candidature pour rejoindre Hyori RP n'a pas été retenue par l'équipe staff.\n\nVous pouvez consulter les détails depuis votre espace joueur."
        );
      break;
    case 'WAITLIST':
      embed
        .setTitle("Liste d'attente")
        .setDescription(
          "Votre candidature a été réintégrée sur la liste d'attente de Hyori RP par l'équipe staff.\n\nVous pouvez suivre l'évolution de votre statut depuis votre espace joueur."
        );
      break;
  }

  const buttons = [
    new ButtonBuilder()
      .setLabel('Accéder à mon espace joueur')
      .setStyle(ButtonStyle.Link)
      .setURL(url),
  ];

  if (status === 'WHITELISTED' && village?.inviteUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel(`Discord — ${village.name}`)
        .setStyle(ButtonStyle.Link)
        .setURL(village.inviteUrl)
    );
  }

  const row = new ActionRowBuilder().addComponents(buttons);
  return {
    embed,
    components: [row],
  };
}

/**
 * Construit l'embed et le bouton pour l'invitation au serveur Discord d'un village.
 * @param {{ village: object, memberName?: string }} params
 */
export function buildVillageInviteNotificationEmbed({ village, memberName }) {
  const embed = createHyoriEmbed()
    .setTitle(`Serveur Discord — ${village.name}`)
    .setDescription(
      `Bonjour${memberName ? ` **${memberName}**` : ''},\n\n` +
        `En tant que joueur affilié à la classe **${village.name}** (${village.class}), voici le lien permanent vers le serveur Discord de votre village :\n` +
        `${village.inviteUrl}\n\n` +
        `Ce serveur privé permet aux habitants de votre village d'échanger et de suivre les annonces locales.`
    );

  const button = new ButtonBuilder()
    .setLabel(`Rejoindre ${village.name}`)
    .setStyle(ButtonStyle.Link)
    .setURL(village.inviteUrl);

  const row = new ActionRowBuilder().addComponents(button);

  return {
    embed,
    components: [row],
  };
}

export function buildCharacterSheetStatusEmbed(status, customUrl) {
  const env = getEnv();
  const url = customUrl || env.ATLAS_PLAYER_SPACE_URL;
  const embed = createHyoriEmbed();

  switch (status) {
    case 'VALIDATED':
      embed
        .setTitle('Fiche personnage validée')
        .setDescription(
          "Votre fiche personnage a été validée par l'équipe staff.\n\nVous pouvez la consulter sur votre espace joueur et poursuivre les étapes de votre inscription."
        );
      break;
    case 'REOPENED':
      embed
        .setTitle('Fiche personnage rouverte')
        .setDescription(
          "Votre fiche personnage a été rouverte par l'équipe staff.\n\nVous pouvez apporter les modifications nécessaires et la soumettre à nouveau depuis votre espace joueur."
        );
      break;
    case 'PENDING_PLAYER':
    default:
      embed
        .setTitle('Fiche personnage — Retours disponibles')
        .setDescription(
          "Des retours ont été formulés sur votre fiche personnage par l'équipe staff.\n\nConsultez les remarques directement sur votre fiche pour effectuer les ajustements demandés."
        );
      break;
  }

  const row = createPlayerSpaceButton(url, 'Consulter ma fiche personnage');
  return {
    embed,
    components: [row],
  };
}

export function buildInterviewReminderEmbed(customUrl) {
  const env = getEnv();
  const url = customUrl || `${env.ATLAS_PLAYER_SPACE_URL}/interview`;
  const embed = createHyoriEmbed();
  embed
    .setTitle('Entretien vocal — Réservation')
    .setDescription(
      "Votre fiche personnage a été validée par l'équipe staff et des créneaux d'entretien vocal sont disponibles.\n\nRendez-vous sur votre espace joueur pour réserver votre créneau."
    );

  const row = createPlayerSpaceButton(url, 'Réserver un créneau');
  return {
    embed,
    components: [row],
  };
}

export function buildSanctionNotificationEmbed(type, reason, duration, appealUrl) {
  const env = getEnv();
  const url = appealUrl || env.ATLAS_BASE_URL;
  const embed = createHyoriEmbed();

  switch (type) {
    case 'WARNING':
      embed
        .setTitle('Sanction — Avertissement')
        .setDescription(`Un avertissement vous a été attribué pour la raison suivante :\n\n> ${reason}`);
      break;
    case 'SUSPENSION': {
      const dur = duration || 'temporaire';
      embed
        .setTitle('Sanction — Suspension')
        .setDescription(
          `Votre compte a été suspendu pour une durée de **${dur}** pour la raison suivante :\n\n> ${reason}\n\nVous pouvez contester cette décision en ouvrant un recours via un ticket.`
        );
      break;
    }
    case 'EXCLUSION':
      embed
        .setTitle('Sanction — Exclusion définitive')
        .setDescription(
          `Votre compte a été définitivement exclu pour la raison suivante :\n\n> ${reason}\n\nVous pouvez contester cette décision en formulant un unique recours par ticket.`
        );
      break;
  }

  const row = createPlayerSpaceButton(url, "Accéder à l'espace joueur");
  return {
    embed,
    components: [row],
  };
}

export function buildTicketMessageNotificationEmbed(
  ticketSubject,
  authorName,
  messagePreview,
  ticketUrl
) {
  const env = getEnv();
  const url = ticketUrl || `${env.ATLAS_PLAYER_SPACE_URL}/tickets`;
  const embed = createHyoriEmbed();

  embed.setTitle('Nouveau message — Ticket');

  let description = `Nouveau message de **${authorName}** dans le ticket **« ${ticketSubject} »**.`;
  if (messagePreview && messagePreview.trim()) {
    const cleanPreview =
      messagePreview.length > 300 ? `${messagePreview.slice(0, 297)}...` : messagePreview;
    description += `\n\n> ${cleanPreview.replace(/\n+/g, '\n> ')}`;
  }

  embed.setDescription(description);

  const row = createPlayerSpaceButton(url, 'Consulter le ticket');
  return {
    embed,
    components: [row],
  };
}

export function buildRpTrackingMessageNotificationEmbed({
  authorName,
  messagePreview,
  rpTrackingUrl,
  characterName = null,
}) {
  const env = getEnv();
  const url = rpTrackingUrl || `${env.ATLAS_PLAYER_SPACE_URL}/rp-tracking`;
  const embed = createHyoriEmbed();

  embed.setTitle(
    characterName ? `Nouveau message — Suivi RP (${characterName})` : 'Nouveau message — Suivi RP'
  );

  let description = `Nouveau message de **${authorName}** sur votre suivi RP.`;
  if (messagePreview && messagePreview.trim()) {
    const cleanPreview =
      messagePreview.length > 300 ? `${messagePreview.slice(0, 297)}...` : messagePreview;
    description += `\n\n> ${cleanPreview.replace(/\n+/g, '\n> ')}`;
  }

  embed.setDescription(description);

  const row = createPlayerSpaceButton(url, 'Consulter mon suivi RP');
  return {
    embed,
    components: [row],
  };
}

export function buildTicketCreatedNotificationEmbed({
  ticketSubject,
  ticketCategory,
  authorName,
  ticketDescription,
  ticketStaffUrl,
  discordId = null,
  avatarUrl = null,
}) {
  const env = getEnv();
  const url = ticketStaffUrl || `${env.ATLAS_BASE_URL}/staff/tickets`;
  const embed = createHyoriEmbed();

  const isTechnique =
    typeof ticketCategory === 'string' &&
    (ticketCategory.toUpperCase() === 'TECHNIQUE' || ticketCategory.toLowerCase().includes('tech'));

  const categoryLabel = isTechnique ? 'Technique' : 'Roleplay';

  embed.setTitle(`Nouveau ticket — ${categoryLabel}`);

  let description =
    `Joueur : **${authorName || 'Inconnu'}**${discordId ? ` (<@${discordId}>)` : ''}\n` +
    `Catégorie : **${categoryLabel}**\n` +
    `Sujet : **${ticketSubject}**`;

  if (ticketDescription && ticketDescription.trim()) {
    const excerpt =
      ticketDescription.length > 500 ? `${ticketDescription.slice(0, 497)}...` : ticketDescription;
    description += `\n\n> ${excerpt.replace(/\n+/g, '\n> ')}`;
  }

  embed.setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const row = createPlayerSpaceButton(url, 'Consulter le ticket');
  return {
    embed,
    components: [row],
  };
}

export function buildWaitlistRegistrationNotificationEmbed({
  playerName,
  minecraftUsername,
  discordId,
  waitlistStaffUrl,
  avatarUrl = null,
}) {
  const env = getEnv();
  const url = waitlistStaffUrl || `${env.ATLAS_BASE_URL}/staff/waitlist`;
  const embed = createHyoriEmbed();

  embed.setTitle("Admissions — Inscription en liste d'attente");

  const description =
    `Joueur : **${playerName || 'Inconnu'}**${discordId ? ` (<@${discordId}>)` : ''}\n` +
    `Compte Minecraft : \`${minecraftUsername || 'Non renseigné'}\`\n` +
    `Statut : **En attente de whitelist**`;

  embed.setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const row = createPlayerSpaceButton(url, "Consulter la liste d'attente");
  return {
    embed,
    components: [row],
  };
}

export function buildCharacterSheetSubmittedNotificationEmbed({
  playerName,
  minecraftUsername,
  characterName,
  characterClass = null,
  discordId = null,
  evaluationStaffUrl = null,
  avatarUrl = null,
}) {
  const env = getEnv();
  const url = evaluationStaffUrl || `${env.ATLAS_BASE_URL}/staff/atlas`;
  const embed = createHyoriEmbed();

  embed.setTitle('Admissions — Fiche RP en évaluation');

  let description =
    `Joueur : **${playerName || 'Inconnu'}**${discordId ? ` (<@${discordId}>)` : ''}\n` +
    `Compte Minecraft : \`${minecraftUsername || 'Non renseigné'}\`\n` +
    `Personnage : **${characterName || 'Non renseigné'}**` +
    (characterClass ? ` · *${characterClass}*` : '') +
    `\nStatut : **En attente d'évaluation staff**`;

  embed.setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const row = createPlayerSpaceButton(url, 'Évaluer la fiche RP');
  return {
    embed,
    components: [row],
  };
}

export function buildInterviewSlotBookedNotificationEmbed({
  playerName,
  minecraftUsername,
  slotDate,
  discordId = null,
  interviewStaffUrl = null,
  avatarUrl = null,
}) {
  const env = getEnv();
  const url = interviewStaffUrl || `${env.ATLAS_BASE_URL}/staff/interview-slots`;
  const embed = createHyoriEmbed();

  embed.setTitle("Admissions — Créneau d'entretien réservé");

  const dateObj = new Date(slotDate);
  const isValidDate = !Number.isNaN(dateObj.getTime());
  const formattedDate = isValidDate
    ? new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      }).format(dateObj)
    : slotDate;
  const discordRelative = isValidDate ? ` (<t:${Math.floor(dateObj.getTime() / 1000)}:R>)` : '';

  const description =
    `Joueur : **${playerName || 'Inconnu'}**${discordId ? ` (<@${discordId}>)` : ''}\n` +
    `Compte Minecraft : \`${minecraftUsername || 'Non renseigné'}\`\n` +
    `Créneau réservé : **${formattedDate}**${discordRelative}\n` +
    `Statut : **Entretien oral planifié**`;

  embed.setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const row = createPlayerSpaceButton(url, 'Consulter le planning');
  return {
    embed,
    components: [row],
  };
}
