import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { configStore } from '../../storage/index.js';
import { discordConfig } from '../../config/discordConfig.js';
import { GuildRegistry } from '../../discord/services/guildRegistry.js';

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
          sub.setName('list').setDescription('Lister tous les rôles staff configurés')
        )
    )
    .addSubcommand(sub =>
      sub.setName('view').setDescription('Afficher toute la configuration actuelle des rôles')
    )
    .addSubcommand(sub =>
      sub
        .setName('sync-non-inscrits')
        .setDescription('Harmoniser le rôle Non-inscrit pour tous les membres du serveur communautaire')
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const config = await configStore.read();
    config.roles = config.roles || {};
    config.roles.staffRoleIds = config.roles.staffRoleIds || [];

    if (subcommand === 'view' || (group === 'staff' && subcommand === 'list')) {
      const staffList =
        config.roles.staffRoleIds.length > 0
          ? config.roles.staffRoleIds.map(id => `• <@&${id}> (\`${id}\`)`).join('\n')
          : '*Aucun rôle staff configuré*';

      const mutedRole = config.roles.mutedRoleId
        ? `<@&${config.roles.mutedRoleId}> (\`${config.roles.mutedRoleId}\`)`
        : '*Automatique (@Muted-Restricted)*';

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ Configuration des Rôles')
        .addFields(
          { name: '🛡️ Rôles Staff (Accès tickets & modération)', value: staffList, inline: false },
          { name: '🔇 Rôle Restrictif Timeout', value: mutedRole, inline: false },
          {
            name: '📜 Rôles d’Adhésion & Whitelist',
            value: `• Whitelisté : <@&${discordConfig.roles.whitelist}> (\`${discordConfig.roles.whitelist}\`)\n• Non-inscrit : <@&${discordConfig.roles.nonInscrit}> (\`${discordConfig.roles.nonInscrit}\`)`,
            inline: false,
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'sync-non-inscrits') {
      if (!GuildRegistry.isCommunityGuild(interaction.guild.id)) {
        return interaction.reply({
          content: '⚠️ Cette commande doit être exécutée sur le serveur communautaire Hyori RP.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const whitelistRoleId = discordConfig.roles.whitelist;
      const nonInscritRoleId = discordConfig.roles.nonInscrit;
      const sanctionedRoleId = discordConfig.roles.sanctioned;

      const members = await interaction.guild.members.fetch();
      const humanMembers = members.filter(m => !m.user.bot);

      let addedCount = 0;
      let removedCount = 0;
      let alreadyCompliantCount = 0;
      let errorCount = 0;

      for (const member of humanMembers.values()) {
        if (sanctionedRoleId && member.roles.cache.has(sanctionedRoleId)) {
          continue;
        }

        const hasWhitelist = member.roles.cache.has(whitelistRoleId);
        const hasNonInscrit = member.roles.cache.has(nonInscritRoleId);

        if (hasWhitelist && hasNonInscrit) {
          try {
            await member.roles.remove(
              nonInscritRoleId,
              'Harmonisation manuelle : membre whitelisté'
            );
            removedCount++;
          } catch {
            errorCount++;
          }
          continue;
        }

        if (!hasWhitelist && !hasNonInscrit) {
          try {
            await member.roles.add(
              nonInscritRoleId,
              'Harmonisation manuelle : membre non whitelisté'
            );
            addedCount++;
          } catch {
            errorCount++;
          }
          continue;
        }

        alreadyCompliantCount++;
      }

      const syncEmbed = new EmbedBuilder()
        .setColor(errorCount > 0 ? 0xf1c40f : 0x2ecc71)
        .setTitle('📊 Harmonisation des Rôles Non-inscrits')
        .setDescription(
          `La vérification et l'application des rôles sont terminées sur **${interaction.guild.name}** :`
        )
        .addFields(
          { name: '👥 Membres vérifiés', value: `\`${humanMembers.size}\``, inline: true },
          { name: '🟢 Non-inscrit attribués', value: `\`+${addedCount}\``, inline: true },
          { name: '🔴 Non-inscrit retirés', value: `\`-${removedCount}\``, inline: true },
          { name: '✅ Déjà conformes', value: `\`${alreadyCompliantCount}\``, inline: true },
          {
            name: '⚠️ Erreurs de permission',
            value: errorCount > 0 ? `\`${errorCount}\`` : '`0`',
            inline: true,
          }
        )
        .setFooter({ text: 'Règle stricte : soit Whitelisté, soit Non-inscrit, jamais les deux.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [syncEmbed] });
    }

    if (group === 'staff') {
      const role = interaction.options.getRole('role');

      if (subcommand === 'add') {
        if (config.roles.staffRoleIds.includes(role.id)) {
          return interaction.reply({
            content: `⚠️ Le rôle ${role} est déjà enregistré comme rôle staff.`,
            ephemeral: true,
          });
        }

        config.roles.staffRoleIds.push(role.id);
        await configStore.write(config);

        return interaction.reply({
          content: `✅ Le rôle ${role} a été ajouté aux rôles staff avec succès.`,
          ephemeral: true,
        });
      }

      if (subcommand === 'remove') {
        if (!config.roles.staffRoleIds.includes(role.id)) {
          return interaction.reply({
            content: `⚠️ Le rôle ${role} n'est pas dans la liste du staff.`,
            ephemeral: true,
          });
        }

        config.roles.staffRoleIds = config.roles.staffRoleIds.filter(id => id !== role.id);
        await configStore.write(config);

        return interaction.reply({
          content: `✅ Le rôle ${role} a été retiré des rôles staff.`,
          ephemeral: true,
        });
      }
    }
  },
};
