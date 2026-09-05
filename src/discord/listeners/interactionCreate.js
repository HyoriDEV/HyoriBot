import { slashCommandsMap } from '../commands/index.js';
import { PermissionService } from '../../services/permissionService.js';
import { tempVoiceService } from '../../services/tempVoiceService.js';
import { logger } from '../../logger/index.js';

export async function handleInteractionCreate(interaction) {
  // Gestionnaires des interactions vocales temporaires (Boutons, Modales, Menus déroulants)
  if (
    interaction.customId?.startsWith('tempvoice_') ||
    interaction.customId?.startsWith('tempvoice_modal_') ||
    interaction.customId?.startsWith('tempvoice_select_')
  ) {
    try {
      return await tempVoiceService.handleInteraction(interaction);
    } catch (err) {
      logger.error({ error: err.message }, 'Erreur lors du traitement d\'interaction tempvoice');
      return;
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('ticket_')) {
      const ticketHandler = (await import('../../events/tickets/ticketButtonHandler.js')).default;
      return ticketHandler.execute(interaction);
    }
    if (interaction.customId.startsWith('role_toggle_')) {
      const roleHandler = (await import('../../events/roles/buttonRoleHandler.js')).default;
      return roleHandler.execute(interaction);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = slashCommandsMap.get(interaction.commandName);
  if (!command) {
    logger.warn(
      {
        commandName: interaction.commandName,
      },
      'Unknown Slash command received'
    );
    return interaction.reply({
      content: '❌ Commande inconnue.',
      ephemeral: true,
    });
  }
  // Contrôle des permissions personnalisées (RBAC / ACL)
  const permCheck = await PermissionService.canExecute(interaction.member, interaction.commandName);
  if (!permCheck.allowed) {
    return interaction.reply({
      content: `❌ **Accès Refusé :** ${permCheck.reason}`,
      ephemeral: true
    });
  }

  try {
    logger.info(
      {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guildId,
      },
      'Executing Slash command'
    );
    await command.execute(interaction);
  } catch (error) {
    logger.error(
      {
        error,
        commandName: interaction.commandName,
      },
      'Error executing Slash command'
    );
    const msg = {
      content: "❌ Une erreur est survenue lors de l'exécution de cette commande.",
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => null);
    } else {
      await interaction.reply(msg).catch(() => null);
    }
  }
}
