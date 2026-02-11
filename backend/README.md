# MealEvent CRM - Backend API

Backend API pour le CRM MealEvent, déployé sur Render.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Language**: TypeScript

## Installation

```bash
cd backend
npm install
```

## Configuration

Copier `.env.example` vers `.env` et remplir les variables :

```bash
cp .env.example .env
```

Variables requises :
- `SUPABASE_URL` - URL du projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clé service role Supabase
- `STRIPE_SECRET_KEY` - Clé secrète Stripe
- `STRIPE_WEBHOOK_SECRET` - Secret du webhook Stripe
- `FRONTEND_URL` - URL du frontend (pour CORS)

## Développement

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Déploiement sur Render

1. Créer un nouveau Web Service sur Render
2. Connecter le repo GitHub
3. Configurer :
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
4. Ajouter les variables d'environnement

## Endpoints API

### Organizations
- `GET /api/organizations` - Liste des organisations
- `GET /api/organizations/:id` - Détail d'une organisation
- `POST /api/organizations` - Créer une organisation
- `PATCH /api/organizations/:id` - Modifier une organisation
- `DELETE /api/organizations/:id` - Supprimer une organisation

### Restaurants
- `GET /api/restaurants` - Liste des restaurants
- `GET /api/restaurants/:id` - Détail d'un restaurant
- `POST /api/restaurants` - Créer un restaurant
- `PATCH /api/restaurants/:id` - Modifier un restaurant
- `DELETE /api/restaurants/:id` - Supprimer un restaurant

### Contacts
- `GET /api/contacts` - Liste des contacts
- `GET /api/contacts/:id` - Détail d'un contact
- `POST /api/contacts` - Créer un contact
- `PATCH /api/contacts/:id` - Modifier un contact
- `DELETE /api/contacts/:id` - Supprimer un contact
- `GET /api/contacts/stats/pipeline` - Statistiques pipeline

### Bookings
- `GET /api/bookings` - Liste des réservations
- `GET /api/bookings/:id` - Détail d'une réservation
- `POST /api/bookings` - Créer une réservation
- `PATCH /api/bookings/:id` - Modifier une réservation
- `DELETE /api/bookings/:id` - Supprimer une réservation
- `POST /api/bookings/:id/products-services` - Ajouter un produit/service
- `POST /api/bookings/:id/events` - Ajouter un événement

### Quotes
- `GET /api/quotes` - Liste des devis
- `GET /api/quotes/:id` - Détail d'un devis
- `POST /api/quotes` - Créer un devis
- `PATCH /api/quotes/:id` - Modifier un devis
- `POST /api/quotes/:id/send` - Envoyer pour signature
- `POST /api/quotes/:id/sign` - Signer un devis
- `POST /api/quotes/:id/items` - Ajouter une ligne

### Payments
- `GET /api/payments` - Liste des paiements
- `POST /api/payments` - Créer un paiement manuel
- `POST /api/payments/create-link` - Créer un lien Stripe
- `POST /api/payments/:id/remind` - Envoyer une relance
- `POST /api/payments/receipts` - Ajouter un ticket de caisse

### Webhooks
- `POST /api/webhooks/stripe` - Webhook Stripe
