import { Command } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import { useCurrentUser } from '@/hooks/use-current-user'
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

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { data: currentUser } = useCurrentUser()

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

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {sidebarData.footerGroups?.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
