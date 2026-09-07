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
  const button = new ButtonBuilder()
    .setLabel(label)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
  return new ActionRowBuilder().addComponents(button);
}
export function buildRegistrationStatusEmbed(status, customUrl) {
  const env = getEnv();
  const url = customUrl || env.ATLAS_PLAYER_SPACE_URL;
  const embed = createHyoriEmbed();
  switch (status) {
    case 'WHITELIST_IN_PROGRESS':
      embed
        .setTitle('Inscription — Candidature acceptée')
        .setDescription(
          'Votre candidature pour rejoindre **Hyori RP** a été acceptée par l\'équipe staff.\n\nVous pouvez dès à présent accéder à votre espace joueur pour préparer votre fiche personnage et réserver votre entretien vocal.'
        );
      break;
    case 'WHITELISTED':
      embed
        .setTitle('Whitelist — Validation définitive')
        .setDescription(
          'Félicitations, votre inscription sur **Hyori RP** a été validée !\n\nVous disposez désormais d\'un accès complet au site, au serveur Discord et au serveur Minecraft.'
        );
      break;
    case 'REJECTED':
      embed
        .setTitle('Inscription — Candidature non retenue')
        .setDescription(
          'Votre candidature pour rejoindre **Hyori RP** n\'a pas été retenue par l\'équipe staff.\n\nVous pouvez consulter les détails depuis votre espace joueur.'
        );
      break;
    case 'WAITLIST':
      embed
        .setTitle('Inscription — Liste d\'attente')
        .setDescription(
          'Votre candidature a été réintégrée sur la liste d\'attente de **Hyori RP** par l\'équipe staff.\n\nVous pouvez suivre l\'évolution de votre statut depuis votre espace joueur.'
        );
      break;
  }
  const row = createPlayerSpaceButton(url);
  return {
    embed,
    components: [row],
  };
}
export function buildCharacterSheetStatusEmbed(status, customUrl) {
  const env = getEnv();
  const url = customUrl || env.ATLAS_PLAYER_SPACE_URL;
  const embed = createHyoriEmbed()
    .setTitle('Fiche Personnage — Retours disponibles')
    .setDescription(
      'Des retours ont été déposés sur votre fiche personnage par l\'équipe staff.\n\nConsultez les remarques directement sur votre fiche pour apporter les ajustements demandés.'
    );
  const row = createPlayerSpaceButton(url, 'Consulter ma fiche personnage');
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
        .setTitle('Sanction Disciplinaire — Avertissement')
        .setDescription(`Tu as reçu un avertissement pour la raison suivante :\n\n> **${reason}**`);
      break;
    case 'SUSPENSION': {
      const dur = duration || 'temporaire';
      embed
        .setTitle('Sanction Disciplinaire — Suspension')
        .setDescription(
          `Tu as été suspendu du projet Hyori pour une durée de **${dur}** pour la raison suivante :\n\n> **${reason}**\n\nTu as la possibilité de contester cette décision en formulant un unique appel par ticket.`
        );
      break;
    }
    case 'EXCLUSION':
      embed
        .setTitle('Sanction Disciplinaire — Exclusion Définitive')
        .setDescription(
          `Tu as été exclu du projet Hyori pour la raison suivante :\n\n> **${reason}**\n\nTu as la possibilité de contester cette décision en formulant un unique appel par ticket.`
        );
      break;
  }
  const row = createPlayerSpaceButton(url);
  return {
    embed,
    components: [row],
  };
}
