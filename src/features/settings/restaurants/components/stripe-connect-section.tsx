import { toast } from 'sonner'
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, Loader2, Unlink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useIsOrgAdmin } from '@/hooks/use-is-org-admin'
import { useStartStripeConnect, useDisconnectStripe, useRefreshStripeStatus } from '../../hooks/use-stripe-connect'
import type { Restaurant } from '../../hooks/use-settings'

interface Props {
  restaurant: Restaurant
}

export function StripeConnectSection({ restaurant }: Props) {
  const { data: isAdmin } = useIsOrgAdmin()
  const startConnect = useStartStripeConnect()
  const disconnect = useDisconnectStripe()
  const refresh = useRefreshStripeStatus(restaurant.id)

  const isConnected = !!restaurant.stripe_account_id
  const hasIssue = isConnected && !restaurant.stripe_charges_enabled

  const handleConnect = () => {
    startConnect.mutate(restaurant.id, {
      onError: (err: Error) => toast.error(err instanceof Error ? err.message : 'Erreur de connexion Stripe'),
    })
  }

  const handleDisconnect = () => {
    disconnect.mutate(restaurant.id, {
      onSuccess: () => toast.success('Compte Stripe déconnecté'),
      onError: (err: Error) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la déconnexion'),
    })
  }

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => toast.success('Statut Stripe mis à jour'),
      onError: (err: Error) => toast.error(err instanceof Error ? err.message : 'Erreur de vérification'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.887 3.408 1.553 3.408 2.487 0 1.086-.952 1.687-2.460 1.687-1.960 0-4.722-.916-6.690-2.154l-.91 5.696c1.660 1.096 4.700 2.152 7.850 2.152 2.680 0 4.908-.688 6.355-1.979 1.542-1.354 2.314-3.298 2.314-5.573-.01-4.14-2.518-5.84-6.124-7.503z"/></svg>
          Compte Stripe
        </CardTitle>
        <CardDescription>
          Connectez le compte Stripe de ce restaurant pour recevoir les paiements directement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected && (
          <>
            <p className="text-sm text-muted-foreground">
              Aucun compte Stripe connecté. Les paiements utilisent le virement bancaire ou la clé plateforme.
            </p>
            {isAdmin ? (
              <Button onClick={handleConnect} disabled={startConnect.isPending}>
                {startConnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ExternalLink className="mr-2 h-4 w-4" />
                Connecter Stripe
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Seul un administrateur peut connecter Stripe.
              </p>
            )}
          </>
        )}

        {isConnected && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{restaurant.stripe_account_name || restaurant.stripe_account_id}</p>
              {restaurant.stripe_account_email && (
                <p className="text-xs text-muted-foreground">{restaurant.stripe_account_email}</p>
              )}
              {restaurant.stripe_connected_at && (
                <p className="text-xs text-muted-foreground">
                  Connecté le {new Date(restaurant.stripe_connected_at).toLocaleDateString('fr-FR')}
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Badge variant={restaurant.stripe_charges_enabled ? 'default' : 'destructive'} className="gap-1">
                  {restaurant.stripe_charges_enabled
                    ? <><CheckCircle2 className="h-3 w-3" /> Paiements actifs</>
                    : <><XCircle className="h-3 w-3" /> Paiements désactivés</>}
                </Badge>
                <Badge variant={restaurant.stripe_payouts_enabled ? 'default' : 'secondary'} className="gap-1">
                  {restaurant.stripe_payouts_enabled
                    ? <><CheckCircle2 className="h-3 w-3" /> Virements actifs</>
                    : <><AlertTriangle className="h-3 w-3" /> Virements suspendus</>}
                </Badge>
              </div>
            </div>

            {hasIssue && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {restaurant.stripe_disabled_reason
                    ? `Compte désactivé par Stripe : ${restaurant.stripe_disabled_reason}. Connectez-vous à votre dashboard Stripe pour compléter la vérification.`
                    : 'Les paiements sont désactivés. Connectez-vous à votre dashboard Stripe pour résoudre le problème.'}
                </AlertDescription>
              </Alert>
            )}

            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refresh.isPending}>
                  {refresh.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Vérifier le statut
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnect.isPending}>
                  {disconnect.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  <Unlink className="mr-2 h-3 w-3" />
                  Déconnecter
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
