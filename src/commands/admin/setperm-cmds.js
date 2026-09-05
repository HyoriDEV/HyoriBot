import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { PermissionService, PERMISSION_LEVELS, DEFAULT_COMMAND_LEVELS } from '../../services/permissionService.js';

// Liste des commandes configurables avec leurs descriptions
const CONFIGURABLE_COMMANDS = [
  { name: 'clear', label: '/clear (alias /purge)', desc: 'Suppression en masse de messages' },
  { name: 'warn', label: '/warn', desc: 'Avertir un membre' },
  { name: 'warnlist', label: '/warnlist', desc: 'Voir les avertissements d\'un membre' },
  { name: 'clearwarns', label: '/clearwarns', desc: 'Effacer les avertissements d\'un membre' },
  { name: 'timeout', label: '/timeout', desc: 'Mettre un membre en timeout' },
  { name: 'untimeout', label: '/untimeout', desc: 'Retirer le timeout d\'un membre' },
  { name: 'tempban', label: '/tempban', desc: 'Bannir temporairement avec isolement de salons' },
  { name: 'untempban', label: '/untempban', desc: 'Lever le tempban / isolement d\'un membre' },
  { name: 'mute', label: '/mute', desc: 'Appliquer le rôle d\'isolement / mute' },
  { name: 'unmute', label: '/unmute', desc: 'Retirer le rôle d\'isolement / mute' },
  { name: 'kick', label: '/kick', desc: 'Expulser un membre du serveur' },
  { name: 'ban', label: '/ban', desc: 'Bannir définitivement un membre' },
  { name: 'unban', label: '/unban', desc: 'Débannir un membre via son ID' },
  { name: 'lock', label: '/lock', desc: 'Verrouiller un salon textuel' },
  { name: 'unlock', label: '/unlock', desc: 'Déverrouiller un salon textuel' },
  { name: 'slowmode', label: '/slowmode', desc: 'Activer le mode ralenti sur un salon' },
  { name: 'setperm', label: '/setperm', desc: 'Assigner des permissions aux rôles/membres' },
  { name: 'config-logs', label: '/config-logs', desc: 'Configurer les salons de logs' },
  { name: 'configtempban', label: '/configtempban', desc: 'Configurer rôle et salons autorisés du tempban' },
  { name: 'config-welcome', label: '/config-welcome', desc: 'Configurer le système d\'image de bienvenue' },
  { name: 'rulesetup', label: '/rulesetup', desc: 'Déployer le règlement multi-messages' },
  { name: 'cmds', label: '/cmds', desc: 'Liste des commandes pour les joueurs' },
  { name: 'help', label: '/help', desc: 'Aide générale' },
  { name: 'ping', label: '/ping', desc: 'Vérifier la latence du bot' },
  { name: 'userinfo', label: '/userinfo', desc: 'Informations sur un utilisateur' },
  { name: 'serverinfo', label: '/serverinfo', desc: 'Statistiques du serveur' }
];

