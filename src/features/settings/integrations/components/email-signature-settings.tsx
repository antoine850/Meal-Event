import { useState } from 'react'
import DOMPurify from 'dompurify'
import { Loader2, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  useEmailSignature,
  useUpdateEmailSignature,
} from '../../hooks/use-email-signature'

const PLACEHOLDER = `Victor Lionnet
Chargé de projets événementiels
06 12 34 56 78
www.pasparisiens.com`

export function EmailSignatureSettings() {
  const { data, isLoading } = useEmailSignature()
  const { mutateAsync: save, isPending } = useUpdateEmailSignature()
  const [draft, setDraft] = useState<string | null>(null)

  const current = data?.signature ?? ''
  const value = draft ?? current
  const dirty = value !== current

  const handleSave = async () => {
    try {
      await save(value)
      setDraft(null)
      toast.success('Signature enregistrée.')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'enregistrement."
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <PenLine className='h-5 w-5' />
          <CardTitle>Signature email</CardTitle>
        </div>
        <CardDescription>
          Elle remplace votre nom au bas de tous les emails que vous envoyez
          depuis le CRM : devis, factures, relances et messages libres.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {isLoading ? (
          <div className='flex items-center justify-center py-6'>
            <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <>
            <Textarea
              rows={6}
              value={value}
              placeholder={PLACEHOLDER}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Laissez vide pour signer de votre prénom et nom. Sites, adresses
              email et numéros de téléphone deviennent cliquables.
            </p>

            {data?.preview_html && (
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Aperçu {dirty && '(enregistrez pour le mettre à jour)'}
                </p>
                <div
                  className='rounded-md border bg-muted/30 p-3'
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(data.preview_html, {
                      USE_PROFILES: { html: true },
                      FORBID_TAGS: ['style'],
                    }),
                  }}
                />
              </div>
            )}

            <Button onClick={handleSave} disabled={!dirty || isPending}>
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Enregistrer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
