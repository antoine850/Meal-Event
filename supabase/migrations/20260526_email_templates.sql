-- ============================================
-- EMAIL TEMPLATES TABLE
-- ============================================
-- Templates d'emails (plaquette, devis, relance, etc.) scopés par organisation.
-- Le rendu (substitution {{var}}) se fait côté client, on stocke ici sujet + corps.

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('fr','en')),
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, slug, lang)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(organization_id, is_active);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage email_templates in their org"
  ON email_templates FOR ALL
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- ============================================
-- RESTAURANTS : seuil de privatisation
-- ============================================
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS min_revenue_privatization_eur NUMERIC;

-- ============================================
-- SEED : 6 templates × 2 langues pour chaque organisation
-- ============================================
INSERT INTO email_templates (organization_id, slug, lang, label, subject, body, sort_order)
SELECT o.id, t.slug, t.lang, t.label, t.subject, t.body, t.sort_order
FROM organizations o
CROSS JOIN (VALUES
  -- 1. PLAQUETTE
  ('plaquette', 'fr', 'Envoi plaquette',
   '{{restaurant}} — disponibilité du {{date_evenement}}',
   'Bonjour {{prenom_client}},

Merci pour l''intérêt porté au {{restaurant}}.
Je vous confirme sa disponibilité pour le {{date_evenement}}.

Vous trouverez en pièce jointe notre plaquette de présentation avec nos différentes formules.

Les créneaux disponibles pour le service sont les suivants : de 19h à 21h30 ou de 21h45 jusqu''à la fermeture. Nous proposons également des menus spéciaux qui vous permettront de profiter des deux services.

Nous serons ravis de vous accompagner afin de trouver le format le plus adapté à votre événement.

Si vous le souhaitez, nous pouvons également vous transmettre un devis personnalisé. La réservation sera confirmée à réception du devis signé, sous réserve de disponibilité.

Je reste à votre disposition pour toute question complémentaire.
Au plaisir de vous accueillir prochainement chez {{groupe}}.

Très belle journée,
{{signature}}', 10),

  ('plaquette', 'en', 'Send brochure',
   '{{restaurant}} — availability on {{date_evenement}}',
   'Hello {{prenom_client}},

Thank you for your interest in {{restaurant}}.
I confirm that the venue is available on {{date_evenement}}.

Please find attached our presentation brochure including our different packages.

The available time slots for service are as follows: from 7:00 PM to 9:30 PM or from 9:45 PM until closing time. We also offer special menus allowing you to enjoy both services.

We would be delighted to assist you in finding the format best suited to your event.

If you wish, we can also provide you with a personalized quotation. The reservation will be confirmed upon receipt of the signed quotation, subject to availability.

I remain at your disposal for any additional questions.
We look forward to welcoming you soon at {{groupe}}.

Have a wonderful day,
{{signature}}', 10),

  -- 2. DEVIS
  ('devis', 'fr', 'Envoi devis',
   'Devis — votre événement chez {{restaurant}} le {{date_evenement}}',
   'Bonjour {{prenom_client}},

Vous trouverez ci-joint le devis pour votre événement chez {{restaurant}}.

Pour confirmer la réservation, il suffira simplement de nous retourner le devis signé. Une fois reçu, la date sera définitivement bloquée.

Selon le format retenu :
- une empreinte bancaire pourra être demandée avant l''événement, avec règlement sur place,
- ou un acompte de 80 % pourra être demandé par carte bancaire ou virement (coordonnées indiquées sur le devis).

Je reste à votre disposition pour toute question et attends votre retour afin de finaliser votre réservation.

Belle journée et à bientôt,
{{signature}}', 20),

  ('devis', 'en', 'Send quotation',
   'Quotation — your event at {{restaurant}} on {{date_evenement}}',
   'Hello {{prenom_client}},

Please find attached the quotation for your event at {{restaurant}}.

To confirm the reservation, you will simply need to return the signed quotation to us. Once received, the date will be definitively secured.

Depending on the selected format:
- a credit card authorization may be requested before the event, with payment made on site,
- or an 80% deposit may be requested by credit card or bank transfer (details indicated on the quotation).

I remain at your disposal for any questions and look forward to your feedback in order to finalize the reservation.

Have a lovely day and see you soon,
{{signature}}', 20),

  -- 3. PRIVATISATION
  ('privatisation', 'fr', 'Privatisation complète',
   '{{restaurant}} — privatisation complète le {{date_evenement}}',
   'Bonjour {{prenom_client}},

Merci pour l''intérêt porté au {{restaurant}}.
Je vous confirme sa disponibilité pour le {{date_evenement}}.

Vous trouverez en pièce jointe notre plaquette de présentation avec nos différentes formules.

Au vu du nombre d''invités ({{nb_invites}} personnes), nous pouvons vous proposer la privatisation complète du restaurant, impliquant un minimum de chiffre d''affaires de {{min_ca}} € HT, incluant l''ensemble des prestations nourriture et boissons.

Nous serons ravis de vous accompagner afin de trouver le format le plus adapté à votre événement.

Souhaitez-vous recevoir un devis dans ce sens ?

Je reste à votre disposition pour toute question complémentaire.
Au plaisir de vous accueillir prochainement chez {{groupe}}.

Très belle journée,
{{signature}}', 30),

  ('privatisation', 'en', 'Full privatization',
   '{{restaurant}} — full privatization on {{date_evenement}}',
   'Hello {{prenom_client}},

Thank you for your interest in {{restaurant}}.
I confirm that the venue is available on {{date_evenement}}.

Please find attached our presentation brochure including our different packages.

Considering the number of guests ({{nb_invites}} people), we would be able to offer you a full privatization of the restaurant, with a minimum spend requirement of €{{min_ca}} excluding VAT, including all food and beverage services.

We would be delighted to assist you in finding the format best suited to your event.

Would you like us to send you a quotation based on this option?

I remain at your disposal for any additional questions.
We look forward to welcoming you soon at {{groupe}}.

Have a wonderful day,
{{signature}}', 30),

  -- 4. CONFIRMATION MENU
  ('menu_confirmation', 'fr', 'Confirmation menu',
   'Confirmation menu — votre événement du {{date_evenement}}',
   'Bonjour {{prenom_client}},

J''espère que vous allez bien.

Vous trouverez ci-joint la confirmation de menu pour votre événement du {{date_evenement}}.

Afin de préparer au mieux votre réception, pourriez-vous nous transmettre :

- Les choix des convives au plus tard 72h avant l''événement (jusqu''à 29 personnes — menu unique à partir de 30 personnes) ou votre sélection de pièces cocktails
- Les éventuelles allergies ou restrictions alimentaires
- Votre horaire d''arrivée ainsi que toute contrainte horaire de départ
- Le contact présent sur place autorisé à valider d''éventuels extras (nom, prénom et numéro de portable)
- Le mode de règlement des extras : société ou règlement individuel des convives

Je reste naturellement à votre disposition pour toute question complémentaire.

Très belle journée,
{{signature}}', 40),

  ('menu_confirmation', 'en', 'Menu confirmation',
   'Menu confirmation — your event on {{date_evenement}}',
   'Hello {{prenom_client}},

I hope you are doing well.

Please find attached the menu confirmation for your event on {{date_evenement}}.

In order to prepare your reception in the best possible way, could you please provide us with the following information:

- Guests'' menu choices no later than 72 hours before the event (up to 29 guests — set menu required from 30 guests onwards) or your cocktail bites selection
- Any allergies or dietary restrictions
- Your arrival time as well as any departure time constraints
- The contact person on site authorized to approve any additional charges (first name, last name, and mobile number)
- The payment method for extras: company payment or individual guest payment

I remain of course at your disposal for any further questions.

Have a wonderful day,
{{signature}}', 40),

  -- 5. RELANCE
  ('relance', 'fr', 'Relance',
   '{{restaurant}} — suite à notre proposition',
   'Bonjour {{prenom_client}},

Je me permets de revenir vers vous à la suite de notre proposition envoyée précédemment pour {{restaurant}}.

Avez-vous bien reçu les éléments ? Je reste bien entendu disponible si vous souhaitez ajuster certains points ou échanger sur le format le plus adapté à votre événement.

Nous serions ravis de vous accompagner au sein de l''un de nos établissements du groupe {{groupe}}. Vous pouvez découvrir l''ensemble de nos restaurants sur notre site : {{site_groupe}}

Vous trouverez également en pièce jointe une sélection d''établissements disponibles à la date souhaitée et pouvant parfaitement correspondre à votre demande.

Je reste à votre disposition et serai ravi d''échanger avec vous.

Très belle journée,
{{signature}}', 50),

  ('relance', 'en', 'Follow-up',
   '{{restaurant}} — following up on our proposal',
   'Hello {{prenom_client}},

I am reaching out following up on the proposal we previously sent regarding {{restaurant}}.

Have you had the chance to review the information? Of course, I remain available should you wish to adjust certain details or discuss the format best suited to your event.

We would be delighted to assist you within one of the establishments of the {{groupe}} group. You can discover all of our restaurants on our website: {{site_groupe}}

Please also find attached a selection of venues available on your requested date and that could perfectly match your needs.

I remain at your disposal and would be delighted to speak with you.

Have a wonderful day,
{{signature}}', 50),

  -- 6. FEEDBACK
  ('feedback', 'fr', 'Feedback post-événement',
   'Merci pour votre événement chez {{restaurant}}',
   'Bonjour {{prenom_client}},

Nous tenions à vous remercier d''avoir choisi {{restaurant}} pour votre événement. Nous espérons que vous avez passé un excellent moment et que tout s''est déroulé comme vous le souhaitiez.

Vos retours sont précieux pour nos équipes, alors n''hésitez pas à nous faire part de votre expérience.

Nous serions également ravis de vous accompagner pour vos prochains événements au sein des établissements du groupe {{groupe}}. Vous pouvez découvrir l''ensemble de nos adresses sur notre site : {{site_groupe}}

Au plaisir de vous accueillir de nouveau très prochainement.

Très belle journée,
{{signature}}', 60),

  ('feedback', 'en', 'Post-event feedback',
   'Thank you for your event at {{restaurant}}',
   'Hello {{prenom_client}},

We would like to thank you for choosing {{restaurant}} for your event. We hope you had a wonderful time and that everything went exactly as you wished.

Your feedback is extremely valuable to our teams, so please do not hesitate to share your experience with us.

We would also be delighted to assist you with your future events within the {{groupe}} group establishments. You can discover all of our venues on our website: {{site_groupe}}

We look forward to welcoming you again very soon.

Have a wonderful day,
{{signature}}', 60)
) AS t(slug, lang, label, subject, body, sort_order)
ON CONFLICT (organization_id, slug, lang) DO NOTHING;
