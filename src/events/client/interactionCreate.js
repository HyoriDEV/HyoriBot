import { Events, InteractionType } from 'discord.js';
import { logger } from '../../logger/index.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // 1. Commandes Slash (Chat Input)
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(
          { commandName: interaction.commandName, userId: interaction.user.id },
          'Commande Slash inconnue reçue'
        );
        return interaction.reply({
          content: '❌ Cette commande est introuvable ou n\'est plus disponible.',
          ephemeral: true
        });
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(
          { commandName: interaction.commandName, error, user: interaction.user.tag },
          'Erreur lors de l\'exécution de la commande Slash'
        );

        const errorMessage = {
          content: '⚠️ Une erreur inattendue est survenue lors de l\'exécution de cette commande.',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage).catch(() => {});
        } else {
          await interaction.reply(errorMessage).catch(() => {});
        }
      }
      return;
    }

    // 2. Boutons (ex: Tickets, Rôles, Confirmation)
    if (interaction.isButton()) {
      // Déclenché plus tard par les handlers de tickets / rôles
      client.emit('customButtonInteraction', interaction);
      return;
    }

    // 3. Modals
    if (interaction.isModalSubmit()) {
      client.emit('customModalInteraction', interaction);
      return;
    }

    // 4. Menus de sélection (String Select, User Select, etc.)
    if (interaction.isAnySelectMenu()) {
      client.emit('customSelectInteraction', interaction);
      return;
    }
  }
};
