import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { TicketService } from '../../services/ticketService.js';
import { ticketsStore } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Commandes de gestion des tickets')
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Fermer le ticket actuel avec génération de transcription')
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Ajouter un membre dans le ticket')
        .addUserOption(opt =>
          opt
            .setName('membre')
            .setDescription('Le membre à inviter dans le ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Retirer un membre du ticket')
        .addUserOption(opt =>
          opt
            .setName('membre')
            .setDescription('Le membre à exclure du ticket')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.channel;

    // Vérifier si le salon actuel est un salon de ticket
    const ticketsData = await ticketsStore.read();
    const isTicketChannel = (ticketsData.tickets || []).some(
      t => t.channelId === channel.id && t.status === 'OPEN'
    );

    if (!isTicketChannel && !channel.name.startsWith('ticket-')) {
      return interaction.reply({
        content: '❌ Cette commande ne peut être exécutée que dans un salon de ticket actif.',
        ephemeral: true
      });
    }

    if (subcommand === 'close') {
      // Simuler l'interaction de bouton pour appeler la logique unifiée
      await TicketService.closeTicket(interaction);
      return;
    }

    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('membre');
      await channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true
      });

      return interaction.reply({
        content: `✅ ${targetUser} a été ajouté au ticket avec succès.`,
        ephemeral: true
      });
    }

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('membre');
      await channel.permissionOverwrites.delete(targetUser.id);

      return interaction.reply({
        content: `✅ ${targetUser} a été retiré du ticket.`,
        ephemeral: true
      });
    }
  }
};
