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

| Méthode | Route                                   | Description                                                                | Module     |
| :------ | :-------------------------------------- | :------------------------------------------------------------------------- | :--------- |
| `GET`   | `/health`                               | Diagnostic de l'état du bot et de la passerelle Discord                    | Système    |
| `POST`  | `/notifications/registration-status`    | Notifie le joueur de l'avancement de son inscription                       | Module 1.a |
| `POST`  | `/notifications/character-sheet-status` | Notifie le joueur de retours sur sa fiche personnage                       | Module 1.b |
| `POST`  | `/notifications/sanction`               | Envoie une notification de sanction (Avertissement, Suspension, Exclusion) | Module 1.c |
| `POST`  | `/sanctions/apply`                      | Applique une sanction, sauvegarde les rôles et attribue le rôle sanctionné | Module 2   |
| `POST`  | `/sanctions/rollback`                   | Lève une sanction, retire le rôle sanctionné et restaure les rôles         | Module 2   |
| `GET`   | `/sanctions/backups`                    | Liste l'historique et les sauvegardes actives de rôles                     | Module 2   |
| `POST`  | `/roles/whitelist-class`                | Attribue la whitelist et la classe RP correspondante                       | Module 3.a |
| `POST`  | `/roles/staff`                          | Synchronise le rôle staff (garantie d'un rôle unique, non-cumul)           | Module 3.b |
| `GET`   | `/members/:discordId`                   | Inspecte un membre Discord (rôles, avatar, statut sanctionné)              | Utilitaire |

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
  "status": "WHITELIST_IN_PROGRESS",
  "playerSpaceUrl": "https://hyori.fr/espace-joueur"
}
```

#### Champs :

- `discordId` (string, requis) : ID Discord de l'utilisateur (17-20 chiffres).
- `status` (string, requis) : `'NEW' | 'WAITLIST' | 'WHITELIST_IN_PROGRESS' | 'WHITELISTED' | 'REJECTED'`.
- `playerSpaceUrl` (string, optionnel) : URL personnalisée vers l'espace joueur (par défaut `ATLAS_PLAYER_SPACE_URL`).

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

### 4.3. `POST /api/v1/notifications/character-sheet-status`

Notifie le joueur lorsque des retours ont été déposés sur sa fiche personnage par l'équipe staff.

- **Comportement métier** :
  - `PENDING_PLAYER` : Envoie l'embed de retours disponibles.
  - `DRAFT` / `PENDING_STAFF` / `VALIDATED` : N'envoie aucun DM (`notified: false`), retourne HTTP 200.

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

### 4.4. `POST /api/v1/notifications/sanction`

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

### 4.5. `POST /api/v1/sanctions/apply`

Applique une sanction lourde (`SUSPENSION` ou `EXCLUSION`) sur Discord avec le cycle complet :

1. Sauvegarde persistante des rôles actuels du joueur.
2. Retrait de tous ses rôles (hors rôles gérés).
3. Attribution de l'unique rôle prévu pour les sanctions (`ROLE_SANCTIONED_ID`).
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

### 4.6. `POST /api/v1/sanctions/rollback`

Lève manuellement une sanction sur Discord :

1. Retire le rôle sanctionné (`ROLE_SANCTIONED_ID`).
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

### 4.7. `POST /api/v1/roles/whitelist-class`

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

### 4.8. `POST /api/v1/roles/staff`

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

### 4.9. `GET /api/v1/members/:discordId`

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
