import { TicketService } from '../../services/ticketService.js';
import { logger } from '../../logger/index.js';

export default {
  name: 'customButtonInteraction',
  async execute(interaction) {
    const customId = interaction.customId;

    try {
      if (customId === 'ticket_create_support') {
        await TicketService.createTicket(interaction, 'Support Général');
      } else if (customId === 'ticket_create_report') {
        await TicketService.createTicket(interaction, 'Signalement');
      } else if (customId === 'ticket_create_other') {
        await TicketService.createTicket(interaction, 'Autre');
      } else if (customId === 'ticket_close_confirm') {
        await TicketService.closeTicket(interaction);
      }
    } catch (error) {
      logger.error({ error, customId, user: interaction.user.tag }, 'Erreur dans le gestionnaire de bouton de tickets');
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ Une erreur est survenue lors du traitement de votre demande de ticket.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
};
