import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} from 'discord.js';
import { buttonRolesStore } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('button-role')
    .setDescription('Créer un panneau de sélection de rôles par boutons cliquables')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('titre')
        .setDescription('Titre du panneau')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('description')
        .setDescription('Description ou consignes du panneau')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt
        .setName('role_1')
        .setDescription('Premier rôle à attribuer')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('label_1')
        .setDescription('Texte affiché sur le 1er bouton (par défaut le nom du rôle)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('emoji_1')
        .setDescription('Emoji sur le 1er bouton (ex: 🔔)')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt
        .setName('role_2')
        .setDescription('Deuxième rôle')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('label_2')
        .setDescription('Texte affiché sur le 2ème bouton')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('emoji_2')
        .setDescription('Emoji sur le 2ème bouton (ex: 🎮)')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt
        .setName('role_3')
        .setDescription('Troisième rôle')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('label_3')
        .setDescription('Texte affiché sur le 3ème bouton')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('emoji_3')
        .setDescription('Emoji sur le 3ème bouton')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt
        .setName('role_4')
        .setDescription('Quatrième rôle')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('label_4')
        .setDescription('Texte affiché sur le 4ème bouton')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('emoji_4')
        .setDescription('Emoji sur le 4ème bouton')
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt
        .setName('salon')
        .setDescription('Salon d\'envoi (salon actuel par défaut)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('titre');
    const description = interaction.options.getString('description');
    const targetChannel = interaction.options.getChannel('salon') || interaction.channel;

    const rolesConfig = [];

    for (let i = 1; i <= 4; i++) {
      const role = interaction.options.getRole(`role_${i}`);
      if (!role) continue;

      const label = interaction.options.getString(`label_${i}`) || role.name;
      const emoji = interaction.options.getString(`emoji_${i}`) || null;

      rolesConfig.push({
        id: role.id,
        name: role.name,
        label: label.slice(0, 80),
        emoji
      });
    }

    if (rolesConfig.length === 0) {
      return interaction.reply({
        content: '❌ Veuillez spécifier au moins un rôle valide.',
        ephemeral: true
      });
    }

    const row = new ActionRowBuilder();

    for (const r of rolesConfig) {
      const btn = new ButtonBuilder()
        .setCustomId(`role_toggle_${r.id}`)
        .setLabel(r.label)
        .setStyle(ButtonStyle.Secondary);

      if (r.emoji) {
        try {
          btn.setEmoji(r.emoji);
        } catch {}
      }

      row.addComponents(btn);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🎭 ${title}`)
      .setDescription(`${description}\n\n*Cliquez sur un bouton ci-dessous pour ajouter ou retirer le rôle correspondant.*`)
      .setFooter({ text: 'Sélection de rôles automatique' });

    const sentMessage = await targetChannel.send({
      embeds: [embed],
      components: [row]
    });

    // Enregistrement persistant dans buttonRoles.json
    await buttonRolesStore.update(data => {
      data.panels = data.panels || [];
      data.panels.push({
        id: `panel_${Date.now()}`,
        messageId: sentMessage.id,
        channelId: targetChannel.id,
        guildId: interaction.guild.id,
        title,
        roles: rolesConfig,
        createdAt: Date.now()
      });
      return data;
    });

    await interaction.reply({
      content: `✅ Panneau de rôles déployé avec succès dans <#${targetChannel.id}> !`,
      ephemeral: true
    });
  }
};
