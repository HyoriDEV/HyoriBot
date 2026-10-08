# Spécification Technique d'Intégration — Bot Discord Hyori (API REST Interne)

Ce document détaille l'intégralité du contrat d'interface exposé par le serveur HTTP interne du **Bot Discord Hyori**. Il est destiné aux développeurs de l'application **Hyori Atlas** (Next.js) pour brancher les événements métier sans avoir à inspecter le code source du bot.

---

## 1. Principes & Architecture de Communication

```
┌─────────────────────────┐                         ┌─────────────────────────┐
│       HYORI ATLAS       │                         │    BOT DISCORD HYORI    │
│  (Next.js App Server)   │                         │   (Node.js ESM / REST)  │
│                         │                         │                         │
│  Événement Métier       │ ── HTTP POST (Bearer) ─▶│  Validation Zod         │
│  (ex: validation WL,    │                         │  File d'attente (Queue) │
│   sanction, retour RP)  │ ◀── Réponse JSON ───────│  Exécution Discord.js   │
│                         │     (200 / 400 / 500)   │  Persistance Rollbacks  │
└─────────────────────────┘                         └─────────────────────────┘
```

- **Réseau** : Le bot écoute par défaut sur `http://127.0.0.1:4000/api/v1` (ou sur réseau interne Docker).
- **Format** : `application/json` (encodage UTF-8).
- **Authentification** : Toutes les routes (sauf `/health`) nécessitent l'en-tête :
  ```http
  Authorization: Bearer <INTERNAL_BOT_API_KEY>
  Content-Type: application/json
  ```
- **Gestion de la concurrence & Rate-Limits** : Le bot intègre une file d'attente interne (queue) avec gestion automatique des réessais et du backoff en cas de rate-limit Discord (HTTP 429).
- **Gestion des MP fermés** : Si un utilisateur a désactivé ses DM ou bloqué le bot, le bot intercepte l'erreur (50007), renvoie `{ "success": true, "notified": false, "dmClosed": true }` pour ne jamais bloquer l'action métier dans Hyori Atlas.

---

## 2. Variables d'Environnement Côté Next.js (`Hyori Atlas`)

Pour communiquer avec le bot, ajoutez les variables suivantes dans le `.env` de Hyori Atlas :

```env
# URL de l'API interne du bot Discord
DISCORD_BOT_API_URL=http://127.0.0.1:4000/api/v1

# Clé API secrète partagée (doit être identique à INTERNAL_BOT_API_KEY du bot)
INTERNAL_BOT_API_KEY=hyori_internal_secret_api_key_change_me_in_prod
```

### Helper TypeScript d'Appel Suggéré (`lib/discord-bot-client.ts`)

