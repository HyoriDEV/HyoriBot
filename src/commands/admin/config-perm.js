import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { PermissionService, PERMISSION_LEVELS } from '../../services/permissionService.js';
import { permissionsStore } from '../../storage/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config-perm')
    .setDescription('Gérer finement les permissions et accès par commande (Rôles & Utilisateurs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 1. Définir le niveau général
    .addSubcommand(sub =>
      sub
        .setName('set-level')
        .setDescription('Définir le niveau de permission minimum pour une commande')
        .addStringOption(opt =>
          opt
            .setName('commande')
            .setDescription('Le nom de la commande (ex: timeout, ban, warn, ticket)')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('niveau')
            .setDescription('Niveau d\'accès requis')
            .setRequired(true)
            .addChoices(
              { name: '👥 0 - Tout le monde', value: 0 },
              { name: '👤 1 - Membres', value: 1 },
              { name: '🛡️ 2 - Modérateurs (Staff)', value: 2 },
              { name: '👑 3 - Administrateurs', value: 3 }
            )
        )
    )
    // 2. Dérogation Rôle
    .addSubcommand(sub =>
      sub
        .setName('role')
        .setDescription('Donner ou retirer l\'accès à un rôle pour une commande')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action').setRequired(true).addChoices(
            { name: '✅ Autoriser (Allow)', value: 'allow' },
            { name: '🚫 Bloquer (Deny)', value: 'deny' }
          )
        )
        .addStringOption(opt =>
          opt.setName('commande').setDescription('Nom de la commande').setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Le rôle ciblé').setRequired(true)
        )
    )
    // 3. Dérogation Utilisateur
    .addSubcommand(sub =>
      sub
        .setName('user')
        .setDescription('Donner ou retirer l\'accès à un utilisateur spécifique pour une commande')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action').setRequired(true).addChoices(
            { name: '✅ Autoriser (Allow)', value: 'allow' },
            { name: '🚫 Bloquer (Deny)', value: 'deny' }
          )
        )
        .addStringOption(opt =>
          opt.setName('commande').setDescription('Nom de la commande').setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('membre').setDescription('L\'utilisateur ciblé').setRequired(true)
        )
    )
    // 4. Consulter les permissions
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Consulter les permissions configurées pour une ou toutes les commandes')
        .addStringOption(opt =>
          opt.setName('commande').setDescription('Nom de la commande spécifique (optionnel)').setRequired(false)
        )
    )
    // 5. Réinitialiser
    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Réinitialiser les dérogations personnalisées d\'une commande')
        .addStringOption(opt =>
          opt.setName('commande').setDescription('Nom de la commande').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const commandName = interaction.options.getString('commande')?.toLowerCase();

    // 1. Consultation
    if (subcommand === 'view') {
      const permData = await permissionsStore.read().catch(() => ({ commands: {} }));
      const commands = permData.commands || {};

      if (commandName) {
        const conf = commands[commandName];
        if (!conf) {
          return interaction.reply({
            content: `ℹ️ Aucun réglage particulier pour la commande \`/${commandName}\`.`,
            ephemeral: true
          });
        }

        const lvlInfo = PERMISSION_LEVELS[conf.level] || PERMISSION_LEVELS[0];
        const allowedRoles = conf.allowedRoles?.length ? conf.allowedRoles.map(id => `<@&${id}>`).join(', ') : '*Aucun*';
        const deniedRoles = conf.deniedRoles?.length ? conf.deniedRoles.map(id => `<@&${id}>`).join(', ') : '*Aucun*';
        const allowedUsers = conf.allowedUsers?.length ? conf.allowedUsers.map(id => `<@${id}>`).join(', ') : '*Aucun*';
        const deniedUsers = conf.deniedUsers?.length ? conf.deniedUsers.map(id => `<@${id}>`).join(', ') : '*Aucun*';

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🔒 Permissions : /${commandName}`)
          .addFields(
            { name: 'Niveau d\'accès de base', value: `${lvlInfo.emoji} **${lvlInfo.name}** (Niveau ${conf.level})`, inline: false },
            { name: '✅ Rôles autorisés explicitement', value: allowedRoles, inline: true },
            { name: '🚫 Rôles interdits explicitement', value: deniedRoles, inline: true },
            { name: '✅ Utilisateurs autorisés', value: allowedUsers, inline: true },
            { name: '🚫 Utilisateurs interdits', value: deniedUsers, inline: true }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Vue globale
      const entries = Object.entries(commands);
      if (entries.length === 0) {
        return interaction.reply({ content: 'ℹ️ Aucune commande configurée.', ephemeral: true });
      }

      const list = entries.map(([cmd, c]) => {
        const lvl = PERMISSION_LEVELS[c.level] || PERMISSION_LEVELS[0];
        const overridesCount = (c.allowedRoles?.length || 0) + (c.allowedUsers?.length || 0) + (c.deniedRoles?.length || 0) + (c.deniedUsers?.length || 0);
        return `• **\`/${cmd}\`** : ${lvl.emoji} ${lvl.name} ${overridesCount > 0 ? `*(${overridesCount} dérogation(s))*` : ''}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Tableau des Niveaux de Permissions des Commandes')
        .setDescription(list)
        .setFooter({ text: 'Utilisez /config-perm view <commande> pour le détail' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 2. Définir le niveau
    if (subcommand === 'set-level') {
      const level = interaction.options.getInteger('niveau');
      await PermissionService.setLevel(commandName, level);
      const lvlInfo = PERMISSION_LEVELS[level];

      return interaction.reply({
        content: `✅ Le niveau d'accès pour la commande **\`/${commandName}\`** a été défini sur : ${lvlInfo.emoji} **${lvlInfo.name}** (Niveau ${level}).`,
        ephemeral: true
      });
    }

    // 3. Dérogation Rôle
    if (subcommand === 'role') {
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');

      await PermissionService.setOverride(commandName, 'role', role.id, action);

      return interaction.reply({
        content: `✅ Le rôle ${role} est désormais **${action === 'allow' ? 'AUTORISÉ' : 'INTERDIT'}** pour la commande **\`/${commandName}\`**.`,
        ephemeral: true
      });
    }

    // 4. Dérogation Utilisateur
    if (subcommand === 'user') {
      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('membre');

      await PermissionService.setOverride(commandName, 'user', targetUser.id, action);

      return interaction.reply({
        content: `✅ L'utilisateur ${targetUser} est désormais **${action === 'allow' ? 'AUTORISÉ' : 'INTERDIT'}** pour la commande **\`/${commandName}\`**.`,
        ephemeral: true
      });
    }

    // 5. Réinitialisation
    if (subcommand === 'reset') {
      await PermissionService.resetOverrides(commandName);
      return interaction.reply({
        content: `✅ Les dérogations de rôles et d'utilisateurs pour **\`/${commandName}\`** ont été réinitialisées.`,
        ephemeral: true
      });
    }
  }
};
