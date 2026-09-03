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
export function createPlayerSpaceButton(customUrl) {
  const env = getEnv();
  const url = customUrl || env.ATLAS_PLAYER_SPACE_URL;
  const button = new ButtonBuilder()
    .setLabel('Accéder à mon espace joueur')
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
        .setTitle('Inscription — Candidature Acceptée')
        .setDescription(
          'Tu as été accepté sur le projet **Hyori RP**.\n\nAccède à ton espace joueur pour suivre les prochaines étapes.'
        )
        .addFields({
          name: 'Espace Joueur',
          value: `[Cliquer ici pour y accéder](${url})`,
        });
      break;
    case 'WHITELISTED':
      embed
        .setTitle('Whitelist — Validation Définitive')
        .setDescription(
          'Bienvenue à Hyori !\n\nTa candidature à la whitelist a été validée. Tu as désormais un accès complet au site, au serveur Discord et au serveur Minecraft.'
        )
        .addFields({
          name: 'Espace Joueur',
          value: `[Cliquer ici pour y accéder](${url})`,
        });
      break;
    case 'REJECTED':
      embed
        .setTitle('Inscription — Statut Mis à Jour')
        .setDescription(
          "Ton statut d'inscription a été mis à jour.\n\nAccède à ton espace joueur pour obtenir les détails."
        )
        .addFields({
          name: 'Espace Joueur',
          value: `[Cliquer ici pour y accéder](${url})`,
        });
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
    .setTitle('Fiche Personnage — Retours Disponibles')
    .setDescription(
      'Des retours ont été déposés sur ta fiche personnage.\n\nAccède à ton espace joueur pour les découvrir.'
    )
    .addFields({
      name: 'Espace Joueur',
      value: `[Cliquer ici pour consulter les retours](${url})`,
    });
  const row = createPlayerSpaceButton(url);
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