```typescript
const BOT_API_URL = process.env.DISCORD_BOT_API_URL || 'http://127.0.0.1:4000/api/v1';
const BOT_API_KEY = process.env.INTERNAL_BOT_API_KEY || '';

export async function callDiscordBot<TResponse = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: unknown
): Promise<TResponse> {
  const res = await fetch(`${BOT_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BOT_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Discord Bot API error [${res.status}]: ${data.message || res.statusText}`);
  }

  return data as TResponse;
}
```

---

## 3. Table des Endpoints

| Méthode | Route                                      | Description                                                                | Module     |
| :------ | :----------------------------------------- | :------------------------------------------------------------------------- | :--------- |
| `GET`   | `/health`                                  | Diagnostic de l'état du bot et de la passerelle Discord                    | Système    |
| `POST`  | `/notifications/registration-status`       | Notifie le joueur de l'avancement de son inscription (inclut village)      | Module 1.a |
| `POST`  | `/notifications/broadcast-village-invites` | Diffuse en DM à tous les whitelistés l'invitation à leur village           | Module 1.a |
| `POST`  | `/notifications/character-sheet-status`    | Notifie le joueur de retours sur sa fiche personnage                       | Module 1.b |
| `POST`  | `/notifications/interview-reminder`        | Relance le(s) joueur(s) pour réserver leur créneau d'entretien             | Module 1.c |
| `POST`  | `/notifications/ticket-message`            | Notifie le joueur d'un nouveau message dans un ticket dont il fait partie  | Module 1.d |
| `POST`  | `/notifications/ticket-created`            | Alerte sur un salon Discord externe lors de l'ouverture d'un ticket        | Module 1.e |
| `POST`  | `/notifications/ticket-team-summoned`      | Transmet un ticket à une équipe sur son salon dédié (embed d'ouverture)    | Module 1.e |
| `POST`  | `/notifications/waitlist-registration`     | Alerte les administrateurs dans leur salon dédié lors d'une inscription WL | Module 1.f |
| `POST`  | `/notifications/sanction`                  | Envoie une notification de sanction (Avertissement, Suspension, Exclusion) | Module 1.g |
| `POST`  | `/sanctions/apply`                         | Applique une sanction, sauvegarde les rôles et attribue le rôle sanctionné | Module 2   |
| `POST`  | `/sanctions/rollback`                      | Lève une sanction, retire le rôle sanctionné et restaure les rôles         | Module 2   |
| `GET`   | `/sanctions/backups`                       | Liste l'historique et les sauvegardes actives de rôles                     | Module 2   |
| `POST`  | `/roles/whitelist-class`                   | Attribue la whitelist et la classe RP correspondante                       | Module 3.a |
| `POST`  | `/roles/staff`                             | Synchronise le rôle staff (garantie d'un rôle unique, non-cumul)           | Module 3.b |
| `GET`   | `/members/:discordId`                      | Inspecte un membre Discord (rôles, avatar, statut sanctionné)              | Utilitaire |
| `GET`   | `/villages`                                | Liste les configurations et liens d'invitation des 5 serveurs de villages  | Utilitaire |

---

## 4. Documentation Détaillée des Routes

---

### 4.1. `GET /api/v1/health`

Permet de vérifier que le serveur HTTP du bot est en ligne et que la connexion à Discord est active.

- **Authentification requise** : Non.
- **Réponse HTTP 200 OK** :

```json
{
  "success": true,
  "service": "hyori-discord-bot",
  "status": "ok",
  "timestamp": "2026-09-02T00:30:00.000Z",
  "uptime": 1245.5,
  "discord": {
    "ready": true,
    "pingMs": 42,
    "guildsCached": 1
  },
  "queue": {
    "queueLength": 0,
    "activeWorkers": 0,
    "totalProcessed": 18,
    "totalFailed": 0
  }
}
```

---

### 4.2. `POST /api/v1/notifications/registration-status`

Notifie le joueur en message privé lors de l'évolution de son inscription sur Hyori.

- **Comportement métier** :
  - `WHITELIST_IN_PROGRESS` : Envoie l'embed d'acceptation.
  - `WHITELISTED` : Envoie l'embed de validation définitive.
  - `REJECTED` : Envoie l'embed de mise à jour / refus.
  - `NEW` / `WAITLIST` : N'envoie aucun DM (`notified: false`), retourne HTTP 200.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "status": "WHITELISTED",
  "playerSpaceUrl": "https://hyori.fr/espace-joueur",
  "assignedClass": "NOBLE"
}
```

#### Champs :

- `discordId` (string, requis) : ID Discord de l'utilisateur (17-20 chiffres).
- `status` (string, requis) : `'NEW' | 'WAITLIST' | 'WHITELIST_IN_PROGRESS' | 'WHITELISTED' | 'REJECTED'`.
- `playerSpaceUrl` (string, optionnel) : URL personnalisée vers l'espace joueur (par défaut `ATLAS_PLAYER_SPACE_URL`).
- `assignedClass` (string, optionnel) : Classe RP assignée (`'NOBLE' | 'PAYSAN' | 'PECHEUR' | 'MINEUR' | 'ERUDIT'`). Si fournie pour le statut `WHITELISTED`, le bot injecte automatiquement le lien permanent d'invitation vers le serveur Discord du village et ajoute un bouton d'accès direct.

#### Réponse HTTP 200 (Succès d'envoi) :

```json
{
  "success": true,
  "notified": true,
  "message": "Notification sent successfully via DM"
}
```

#### Réponse HTTP 200 (Statut sans notification requise) :

```json
{
  "success": true,
  "notified": false,
  "message": "Registration status WAITLIST does not trigger a notification"
}
```

#### Réponse HTTP 200 (MP fermés ou utilisateur ayant bloqué le bot) :

```json
{
  "success": true,
  "notified": false,
  "dmClosed": true,
  "error": "Direct messages are disabled or the bot is blocked by the user"
}
```

---

### 4.2b. `POST /api/v1/notifications/broadcast-village-invites`

Analyse les rôles de l'intégralité des membres sur le serveur Discord communautaire "Hyori RP" (`discordConfig.guilds.community.id`). Filtre tous les membres possédant le rôle Whitelist (`discordConfig.roles.whitelist`), détecte leur rôle de classe et leur envoie un message privé contenant le lien permanent d'invitation vers le serveur Discord de leur village.

#### Corps de la requête (JSON) :

```json
{}
```

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "summary": {
    "totalWhitelisted": 25,
    "sent": 22,
    "dmClosed": 2,
    "failed": 0,
    "noClassRole": 1,
    "byClass": {
      "NOBLE": 5,
      "PECHEUR": 4,
      "PAYSAN": 6,
      "MINEUR": 4,
      "ERUDIT": 3
    }
  },
  "message": "22 invitation(s) envoyée(s) avec succès sur 25 joueur(s) whitelisté(s)."
}
```

---

### 4.3. `POST /api/v1/notifications/character-sheet-status`

Notifie le joueur par message privé des retours, de la validation ou de la réouverture de sa fiche personnage par l'équipe staff.

- **Comportement métier** :
  - `VALIDATED` : Envoie l'embed de validation de la fiche personnage.
  - `REOPENED` : Envoie l'embed de réouverture de la fiche personnage.
  - `PENDING_PLAYER` : Envoie l'embed de retours disponibles.
  - `DRAFT` / `PENDING_STAFF` : N'envoie aucun DM (`notified: false`), retourne HTTP 200.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "status": "PENDING_PLAYER",
  "playerSpaceUrl": "https://hyori.fr/espace-joueur/fiche"
}
```

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "notified": true,
  "message": "Notification sent successfully via DM"
}
```

---

### 4.4. `POST /api/v1/notifications/interview-reminder`

Notifie un ou plusieurs joueurs par message privé pour les inviter à réserver leur créneau d'entretien de whitelist une fois leur fiche RP validée.

#### Corps de la requête (JSON) :

Envoi groupé :

```json
{
  "discordIds": ["123456789012345678", "234567890123456789"],
  "interviewUrl": "https://hyori-rp.fr/player/interview"
}
```

Envoi individuel :

```json
{
  "discordId": "123456789012345678",
  "interviewUrl": "https://hyori-rp.fr/player/interview"
}
```

#### Champs :

- `discordId` (string, optionnel) : ID Discord unique (16-21 chiffres).
- `discordIds` (array[string], optionnel) : Tableau d'IDs Discord (au moins l'un des deux doit être renseigné).
- `interviewUrl` (string, optionnel) : URL vers la page de réservation d'entretien (par défaut `${ATLAS_PLAYER_SPACE_URL}/interview`).

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "total": 2,
  "sent": 2,
  "dmClosed": 0,
  "failed": 0
}
```

---

### 4.5. `POST /api/v1/notifications/sanction`

Envoie une notification de sanction disciplinaire par message privé.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "type": "SUSPENSION",
  "reason": "Non-respect répété des consignes de modération RP.",
  "duration": "7 jours",
  "appealUrl": "https://hyori.fr/espace-joueur/tickets"
}
```

