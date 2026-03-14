import { useMemo } from 'react'
import { Command } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePermissions } from '@/hooks/use-permissions'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import type { NavItem, NavGroup as NavGroupType } from './types'

// Map sidebar URLs to required permissions
const routePermissions: Record<string, string> = {
  '/contacts': 'contacts.view',
  '/companies': 'contacts.view',
  '/evenements': 'bookings.view',
  '/contracts': 'quotes.view',
  '/settings': 'settings.view',
  '/settings/restaurants': 'restaurants.view',
  '/settings/statuses': 'settings.view',
  '/settings/products': 'settings.view',
  '/settings/menus': 'settings.view',
  '/settings/members': 'users.view',
}

function filterNavItems(items: NavItem[], permissions: string[], isAdmin: boolean): NavItem[] {
  return items
    .map(item => {
      // Admin sees everything
      if (isAdmin) return item

      // Check if this URL requires a permission
      if (item.url && routePermissions[item.url]) {
        if (!permissions.includes(routePermissions[item.url])) return null
      }

      // Filter sub-items recursively
      if (item.items) {
        const filteredItems = filterNavItems(item.items, permissions, isAdmin)
        if (filteredItems.length === 0) return null
        return { ...item, items: filteredItems }
      }

      return item
    })
    .filter(Boolean) as NavItem[]
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { data: currentUser } = useCurrentUser()
  const { permissions, isAdmin } = usePermissions()

  const teams = currentUser?.organization
    ? [
        {
          name: currentUser.organization.name,
          logo: Command,
          plan: 'Restaurant CRM',
        },
      ]
    : sidebarData.teams

  const user = currentUser
    ? {
        name: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
        email: currentUser.email,
        avatar: currentUser.avatar_url || '/avatars/default.jpg',
      }
    : sidebarData.user

  const filteredNavGroups = useMemo(() => {
    return sidebarData.navGroups.map(group => ({
      ...group,
      items: filterNavItems(group.items, permissions, isAdmin),
    })).filter(g => g.items.length > 0)
  }, [permissions, isAdmin])

  const filteredFooterGroups = useMemo(() => {
    return (sidebarData.footerGroups || []).map(group => ({
      ...group,
      items: filterNavItems(group.items, permissions, isAdmin),
    })).filter(g => g.items.length > 0)
  }, [permissions, isAdmin])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        {filteredNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {filteredFooterGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
