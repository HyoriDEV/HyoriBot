import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { PermissionService, PERMISSION_LEVELS } from '../../services/permissionService.js';

export const splCommand = {
  data: new SlashCommandBuilder()
    .setName('spl')
    .setDescription('Afficher la liste de tous les rôles et membres avec leur niveau de permission')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const all = await PermissionService.getAllPermissions();
    const rolesConfig = all.roles || {};
    const usersConfig = all.users || {};

    const rolesLines = Object.entries(rolesConfig).map(([id, lvl]) => {
      const lvlInfo = PERMISSION_LEVELS[lvl] || { emoji: '❓', name: `Niveau ${lvl}` };
      return `• <@&${id}> : **${lvlInfo.emoji} ${lvlInfo.name} (Niv. ${lvl})**`;
    });

    const usersLines = Object.entries(usersConfig).map(([id, lvl]) => {
      const lvlInfo = PERMISSION_LEVELS[lvl] || { emoji: '❓', name: `Niveau ${lvl}` };
      return `• <@${id}> : **${lvlInfo.emoji} ${lvlInfo.name} (Niv. ${lvl})**`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🛡️ Répertoire des Permissions Hyori Bot')
      .setDescription('Voici la liste des rôles et des membres ayant un niveau spécifique attribué :')
      .addFields(
        {
          name: '🎭 Rôles Configurés',
          value: rolesLines.length > 0 ? rolesLines.join('\n') : '*Aucun rôle spécifique configuré (utilisez `/setperm` ou `/sp`)*',
          inline: false
        },
        {
          name: '👤 Membres Configurés',
          value: usersLines.length > 0 ? usersLines.join('\n') : '*Aucun membre spécifique configuré (utilisez `/setperm` ou `/sp`)*',
          inline: false
        }
      )
      .setFooter({ text: 'Raccourcis : /sp (assigner) • /spr (reset) • /spl (liste) • /setperm-cmds (niveaux commandes)' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};

export default splCommand;
