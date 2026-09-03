import { SlashCommandBuilder } from 'discord.js';
import { modActions } from '../moderation/modActions.js';
import { getEnv } from '../../config/env.js';
export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche le guide complet de toutes les commandes de modération'),
  async execute(interaction) {
    const env = getEnv();
    const result = modActions.executeHelp({
      prefix: env.PREFIX || '!',
    });
    return interaction.reply({
      embeds: [result.embed],
      ephemeral: true,
    });
  },
};
