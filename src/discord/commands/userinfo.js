import { SlashCommandBuilder } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
export const userinfoCommand = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription("Affiche la fiche détaillée d'un utilisateur (rôles, date d'arrivée, warns)")
    .addUserOption(opt =>
      opt
        .setName('utilisateur')
        .setDescription("L'utilisateur ciblé (vous-même par défaut)")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
    const result = await modActions.executeUserinfo({
      guild: interaction.guild,
      targetUser,
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
