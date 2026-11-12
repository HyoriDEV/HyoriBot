import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { staffTopicService } from '../../services/staffTopicService.js';
import { logger } from '../../logger/index.js';

export default {
  name: 'customButtonInteraction',
  async execute(interaction) {
    if (interaction.customId !== 'topic_archive') {
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) {
        return interaction.editReply({
          content: '❌ Cette action ne peut être exécutée que dans un salon textuel.',
        });
      }

      const result = await staffTopicService.archiveTopic({
        channelId: interaction.channelId,
        user: interaction.user,
      });

      // Désactiver le bouton d'archivage sur le message d'origine si modifiable
      if (interaction.message && interaction.message.editable) {
        try {
          const updatedComponents = interaction.message.components.map(row => {
            const rowBuilder = ActionRowBuilder.from(row);
            rowBuilder.components = rowBuilder.components.map(component => {
              if (component.data.custom_id === 'topic_archive') {
                return ButtonBuilder.from(component).setDisabled(true);
              }
              return component;
            });
            return rowBuilder;
          });
          await interaction.message.edit({ components: updatedComponents });
        } catch (editErr) {
          logger.warn({ editErr }, 'Impossible de désactiver le bouton d’archivage sur le message');
        }
      }

      if (result.alreadyArchived) {
        return interaction.editReply({
          content: 'ℹ️ Ce sujet est déjà archivé dans la catégorie des archives.',
        });
      }

      return interaction.editReply({
        content: `✅ Le sujet a été déplacé dans la catégorie d'archive et renommé en \`${result.newName || interaction.channel.name}\`.`,
      });
    } catch (error) {
      logger.error(
        { error, channelId: interaction.channelId, user: interaction.user?.tag },
        'Erreur lors de l’archivage du sujet via le bouton Discord'
      );

      const errorMessage = '⚠️ Une erreur est survenue lors de l’archivage de ce sujet.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
      }
    }
  },
};

