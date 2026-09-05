import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { allSlashCommands } from '../src/discord/commands/index.js';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID || '1054172720847388753';

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN manquant dans le fichier .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
const validCommandNames = new Set(allSlashCommands.map(c => c.data.name));
const commandsData = allSlashCommands.map(c => c.data.toJSON());

async function cleanAllCommands() {
  console.log('🧹 ──────────────────────────────────────────────────────────');
  console.log('🧹 NETTOYAGE EXHAUSTIF DES COMMANDES DISCORD (LOCAL & GLOBAL)');
  console.log('🧹 ──────────────────────────────────────────────────────────\n');

  // 1. Purge complète des commandes globales
  try {
    console.log('1️⃣ Inspection des commandes GLOBALES...');
    const globalCmds = await rest.get(Routes.applicationCommands(clientId));
    console.log(`   ➔ ${globalCmds.length} commande(s) globale(s) trouvée(s) :`, globalCmds.map(c => c.name));
    
    if (globalCmds.length > 0) {
      console.log('   🗑️ Suppression de toutes les commandes globales...');
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log('   ✅ Commandes globales réinitialisées à zéro !');
    } else {
      console.log('   ✅ Aucune commande globale résiduelle.');
    }
  } catch (err) {
    console.warn(`   ⚠️ Erreur purge globale : ${err.message}`);
  }

  // 2. Détection de tous les serveurs où se trouve le bot
  let guilds = [];
  try {
    console.log('\n2️⃣ Détection des serveurs Discord où le bot est installé...');
    guilds = await rest.get(Routes.userGuilds());
    console.log(`   ➔ ${guilds.length} serveur(s) détecté(s) :`);
    guilds.forEach(g => console.log(`      • ${g.name} (ID: ${g.id})`));
  } catch (err) {
    console.warn(`   ⚠️ Impossible de récupérer la liste des serveurs : ${err.message}`);
  }

  // 3. Nettoyage et synchronisation pour CHAQUE serveur
  console.log('\n3️⃣ Nettoyage et synchronisation serveur par serveur...');
  for (const guild of guilds) {
    console.log(`\n   📌 Serveur : ${guild.name} (${guild.id})`);
    try {
      // Récupération des commandes existantes
      const existingCmds = await rest.get(Routes.applicationGuildCommands(clientId, guild.id));
      const oldCmds = existingCmds.filter(c => !validCommandNames.has(c.name));

      if (oldCmds.length > 0) {
        console.log(`      ⚠️ ${oldCmds.length} ancienne(s) commande(s) obsolète(s) détectée(s) :`, oldCmds.map(c => c.name));
      }

      // Remplacement direct par les commandes propres
      const updated = await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
        body: commandsData,
      });

      console.log(`      ✅ ${updated.length} commandes officielles enregistrées avec succès sur "${guild.name}" !`);
    } catch (err) {
      console.warn(`      ❌ Erreur sur ${guild.name} : ${err.message}`);
    }
  }

  console.log('\n✨ ──────────────────────────────────────────────────────────');
  console.log('✨ NETTOYAGE TERMINÉ AVEC SUCCÈS !');
  console.log('✨ Astuce Discord : Appuyez sur Ctrl + R sur Discord pour vider le cache local.');
  console.log('✨ ──────────────────────────────────────────────────────────');
  process.exit(0);
}

cleanAllCommands();
