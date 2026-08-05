-- Fin du pilote Gmail : une boite fraichement connectee envoie desormais
-- reellement depuis Gmail. La colonne reste comme coupe-circuit par boite
-- (repasser a false a la main si une boite deraille).
ALTER TABLE user_gmail_accounts ALTER COLUMN sending_enabled SET DEFAULT true;
UPDATE user_gmail_accounts SET sending_enabled = true WHERE sending_enabled = false;

-- Signature email personnelle, attachee a la personne (survit a une
-- deconnexion Gmail, sert aussi aux envois Resend).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature TEXT;
