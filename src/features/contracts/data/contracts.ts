import { faker } from '@faker-js/faker'

faker.seed(98765)

export const contractStatuses = [
  { value: 'draft', label: 'Brouillon', color: 'bg-gray-500' },
  { value: 'sent', label: 'Envoyé', color: 'bg-blue-500' },
  { value: 'signed', label: 'Signé', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Annulé', color: 'bg-red-500' },
] as const

export const invoiceStatuses = [
  { value: 'draft', label: 'Brouillon', color: 'bg-gray-500' },
  { value: 'sent', label: 'Envoyée', color: 'bg-blue-500' },
  { value: 'paid', label: 'Payée', color: 'bg-green-500' },
  { value: 'overdue', label: 'En retard', color: 'bg-red-500' },
  { value: 'partial', label: 'Partielle', color: 'bg-orange-500' },
] as const

export type ContractStatus = typeof contractStatuses[number]['value']
export type InvoiceStatus = typeof invoiceStatuses[number]['value']

export type Contract = {
  id: string
  number: string
  clientName: string
  clientEmail: string
  reservationId: string
  eventDate: Date
  eventType: string
  restaurant: string
  amountHT: number
  amountTTC: number
  status: ContractStatus
  createdAt: Date
  signedAt: Date | null
}

export type Invoice = {
  id: string
  number: string
  contractId: string
  clientName: string
  clientEmail: string
  restaurant: string
  amountHT: number
  amountTTC: number
  paidAmount: number
  status: InvoiceStatus
  dueDate: Date
  createdAt: Date
  paidAt: Date | null
}

const restaurants = [
  'Le Petit Bistro',
  'La Grande Table',
  'Chez Marcel',
  'L\'Atelier Gourmand',
  'Bistrot Là-Haut',
]

const eventTypes = [
  'Anniversaire',
  'Mariage',
  'Séminaire',
  'Dîner d\'équipe',
  'Cocktail',
  'Baptême',
]

export const contracts: Contract[] = Array.from({ length: 25 }, (_, i) => {
  const status = faker.helpers.arrayElement(contractStatuses).value
  const amountHT = faker.number.int({ min: 1500, max: 25000 })
  const createdAt = faker.date.past({ years: 1 })
  
  return {
    id: `contract-${i + 1}`,
    number: `CTR-2024-${String(i + 1).padStart(4, '0')}`,
    clientName: faker.company.name(),
    clientEmail: faker.internet.email(),
    reservationId: `RES-${1000 + i}`,
    eventDate: faker.date.soon({ days: 90 }),
    eventType: faker.helpers.arrayElement(eventTypes),
    restaurant: faker.helpers.arrayElement(restaurants),
    amountHT,
    amountTTC: Math.round(amountHT * 1.2),
    status,
    createdAt,
    signedAt: status === 'signed' ? faker.date.between({ from: createdAt, to: new Date() }) : null,
  }
})

export const invoices: Invoice[] = Array.from({ length: 30 }, (_, i) => {
  const status = faker.helpers.arrayElement(invoiceStatuses).value
  const amountHT = faker.number.int({ min: 1500, max: 25000 })
  const amountTTC = Math.round(amountHT * 1.2)
  const createdAt = faker.date.past({ years: 1 })
  const dueDate = faker.date.soon({ days: 30, refDate: createdAt })
  
  let paidAmount = 0
  if (status === 'paid') paidAmount = amountTTC
  else if (status === 'partial') paidAmount = Math.round(amountTTC * faker.number.float({ min: 0.3, max: 0.7 }))
  
  return {
    id: `invoice-${i + 1}`,
    number: `FAC-2024-${String(i + 1).padStart(4, '0')}`,
    contractId: `contract-${faker.number.int({ min: 1, max: 25 })}`,
    clientName: faker.company.name(),
    clientEmail: faker.internet.email(),
    restaurant: faker.helpers.arrayElement(restaurants),
    amountHT,
    amountTTC,
    paidAmount,
    status,
    dueDate,
    createdAt,
    paidAt: status === 'paid' ? faker.date.between({ from: createdAt, to: new Date() }) : null,
  }
})

export const getContractStats = () => ({
  total: contracts.length,
  draft: contracts.filter(c => c.status === 'draft').length,
  sent: contracts.filter(c => c.status === 'sent').length,
  signed: contracts.filter(c => c.status === 'signed').length,
  totalAmount: contracts.filter(c => c.status === 'signed').reduce((acc, c) => acc + c.amountTTC, 0),
})

export const getInvoiceStats = () => ({
  total: invoices.length,
  draft: invoices.filter(i => i.status === 'draft').length,
  sent: invoices.filter(i => i.status === 'sent').length,
  paid: invoices.filter(i => i.status === 'paid').length,
  overdue: invoices.filter(i => i.status === 'overdue').length,
  totalPaid: invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amountTTC, 0),
  totalPending: invoices.filter(i => ['sent', 'overdue', 'partial'].includes(i.status)).reduce((acc, i) => acc + (i.amountTTC - i.paidAmount), 0),
})