#### Champs :

- `discordId` (string, requis) : ID Discord du joueur.
- `type` (string, requis) : `'WARNING' | 'SUSPENSION' | 'EXCLUSION'`.
- `reason` (string, requis) : Motif explicite de la sanction.
- `duration` (string, optionnel) : Libellé de durée pour les suspensions (ex : `"3 jours"`, `"48 heures"`).
- `appealUrl` (string, optionnel) : Lien vers le système de tickets pour appel.

---

### 4.6. `POST /api/v1/notifications/ticket-message`

Notifie le joueur par message privé Discord lorsqu'un nouveau message apparaît dans un ticket dont il fait partie.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "ticketId": "cm1234567890",
  "ticketSubject": "Question sur le métier d'érudit",
  "authorName": "Staff_Kenshin",
  "messagePreview": "Bonjour ! Voici les précisions demandées...",
  "ticketUrl": "https://hyori-rp.fr/player/tickets/cm1234567890"
}
```

#### Champs :

- `discordId` (string, requis) : ID Discord de l'utilisateur (16-21 chiffres).
- `ticketId` (string, requis) : Identifiant unique du ticket Atlas.
- `ticketSubject` (string, requis) : Sujet du ticket (max 200 caractères).
- `authorName` (string, requis) : Pseudo ou nom d'affichage de l'auteur du message.
- `messagePreview` (string, optionnel) : Aperçu textuel du message.
- `ticketUrl` (string, optionnel) : URL directe vers le ticket dans l'espace joueur.

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "notified": true,
  "message": "Notification sent successfully via DM"
}
```

