// ── Email Templates for MealEvent CRM ──
// All templates are in French, HTML inline-styled, responsive
// Dynamic branding: restaurant logo, color, legal footer

interface RestaurantBranding {
  name: string
  logo_url?: string | null
  color?: string | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  email?: string | null
  siret?: string | null
  tva_number?: string | null
  iban?: string | null
  bic?: string | null
  bank_name?: string | null
  legal_name?: string | null
  legal_form?: string | null
  share_capital?: string | null
  rcs?: string | null
  siren?: string | null
}

interface ContactInfo {
  first_name: string
  last_name?: string | null
  email?: string | null
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} €`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function buildLegalFooter(r: RestaurantBranding): string {
  const parts: string[] = []
  if (r.legal_name || r.name) parts.push(r.legal_name || r.name)
  if (r.legal_form) parts.push(r.legal_form)
  if (r.share_capital) parts.push(`Capital: ${r.share_capital}`)
  if (r.address) parts.push(r.address)
  if (r.postal_code || r.city) parts.push(`${r.postal_code || ''} ${r.city || ''}`.trim())
  if (r.siren) parts.push(`SIREN: ${r.siren}`)
  if (r.rcs) parts.push(`RCS: ${r.rcs}`)
  if (r.siret) parts.push(`SIRET: ${r.siret}`)
  if (r.tva_number) parts.push(`TVA: ${r.tva_number}`)

  return parts.join(' — ')
}

function buildEmailWrapper(restaurant: RestaurantBranding, bodyContent: string): string {
  const color = restaurant.color || '#0d7377'
  const logoHtml = restaurant.logo_url
    ? `<img src="${restaurant.logo_url}" alt="${restaurant.name}" style="height:48px;width:auto;margin-bottom:12px;" />`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${restaurant.name}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f4f5;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:${color};padding:24px 32px;text-align:center;">
              ${logoHtml}
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${restaurant.name}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:20px 32px;border-top:1px solid #e5e5e5;">
              <p style="margin:0 0 8px;font-size:11px;color:#999;text-align:center;">
                ${buildLegalFooter(restaurant)}
              </p>
              ${restaurant.email ? `<p style="margin:0;font-size:11px;color:#999;text-align:center;">📧 ${restaurant.email}${restaurant.phone ? ` — 📞 ${restaurant.phone}` : ''}</p>` : ''}
              <p style="margin:8px 0 0;font-size:10px;color:#bbb;text-align:center;">
                Cet email a été envoyé automatiquement. Pour toute question, répondez directement à cet email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ═══════════════════════════════════════════════
// Template A: Envoi de Devis
// ═══════════════════════════════════════════════

export function buildQuoteEmailHtml(params: {
  restaurant: RestaurantBranding
  contact: ContactInfo
  quoteNumber: string
  totalTtc: number
  eventDate: string | null
  eventTitle: string | null
  commercialName?: string | null
  orderNumber?: string | null
}): string {
  const { restaurant, contact, quoteNumber, totalTtc, eventDate, eventTitle, commercialName, orderNumber } = params
  const color = restaurant.color || '#0d7377'

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      Veuillez trouver ci-joint votre devis <strong>n°${quoteNumber}</strong> pour votre événement
      ${eventTitle ? `<em>« ${eventTitle} »</em>` : ''}
      ${eventDate ? `du <strong>${formatDate(eventDate)}</strong>` : ''}
      chez <strong>${restaurant.name}</strong>.
    </p>

    <!-- Summary card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:16px;">
          <table width="100%">
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Devis n°</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${quoteNumber}</td>
            </tr>
            ${eventDate ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Date de l'événement</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${formatDate(eventDate)}</td>
            </tr>` : ''}
            ${orderNumber ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">N° commande</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${orderNumber}</td>
            </tr>` : ''}
            <tr>
              <td colspan="2" style="padding:8px 0 4px;"><hr style="border:none;border-top:1px solid #e5e7eb;" /></td>
            </tr>
            <tr>
              <td style="font-size:14px;font-weight:700;color:${color};padding:4px 0;">Montant total TTC</td>
              <td style="font-size:14px;font-weight:700;color:${color};text-align:right;padding:4px 0;">${formatCurrency(totalTtc)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      Le devis est joint à cet email au format PDF. N'hésitez pas à nous contacter pour toute question ou modification.
    </p>

    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#444;">
      Cordialement,
    </p>
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">
      ${commercialName || restaurant.name}
    </p>
  `

  return buildEmailWrapper(restaurant, body)
}

export function buildQuoteEmailSubject(quoteNumber: string, restaurantName: string): string {
  return `Votre devis ${quoteNumber} — ${restaurantName}`
}

// ═══════════════════════════════════════════════
// Template B: Facture d'acompte + Lien Stripe
// ═══════════════════════════════════════════════

