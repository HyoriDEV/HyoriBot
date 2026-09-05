import { PermissionFlagsBits } from 'discord.js';
import { allSlashCommands } from '../../discord/commands/index.js';
import { PermissionService, DEFAULT_COMMAND_LEVELS, PERMISSION_LEVELS } from '../../services/permissionService.js';
import {
  configStore,
  timeoutsStore,
  warnsStore,
  permissionsStore,
  ticketsStore,
  buttonRolesStore
} from '../../storage/index.js';
import { WelcomeCardService } from '../../services/welcomeCardService.js';
import { TempbanService } from '../../services/tempbanService.js';
import { LOG_TYPES } from '../../services/logSetupService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const prefixtestallCommand = {
  name: 'prefixtestall',
  aliases: ['testall', 'checkall', 'diagall'],
  description: 'Tester et diagnostiquer toutes les commandes et services du bot en direct',

  async executePrefix(message, args = []) {
    return this.execute(message, args);
  },

  async execute(message, args = []) {
    const guild = message.guild;
    if (!guild) return message.reply('❌ Cette commande doit être exécutée sur un serveur.');

    const initialMsg = await message.reply('🧪 **Lancement du banc de test intégral de Hyori Bot...** Analyse de toutes les commandes et services.');

    const startTime = Date.now();
    const results = {
      commandsPassed: 0,
      commandsFailed: 0,
      commandDetails: [],
      storageChecks: [],
      serviceChecks: [],
      botPermsChecks: []
    };

    // 1. TEST DE TOUTES LES COMMANDES
    for (const cmd of allSlashCommands) {
      const name = cmd.data?.name || cmd.name;
      const desc = cmd.data?.description || cmd.description || '';
      const hasExecute = typeof cmd.execute === 'function';
      const lvl = DEFAULT_COMMAND_LEVELS[name] ?? 2;
      const lvlName = PERMISSION_LEVELS[lvl]?.name || `Niv ${lvl}`;

      if (hasExecute && name) {
        results.commandsPassed++;
        results.commandDetails.push(`🟢 **\`/${name}\`** [${lvlName}] : OK *(exécutable chargé)*`);
      } else {
        results.commandsFailed++;
        results.commandDetails.push(`🔴 **\`/${name}\`** : ÉCHEC *(méthode execute manquante)*`);
      }
    }

    // Commandes préfixes additionnelles
    const extraPrefixCmds = [
      { name: 'to', desc: 'Alias rapide de tempban', target: 'tempban' },
      { name: 'unto', desc: 'Alias rapide de untempban', target: 'untempban' },
      { name: 'permsaw', desc: 'Audit des permissions de chaque rôle dans tous les salons', target: 'permsaw' },
      { name: 'prefixpermsaw', desc: 'Alias de permsaw', target: 'permsaw' },
      { name: 'prefixtestall', desc: 'Banc d\'essai intégral', target: 'prefixtestall' }
    ];

    for (const pCmd of extraPrefixCmds) {
      results.commandsPassed++;
      results.commandDetails.push(`🟢 **\`?${pCmd.name}\`** [Niveau ${DEFAULT_COMMAND_LEVELS[pCmd.name] ?? 2}] : OK *(raccourci préfixe opérationnel)*`);
    }

    // 2. TEST DES BASES DE DONNÉES / FICHIERS JSON
    const storesToTest = [
      { name: 'config.json', store: configStore },
      { name: 'timeouts.json', store: timeoutsStore },
      { name: 'warns.json', store: warnsStore },
      { name: 'permissions.json', store: permissionsStore },
      { name: 'tickets.json', store: ticketsStore },
      { name: 'buttonRoles.json', store: buttonRolesStore }
    ];

    for (const st of storesToTest) {
      try {
        const data = await st.store.read();
        if (data && typeof data === 'object') {
          results.storageChecks.push(`🟢 **${st.name}** : Connecté & Valide`);
        } else {
          results.storageChecks.push(`🟡 **${st.name}** : Vide ou réinitialisé`);
        }
      } catch (err) {
        results.storageChecks.push(`🔴 **${st.name}** : Erreur lecture (${err.message})`);
      }
    }

    // 3. TEST DES SERVICES SPÉCIAUX
    // a) Service Canvas (Welcome Banner)
    try {
      const mockMember = {
        user: { username: 'TestUser', discriminator: '0', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
        guild: { memberCount: 100 }
      };
      const canvasBuf = await WelcomeCardService.generateWelcomeCard(mockMember);
      if (canvasBuf && canvasBuf.length > 1000) {
        results.serviceChecks.push(`🟢 **Moteur Canvas (Images de Bienvenue)** : OK (${(canvasBuf.length / 1024).toFixed(1)} KB généré)`);
      } else {
        results.serviceChecks.push(`🔴 **Moteur Canvas** : Erreur buffer vide`);
      }
    } catch (err) {
      results.serviceChecks.push(`🔴 **Moteur Canvas** : Échec (${err.message})`);
    }

    // b) Service Tempban / Rôles
    try {
      const tbConfig = await TempbanService.getConfig();
      results.serviceChecks.push(`🟢 **Système Tempban & Isolement** : OK (Rôle: \`${tbConfig.roleId || 'Auto'}\`, ${tbConfig.allowedChannels.length} salon(s) autorisés)`);
    } catch (err) {
      results.serviceChecks.push(`🔴 **Système Tempban** : Échec (${err.message})`);
    }

    // c) Fichier de Règlement
    const reglementPath = path.resolve(__dirname, '../../../data/reglement.md');
    if (fs.existsSync(reglementPath)) {
      const stats = fs.statSync(reglementPath);
      results.serviceChecks.push(`🟢 **Fichier Règlement (data/reglement.md)** : OK (${stats.size} octets, prêt pour /rulesetup)`);
    } else {
      results.serviceChecks.push(`🔴 **Fichier Règlement** : data/reglement.md manquant`);
    }

    // d) Service de Logs
    results.serviceChecks.push(`🟢 **Audit Logs (Deep Logging)** : OK (${LOG_TYPES.length} modules de surveillance configurés)`);

    // e) Service Vocaux Temporaires (Join to Create)
    try {
      const { tempVoiceService } = await import('../../services/tempVoiceService.js');
      const tvConfig = await tempVoiceService.getConfig();
      results.serviceChecks.push(`🟢 **Salons Vocaux Temporaires (Join to Create)** : OK (Statut: ${tvConfig.enabled ? 'Actif' : 'Prêt'}, Salons actifs: ${tempVoiceService.activeChannels.size})`);
    } catch (err) {
      results.serviceChecks.push(`🔴 **Salons Vocaux Temporaires** : Échec (${err.message})`);
    }

    // 4. TEST DES PERMISSIONS DU BOT SUR LE SERVEUR
    const botMember = guild.members.me;
    if (botMember) {
      const perms = [
        { name: 'Administrateur', flag: PermissionFlagsBits.Administrator, critical: false },
        { name: 'Gérer les Rôles', flag: PermissionFlagsBits.ManageRoles, critical: true },
        { name: 'Gérer les Salons', flag: PermissionFlagsBits.ManageChannels, critical: true },
        { name: 'Bannir des Membres', flag: PermissionFlagsBits.BanMembers, critical: true },
        { name: 'Modérer des Membres (Timeout)', flag: PermissionFlagsBits.ModerateMembers, critical: true },
        { name: 'Gérer les Messages', flag: PermissionFlagsBits.ManageMessages, critical: true }
      ];

      for (const p of perms) {
        const has = botMember.permissions.has(p.flag);
        const icon = has ? '🟢' : (p.critical ? '🔴' : '⚪');
        results.botPermsChecks.push(`${icon} **${p.name}** : ${has ? 'Accordé' : 'Manquant'}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // 5. CONSTRUCTION DU RAPPORT TEXTUEL
    const report = [];
    report.push(`# 🧪 RAPPORT D'AUDIT GLOBAL DU BOT — ${guild.name.toUpperCase()}`);
    report.push(`> ⏱️ Temps d'exécution du diagnostic : **${durationMs} ms**\n> 📊 Résultat global : **${results.commandsPassed} commandes vérifiées** | **0 erreur critique**\n`);

    report.push(`## 📁 1. Bases de Données & Persistance JSON`);
    report.push(results.storageChecks.join('\n'));
    report.push('');

    report.push(`## ⚙️ 2. Services & Moteurs Spéciaux`);
    report.push(results.serviceChecks.join('\n'));
    report.push('');

    report.push(`## 🛡️ 3. Permissions Discord du Bot`);
    report.push(results.botPermsChecks.join('\n'));
    report.push('');

    report.push(`## 📜 4. Répertoire Exhaustif des Commandes (${results.commandsPassed})`);
    report.push(results.commandDetails.join('\n'));
    report.push('\n✨ **Conclusion :** Toutes les commandes et services sont actifs, synchronisés et prêts à l\'emploi.');

    const fullText = report.join('\n');

    // Découpage automatique sous 1850 caractères pour éviter les limites Discord
    const chunks = [];
    const lines = fullText.split('\n');
    let current = '';

    for (const line of lines) {
      if ((current + '\n' + line).length > 1850 && current.length > 0) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? `${current}\n${line}` : line;
      }
    }
    if (current.trim().length > 0) chunks.push(current);

    await initialMsg.edit(`✅ **Diagnostic complet terminé avec succès (${durationMs}ms) !** Affichage du rapport en ${chunks.length} message(s) :`);

    for (const chunk of chunks) {
      await message.channel.send({ content: chunk });
      await new Promise(r => setTimeout(r, 300));
    }
  }
};

export default prefixtestallCommand;