---

### 4.7. `POST /api/v1/notifications/ticket-created`

Envoie une notification dans un salon Discord (pouvant être situé sur un autre serveur/guilde que le serveur principal du bot) lors de l'ouverture d'un nouveau ticket sur Atlas, avec mention d'un rôle par ID optionnelle.

#### Corps de la requête (JSON) :

```json
{
  "channelId": "123456789012345678",
  "mentionRoleId": "987654321098765432",
  "ticketId": "cm1234567890",
  "ticketSubject": "Demande de concession de terrain",
  "ticketCategory": "Demande RP",
  "authorName": "Joueur_Alex",
  "ticketDescription": "Bonjour, je sollicite un terrain pour implanter une forge...",
  "ticketStaffUrl": "https://hyori-rp.fr/staff/tickets/cm1234567890",
  "override": {
    "title": "Nouveau Ticket — {category}",
    "description": "Un ticket a été ouvert par {author}...",
    "buttonLabel": "Consulter le ticket"
  }
}
```

#### Champs :

- `channelId` (string, optionnel) : ID du salon Discord cible (16-21 chiffres). S'il n'est pas fourni, le bot utilise `channels.ticketNotifications` défini dans `discordConfig.js`.
- `mentionRoleId` (string, optionnel) : ID du rôle Discord à mentionner (16-21 chiffres). S'il n'est pas fourni, le bot utilise `roles.ticketMention` défini dans `discordConfig.js`. Si configuré, le bot préfixe le message par `<@&roleId>`.
- `ticketId` (string, requis) : Identifiant unique du ticket.
- `ticketSubject` (string, requis) : Sujet du ticket.
- `ticketCategory` (string, requis) : Libellé de la catégorie du ticket.
- `authorName` (string, requis) : Pseudo ou nom de l'auteur créateur du ticket.
- `ticketDescription` (string, optionnel) : Contenu du premier message d'ouverture.
- `ticketStaffUrl` (string, optionnel) : URL directe vers le ticket dans l'espace staff.
- `override` (objet, optionnel) : Objet de personnalisation dynamique de l'embed (`title`, `description`, `buttonLabel`, `buttonUrl`).

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "notified": true,
  "message": "Ticket creation notification sent successfully to channel 123456789012345678"
}
```

---

### 4.8. `POST /api/v1/notifications/ticket-team-summoned`

Transmet un ticket à une équipe du staff sur son salon Discord dédié, lorsqu'un administrateur ou un helper la convoque sur ce ticket. L'embed est strictement identique à celui d'une ouverture de ticket (`ticket-created`) : rien n'indique qu'il s'agit d'une convocation.

- `team` : `RP_TRACKING`, `CONFLICT_MANAGEMENT`, `EVENT` ou `DEVELOPER`.
- Salon : `channelId` de la requête, sinon `channels.ticketTeamNotifications[team]` dans `discordConfig.js`. Il n'y a **pas** de repli sur le salon tickets général : sans salon configuré, la réponse est `{ "success": false, "notified": false }`.
- Mention : `mentionRoleId` de la requête, sinon `roles.ticketTeamMention[team]` (aucune mention si `null`).

#### Corps de la requête (JSON) :

Même format que `ticket-created`, plus `team` :

```json
{
  "team": "RP_TRACKING",
  "channelId": "123456789012345678",
  "mentionRoleId": "987654321098765432",
  "ticketId": "cm1234567890",
  "ticketSubject": "Demande de concession de terrain",
  "ticketCategory": "Demande RP",
  "authorName": "Joueur_Alex",
  "ticketDescription": "Bonjour, je sollicite un terrain pour implanter une forge...",
  "ticketStaffUrl": "https://hyori-rp.fr/staff/tickets/cm1234567890",
  "override": {
    "title": "Nouveau Ticket — {category}",
    "description": "Un ticket a été ouvert par {author}...",
    "buttonLabel": "Consulter le ticket"
  }
}
```

> L'ancienne route `POST /api/v1/notifications/ticket-rp-summoned` reste disponible comme alias de `team: "RP_TRACKING"` (compatibilité de déploiement).

---

### 4.9. `POST /api/v1/notifications/waitlist-registration`

Alerte les administrateurs dans leur salon dédié sur le serveur staff (`Direction ⭐ / ⏳・liste-attente`) lorsqu'un joueur s'inscrit sur la liste d'attente après avoir lié son compte Minecraft sur Hyori Atlas.

- **Salon** : `channelId` de la requête, sinon `channels.waitlistNotifications` dans `discordConfig.js` (`1557096333683331172`).
- **Mention** : `mentionRoleId` de la requête, sinon `roles.waitlistMention` dans `discordConfig.js` (aucune mention par défaut).
- **Design de l'embed** : Couleur dorée Hyori (`#E9D15C`), titre standard, récapitulatif du joueur et du pseudo Minecraft, miniature de l'avatar (si disponible) et bouton interactif vers `/staff/waitlist`.

