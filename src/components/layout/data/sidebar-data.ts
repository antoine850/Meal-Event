import {
  LayoutDashboard,
  Monitor,
  Contact,
  HelpCircle,
  Bell,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Users,
  Command,
  CalendarDays,
  FileText,
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
          title: 'Réservations',
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
          badge: 'Soon',
          items: [
            {
              title: 'Profil',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Compte',
              url: '/settings/account',
              icon: Wrench,
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
