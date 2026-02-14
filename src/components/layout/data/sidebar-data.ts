import {
  LayoutDashboard,
  Monitor,
  Contact,
  HelpCircle,
  Bell,
  Palette,
  Settings,
  Users,
  Command,
  CalendarDays,
  FileText,
  Building2,
  Store,
  MapPin,
  Clock,
  Tags,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Antoine',
    email: 'antoine@mealevent.com',
    avatar: '/avatars/default.jpg',
  },
  teams: [
    {
      name: 'MealEvent',
      logo: Command,
      plan: 'Restaurant CRM',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Contacts',
          url: '/tasks',
          icon: Contact,
        },
        {
          title: 'Événements',
          url: '/reservations',
          icon: CalendarDays,
        },
        {
          title: 'Contrats & Factures',
          url: '/contracts',
          icon: FileText,
        },
      ],
    },
  ],
  footerGroups: [
    {
      title: 'Paramètres',
      items: [
        {
          title: 'Paramètres',
          icon: Settings,
          items: [
            {
              title: 'Organisation',
              url: '/settings',
              icon: Building2,
            },
            {
              title: 'Restaurants',
              url: '/settings/restaurants',
              icon: Store,
            },
            {
              title: 'Espaces',
              url: '/settings/spaces',
              icon: MapPin,
            },
            {
              title: 'Créneaux',
              url: '/settings/time-slots',
              icon: Clock,
            },
            {
              title: 'Statuts',
              url: '/settings/statuses',
              icon: Tags,
            },
            {
              title: 'Apparence',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Affichage',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'Utilisateurs',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Aide',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
