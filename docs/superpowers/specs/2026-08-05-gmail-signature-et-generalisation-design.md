# Gmail : ouverture à toute l'équipe + signature personnelle

Date : 2026-08-05. Statut : design validé, à planifier.

## Objectif

1. Lever le garde-fou du pilote pour que toute personne qui connecte sa boîte Gmail envoie
   réellement depuis celle-ci, sans intervention en base.
2. Ne plus afficher les zones d'envoi Gmail à ceux qui n'ont pas de boîte connectée (sinon ils
   écrivent depuis `noreply@` hors du fil, et la réponse du client ne revient jamais).
3. Chacun règle sa signature email dans le CRM ; elle remplace le « Cordialement, {Prénom Nom} »
   sur **tous** les emails client, gabarits transactionnels compris.
4. La signature suit la boîte qui envoie, pas le commercial attribué au dossier.

## État actuel (vérifié en prod le 05/08)

- Pilote actif depuis le 28/07 et fonctionnel : envois Gmail depuis `victor.l@pasparisiens.com`,
  réponses clients ingérées par le polling (dernier entrant 05/08 08:33).
- Les 3 flags serveur sont **déjà ON** : `GMAIL_INTEGRATION_ENABLED`, `GMAIL_SENDING_ENABLED`,
  `GMAIL_POLLING_ENABLED`.
- Le seul verrou restant est `user_gmail_accounts.sending_enabled`, `DEFAULT false`
  (`supabase/migrations/20260706_gmail_foundations.sql:15`), sans aucune UI : il a été passé à
  `true` à la main pour la seule boîte pilote. `pickMailbox` exige `connected && sendingEnabled`
  (`backend/src/lib/email-threads.ts:15`), donc une boîte fraîchement connectée n'envoie rien.
- Verrou non technique : l'app Google est en **Internal** sur le Workspace `pasparisiens.com`.
  Sur 14 utilisateurs actifs, 9 sont sur ce domaine et peuvent connecter leur boîte ; 5 ne le
  peuvent pas (`antoine@`/`nathan@foolishstudio.fr`, `contact@lacena.fr`, `zestxagency@gmail.com`,
  `georgettepenid@gmail.com`) et restent sur Resend.
- Signature aujourd'hui, deux mécanismes distincts :
  - gabarits client : `Cordialement,` + `${commercialName || restaurant.name}` en dur, 6 fois dans
    `backend/src/lib/email-templates.ts` (lignes 204, 334, 449, 571, 836, 875). `commercialName`
    vient de `getCommercialInfo(bookingId)` = **commercial attribué au dossier**
    (`backend/src/lib/client-email.ts:39`).
  - emails libres : `signatureOf(actor)` = `${first_name} ${last_name}` de **l'acteur connecté**
    (`backend/src/routes/emails.ts:33`).
  - les deux gabarits de notification interne (`buildSignatureNotificationHtml`,
    `buildPaymentNotificationHtml`) s'adressent au commercial, pas au client : hors périmètre.
- La boîte d'expédition, elle, est résolue en acteur → commercial attribué
  (`resolveSenderMailbox`), donc expéditeur et signature peuvent déjà diverger.

## Partie A -- Ouvrir à toute l'équipe

### Migration

`supabase/migrations/20260805_gmail_signature.sql` :

```sql
ALTER TABLE user_gmail_accounts ALTER COLUMN sending_enabled SET DEFAULT true;
UPDATE user_gmail_accounts SET sending_enabled = true WHERE sending_enabled = false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature TEXT;
```

La colonne `sending_enabled` reste en place comme coupe-circuit par boîte (repasser une boîte à
`false` à la main si elle déraille) ; elle ne bloque simplement plus à la connexion.
`handleGmailCallback` fait un upsert sans citer la colonne : le `DEFAULT` s'applique à l'insertion,
la valeur existante est préservée à la mise à jour. Aucun changement dans `pickMailbox`.

Aucune variable Render à toucher.

### Gardes UI

Deux endroits affichent une zone d'envoi Gmail dès que l'intégration est active, donc pour tout le
monde. Ils passent sur « boîte connectée » (`gmailStatus?.connected`), règle déjà appliquée par
`send-email-menu.tsx:141` :

