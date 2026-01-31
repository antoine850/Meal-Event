// Mock data for MealEvent Restaurant CRM Dashboard

// Restaurants
export const restaurants = [
  { id: 1, name: 'Le Petit Bistro', city: 'Paris' },
  { id: 2, name: 'La Grande Table', city: 'Lyon' },
  { id: 3, name: 'Chez Marcel', city: 'Marseille' },
  { id: 4, name: 'L\'Atelier Gourmand', city: 'Bordeaux' },
]

// Commercials
export const commercials = [
  { id: 1, name: 'Sophie Martin', avatar: '/avatars/01.png', initials: 'SM' },
  { id: 2, name: 'Lucas Dubois', avatar: '/avatars/02.png', initials: 'LD' },
  { id: 3, name: 'Emma Bernard', avatar: '/avatars/03.png', initials: 'EB' },
  { id: 4, name: 'Thomas Petit', avatar: '/avatars/04.png', initials: 'TP' },
]

// Acquisition sources
export const acquisitionSources = [
  { id: 'instagram', name: 'Instagram', color: '#E4405F' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2' },
  { id: 'google', name: 'Google Ads', color: '#4285F4' },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366' },
  { id: 'organic', name: 'Organique', color: '#6B7280' },
  { id: 'referral', name: 'Parrainage', color: '#8B5CF6' },
]

// Monthly sales data by restaurant
export const monthlySalesByRestaurant = [
  { month: 'Jan', 'Le Petit Bistro': 45000, 'La Grande Table': 62000, 'Chez Marcel': 38000, 'L\'Atelier Gourmand': 51000 },
  { month: 'Fév', 'Le Petit Bistro': 52000, 'La Grande Table': 58000, 'Chez Marcel': 42000, 'L\'Atelier Gourmand': 48000 },
  { month: 'Mar', 'Le Petit Bistro': 48000, 'La Grande Table': 71000, 'Chez Marcel': 45000, 'L\'Atelier Gourmand': 55000 },
  { month: 'Avr', 'Le Petit Bistro': 61000, 'La Grande Table': 68000, 'Chez Marcel': 51000, 'L\'Atelier Gourmand': 62000 },
  { month: 'Mai', 'Le Petit Bistro': 55000, 'La Grande Table': 75000, 'Chez Marcel': 48000, 'L\'Atelier Gourmand': 58000 },
  { month: 'Juin', 'Le Petit Bistro': 67000, 'La Grande Table': 82000, 'Chez Marcel': 56000, 'L\'Atelier Gourmand': 71000 },
]

// Sales by commercial
export const salesByCommercial = [
  { name: 'Sophie Martin', sales: 156000, bookings: 89, conversionRate: 78 },
  { name: 'Lucas Dubois', sales: 142000, bookings: 76, conversionRate: 72 },
  { name: 'Emma Bernard', sales: 128000, bookings: 68, conversionRate: 81 },
  { name: 'Thomas Petit', sales: 98000, bookings: 52, conversionRate: 69 },
]

// Monthly performance by commercial
export const monthlyPerformanceByCommercial = [
  { month: 'Jan', 'Sophie Martin': 24000, 'Lucas Dubois': 22000, 'Emma Bernard': 19000, 'Thomas Petit': 15000 },
  { month: 'Fév', 'Sophie Martin': 26000, 'Lucas Dubois': 24000, 'Emma Bernard': 21000, 'Thomas Petit': 16000 },
  { month: 'Mar', 'Sophie Martin': 28000, 'Lucas Dubois': 25000, 'Emma Bernard': 23000, 'Thomas Petit': 17000 },
  { month: 'Avr', 'Sophie Martin': 25000, 'Lucas Dubois': 23000, 'Emma Bernard': 22000, 'Thomas Petit': 16000 },
  { month: 'Mai', 'Sophie Martin': 27000, 'Lucas Dubois': 24000, 'Emma Bernard': 21000, 'Thomas Petit': 17000 },
  { month: 'Juin', 'Sophie Martin': 26000, 'Lucas Dubois': 24000, 'Emma Bernard': 22000, 'Thomas Petit': 17000 },
]

// Marketing data - leads and bookings by source
export const marketingBySource = [
  { source: 'Instagram', leads: 245, bookings: 89, conversionRate: 36.3, revenue: 156000 },
  { source: 'Facebook', leads: 189, bookings: 62, conversionRate: 32.8, revenue: 108000 },
  { source: 'Google Ads', leads: 156, bookings: 58, conversionRate: 37.2, revenue: 98000 },
  { source: 'WhatsApp', leads: 98, bookings: 45, conversionRate: 45.9, revenue: 78000 },
  { source: 'Organique', leads: 134, bookings: 52, conversionRate: 38.8, revenue: 89000 },
  { source: 'Parrainage', leads: 67, bookings: 34, conversionRate: 50.7, revenue: 62000 },
]

// Monthly leads by source
export const monthlyLeadsBySource = [
  { month: 'Jan', Instagram: 38, Facebook: 28, 'Google Ads': 24, WhatsApp: 15, Organique: 21, Parrainage: 10 },
  { month: 'Fév', Instagram: 42, Facebook: 32, 'Google Ads': 26, WhatsApp: 16, Organique: 22, Parrainage: 11 },
  { month: 'Mar', Instagram: 45, Facebook: 35, 'Google Ads': 28, WhatsApp: 18, Organique: 24, Parrainage: 12 },
  { month: 'Avr', Instagram: 40, Facebook: 30, 'Google Ads': 25, WhatsApp: 16, Organique: 22, Parrainage: 11 },
  { month: 'Mai', Instagram: 38, Facebook: 32, 'Google Ads': 27, WhatsApp: 17, Organique: 23, Parrainage: 12 },
  { month: 'Juin', Instagram: 42, Facebook: 32, 'Google Ads': 26, WhatsApp: 16, Organique: 22, Parrainage: 11 },
]

// Recent bookings
export const recentBookings = [
  { id: 1, client: 'Marie Dupont', email: 'marie.dupont@email.com', restaurant: 'Le Petit Bistro', amount: 2450, date: '2024-01-15', status: 'confirmed', source: 'Instagram' },
  { id: 2, client: 'Jean-Pierre Martin', email: 'jp.martin@email.com', restaurant: 'La Grande Table', amount: 3200, date: '2024-01-14', status: 'paid', source: 'Google Ads' },
  { id: 3, client: 'Claire Leroy', email: 'claire.leroy@email.com', restaurant: 'Chez Marcel', amount: 1850, date: '2024-01-14', status: 'pending', source: 'WhatsApp' },
  { id: 4, client: 'François Moreau', email: 'f.moreau@email.com', restaurant: 'L\'Atelier Gourmand', amount: 4100, date: '2024-01-13', status: 'confirmed', source: 'Facebook' },
  { id: 5, client: 'Isabelle Roux', email: 'i.roux@email.com', restaurant: 'Le Petit Bistro', amount: 2800, date: '2024-01-13', status: 'paid', source: 'Parrainage' },
]

// KPIs
export const globalKPIs = {
  totalRevenue: 524000,
  revenueGrowth: 12.5,
  totalBookings: 285,
  bookingsGrowth: 8.3,
  averageTicket: 1838,
  ticketGrowth: 3.8,
  conversionRate: 38.2,
  conversionGrowth: 2.1,
}

export const restaurantKPIs = [
  { name: 'Le Petit Bistro', revenue: 128000, bookings: 72, avgTicket: 1778 },
  { name: 'La Grande Table', revenue: 156000, bookings: 85, avgTicket: 1835 },
  { name: 'Chez Marcel', revenue: 98000, bookings: 58, avgTicket: 1690 },
  { name: 'L\'Atelier Gourmand', revenue: 142000, bookings: 70, avgTicket: 2029 },
]