function buildOverviewEmbed(commandsConfig, selectedCmd = null) {
  const levels = {
    3: [],
    2: [],
    1: [],
    0: []
  };

  for (const cmd of CONFIGURABLE_COMMANDS) {
    const lvl = typeof commandsConfig[cmd.name] === 'number' ? commandsConfig[cmd.name] : (DEFAULT_COMMAND_LEVELS[cmd.name] ?? 2);
    if (levels[lvl]) {
      levels[lvl].push(`\`/${cmd.name}\``);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xe9d15c)
    .setTitle('⚙️ Configuration des Permissions des Commandes')
    .setDescription(
      'Ce panneau vous permet d\'assigner directement le niveau requis pour chaque commande sans jamais réécrire de commande.\n\n' +
      '👉 **1.** Choisissez une commande dans le menu déroulant ci-dessous.\n' +
      '👉 **2.** Cliquez sur le niveau souhaité pour la mettre à jour instantanément !\n\n' +
      (selectedCmd ? `📌 **Commande sélectionnée actuellement : \`/${selectedCmd}\`**` : '*Sélectionnez une commande pour modifier son niveau.*')
    )
    .addFields(
      {
        name: '👑 Niveau 3 — Administrateur',
        value: levels[3].length > 0 ? levels[3].join(', ') : '*Aucune commande*',
        inline: false
      },
      {
        name: '🛡️ Niveau 2 — Modérateur / Staff',
        value: levels[2].length > 0 ? levels[2].join(', ') : '*Aucune commande*',
        inline: false
      },
      {
        name: '👤 Niveau 1 — Membre',
        value: levels[1].length > 0 ? levels[1].join(', ') : '*Aucune commande*',
        inline: false
      },
      {
        name: '👥 Niveau 0 — Tout le monde (Public)',
        value: levels[0].length > 0 ? levels[0].join(', ') : '*Aucune commande*',
        inline: false
      }
    )
    .setFooter({ text: 'Menu interactif actif pendant 15 minutes • Hyori RP' })
    .setTimestamp();

  return embed;
}

function buildComponents(commandsConfig, selectedCmd = null) {
  // 1. Menu déroulant pour choisir la commande
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_perm_command')
    .setPlaceholder(selectedCmd ? `Modifier : /${selectedCmd}` : 'Sélectionnez une commande à modifier...')
    .addOptions(
      CONFIGURABLE_COMMANDS.map(c => {
        const lvl = typeof commandsConfig[c.name] === 'number' ? commandsConfig[c.name] : (DEFAULT_COMMAND_LEVELS[c.name] ?? 2);
        const lvlInfo = PERMISSION_LEVELS[lvl] || { emoji: '❓', name: `Niv. ${lvl}` };
        return {
          label: c.label,
          description: `${lvlInfo.emoji} ${lvlInfo.name} — ${c.desc}`.slice(0, 100),
          value: c.name,
          default: c.name === selectedCmd
        };
      })
    );

  const rows = [new ActionRowBuilder().addComponents(selectMenu)];

  // 2. Boutons de niveau si une commande est sélectionnée
  if (selectedCmd) {
    const currentLvl = typeof commandsConfig[selectedCmd] === 'number'
      ? commandsConfig[selectedCmd]
      : (DEFAULT_COMMAND_LEVELS[selectedCmd] ?? 2);

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setlvl_${selectedCmd}_0`)
        .setLabel('Niveau 0 (Public)')
        .setEmoji('👥')
        .setStyle(currentLvl === 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`setlvl_${selectedCmd}_1`)
        .setLabel('Niveau 1 (Membre)')
        .setEmoji('👤')
        .setStyle(currentLvl === 1 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`setlvl_${selectedCmd}_2`)
        .setLabel('Niveau 2 (Modo/Staff)')
        .setEmoji('🛡️')
        .setStyle(currentLvl === 2 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`setlvl_${selectedCmd}_3`)
        .setLabel('Niveau 3 (Admin)')
        .setEmoji('👑')
        .setStyle(currentLvl === 3 ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    rows.push(buttonRow);
  }

  return rows;
}

export default {
  data: new SlashCommandBuilder()
    .setName('setperm-cmds')
    .setDescription('Menu interactif pour modifier le niveau de permission requis par chaque commande')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    let all = await PermissionService.getAllPermissions();
    let commandsConfig = all.commands || {};
    let selectedCmd = null;

    const initialEmbed = buildOverviewEmbed(commandsConfig, selectedCmd);
    const initialComponents = buildComponents(commandsConfig, selectedCmd);

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: initialComponents,
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 15 * 60 * 1000 // 15 minutes
    });

    collector.on('collect', async i => {
      // Cas 1 : L'utilisateur a sélectionné une commande dans le menu déroulant
      if (i.isStringSelectMenu() && i.customId === 'select_perm_command') {
        selectedCmd = i.values[0];
        const newEmbed = buildOverviewEmbed(commandsConfig, selectedCmd);
        const newComponents = buildComponents(commandsConfig, selectedCmd);

        await i.update({
          embeds: [newEmbed],
          components: newComponents
        });
        return;
      }

      // Cas 2 : L'utilisateur a cliqué sur un bouton de niveau (setlvl_<cmd>_<lvl>)
      if (i.isButton() && i.customId.startsWith('setlvl_')) {
        const parts = i.customId.split('_');
        const cmdName = parts[1];
        const newLvl = parseInt(parts[2], 10);

        // Sauvegarder en persistance
        await PermissionService.setCommandLevel(cmdName, newLvl);

        // Recharger les permissions
        all = await PermissionService.getAllPermissions();
        commandsConfig = all.commands || {};
        selectedCmd = cmdName;

        const newEmbed = buildOverviewEmbed(commandsConfig, selectedCmd);
        const newComponents = buildComponents(commandsConfig, selectedCmd);

        await i.update({
          embeds: [newEmbed],
          components: newComponents
        });
      }
    });

    collector.on('end', async () => {
      try {
        const disabledRows = buildComponents(commandsConfig, selectedCmd).map(row => {
          row.components.forEach(c => c.setDisabled(true));
          return row;
        });
        await interaction.editReply({ components: disabledRows }).catch(() => {});
      } catch {
        // Ignorer si message supprimé
      }
    });
  }
};