- `src/features/emails/components/booking-emails-tab.tsx:93` -- zone de réponse du fil.
- `src/features/contacts/components/contact-detail-page.tsx:117` -- bouton « Envoyer un email ».

À la place, une ligne discrète « Connectez votre Gmail pour répondre » avec un lien vers
`/settings/integrations`. Quand l'intégration est globalement coupée, on garde le comportement
actuel (rien du tout).

### Activation

Chaque personne se connecte elle-même depuis Réglages → Intégrations : l'OAuth est nominatif.

## Partie B -- Signature personnelle

### Stockage

`users.email_signature TEXT NULL` : texte brut multi-lignes, attaché à la personne. La signature
survit à une déconnexion Gmail et sert aussi aux envois Resend. Pas de colonne sur
`user_gmail_accounts` (la ligne est supprimée à la déconnexion).

Le front ne lit jamais cette colonne directement, donc rien à ajouter dans
`src/lib/supabase/types.ts`.

### Le mécanisme : bloc balisé, substitué à l'envoi

Les gabarits ne savent pas de quelle boîte l'email partira : la décision tombe plus tard, dans
`sendClientEmail`. Chaque gabarit pose donc un **bloc signature balisé** contenant la valeur de
repli d'aujourd'hui, et `sendClientEmail` -- passage obligé de tous les emails client, et qui vient
justement de choisir la boîte -- remplace ce bloc par la signature du vrai expéditeur.

Nouveau module pur `backend/src/lib/email-signature.ts` :

```ts
signatureBlock(fallbackName: string): string   // <!--mev:sig-->{bloc actuel}<!--/mev:sig-->
renderSignature(raw: string): string           // texte utilisateur -> HTML
applySignature(html: string, raw: string | null): string
esc(s: string): string                         // remonté depuis routes/emails.ts:7
```

- `signatureBlock` produit **exactement** le markup existant du nom (`<p ...>{nom}</p>`, mêmes
  styles inline), encadré des deux marqueurs. Le `<p>Cordialement,</p>` reste **hors** du bloc,
  dans le gabarit : la signature personnelle remplace le nom, pas la formule de politesse. Les
  emails libres, qui n'ont pas de formule de politesse aujourd'hui, n'en gagnent donc pas une.
- `applySignature` renvoie le HTML **inchangé** si la signature est vide/nulle ou si les marqueurs
  sont absents. Sinon elle remplace le bloc entier, marqueurs compris, par `renderSignature(raw)`.
  Remplacement global : un gabarit ne pose qu'un bloc, mais aucun marqueur ne doit survivre.
- Marqueurs en commentaires HTML (`<!--mev:sig-->` / `<!--/mev:sig-->`) : invisibles chez le
  destinataire, et supprimés par DOMPurify à l'affichage du fil dans le CRM.

