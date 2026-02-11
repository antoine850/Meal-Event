import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Organization, User as DbUser, Role } from '@/lib/supabase/types'

interface AuthUser {
  id: string
  email: string
  dbUser: DbUser | null
  organization: Organization | null
  role: Role | null
}

interface AuthState {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setSession: (session: Session | null) => void
  setIsLoading: (isLoading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, session: null, isLoading: false }),
}))
