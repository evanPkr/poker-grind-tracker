# 🎰 Poker Grind Tracker

Application de suivi de sessions poker avec système de comptes utilisateurs.

## Fonctionnalités

- ✅ **Comptes indépendants** - Chaque utilisateur a ses propres données
- ⏱️ **Timers de session** - Track tes heures de Spin & Go, Cash Game, et étude
- 💰 **Gestion de bankroll** - Suivi automatique des gains/pertes
- 📊 **Statistiques** - €/heure, ROI, volumes hebdomadaires
- 📝 **Notes joueurs** - Base de données de reads par catégorie (HU, BvB, etc.)
- 🔒 **Sécurisé** - Mots de passe hashés, JWT tokens

## Installation

### 1. Prérequis

- Node.js 18+ installé
- npm ou yarn

### 2. Installation des dépendances

```bash
cd poker-tracker-app
npm install
```

### 3. Configuration

Créez un fichier `.env` (optionnel) :

```env
PORT=3000
JWT_SECRET=votre-secret-super-securise-a-changer-absolument
```

**IMPORTANT** : Changez le JWT_SECRET en production !

### 4. Démarrage

```bash
npm start
```

L'application sera accessible sur `http://localhost:3000`

## Déploiement en Production

### Option 1 : VPS (Recommandé)

1. Louez un VPS (OVH, Hostinger, DigitalOcean ~5€/mois)
2. Installez Node.js
3. Clonez votre projet
4. Utilisez PM2 pour garder l'app en vie :

```bash
npm install -g pm2
pm2 start src/server.js --name poker-tracker
pm2 save
pm2 startup
```

5. Configurez un reverse proxy Nginx pour HTTPS

### Option 2 : Railway / Render (Gratuit)

1. Push le projet sur GitHub
2. Connectez Railway ou Render à votre repo
3. Déployez automatiquement

### Option 3 : Heroku

```bash
heroku create mon-poker-tracker
git push heroku main
```

## Structure du Projet

```
poker-tracker-app/
├── package.json          # Dépendances
├── src/
│   └── server.js        # Backend Express + API
├── public/
│   └── index.html       # Frontend complet
└── data.db              # Base SQLite (créée auto)
```

## API Endpoints

### Auth
- `POST /api/register` - Créer un compte
- `POST /api/login` - Se connecter
- `POST /api/logout` - Se déconnecter
- `GET /api/me` - Info utilisateur actuel

### Sessions
- `GET /api/sessions` - Liste des sessions
- `POST /api/sessions` - Sauvegarder une session
- `DELETE /api/sessions/:id` - Supprimer une session

### Bankroll
- `GET /api/bankroll` - Montant actuel
- `PUT /api/bankroll` - Modifier le montant

### Notes Joueurs
- `GET /api/player-notes` - Liste des notes
- `POST /api/player-notes` - Ajouter une note
- `DELETE /api/player-notes/:id` - Supprimer une note

### Stats
- `GET /api/stats` - Statistiques globales

## Sécurité

- Les mots de passe sont hashés avec bcrypt (10 rounds)
- L'authentification utilise des JWT tokens (validité 30 jours)
- Les cookies sont HttpOnly et SameSite=Strict
- Chaque utilisateur n'accède qu'à ses propres données

## Personnalisation

### Changer les objectifs par défaut

Dans `public/index.html`, modifiez les valeurs dans `updateDisplay()` :
- 5h pour Spins
- 1-2h pour Cash
- 1h pour Étude

### Ajouter des catégories de notes

Ajoutez des options dans le `<select id="noteCategory">` et mettez à jour les boutons de filtre.

### Modifier le thème

Changez les couleurs CSS :
- `#10b981` - Vert émeraude (accent)
- `#0a0a0a` - Noir (fond)
- `#141414` - Gris foncé (cartes)
- `#1a1a1a` - Gris (inputs)

## Support

Pour toute question ou amélioration, n'hésitez pas à demander !

---

Bon grind ! 🎯💰
