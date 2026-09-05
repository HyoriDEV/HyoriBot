import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { PermissionService, PERMISSION_LEVELS } from '../../services/permissionService.js';
import { getEnv } from '../../config/env.js';

export const COMMAND_CATEGORIES = {
  '🛡️ Modération & Sanctions': [
    'warn', 'warnlist', 'clearwarns', 'timeout', 'untimeout',
    'tempban', 'to', 'untempban', 'unto',
    'mute', 'unmute', 'kick', 'ban', 'unban'
  ],
  '💬 Salons & Chat': [
    'clear', 'purge', 'lock', 'unlock', 'slowmode'
  ],
  '⚙️ Système de Permissions': [
    'setperm', 'sp', 'spr', 'spl', 'setperm-cmds'
  ],
  '📁 Déploiement & Configuration': [
    'setup-logs', 'config-logs', 'config-welcome', 'configtempban', 'setup-vocal'
  ],
  'ℹ️ Utilitaires & Informations': [
    'cmds', 'help', 'ping', 'userinfo', 'serverinfo'
  ]
};

export async function buildCmdsEmbed(member) {
  const { allSlashCommands } = await import('../../discord/commands/index.js');
  const env = getEnv();
  const prefix = env.PREFIX || '!';

  const embed = new EmbedBuilder()
    .setColor(0xe9d15c) // Hyori Brand Guidelines (Or chaud)
    .setTitle('📜 Répertoire des Commandes — Hyori RP')
    .setDescription(
      `Toutes les commandes fonctionnent en **Slash command (\`/\`)** ou via le préfixe textuel **\`${prefix}\`**.\n\n` +
      `**Légende de vos accès :**\n` +
      `🟢 = Vous avez la permission d'exécuter cette commande\n` +
      `🔒 = Verrouillé (permissions insuffisantes pour votre rôle/niveau)\n`
    )
    .setFooter({
      text: `Hyori RP • Préfixe textuel : ${prefix} • Tapez ${prefix}help ou /help pour plus de détails`
    })
    .setTimestamp();

  for (const [categoryTitle, cmdNames] of Object.entries(COMMAND_CATEGORIES)) {
    const lines = [];

    for (const name of cmdNames) {
      const cmdObj = allSlashCommands.find(c => c.data.name === name);
      if (!cmdObj) continue;

      const check = await PermissionService.canExecute(member, name);
      const icon = check.allowed ? '🟢' : '🔒';
      const desc = cmdObj.data.description || '';
      lines.push(`${icon} **\`/${name}\`** *(ou \`${prefix}${name}\`)* : ${desc}`);
    }

    if (lines.length > 0) {
      embed.addFields({
        name: categoryTitle,
        value: lines.join('\n'),
        inline: false
      });
    }
  }

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('cmds')
    .setDescription('Afficher la liste de toutes les commandes disponibles et vos permissions d\'accès')
    .addStringOption(opt =>
      opt
        .setName('commande')
        .setDescription('Nom d\'une commande spécifique pour voir ses détails')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { allSlashCommands } = await import('../../discord/commands/index.js');
    const specificCmdName = interaction.options.getString('commande')?.toLowerCase();

    if (specificCmdName) {
      const cmd = allSlashCommands.find(c => c.data.name === specificCmdName);
      if (!cmd) {
        return interaction.reply({
          content: `❌ La commande \`/${specificCmdName}\` n'existe pas.`,
          ephemeral: true
        });
      }

      const canUserRun = await PermissionService.canExecute(interaction.member, specificCmdName);
      const allPerms = await PermissionService.getAllPermissions();
      const requiredLevel = allPerms.commands[specificCmdName] ?? 0;
      const lvlInfo = PERMISSION_LEVELS[requiredLevel] || PERMISSION_LEVELS[0];

      const embed = new EmbedBuilder()
        .setColor(canUserRun.allowed ? 0xe9d15c : 0xED4245)
        .setTitle(`📖 Détails de la commande : /${cmd.data.name}`)
        .setDescription(cmd.data.description || 'Aucune description fournie')
        .addFields(
          { name: 'Niveau requis', value: `${lvlInfo.emoji} ${lvlInfo.name} (Niveau ${requiredLevel})`, inline: true },
          { name: 'Votre statut', value: canUserRun.allowed ? '🟢 **Autorisé**' : `🔒 **Verrouillé** (${canUserRun.reason || 'Niveau insuffisant'})`, inline: true }
        )
        .setFooter({ text: 'Hyori RP • Système de Permissions' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = await buildCmdsEmbed(interaction.member);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
