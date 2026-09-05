import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { configStore } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config-roles')
    .setDescription('Configurer les rôles du bot (Staff, Modération)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('staff')
        .setDescription('Gérer les rôles ayant accès aux commandes staff et tickets')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Ajouter un rôle staff')
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Le rôle à ajouter').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Retirer un rôle staff')
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Le rôle à retirer').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('Lister tous les rôles staff configurés')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Afficher toute la configuration actuelle des rôles')
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const config = await configStore.read();
    config.roles = config.roles || {};
    config.roles.staffRoleIds = config.roles.staffRoleIds || [];

    if (subcommand === 'view' || (group === 'staff' && subcommand === 'list')) {
      const staffList = config.roles.staffRoleIds.length > 0
        ? config.roles.staffRoleIds.map(id => `• <@&${id}> (\`${id}\`)`).join('\n')
        : '*Aucun rôle staff configuré*';

      const mutedRole = config.roles.mutedRoleId
        ? `<@&${config.roles.mutedRoleId}> (\`${config.roles.mutedRoleId}\`)`
        : '*Automatique (@Muted-Restricted)*';

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Configuration des Rôles')
        .addFields(
          { name: '🛡️ Rôles Staff (Accès tickets & modération)', value: staffList, inline: false },
          { name: '🔇 Rôle Restrictif Timeout', value: mutedRole, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (group === 'staff') {
      const role = interaction.options.getRole('role');

      if (subcommand === 'add') {
        if (config.roles.staffRoleIds.includes(role.id)) {
          return interaction.reply({
            content: `⚠️ Le rôle ${role} est déjà enregistré comme rôle staff.`,
            ephemeral: true
          });
        }

        config.roles.staffRoleIds.push(role.id);
        await configStore.write(config);

        return interaction.reply({
          content: `✅ Le rôle ${role} a été ajouté aux rôles staff avec succès.`,
          ephemeral: true
        });
      }

      if (subcommand === 'remove') {
        if (!config.roles.staffRoleIds.includes(role.id)) {
          return interaction.reply({
            content: `⚠️ Le rôle ${role} n'est pas dans la liste du staff.`,
            ephemeral: true
          });
        }

        config.roles.staffRoleIds = config.roles.staffRoleIds.filter(id => id !== role.id);
        await configStore.write(config);

        return interaction.reply({
          content: `✅ Le rôle ${role} a été retiré des rôles staff.`,
          ephemeral: true
        });
      }
    }
  }
};