#### Corps de la requête (JSON) :

```json
{
  "channelId": "1557096333683331172",
  "mentionRoleId": null,
  "discordId": "123456789012345678",
  "playerName": "Alex",
  "minecraftUsername": "Alex_Craft",
  "minecraftUuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "avatarUrl": "https://cdn.discordapp.com/avatars/123456789012345678/abc.png",
  "waitlistStaffUrl": "https://hyori-rp.fr/staff/waitlist",
  "override": {
    "title": "Nouvelle Inscription — Liste d'attente",
    "description": "Un nouveau joueur s'est inscrit...",
    "buttonLabel": "Consulter la liste d'attente"
  }
}
```

#### Champs :

- `channelId` (string, optionnel) : ID du salon Discord cible. S'il n'est pas fourni, le bot utilise `channels.waitlistNotifications`.
- `mentionRoleId` (string, optionnel) : ID du rôle Discord à mentionner (optionnel, préfixe le message par `<@&roleId>`).
- `discordId` (string, optionnel) : Identifiant Discord du joueur.
- `playerName` (string, requis) : Nom d'affichage ou pseudo Discord du joueur.
- `minecraftUsername` (string, optionnel) : Pseudo Minecraft lié du joueur.
- `minecraftUuid` (string, optionnel) : UUID Minecraft lié.
- `avatarUrl` (string, optionnel) : URL de l'avatar du joueur pour la miniature de l'embed.
- `waitlistStaffUrl` (string, optionnel) : URL vers la gestion de la liste d'attente dans l'espace staff.
- `override` (objet, optionnel) : Personnalisation dynamique de l'embed (`title`, `description`, `buttonLabel`, `buttonUrl`).

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "notified": true,
  "message": "Waitlist registration notification sent successfully to channel"
}
```

---

### 4.10. `POST /api/v1/sanctions/apply`

Applique une sanction lourde (`SUSPENSION` ou `EXCLUSION`) sur Discord avec le cycle complet :

1. Sauvegarde persistante des rôles actuels du joueur.
2. Retrait de tous ses rôles (hors rôles gérés).
3. Attribution de l'unique rôle prévu pour les sanctions (`roles.sanctioned` dans `discordConfig.js`).
4. Notification DM optionnelle.
5. Si `durationSeconds` est spécifié, la levée automatique sera planifiée de manière persistante par le scheduler.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "type": "SUSPENSION",
  "reason": "Comportement anti-jeu persistant",
  "durationSeconds": 259200,
  "durationString": "3 jours",
  "notifyDm": true,
  "metadata": {
    "staffAuthorId": "clx123456789",
    "ticketId": "tkt_456"
  }
}
```

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "backupId": "bk_1725234567890_a1b2c3d",
  "sanctionType": "SUSPENSION",
  "removedRoleIds": ["123456789000000001", "123456789000000010"],
  "assignedRoleId": "123456789000000002",
  "expiresAt": "2026-09-05T00:30:00.000Z",
  "message": "Sanction applied and roles backed up successfully",
  "dmNotification": {
    "success": true,
    "notified": true,
    "message": "Notification sent successfully via DM"
  }
}
```

---

### 4.9. `POST /api/v1/sanctions/rollback`

Lève manuellement une sanction sur Discord :

1. Retire le rôle sanctionné (`roles.sanctioned` dans `discordConfig.js`).
2. Restaure l'ensemble des rôles sauvegardés lors de l'application.
3. Si un rôle n'existe plus sur Discord, il est ignoré sans faire échouer l'opération.
4. Archive la sauvegarde dans le stockage persistant.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "backupId": null,
  "reason": "Levée de sanction suite à appel validé par le staff"
}
```

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "backupId": "bk_1725234567890_a1b2c3d",
  "restoredRoleIds": ["123456789000000001", "123456789000000010"],
  "missingRoleIds": [],
  "message": "Sanction lifted and roles restored successfully"
}
```

---

### 4.10. `POST /api/v1/roles/whitelist-class`

Synchronise le statut Whitelist et la classe RP d'un joueur après son entretien.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "whitelisted": true,
  "classRole": "NOBLE"
}
```