export function buildDepositEmailHtml(params: {
  restaurant: RestaurantBranding
  contact: ContactInfo
  quoteNumber: string
  depositPercentage: number
  depositAmount: number
  totalTtc: number
  stripePaymentUrl: string
  eventDate: string | null
  commercialName?: string | null
  stripeEnabled?: boolean
  orderNumber?: string | null
}): string {
  const { restaurant, contact, quoteNumber, depositPercentage, depositAmount, stripePaymentUrl, eventDate, commercialName, stripeEnabled = true, orderNumber } = params
  const color = restaurant.color || '#0d7377'

  const bankSection = (restaurant.iban || restaurant.bic)
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#0369a1;">Paiement par virement bancaire</p>
          ${restaurant.bank_name ? `<p style="margin:0 0 4px;font-size:12px;color:#444;">Banque: <strong>${restaurant.bank_name}</strong></p>` : ''}
          ${restaurant.iban ? `<p style="margin:0 0 4px;font-size:12px;color:#444;">IBAN: <strong>${restaurant.iban}</strong></p>` : ''}
          ${restaurant.bic ? `<p style="margin:0 0 4px;font-size:12px;color:#444;">BIC: <strong>${restaurant.bic}</strong></p>` : ''}
          <p style="margin:4px 0 0;font-size:12px;color:#444;">Libellé: <strong>ACOMPTE-${quoteNumber}</strong></p>
        </td>
      </tr>
    </table>`
    : ''

  // Stripe CTA button (only shown if stripe is enabled)
  const stripeCta = stripeEnabled && stripePaymentUrl
    ? `
    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <a href="${stripePaymentUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${color};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
            Payer mon acompte
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#666;text-align:center;">
      Vous pouvez également effectuer un virement bancaire :
    </p>`
    : `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      Merci d'effectuer le règlement par virement bancaire :
    </p>`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      Veuillez trouver ci-dessous votre facture d'acompte pour le devis <strong>n°${quoteNumber}</strong>.
    </p>

    <!-- Amount card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
      <tr>
        <td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#666;">Montant de l'acompte (${depositPercentage}%)</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:${color};">${formatCurrency(depositAmount)}</p>
          ${eventDate ? `<p style="margin:8px 0 0;font-size:12px;color:#666;">Événement du ${formatDate(eventDate)}</p>` : ''}
          ${orderNumber ? `<p style="margin:4px 0 0;font-size:12px;color:#666;">N° commande: <strong>${orderNumber}</strong></p>` : ''}
        </td>
      </tr>
    </table>

    ${stripeCta}

    ${bankSection}

    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#444;">
      Cordialement,
    </p>
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">
      ${commercialName || restaurant.name}
    </p>
  `

  return buildEmailWrapper(restaurant, body)
}

export function buildDepositEmailSubject(quoteNumber: string, restaurantName: string): string {
  return `Facture d'acompte ${quoteNumber} — ${restaurantName}`
}

// ═══════════════════════════════════════════════
// Template C: Facture de solde + Lien Stripe
// ═══════════════════════════════════════════════

export function buildBalanceEmailHtml(params: {
  restaurant: RestaurantBranding
  contact: ContactInfo
  quoteNumber: string
  balanceAmount: number
  totalTtc: number
  stripePaymentUrl: string
  eventDate: string | null
  commercialName?: string | null
  stripeEnabled?: boolean
  orderNumber?: string | null
}): string {
  const { restaurant, contact, quoteNumber, balanceAmount, stripePaymentUrl, eventDate, commercialName, stripeEnabled = true, orderNumber } = params
  const color = restaurant.color || '#0d7377'

  const bankSection = (restaurant.iban || restaurant.bic)
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#0369a1;">Paiement par virement bancaire</p>
          ${restaurant.bank_name ? `<p style="margin:0 0 4px;font-size:12px;color:#444;">Banque: <strong>${restaurant.bank_name}</strong></p>` : ''}
          ${restaurant.iban ? `<p style="margin:0 0 4px;font-size:12px;color:#444;">IBAN: <strong>${restaurant.iban}</strong></p>` : ''}
          ${restaurant.bic ? `<p style="margin:0 0 4px;font-size:12px;color:#444;">BIC: <strong>${restaurant.bic}</strong></p>` : ''}
          <p style="margin:4px 0 0;font-size:12px;color:#444;">Libellé: <strong>SOLDE-${quoteNumber}</strong></p>
        </td>
      </tr>
    </table>`
    : ''

  // Stripe CTA button (only shown if stripe is enabled)
  const stripeCta = stripeEnabled && stripePaymentUrl
    ? `
    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <a href="${stripePaymentUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${color};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
            Payer le solde
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#666;text-align:center;">
      Vous pouvez également effectuer un virement bancaire :
    </p>`
    : `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      Merci d'effectuer le règlement par virement bancaire :
    </p>`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      ${eventDate
        ? `Nous vous remercions pour votre événement du <strong>${formatDate(eventDate)}</strong> chez <strong>${restaurant.name}</strong>.`
        : `Nous vous remercions pour votre événement chez <strong>${restaurant.name}</strong>.`
      }
      Veuillez trouver ci-joint votre facture de solde.
    </p>

    <!-- Amount card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#fffbeb;border-radius:8px;border:1px solid #fde68a;">
      <tr>
        <td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#666;">Montant du solde restant</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:${color};">${formatCurrency(balanceAmount)}</p>
          ${eventDate ? `<p style="margin:8px 0 0;font-size:12px;color:#666;">Événement du ${formatDate(eventDate)}</p>` : ''}
          ${orderNumber ? `<p style="margin:4px 0 0;font-size:12px;color:#666;">N° commande: <strong>${orderNumber}</strong></p>` : ''}
        </td>
      </tr>
    </table>

    ${stripeCta}

    ${bankSection}

    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#444;">
      Cordialement,
    </p>
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">
      ${commercialName || restaurant.name}
    </p>
  `

  return buildEmailWrapper(restaurant, body)
}

