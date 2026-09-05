import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Affiche la latence du bot et de l\'API Discord'),
  async execute(interaction, client) {
    const sent = await interaction.reply({
      content: 'Calcul de la latence...',
      fetchReply: true,
      ephemeral: true
    });

    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏓 Pong !')
      .addFields(
        { name: 'Latence Aller-Retour', value: `\`${latency} ms\``, inline: true },
        { name: 'Latence API WebSocket', value: `\`${apiPing} ms\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
