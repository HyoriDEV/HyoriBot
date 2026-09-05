import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { PermissionService } from '../../services/permissionService.js';

export const sprCommand = {
  data: new SlashCommandBuilder()
    .setName('spr')
    .setDescription('Réinitialiser la permission personnalisée d\'un rôle, d\'un membre ou de tout le serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt =>
      opt
        .setName('role')
        .setDescription('Rôle à réinitialiser')
        .setRequired(false)
    )
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Membre à réinitialiser')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt
        .setName('tout')
        .setDescription('Réinitialiser toutes les permissions personnalisées (rôles et membres)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const user = interaction.options.getUser('membre');
    const all = interaction.options.getBoolean('tout');

    if (!role && !user && !all) {
      return interaction.reply({
        content: '⚠️ Veuillez préciser au moins un `role`, un `membre` ou sélectionner `tout: Vrai` pour réinitialiser.',
        ephemeral: true
      });
    }

    if (all) {
      await PermissionService.resetAll();
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Permissions Réinitialisées')
        .setDescription('Toutes les attributions de permissions personnalisées (rôles et membres) ont été supprimées.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    const details = [];
    if (role) {
      await PermissionService.removeRoleLevel(role.id);
      details.push(`• Rôle **${role.name}** (<@&${role.id}>) réinitialisé`);
    }

    if (user) {
      await PermissionService.removeUserLevel(user.id);
      details.push(`• Membre <@${user.id}> (**${user.tag}**) réinitialisé`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Réinitialisation Effectuée')
      .setDescription(details.join('\n'))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};

export default sprCommand;
