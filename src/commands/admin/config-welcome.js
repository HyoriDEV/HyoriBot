import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import { configStore } from '../../storage/index.js';
import { WelcomeCardService } from '../../services/welcomeCardService.js';

export const configWelcomeCommand = {
  data: new SlashCommandBuilder()
    .setName('config-welcome')
    .setDescription('Configurer le système de bienvenue et la bannière dynamique personnalisée')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Définir le salon où envoyer les cartes de bienvenue')
        .addChannelOption(opt =>
          opt
            .setName('salon')
            .setDescription('Le salon textuel de bienvenue')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addBooleanOption(opt =>
          opt
            .setName('activer')
            .setDescription('Activer immédiatement les messages de bienvenue')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('autorole')
        .setDescription('Définir le rôle attribué automatiquement aux nouveaux arrivants')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Le rôle à donner automatiquement (laisser vide pour désactiver)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Activer ou désactiver l\'envoi des messages de bienvenue')
        .addBooleanOption(opt =>
          opt
            .setName('actif')
            .setDescription('Activer (Vrai) ou Désactiver (Faux)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Afficher la configuration actuelle du système de bienvenue')
    )
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Générer et prévisualiser votre carte de bienvenue en direct')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const config = await configStore.read().catch(() => ({}));
    config.welcome = config.welcome || {};

    if (subcommand === 'channel') {
      const channel = interaction.options.getChannel('salon');
      const activate = interaction.options.getBoolean('activer') ?? true;

      await configStore.update(data => {
        data.welcome = data.welcome || {};
        data.welcome.channelId = channel.id;
        data.welcome.enabled = activate;
        return data;
      });

      return interaction.reply({
        content: `✅ Le salon de bienvenue est configuré sur <#${channel.id}> (${activate ? '🟢 Activé' : '🔴 Désactivé'}).`,
        ephemeral: true
      });
    }

    if (subcommand === 'autorole') {
      const role = interaction.options.getRole('role');

      await configStore.update(data => {
        data.welcome = data.welcome || {};
        data.welcome.autoRoleId = role ? role.id : null;
        return data;
      });

      return interaction.reply({
        content: role
          ? `✅ Les nouveaux membres recevront désormais automatiquement le rôle <@&${role.id}>.`
          : `✅ L'attribution automatique de rôle à l'arrivée a été désactivée.`,
        ephemeral: true
      });
    }

    if (subcommand === 'toggle') {
      const active = interaction.options.getBoolean('actif');

      await configStore.update(data => {
        data.welcome = data.welcome || {};
        data.welcome.enabled = active;
        return data;
      });

      return interaction.reply({
        content: `✅ Système de bienvenue : **${active ? '🟢 Activé' : '🔴 Désactivé'}**.`,
        ephemeral: true
      });
    }

    if (subcommand === 'view') {
      const w = config.welcome || {};
      const statusText = w.enabled !== false && w.channelId ? '🟢 Actif' : '🔴 Inactif';
      const channelText = w.channelId ? `<#${w.channelId}>` : '*Non configuré*';
      const roleText = w.autoRoleId ? `<@&${w.autoRoleId}>` : '*Aucun (désactivé)*';

      const embed = new EmbedBuilder()
        .setColor(0xe9d15c)
        .setTitle('🏛️ Configuration du Système de Bienvenue')
        .setDescription('Voici l\'état actuel du module de bienvenue personnalisé selon la charte Hyori :')
        .addFields(
          { name: 'État du module', value: statusText, inline: true },
          { name: 'Salon de Bienvenue', value: channelText, inline: true },
          { name: 'Rôle Automatique (Auto-Role)', value: roleText, inline: true },
          { name: 'Bannière Hyori', value: 'Génération dynamique haute fidélité (`@napi-rs/canvas`)', inline: false }
        )
        .setFooter({ text: 'Pour tester le rendu visuel, tapez /config-welcome test' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'test') {
      await interaction.deferReply({ ephemeral: false });

      const member = interaction.member;
      const cardBuffer = await WelcomeCardService.generateWelcomeCard(member);
      const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-hyori.png' });

      return interaction.editReply({
        content: `Bienvenue sur **Hyori RP**, <@${member.id}> !`,
        files: [attachment]
      });
    }
  }
};

export default configWelcomeCommand;
