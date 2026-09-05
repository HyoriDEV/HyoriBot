import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { PermissionService, PERMISSION_LEVELS } from '../../services/permissionService.js';

function createSetpermBuilder(name = 'setperm', desc = 'Assigner un niveau de permission (0 à 3) à un rôle ou à un membre') {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(desc)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt =>
      opt
        .setName('niveau')
        .setDescription('Niveau de permission (0=Public, 1=Membre, 2=Modo/Staff, 3=Admin)')
        .setRequired(true)
        .addChoices(
          { name: '👥 Niveau 0 — Tout le monde (Public)', value: 0 },
          { name: '👤 Niveau 1 — Membre', value: 1 },
          { name: '🛡️ Niveau 2 — Modérateur / Staff', value: 2 },
          { name: '👑 Niveau 3 — Administrateur', value: 3 }
        )
    )
    .addRoleOption(opt =>
      opt
        .setName('role')
        .setDescription('Rôle auquel attribuer ce niveau de permission')
        .setRequired(false)
    )
    .addUserOption(opt =>
      opt
        .setName('membre')
        .setDescription('Membre auquel attribuer ce niveau de permission')
        .setRequired(false)
    );
}

export async function executeSetperm(interaction) {
  const level = interaction.options.getInteger('niveau');
  const role = interaction.options.getRole('role');
  const user = interaction.options.getUser('membre');

  if (!role && !user) {
    return interaction.reply({
      content: '⚠️ **Paramètre manquant** : Vous devez spécifier au moins un `role` ou un `membre` à assigner à ce niveau.',
      ephemeral: true
    });
  }

  const lvlInfo = PERMISSION_LEVELS[level];
  const fields = [];

  if (role) {
    await PermissionService.setRoleLevel(role.id, level);
    fields.push({
      name: '🎭 Rôle Assigné',
      value: `**${role.name}** (<@&${role.id}>) ➔ **${lvlInfo.emoji} ${lvlInfo.name} (Niveau ${level})**`,
      inline: false
    });
  }

  if (user) {
    await PermissionService.setUserLevel(user.id, level);
    fields.push({
      name: '👤 Membre Assigné',
      value: `<@${user.id}> (**${user.tag}**) ➔ **${lvlInfo.emoji} ${lvlInfo.name} (Niveau ${level})**`,
      inline: false
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('✅ Permissions Mises à Jour')
    .setDescription(`Les permissions suivantes ont été enregistrées avec succès :`)
    .addFields(fields)
    .setFooter({ text: 'Utilisez /setperm-cmds pour gérer le niveau requis de chaque commande, /spl pour lister, /spr pour réinitialiser.' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

export const setpermCommand = {
  data: createSetpermBuilder('setperm', 'Assigner un niveau de permission (0 à 3) à un rôle ou à un membre'),
  execute: executeSetperm
};

export const spCommand = {
  data: createSetpermBuilder('sp', 'Alias direct de /setperm : assigner un niveau à un rôle ou membre'),
  execute: executeSetperm
};

export default setpermCommand;
