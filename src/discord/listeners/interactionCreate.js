import { slashCommandsMap } from '../commands/index.js';
import { logger } from '../../logger/index.js';
export async function handleInteractionCreate(interaction) {
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
