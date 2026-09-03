import { SlashCommandBuilder } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const serverinfoCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Affiche les informations et statistiques du serveur Discord'),
  async execute(interaction) {
    await interaction.deferReply();
    const result = await modActions.executeServerinfo({
      guild: interaction.guild,
    });
    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
    return interaction.editReply({
      embeds: [result.embed],
    });
  },
};
