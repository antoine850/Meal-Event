import { createContext, useContext, useEffect, useState } from 'react'
import { type User, type Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Organization, User as DbUser, Role } from '@/lib/supabase/types'

type AuthUser = {
  id: string
  email: string
  dbUser: DbUser | null
  organization: Organization | null
  role: Role | null
}

type AuthContextType = {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null; user: User | null }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUserData = async (authUser: User) => {
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select(`
          *,
          role:roles (*),
          organization:organizations (*)
        `)
        .eq('id', authUser.id)
        .single()

      if (dbUser) {
        const userData = dbUser as DbUser & { organization: Organization; role: Role }
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          dbUser: userData,
          organization: userData.organization,
          role: userData.role,
        })
      } else {
        // User exists in auth but not in users table (needs onboarding)
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          dbUser: null,
          organization: null,
          role: null,
        })
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        dbUser: null,
        organization: null,
        role: null,
      })
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchUserData(session.user)
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session?.user) {
          await fetchUserData(session.user)
        } else {
          setUser(null)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error: error as Error | null, user: data.user }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const refreshUser = async () => {
    if (session?.user) {
      await fetchUserData(session.user)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
