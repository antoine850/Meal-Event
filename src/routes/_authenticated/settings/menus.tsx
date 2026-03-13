import { createFileRoute } from '@tanstack/react-router'
import { SettingsMenus } from '@/features/settings/menus'

export const Route = createFileRoute('/_authenticated/settings/menus')({
  component: SettingsMenus,
})
