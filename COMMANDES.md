# 📖 Guide & Répertoire des Commandes — Hyori Discord Bot

Ce document répertorie **l'ensemble des commandes slash (`/`)** disponibles sur le bot Discord de Hyori RP, classées par catégorie avec leur utilité, leurs paramètres et les permissions requises.

---

## Sommaire
1. [🛡️ Modération & Sanctions](#1-️-modération--sanctions)
2. [💬 Gestion des Salons & Chat](#2--gestion-des-salons--chat)
3. [⚙️ Système de Permissions Dynamique](#3-️-système-de-permissions-dynamique)
4. [📁 Déploiement & Configuration des Logs](#4-️-déploiement--configuration-des-logs)
5. [⚙️ Configuration Générale du Serveur](#5-️-configuration-générale-du-serveur)
6. [ℹ️ Utilitaires & Informations](#6-️-utilitaires--informations)

---

## 1. 🛡️ Modération & Sanctions

| Commande | Syntaxe | Description |
| :--- | :--- | :--- |
| **`/warn`** | `/warn membre:<@membre> raison:<texte>` | Attribue un avertissement officiel à un membre, l'enregistre en base de données et l'envoie dans les logs de modération. |
| **`/warnlist`** | `/warnlist membre:<@membre>` | Affiche la liste complète et l'historique des avertissements reçus par un joueur (avec dates, motifs et modérateurs). |
| **`/clearwarns`** | `/clearwarns membre:<@membre>` | Réinitialise et supprime tous les avertissements enregistrés pour un joueur. |
| **`/timeout`** | `/timeout membre:<@membre> duree:<10m/1h/24h> [raison:<texte>]` | Isole / réduit au silence un membre pour une durée donnée avec gestionnaire persistant de fin de sanction (`timeouts.json`). |
| **`/untimeout`** | `/untimeout membre:<@membre> [raison:<texte>]` | Lève immédiatement le timeout d'un membre avant son expiration naturelle. |
| **`/tempban`** *(alias `/to`)* | `/tempban membre:<@membre> duree:<12h/1d/7d> [raison:<texte>]`<br>`?to <@membre> <durée> [raison]` | Bannit temporairement un membre : lui retire tous ses rôles (sauvegardés), applique le rôle d'isolement, **envoie un MP anonyme au joueur** lui expliquant la sanction (sans révéler le staff), et **supprime le message de confirmation après 2s**. |
| **`/untempban`** *(alias `/unto`)* | `/untempban membre:<@membre> [raison:<texte>]`<br>`?unto <@membre> [raison]` | Lève immédiatement le tempban d'un membre, lui restitue automatiquement tous ses rôles d'origine, et **supprime le message après 2s**. |
| **`/mute`** | `/mute membre:<@membre> duree:<10m/1h/1d> [raison:<texte>]` | Applique le rôle d'isolement (Mute) empêchant le joueur de parler à l'écrit et en vocal. |
| **`/unmute`** | `/unmute membre:<@membre> [raison:<texte>]` | Retire la sanction de mute et restitue les permissions du membre. |
| **`/kick`** | `/kick membre:<@membre> [raison:<texte>]` | Expulse un membre du serveur Discord (le membre peut revenir s'il possède une invitation valide). |
| **`/ban`** | `/ban membre:<@membre> [suppr_messages:<0-7j>] [raison:<texte>]` | Bannit définitivement un utilisateur du serveur avec option de purge de ses messages récents. |
| **`/unban`** | `/unban user_id:<ID_Discord> [raison:<texte>]` | Révoque le bannissement d'un utilisateur à partir de son identifiant numérique Discord. |

---

## 2. 💬 Gestion des Salons & Chat

| Commande | Syntaxe | Description |
| :--- | :--- | :--- |
| **`/clear`** *(ou `/purge`)* | `/clear [nombre:<1-100>] [utilisateur:<@membre>]`<br>`/purge [nombre:<1-100>] [utilisateur:<@membre>]` | **`/clear` et `/purge` sont la même commande (alias direct)** : supprime en masse des messages récents dans le salon, avec option de cibler un utilisateur précis. |
| **`/lock`** | `/lock [raison:<texte>]` | Verrouille le salon actuel : empêche les joueurs d'y envoyer des messages (utile en cas de débordement). |
| **`/unlock`** | `/unlock` | Déverrouille le salon actuel et réautorise les joueurs à y écrire. |
| **`/slowmode`** | `/slowmode secondes:<0-21600>` | Définit le délai d'attente (ralenti) entre chaque message dans le salon (mettre `0` pour désactiver). |

---

## 3. ⚙️ Système de Permissions Dynamique

Le bot utilise un système hiérarchique à 4 niveaux :
* **Niveau 0 (Public)** : Accessible par tout le monde.
* **Niveau 1 (Membre)** : Réservé aux membres autorisés.
* **Niveau 2 (Modérateur / Staff)** : Réservé à la modération.
* **Niveau 3 (Administrateur)** : Réservé à l'administration.

### 🔹 Assigner un niveau à un Rôle ou Membre en 1 commande : `/setperm` *(alias `/sp`)*
La commande accepte directement le niveau ainsi que la cible (**rôle** ou **membre**) :

* **`/setperm niveau:2 role:@Modérateur`** *(ou `/sp niveau:2 role:@Modérateur`)*  
  *(Accorde le Niveau 2 à tous les membres possédant ce rôle)*
* **`/setperm niveau:3 membre:@Zack`** *(ou `/sp niveau:3 membre:@Zack`)*  
  *(Accorde le Niveau 3 directement à ce membre)*

### 🔹 Réinitialiser les permissions rapidement : `/spr`
* **`/spr role:@Modérateur`** : Retire la permission spécifique du rôle.
* **`/spr membre:@Zack`** : Retire la permission spécifique du membre.
* **`/spr tout:Vrai`** : Réinitialise toutes les permissions personnalisées en une fois.

### 🔹 Afficher la liste complète des permissions : `/spl`
* **`/spl`** : Affiche instantanément l'embed récapitulatif de tous les rôles et membres configurés avec leurs niveaux respectifs.

### 🔹 Assigner les commandes aux niveaux en direct : `/setperm-cmds`
Affiche un **panneau interactif complet** récapitulant toutes les commandes et leur niveau requis.

* **Comment ça marche ?**
  1. Vous tapez `/setperm-cmds`.
  2. Un menu déroulant s'affiche avec la liste de toutes les commandes.
  3. Sélectionnez une commande (ex: `/clear`).
  4. Cliquez directement sur le bouton du niveau souhaité :  
     `[ 👥 Niveau 0 ]  [ 👤 Niveau 1 ]  [ 🛡️ Niveau 2 ]  [ 👑 Niveau 3 ]`
  5. **L'affichage et la base de données se mettent à jour instantanément** sans avoir besoin de retaper de commande.

### 🔹 Auditer les permissions de chaque rôle dans tous les salons : `?prefixpermsaw` *(ou `?permsaw`)*
Commande préfixe exclusive réservée aux administrateurs pour scanner et analyser en direct les permissions de chaque rôle à travers l'ensemble des salons du serveur :
* **`?prefixpermsaw`** *(ou `?permsaw`)* : Scanne tous les rôles (hors bots) et affiche pour chacun les salons où il a l'accès complet (🟢 Voir + Écrire/Parler), la lecture seule (👁️) ou l'accès interdit/masqué (🔴).
* **`?permsaw @Rôle`** : Filtre et audite les accès d'un rôle précis dans tous les salons.

---

## 4. 📁 Déploiement & Configuration des Logs

Le bot intègre un **générateur automatique de salons de logs** d'audit exhaustifs.

### 🔹 Assistant de Déploiement Interactif : `/setup-logs` *(ou `/config-logs setup`)*
Ouvre un panneau interactif complet avec boutons et menu à cocher pour créer et configurer tous les salons de logs d'un coup :

* **Ce qui est surveillé :**
  1. 🗑️ **Messages Supprimés** (`logs-messages-suppr`) : Auteur, contenu textuel, pièces jointes, salon.
  2. ✏️ **Messages Modifiés** (`logs-messages-modif`) : Contenu avant / après, lien direct vers le message.
  3. 🧹 **Purges Massives** (`logs-purges`) : Purges et suppressions de masse (`/clear`, `/purge`).
  4. 📥 **Arrivées & Départs** (`logs-arrivées-départs`) : Entrées et sorties de membres avec date de création du compte.
  5. 👤 **Profils & Surnoms** (`logs-profils-membres`) : Changements de pseudo, surnom serveur, avatar et timeouts.
  6. 🛡️ **Rôles des Membres** (`logs-roles-membres`) : Rôles ajoutés ou retirés aux membres avec modérateur responsable.
  7. ⚖️ **Modération & Sanctions** (`logs-moderation`) : Warns, Timeouts, Mutes, Kicks, Bans et Débans.
  8. 📁 **Salons Serveur** (`logs-salons`) : Création, modification et suppression de salons et fils (threads).
  9. 🏷️ **Rôles Serveur** (`logs-roles-serveur`) : Création, renommage, changement de couleur et suppression de rôles.
  10. 🔊 **Activité Vocale** (`logs-vocal`) : Connexions, déconnexions, déplacements et mutes micro/casque.
  11. ⚙️ **Paramètres & Emojis** (`logs-serveur`) : Modifications du nom de serveur, icône, bannière, emojis et stickers.
  12. ✉️ **Invitations** (`logs-invitations`) : Liens d'invitations créés ou supprimés avec créateur et expiration.

* **Boutons disponibles dans le panneau :**
  * `[ 🚀 Créer TOUS les Salons (12) ]` : Crée instantanément la catégorie verrouillée `📁 ─── LOGS SERVEUR ───` (invisible pour `@everyone`, réservée au Staff) et génère tous les 12 salons de surveillance.
  * `[ ✅ Créer Salons Sélectionnés ]` : Crée uniquement les salons cochés dans le menu déroulant.
  * `[ 🔄 Actualiser la Vue ]` : Vérifie l'état actuel de chaque salon.
  * `[ 🗑️ Tout Nettoyer / Supprimer ]` : Supprime les salons de logs et leur catégorie si nécessaire.

### 🔹 Configuration Manuelle : `/config-logs`
* `/config-logs view` : Affiche l'état actuel de tous les salons de logs.
* `/config-logs set categorie:<Type> salon:<#salon>` : Associe manuellement un salon précis à une catégorie de logs.

---

## 5. ⚙️ Configuration Générale du Serveur

| Commande | Syntaxe | Description |
| :--- | :--- | :--- |
| **`/config-welcome`** | `/config-welcome channel salon:<#salon>`<br>`/config-welcome test`<br>`/config-welcome autorole [role:<@Role>]`<br>`/config-welcome toggle actif:<Vrai\|Faux>`<br>`/config-welcome view` | Configure le système de bienvenue avec génération d'image dynamique (DA Hyori), incrustation de l'avatar et auto-role. |
| **`/configtempban`** | `/configtempban` *(ou `?configtempban`)* | Panneau interactif complet : sélection directe du **rôle Tempban/Isolement** et des **salons autorisés** avec bouton d'application instantanée des permissions sur tout le serveur. |
| **`/rulesetup`** | `/rulesetup [salon:<#salon>]`<br>`?rulesetup [#salon]` | Lit le fichier de règlement du bot (`data/reglement.md`) et le publie sous forme de **messages texte purs (aucun embed)** découpés chronologiquement (< 2 000 caractères). |
| **`/setup-vocal`** *(ou `?setup-vocal`)* | `/setup-vocal [salon:<#salon>] [categorie:<Catégorie>]`<br>`?setup-vocal [ID_Salon]` | Déploie le système **Join to Create** (salons vocaux temporaires automatiques). Crée un salon déclencheur `➕・Créer un salon`. Dès qu'un joueur le rejoint, un salon privé est généré avec ses permissions (nom, taille) et un **panneau interactif dans le chat vocal** (Renommer, Changer limite, Verrouiller, Expulser, Transférer). Auto-suppression quand vide. |

---

## 6. ℹ️ Utilitaires & Informations

| Commande | Syntaxe | Description |
| :--- | :--- | :--- |
| **`/cmds`** | `/cmds [commande:<nom>]` | Liste dynamique de toutes les commandes avec indicateur visuel de vos permissions d'accès (🟢 Autorisé, 🔒 Verrouillé). |
| **`/help`** | `/help` | Affiche l'aide globale du bot. |
| **`/ping`** | `/ping` | Mesure et affiche la latence WebSocket du bot et le temps de réponse de l'API Discord. |
| **`/userinfo`** | `/userinfo [membre:<@membre>]` | Affiche la fiche détaillée d'un joueur (date de création, rôles, permissions). |
| **`/serverinfo`** | `/serverinfo` | Affiche les statistiques globales du serveur Hyori RP (membres, salons, rôles). |
| **`?prefixtestall`** *(alias `?testall`)* | `?prefixtestall` *(ou `?testall`)* | **Commande préfixe exclusive** : Diagnostic en direct de l'intégralité du bot (intégrité des 33 commandes, accès aux stockages JSON, moteur de bienvenue Canvas, service de tempban/dé-tempban, fichier du règlement et permissions Discord). |