Conséquence directe : **signature vide = email identique à aujourd'hui à l'affichage** (le source
HTML change d'indentation, sans effet visible). Le déploiement reste invisible pour le client tant
que personne n'a rempli son champ, à la seule exception du gras signalé plus bas sur les emails
libres.

### Qui signe

Dans `sendClientEmail`, juste après `resolveSenderMailbox` (`client-email.ts:158`) :

```
signataire = boîte Gmail retenue -> sinon acteur connecté -> sinon personne (le repli reste)
```

Un helper local `loadSignature(userId)` lit `users.email_signature` (service-role, comme les
autres lectures du module). Le HTML substitué est stocké dans une variable locale utilisée
**partout ensuite** : `buildRawMessage`, les deux `recordOutbound`, et `sendEmail`. Le corps
archivé dans `email_messages` porte donc la vraie signature.

Si l'envoi Gmail échoue et retombe sur Resend, la signature déjà appliquée est conservée : le
message a été composé au nom de cette personne, seul le transport change.

### Rendu du texte

`renderSignature` échappe le texte (aucun HTML utilisateur ne passe), convertit les retours à la
ligne en `<br/>`, puis rend cliquables sites, emails et téléphones en **une seule passe** de regex
à alternation -- pas de passes successives qui se re-mordent la queue :

```
https?://…  |  www.…  |  …@….…  |  (+33|0)[\d\s.-]{8,}\d
```

Ordre d'alternation : URL avant email avant téléphone. Le `tel:` est construit en retirant espaces
et séparateurs. Le bloc reprend la typographie du bloc actuel (14px, gris foncé, interligne 1.6).

### Emails libres

`routes/emails.ts` : `buildPlainHtml(message, signatureBlock(nomActeur))`, `signatureOf` disparaît,
`esc` est importé du nouveau module. Ces emails passent par `sendClientEmail`, donc ils héritent du
même arbitrage : si l'acteur n'a pas de boîte connectée et que l'email part de celle du commercial
attribué, c'est ce dernier qui signe -- cohérent avec le `From` que verra le client.

Seul écart de rendu à signature vide, assumé : sur ces emails libres le nom passe en gras, puisque
les deux chemins partagent désormais le même markup de repli.

### Réglages

Routes backend, dans `routes/emails.ts` (auth déjà en place, écriture sur sa propre ligne
uniquement) :

- `GET /api/emails/signature` -> `{ signature: string | null, preview_html: string }`
- `PUT /api/emails/signature` `{ signature }` -> même charge utile en retour.
  Validation : chaîne, `trim`, 2000 caractères maximum (400 au-delà), vide -> `NULL` en base.

`preview_html` est produit par `renderSignature` côté backend : l'aperçu montre le rendu réel sans
dupliquer la logique côté front (et sans risque de dérive entre les deux). Il se rafraîchit à
l'enregistrement.

Front :

- `src/features/settings/hooks/use-email-signature.ts` -- `useEmailSignature()` +
  `useUpdateEmailSignature()` (invalide la query, toast Sonner).
- `src/features/settings/integrations/components/email-signature-settings.tsx` -- carte
  « Signature email » : `Textarea` (placeholder d'exemple : nom, fonction, téléphone, site),
  encadré « Aperçu » rendant `preview_html` via DOMPurify, bouton Enregistrer désactivé tant que
  rien n'a changé.
- `src/features/settings/integrations/page.tsx` -- carte ajoutée sous `GmailSettings`, container
  passé en `space-y-6`. Visible par tout le monde, connecté à Gmail ou non.

## Tests

Style maison : vitest, fonctions pures, tests en français dans `backend/tests/`.

`backend/tests/lib/email-signature.test.ts` :
- `signatureBlock` restitue le markup actuel (verrou anti-régression visuelle).
- `applySignature` : no-op si signature `null`/vide, no-op si marqueurs absents, remplacement
  complet marqueurs compris, aucun marqueur résiduel.
- `renderSignature` : `<script>` échappé, retours à la ligne, lien mail/site/téléphone, pas de
  double linkification (`tel:` propre, pas de lien dans un lien).

`backend/tests/routes/client-email-callsites.test.ts` (verrou existant, à étendre) : les 6 gabarits
client de `email-templates.ts` passent par `signatureBlock` et plus aucun ne contient
`Cordialement,` en dur.

## Déploiement

Ordre imposé, comme les phases précédentes :

1. Coller `20260805_gmail_signature.sql` dans l'éditeur SQL prod.
2. Déployer le backend (Render), puis le front (Netlify).
3. Vérifier qu'un envoi sans signature renseignée est strictement identique à avant.
4. Renseigner sa signature, renvoyer un devis de test, contrôler le rendu chez le destinataire.
5. Prévenir l'équipe : chacun connecte sa boîte puis règle sa signature.

Aucun changement de variable d'environnement.

## Hors périmètre

- Éditeur riche, logo ou image dans la signature (les images demanderaient un hébergement).
- Signature imposée ou éditée par un admin pour les autres.
- Passage de l'app Google en External pour les 5 personnes hors domaine : audit CASA de Google,
  plusieurs semaines, sans rapport avec ce chantier.
- Capture des réponses aux envois Resend (phase 5, inchangée).

## Risques et points d'attention

- **Changement de comportement assumé** : sur les emails transactionnels, le nom affiché devient
  celui de l'expéditeur réel et non plus celui du commercial attribué. C'est la décision prise ;
  elle se voit dès qu'un dossier est traité par quelqu'un d'autre que son commercial.
- Ouvrir l'envoi à toutes les boîtes multiplie les expéditeurs : surveiller les logs Render aux
  premiers envois de chaque nouvelle boîte (révocation de token, quota Gmail).
- Le `DEFAULT true` s'applique aussi à une reconnexion après révocation : c'est voulu.
