import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} from 'discord.js';
import { configStore } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Déployer le panneau interactif de création de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Le salon où envoyer le panneau (actuel par défaut)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addChannelOption(opt =>
      opt
        .setName('categorie')
        .setDescription('La catégorie Discord où créer les salons de tickets')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildCategory)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
    const categoryChannel = interaction.options.getChannel('categorie');

    if (categoryChannel) {
      await configStore.update(data => {
        data.tickets = data.tickets || {};
        data.tickets.categoryId = categoryChannel.id;
        return data;
      });
    }

    const panelEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📩 Centre d\'Assistance & Support')
      .setDescription(
        'Besoin d\'aide, d\'une assistance technique ou de contacter l\'équipe ?\n\n' +
        'Cliquez sur l\'un des boutons ci-dessous correspondant à votre demande pour ouvrir un salon de discussion privé avec l\'équipe du serveur.\n\n' +
        '• 🎫 **Support Général** : Questions, aide, problèmes en jeu/serveur\n' +
        '• 🚨 **Signalement** : Signaler un joueur, un comportement ou un abus\n' +
        '• ❓ **Autre Demande** : Partenariats, questions diverses'
      )
      .setImage('https://dummyimage.com/600x200/2b2d31/ffffff&text=SUPPORT+&+TICKETS')
      .setFooter({ text: 'Merci de ne pas ouvrir de ticket sans motif valable.' });

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create_support')
        .setLabel('Support Général')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_create_report')
        .setLabel('Signaler un problème')
        .setEmoji('🚨')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_create_other')
        .setLabel('Autre')
        .setEmoji('❓')
        .setStyle(ButtonStyle.Secondary)
    );

    await targetChannel.send({
      embeds: [panelEmbed],
      components: [buttonsRow]
    });

    await interaction.reply({
      content: `✅ Panneau de ticket déployé avec succès dans <#${targetChannel.id}> !`,
      ephemeral: true
    });
  }
};