export function buildBalanceEmailSubject(quoteNumber: string, restaurantName: string): string {
  return `Facture de solde ${quoteNumber} — ${restaurantName}`
}

// ═══════════════════════════════════════════════
// Template D: Notification Commercial — Devis signé
// ═══════════════════════════════════════════════

export function buildSignatureNotificationHtml(params: {
  restaurant: RestaurantBranding
  commercialFirstName: string
  contactName: string
  quoteNumber: string
  totalTtc: number
  eventDate: string | null
  eventTitle: string | null
}): string {
  const { restaurant, commercialFirstName, contactName, quoteNumber, totalTtc, eventDate, eventTitle } = params
  const color = restaurant.color || '#0d7377'

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${commercialFirstName}</strong>,
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:28px;">&#9989;</p>
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#15803d;">Devis signé !</p>
          <p style="margin:0;font-size:14px;color:#444;">
            <strong>${contactName}</strong> vient de signer le devis <strong>n°${quoteNumber}</strong>
          </p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:16px;">
          <table width="100%">
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Client</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${contactName}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Devis</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${quoteNumber}</td>
            </tr>
            ${eventTitle ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Événement</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${eventTitle}</td>
            </tr>` : ''}
            ${eventDate ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Date</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${formatDate(eventDate)}</td>
            </tr>` : ''}
            <tr>
              <td colspan="2" style="padding:8px 0 4px;"><hr style="border:none;border-top:1px solid #e5e7eb;" /></td>
            </tr>
            <tr>
              <td style="font-size:14px;font-weight:700;color:${color};padding:4px 0;">Montant TTC</td>
              <td style="font-size:14px;font-weight:700;color:${color};text-align:right;padding:4px 0;">${formatCurrency(totalTtc)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">
      La facture d'acompte et le lien de paiement ont été envoyés automatiquement au client.
    </p>
  `

  return buildEmailWrapper(restaurant, body)
}

export function buildSignatureNotificationSubject(quoteNumber: string, contactName: string): string {
  return `Devis ${quoteNumber} signé par ${contactName}`
}

// ═══════════════════════════════════════════════
// Template E: Notification Commercial — Paiement reçu
// ═══════════════════════════════════════════════

export function buildPaymentNotificationHtml(params: {
  restaurant: RestaurantBranding
  commercialFirstName: string
  contactName: string
  amount: number
  paymentType: string
  quoteNumber: string | null
  eventDate: string | null
  eventTitle: string | null
  paymentMethod: string | null
}): string {
  const { restaurant, commercialFirstName, contactName, amount, paymentType, quoteNumber, eventDate, eventTitle, paymentMethod } = params
  const color = restaurant.color || '#0d7377'

  const typeLabel = paymentType === 'deposit' || paymentType === 'acompte' ? 'Acompte'
    : paymentType === 'balance' || paymentType === 'solde' ? 'Solde'
    : paymentType === 'extra' ? 'Extra'
    : 'Paiement'

  const methodLabel = paymentMethod === 'stripe' ? 'Stripe'
    : paymentMethod === 'bank_transfer' ? 'Virement'
    : paymentMethod === 'cash' ? 'Espèces'
    : paymentMethod === 'check' ? 'Chèque'
    : paymentMethod || 'Non précisé'

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Bonjour <strong>${commercialFirstName}</strong>,
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:28px;">&#128176;</p>
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#15803d;">${typeLabel} reçu !</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:${color};">${formatCurrency(amount)}</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:16px;">
          <table width="100%">
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Client</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${contactName}</td>
            </tr>
            ${quoteNumber ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Devis</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${quoteNumber}</td>
            </tr>` : ''}
            ${eventTitle ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Événement</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${eventTitle}</td>
            </tr>` : ''}
            ${eventDate ? `
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Date</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${formatDate(eventDate)}</td>
            </tr>` : ''}
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Type</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#666;padding:4px 0;">Méthode</td>
              <td style="font-size:12px;font-weight:600;text-align:right;padding:4px 0;">${methodLabel}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  return buildEmailWrapper(restaurant, body)
}

export function buildPaymentNotificationSubject(amount: number, contactName: string, paymentType: string): string {
  const typeLabel = paymentType === 'deposit' || paymentType === 'acompte' ? 'Acompte'
    : paymentType === 'balance' || paymentType === 'solde' ? 'Solde'
    : 'Paiement'
  return `${typeLabel} de ${amount.toFixed(2)} € reçu — ${contactName}`
}
