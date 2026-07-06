# 🚀 Lancer le projet en localhost

## Prérequis

- Node.js >= 20.0.0
- pnpm (ou npm/yarn)

## 1. Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet :

```bash
cp .env.example .env
```

Puis éditez `.env` avec vos valeurs :

```env
# Supabase (récupérez ces valeurs depuis votre dashboard Supabase)
VITE_SUPABASE_URL=https://geofmvmydyjuculbbmil.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key-supabase

# Backend API
# Option 1: Utiliser le backend Render (production)
VITE_API_URL=https://votre-app.onrender.com

# Option 2: Utiliser le backend local (développement)
# VITE_API_URL=http://localhost:3001
```

## 2. Installation des dépendances

```bash
# À la racine du projet
pnpm install
```

## 3. Lancer le frontend

```bash
pnpm dev
```

Le frontend sera accessible sur : **http://localhost:5173**

---

## 🔧 Lancer le backend en local (optionnel)

Si vous voulez aussi lancer le backend localement :

### 1. Configuration du backend

Créez un fichier `.env` dans le dossier `backend/` :

```bash
cd backend
cp .env.example .env
```

Éditez `backend/.env` :

```env
# Supabase (utilisez la SERVICE_ROLE_KEY, pas l'anon key)
SUPABASE_URL=https://geofmvmydyjuculbbmil.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# Stripe — clé plateforme
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Connect (par restaurant)
STRIPE_CLIENT_ID=ca_test_...                           # Dashboard Stripe > Connect > Paramètres
STRIPE_CONNECT_REDIRECT_URI=http://localhost:3001/api/stripe-connect/oauth/callback
STRIPE_CONNECT_LEGACY_MODE=true                        # true = fallback clé plateforme pour restaurants non connectés

# Frontend URL (pour les redirections Stripe)
FRONTEND_URL=http://localhost:5173

# Port
PORT=3001

# Gmail (optionnel) — laisser tout OFF tant que la console Google Cloud n'est pas prete
GMAIL_INTEGRATION_ENABLED=false                        # master switch : coupe toute l'integration Gmail
GMAIL_SENDING_ENABLED=false                            # phase 2 : envoi via la boite du commercial (effectif seulement si le master est ON)
GMAIL_POLLING_ENABLED=false                            # phase 3 : polling des reponses (declare ici, consomme en phase 3)
```

### 2. Installation et lancement

```bash
cd backend
pnpm install
pnpm dev
```

Le backend sera accessible sur : **http://localhost:3001**

### 3. Mettre à jour le frontend

Dans le fichier `.env` à la racine, changez :

```env
VITE_API_URL=http://localhost:3001
```

---

## 📋 Résumé des commandes

| Commande | Description |
|----------|-------------|
| `pnpm install` | Installer les dépendances |
| `pnpm dev` | Lancer le frontend (port 5173) |
| `pnpm build` | Build de production |
| `cd backend && pnpm dev` | Lancer le backend (port 3001) |

---

## 🔗 URLs importantes

- **Frontend local** : http://localhost:5173
- **Backend local** : http://localhost:3001
- **Supabase Dashboard** : https://supabase.com/dashboard
- **Render Dashboard** : https://dashboard.render.com

---

## ⚠️ Notes

1. **Supabase** : Assurez-vous que les RLS (Row Level Security) sont désactivées pour le développement ou configurées correctement.

2. **Backend Render** : Si vous utilisez le backend sur Render, assurez-vous qu'il est démarré (les instances gratuites s'éteignent après inactivité).

3. **Variables d'environnement** : Ne commitez jamais le fichier `.env` ! Il est déjà dans `.gitignore`.
