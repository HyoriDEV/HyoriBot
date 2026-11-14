import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { discordConfig } from '../src/config/discordConfig.js';
import { GuildRegistry } from '../src/discord/services/guildRegistry.js';

// Charge le .env local ou parent
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function syncNonWhitelistedRoles() {
  console.log('🤖 Connexion au bot Discord pour harmonisation des rôles Non-inscrit...');
  await client.login(process.env.DISCORD_BOT_TOKEN);

  const communityGuildId = GuildRegistry.getCommunityGuildId();
  const guild = await client.guilds.fetch(communityGuildId);

  console.log(`🏰 Serveur : ${guild.name} (${guild.id})`);

  const whitelistRoleId = discordConfig.roles.whitelist;
  const noWhitelistRoleId = discordConfig.roles.noWhitelist;
  const sanctionedRoleId = discordConfig.roles.sanctioned;

  console.log(`📜 Rôle Whitelist   : ${whitelistRoleId}`);
  console.log(`📜 Rôle Non-inscrit : ${noWhitelistRoleId}`);

  const whitelistRole = guild.roles.cache.get(whitelistRoleId);
  const noWhitelistRole = guild.roles.cache.get(noWhitelistRoleId);

  if (!whitelistRole) {
    console.error(`❌ Erreur critique : Le rôle Whitelist (${whitelistRoleId}) est introuvable sur le serveur.`);
    process.exit(1);
  }

  if (!noWhitelistRole) {
    console.error(`❌ Erreur critique : Le rôle Non-inscrit (${noWhitelistRoleId}) est introuvable sur le serveur.`);
    process.exit(1);
  }

  console.log('📥 Récupération de tous les membres du serveur...');
  const members = await guild.members.fetch();
  const humanMembers = members.filter(m => !m.user.bot);

  console.log(`👥 Membres humains détectés : ${humanMembers.size}`);
  console.log('⏳ Début du traitement...\n');

  let addedCount = 0;
  let removedCount = 0;
  let alreadyCompliantCount = 0;
  let skippedSanctionedCount = 0;
  const errors = [];

  for (const member of humanMembers.values()) {
    // Si sanctionné (isolé), ignorer
    if (sanctionedRoleId && member.roles.cache.has(sanctionedRoleId)) {
      skippedSanctionedCount++;
      continue;
    }

    const hasWhitelist = member.roles.cache.has(whitelistRoleId);
    const hasNoWhitelist = member.roles.cache.has(noWhitelistRoleId);

    // Cas 1 : A le rôle Whitelist et le rôle Non-inscrit -> retirer Non-inscrit
    if (hasWhitelist && hasNoWhitelist) {
      try {
        await member.roles.remove(
          noWhitelistRoleId,
          'Harmonisation initiale : membre whitelisté (retrait du rôle Non-inscrit)'
        );
        removedCount++;
        console.log(`  🔴 [- Non-inscrit] Retiré pour ${member.user.tag} (ID: ${member.id}) [Whitelisté]`);
        await sleep(100);
      } catch (err) {
        errors.push({ member: member.user.tag, id: member.id, action: 'remove', error: err.message });
        console.warn(`  ⚠️ Échec retrait Non-inscrit pour ${member.user.tag}: ${err.message}`);
      }
      continue;
    }

    // Cas 2 : N'a pas le rôle Whitelist et n'a pas Non-inscrit -> ajouter Non-inscrit
    if (!hasWhitelist && !hasNoWhitelist) {
      try {
        await member.roles.add(
          noWhitelistRoleId,
          'Harmonisation initiale : membre non whitelisté (attribution du rôle Non-inscrit)'
        );
        addedCount++;
        console.log(`  🟢 [+ Non-inscrit] Attribué pour ${member.user.tag} (ID: ${member.id})`);
        await sleep(100);
      } catch (err) {
        errors.push({ member: member.user.tag, id: member.id, action: 'add', error: err.message });
        console.warn(`  ⚠️ Échec ajout Non-inscrit pour ${member.user.tag}: ${err.message}`);
      }
      continue;
    }

    // Cas 3 : Déjà conforme (soit Whitelist sans Non-inscrit, soit Non-inscrit sans Whitelist)
    alreadyCompliantCount++;
  }

  console.log('\n============================================================');
  console.log('📊 RAPPORT DE SYNCHRONISATION DES RÔLES NON-INSCRITS');
  console.log('============================================================');
  console.log(`Total membres humains analysés : ${humanMembers.size}`);
  console.log(`🟢 Rôles "Non-inscrit" attribués : ${addedCount}`);
  console.log(`🔴 Rôles "Non-inscrit" retirés   : ${removedCount}`);
  console.log(`✅ Membres déjà conformes        : ${alreadyCompliantCount}`);
  if (skippedSanctionedCount > 0) {
    console.log(`⚖️ Membres sous sanction ignorés : ${skippedSanctionedCount}`);
  }
  if (errors.length > 0) {
    console.log(`⚠️ Erreurs rencontrées           : ${errors.length}`);
  }
  console.log('============================================================\n');

  await client.destroy();
  process.exit(0);
}

syncNonWhitelistedRoles().catch(err => {
  console.error('Erreur fatale lors de la synchronisation :', err);
  process.exit(1);
});
