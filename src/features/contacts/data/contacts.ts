import { faker } from '@faker-js/faker'

faker.seed(54321)

export const contactStatuses = [
  { value: 'nouveau', label: 'Nouveau', color: 'bg-red-500' },
  { value: 'qualification', label: 'Qualification', color: 'bg-orange-500' },
  { value: 'proposition', label: 'Proposition', color: 'bg-yellow-500' },
  { value: 'negociation', label: 'Négociation', color: 'bg-lime-500' },
  { value: 'confirme', label: 'Confirmé / Fon...', color: 'bg-green-500' },
  { value: 'fonction_envoyee', label: 'Fonction envoy...', color: 'bg-teal-500' },
  { value: 'a_facturer', label: 'A facturer', color: 'bg-blue-500' },
  { value: 'attente_paiement', label: 'Attente paiem...', color: 'bg-purple-500' },
  { value: 'relance_paiement', label: 'Relance paiem...', color: 'bg-pink-500' },
] as const

export type ContactStatus = typeof contactStatuses[number]['value']

export const espaces = [
  'Salle principale',
  'Terrasse',
  'Salon privé',
  'Rooftop',
  'Cave à vin',
  'Espace à définir',
] as const

export const occasions = [
  'Anniversaire',
  'Mariage',
  'Séminaire',
  'Dîner d\'équipe',
  'Cocktail',
  'Baptême',
  'Communion',
  'Réunion famille',
  'Événement corporate',
  'Soirée privée',
] as const

export const restaurants = [
  'Le Petit Bistro',
  'La Grande Table',
  'Chez Marcel',
  'L\'Atelier Gourmand',
  'Bistrot Là-Haut',
] as const

export const commerciaux = [
  'Sophie Martin',
  'Lucas Dubois',
  'Emma Bernard',
  'Thomas Petit',
] as const

export type Contact = {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  date: Date
  time: string
  espace: string
  occasion: string
  guests: number
  devisHT: number | null
  facturesHT: number | null
  status: ContactStatus
  assignee: string
  restaurant: string
  relanceDate: Date | null
  createdAt: Date
  notes: string
}

export const contacts: Contact[] = Array.from({ length: 30 }, (_, i) => {
  const status = faker.helpers.arrayElement(contactStatuses).value
  const hasDevis = ['proposition', 'negociation', 'confirme', 'fonction_envoyee', 'a_facturer', 'attente_paiement', 'relance_paiement'].includes(status)
  const hasFacture = ['a_facturer', 'attente_paiement', 'relance_paiement'].includes(status)
  const needsRelance = ['attente_paiement', 'relance_paiement'].includes(status)
  
  return {
    id: `RES-${1000 + i}`,
    companyName: faker.company.name(),
    contactName: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number({ style: 'national' }),
    date: faker.date.soon({ days: 60 }),
    time: `${faker.number.int({ min: 11, max: 21 })}:${faker.helpers.arrayElement(['00', '30'])}`,
    espace: faker.helpers.arrayElement(espaces),
    occasion: faker.helpers.arrayElement(occasions),
    guests: faker.number.int({ min: 8, max: 120 }),
    devisHT: hasDevis ? faker.number.int({ min: 800, max: 15000 }) : null,
    facturesHT: hasFacture ? faker.number.int({ min: 800, max: 15000 }) : null,
    status,
    assignee: faker.helpers.arrayElement(commerciaux),
    restaurant: faker.helpers.arrayElement(restaurants),
    relanceDate: needsRelance ? faker.date.recent({ days: 30 }) : null,
    createdAt: faker.date.past({ years: 1 }),
    notes: faker.lorem.sentence(),
  }
})

// Count contacts by status
export const getStatusCounts = () => {
  return contactStatuses.map(status => ({
    ...status,
    count: contacts.filter(c => c.status === status.value).length,
  }))
}
