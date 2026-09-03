import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
async function inspectGuild() {
  console.log('Connexion au serveur Discord pour inspection...');
  await client.login(process.env.DISCORD_BOT_TOKEN);
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  console.log(`\n============================================================`);
  console.log(`🏰 Serveur : ${guild.name} (ID: ${guild.id})`);
  console.log(`👥 Membres totaux : ${guild.memberCount}`);
  console.log(`============================================================\n`);
  const roles = await guild.roles.fetch();
  console.log(`📜 Liste des rôles détectés sur le serveur (${roles.size}) :`);
  console.log(`------------------------------------------------------------`);
  const roleList = [];
  roles.forEach(role => {
    if (role.name !== '@everyone') {
      console.log(`• Nom : "${role.name}" | ID : ${role.id} | Couleur : ${role.hexColor}`);
      roleList.push({
        name: role.name,
        id: role.id,
      });
    }
  });
  console.log(`\n------------------------------------------------------------`);
  console.log(`👤 Liste des membres récents :`);
  const members = await guild.members.fetch({
    limit: 10,
  });
  members.forEach(m => {
    console.log(`• Pseudo : ${m.user.tag} (Nom affiché : ${m.displayName}) | ID : ${m.id}`);
  });
  await client.destroy();
  process.exit(0);
}
inspectGuild().catch(err => {
  console.error("Erreur lors de l'inspection :", err);
  process.exit(1);
});