#### Classes RP acceptées :

- `NOBLE` / `ROLE_NOBLE`
- `PAYSAN` / `ROLE_PAYSAN`
- `PECHEUR` / `ROLE_PECHEUR`
- `MINEUR` / `ROLE_MINEUR`
- `ERUDIT` / `ROLE_ERUDIT`

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "whitelisted": true,
  "classRole": "NOBLE",
  "rolesAdded": ["123456789000000001", "123456789000000010"],
  "rolesRemoved": [],
  "message": "Whitelist and RP class synchronized successfully"
}
```

---

### 4.11. `POST /api/v1/roles/staff`

Synchronise le rôle Staff d'un utilisateur en appliquant **strictement la règle du rôle unique (non-cumul)** :

- Tous les anciens rôles Staff du membre sont retirés automatiquement.
- Le nouveau rôle Staff est attribué instantanément.
- Si `staffRole` vaut `NONE`, `PLAYER` ou `null`, tous les rôles Staff sont retirés.

#### Corps de la requête (JSON) :

```json
{
  "discordId": "123456789012345678",
  "staffRole": "GC"
}
```

#### Rôles Staff acceptés :

- `GC` / `CONFLICT_MANAGEMENT` (Gestion des Conflits)
- `COMMUNICATION`
- `RP_TRACKING` (Suivi RP)
- `EVENT` (Événementiel)
- `DEVELOPER`
- `ADMIN`
- `NONE` / `PLAYER` / `null` (Retrait de tout rôle staff)

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "staffRole": "GC",
  "targetStaffRoleId": "123456789000000020",
  "rolesAdded": ["123456789000000020"],
  "rolesRemoved": ["123456789000000022"],
  "message": "Staff role synchronized successfully (single role constraint respected)"
}
```

---

### 4.12. `GET /api/v1/members/:discordId`

Inspecte l'état complet d'un membre sur le serveur Discord (rôles attribués, statut whitelisté, statut sanctionné, dernière sauvegarde active).

#### Réponse HTTP 200 :

```json
{
  "success": true,
  "member": {
    "discordId": "123456789012345678",
    "username": "joueur_hyori",
    "displayName": "Kenshin",
    "nickname": "Kenshin | Noble",
    "avatarUrl": "https://cdn.discordapp.com/avatars/...",
    "joinedAt": "2026-08-15T14:20:00.000Z",
    "isSanctioned": false,
    "isWhitelisted": true,
    "roles": [
      {
        "id": "123456789000000001",
        "name": "Membre Whitelist",
        "color": "#E9D15C",
        "isWhitelist": true,
        "isSanctioned": false,
        "isStaff": false,
        "isClass": false
      },
      {
        "id": "123456789000000010",
        "name": "Noble",
        "color": "#7289DA",
        "isWhitelist": false,
        "isSanctioned": false,
        "isStaff": false,
        "isClass": true
      }
    ],
    "activeBackup": null
  }
}
```

---

## 5. Gestion des Codes d'Erreur HTTP

| Code HTTP                   | Cause                                                               | Format du corps de réponse                                                                  |
| :-------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------ |
| `400 Bad Request`           | Payload JSON invalide ou paramètres manquants / mal formatés        | `{"success": false, "statusCode": 400, "error": "Bad Request", "details": {...}}`           |
| `401 Unauthorized`          | Header `Authorization` manquant ou token Bearer incorrect           | `{"success": false, "statusCode": 401, "error": "Unauthorized", "message": "..."}`          |
| `404 Not Found`             | Membre introuvable sur le serveur Discord ou sauvegarde inexistante | `{"success": false, "statusCode": 404, "error": "Not Found", "message": "..."}`             |
| `500 Internal Server Error` | Erreur inattendue ou échec critique lors d'un appel à l'API Discord | `{"success": false, "statusCode": 500, "error": "Discord Action Failed", "message": "..."}` |
