import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentSection } from '../components/content-section'
import { useOrganization } from '../hooks/use-settings'

const API_BASE_URL = 'https://mealevent-api.onrender.com/api/v1'

type Endpoint = {
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  description: string
  params?: { name: string; type: string; required: boolean; description: string }[]
  queryParams?: { name: string; type: string; description: string }[]
  body?: string
  response?: string
}

const endpoints: { category: string; routes: Endpoint[] }[] = [
  {
    category: 'Restaurants',
    routes: [
      {
        method: 'GET',
        path: '/restaurants',
        description: 'Lister tous les restaurants de votre organisation.',
        response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Chou de Chanorier",
      "slug": "chou-de-chanorier-xxx",
      "address": "12 rue ...",
      "city": "Paris",
      "phone": "+33...",
      "is_active": true
    }
  ]
}`,
      },
      {
        method: 'GET',
        path: '/restaurants/:id',
        description: "Obtenir les détails d'un restaurant.",
        params: [{ name: 'id', type: 'UUID', required: true, description: 'ID du restaurant' }],
      },
    ],
  },
  {
    category: 'Contacts',
    routes: [
      {
        method: 'GET',
        path: '/contacts',
        description: 'Lister les contacts avec pagination et filtres.',
        queryParams: [
          { name: 'page', type: 'number', description: 'Page (défaut: 1)' },
          { name: 'per_page', type: 'number', description: 'Résultats par page (défaut: 20, max: 100)' },
          { name: 'email', type: 'string', description: 'Filtrer par email exact' },
          { name: 'phone', type: 'string', description: 'Filtrer par téléphone exact' },
          { name: 'search', type: 'string', description: 'Recherche par nom ou email' },
        ],
        response: `{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}`,
      },
      {
        method: 'GET',
        path: '/contacts/:id',
        description: "Obtenir les détails d'un contact.",
        params: [{ name: 'id', type: 'UUID', required: true, description: 'ID du contact' }],
      },
      {
        method: 'POST',
        path: '/contacts',
        description: 'Créer un nouveau contact.',
        body: `{
  "first_name": "Jean",
  "last_name": "Dupont",
  "email": "jean@example.com",
  "phone": "+33612345678",
  "client_type": "particulier",
  "company_name": "ACME"
}`,
      },
      {
        method: 'PATCH',
        path: '/contacts/:id',
        description: 'Modifier un contact existant.',
        params: [{ name: 'id', type: 'UUID', required: true, description: 'ID du contact' }],
        body: `{
  "first_name": "Jean-Pierre",
  "phone": "+33698765432"
}`,
      },
    ],
  },
  {
    category: 'Événements',
    routes: [
      {
        method: 'GET',
        path: '/bookings',
        description: 'Lister les événements avec pagination et filtres.',
        queryParams: [
          { name: 'page', type: 'number', description: 'Page (défaut: 1)' },
          { name: 'per_page', type: 'number', description: 'Résultats par page (défaut: 20, max: 100)' },
          { name: 'restaurant_id', type: 'UUID', description: 'Filtrer par restaurant' },
          { name: 'status_id', type: 'UUID', description: 'Filtrer par statut' },
          { name: 'contact_id', type: 'UUID', description: 'Filtrer par contact' },
          { name: 'date_from', type: 'date', description: "Date de début (format: YYYY-MM-DD)" },
          { name: 'date_to', type: 'date', description: 'Date de fin (format: YYYY-MM-DD)' },
        ],
      },
      {
        method: 'GET',
        path: '/bookings/:id',
        description: "Obtenir les détails complets d'un événement.",
        params: [{ name: 'id', type: 'UUID', required: true, description: "ID de l'événement" }],
      },
      {
        method: 'POST',
        path: '/bookings',
        description: "Créer un événement. Le contact est automatiquement trouvé par email ou créé s'il n'existe pas.",
        body: `{
  "restaurant_id": "uuid",
  "event_type": "repas-assis",
  "occasion": "Anniversaire",
  "event_date": "2026-04-15",
  "guests_count": 30,
  "contact": {
    "first_name": "Jean",
    "last_name": "Dupont",
    "email": "jean@example.com",
    "phone": "+33612345678"
  },
  "client_type": "particulier",
  "company_name": "ACME",
  "allergies": "Sans gluten",
  "special_requests": "Décoration anniversaire"
}`,
        response: `{
  "data": {
    "id": "uuid",
    "event_date": "2026-04-15",
    "guests_count": 30,
    "event_type": "repas-assis",
    "occasion": "Anniversaire",
    "source": "api",
    "contact_id": "uuid",
    "created_at": "2026-03-19T..."
  }
}`,
      },
      {
        method: 'PATCH',
        path: '/bookings/:id',
        description: 'Modifier un événement existant.',
        params: [{ name: 'id', type: 'UUID', required: true, description: "ID de l'événement" }],
        body: `{
  "guests_count": 40,
  "event_date": "2026-04-20",
  "status_id": "uuid"
}`,
      },
    ],
  },
  {
    category: 'Devis',
    routes: [
      {
        method: 'GET',
        path: '/quotes',
        description: 'Lister les devis avec pagination.',
        queryParams: [
          { name: 'page', type: 'number', description: 'Page (défaut: 1)' },
          { name: 'per_page', type: 'number', description: 'Résultats par page' },
          { name: 'booking_id', type: 'UUID', description: 'Filtrer par événement' },
          { name: 'status', type: 'string', description: 'Filtrer par statut (draft, sent, signed...)' },
        ],
      },
      {
        method: 'GET',
        path: '/quotes/:id',
        description: "Obtenir les détails complets d'un devis.",
        params: [{ name: 'id', type: 'UUID', required: true, description: 'ID du devis' }],
      },
    ],
  },
  {
    category: 'Paiements',
    routes: [
      {
        method: 'GET',
        path: '/payments',
        description: 'Lister les paiements avec pagination.',
        queryParams: [
          { name: 'page', type: 'number', description: 'Page (défaut: 1)' },
          { name: 'per_page', type: 'number', description: 'Résultats par page' },
          { name: 'booking_id', type: 'UUID', description: 'Filtrer par événement' },
          { name: 'status', type: 'string', description: 'Filtrer par statut (pending, paid, failed)' },
          { name: 'type', type: 'string', description: 'Filtrer par type (deposit, balance)' },
        ],
      },
    ],
  },
]

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className='absolute top-2 right-2 p-1 rounded hover:bg-muted'>
      {copied ? <Check className='h-3.5 w-3.5 text-green-600' /> : <Copy className='h-3.5 w-3.5 text-muted-foreground' />}
    </button>
  )
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className='border rounded-lg overflow-hidden'>
      <button
        onClick={() => setExpanded(!expanded)}
        className='w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left'
      >
        {expanded ? <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground' /> : <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />}
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColors[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <code className='text-sm font-mono'>{endpoint.path}</code>
        <span className='text-sm text-muted-foreground ml-auto hidden sm:block'>{endpoint.description}</span>
      </button>

      {expanded && (
        <div className='border-t px-4 py-3 space-y-3 bg-muted/20'>
          <p className='text-sm text-muted-foreground sm:hidden'>{endpoint.description}</p>

          {endpoint.params && (
            <div>
              <p className='text-xs font-medium mb-1'>Paramètres URL</p>
              <div className='space-y-1'>
                {endpoint.params.map((p) => (
                  <div key={p.name} className='flex items-center gap-2 text-xs'>
                    <code className='bg-muted px-1.5 py-0.5 rounded font-mono'>{p.name}</code>
                    <Badge variant='outline' className='text-[10px]'>{p.type}</Badge>
                    {p.required && <Badge variant='destructive' className='text-[10px]'>requis</Badge>}
                    <span className='text-muted-foreground'>{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.queryParams && (
            <div>
              <p className='text-xs font-medium mb-1'>Query Parameters</p>
              <div className='space-y-1'>
                {endpoint.queryParams.map((p) => (
                  <div key={p.name} className='flex items-center gap-2 text-xs'>
                    <code className='bg-muted px-1.5 py-0.5 rounded font-mono'>{p.name}</code>
                    <Badge variant='outline' className='text-[10px]'>{p.type}</Badge>
                    <span className='text-muted-foreground'>{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.body && (
            <div>
              <p className='text-xs font-medium mb-1'>Body (JSON)</p>
              <div className='relative'>
                <pre className='bg-muted rounded p-3 text-xs font-mono overflow-x-auto'>{endpoint.body}</pre>
                <CopyButton text={endpoint.body} />
              </div>
            </div>
          )}

          {endpoint.response && (
            <div>
              <p className='text-xs font-medium mb-1'>Réponse</p>
              <div className='relative'>
                <pre className='bg-muted rounded p-3 text-xs font-mono overflow-x-auto'>{endpoint.response}</pre>
                <CopyButton text={endpoint.response} />
              </div>
            </div>
          )}

          {/* cURL example */}
          <div>
            <p className='text-xs font-medium mb-1'>Exemple cURL</p>
            <CurlExample endpoint={endpoint} />
          </div>
        </div>
      )}
    </div>
  )
}

function CurlExample({ endpoint }: { endpoint: Endpoint }) {
  const path = endpoint.path.replace(':id', '<ID>')
  const url = `${API_BASE_URL}${path}`
  let curl = `curl -X ${endpoint.method} "${url}"`
  curl += ` \\\n  -H "Authorization: Bearer sk_live_VOTRE_CLE"`

  if (endpoint.body) {
    curl += ` \\\n  -H "Content-Type: application/json"`
    curl += ` \\\n  -d '${endpoint.body.replace(/\n\s*/g, ' ').trim()}'`
  }

  return (
    <div className='relative'>
      <pre className='bg-zinc-900 text-zinc-100 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap'>{curl}</pre>
      <CopyButton text={curl.replace(/\\\n\s*/g, ' ')} />
    </div>
  )
}

export function ApiDocsSettings() {
  const { data: organization } = useOrganization()

  return (
    <ContentSection
      title='Documentation API'
      desc='Référence complète des endpoints de votre API REST.'
    >
      {/* Auth section */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='text-base'>Authentification</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm text-muted-foreground'>
            Toutes les requêtes doivent inclure votre clé API dans le header <code className='bg-muted px-1.5 py-0.5 rounded text-xs'>Authorization</code>.
          </p>
          <div className='relative'>
            <pre className='bg-muted rounded p-3 text-xs font-mono'>Authorization: Bearer sk_live_VOTRE_CLE</pre>
            <CopyButton text='Authorization: Bearer sk_live_VOTRE_CLE' />
          </div>
          <div className='text-xs text-muted-foreground space-y-1'>
            <p>Base URL : <code className='bg-muted px-1.5 py-0.5 rounded'>{API_BASE_URL}</code></p>
            <p>Rate limit : <strong>100 requêtes / minute</strong></p>
            <p>Format : JSON (Content-Type: application/json)</p>
            {organization?.api_key_prefix && (
              <p>Votre clé active : <code className='bg-muted px-1.5 py-0.5 rounded'>{organization.api_key_prefix}</code></p>
            )}
            {!organization?.api_key_prefix && (
              <p className='text-yellow-600'>Aucune clé API active. Générez-en une dans Paramètres &gt; Organisation.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error format */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='text-base'>Format des erreurs</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className='bg-muted rounded p-3 text-xs font-mono'>{`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "restaurant_id is required"
  }
}`}</pre>
          <div className='mt-3 text-xs text-muted-foreground space-y-1'>
            <p><strong>401</strong> — Clé API invalide ou manquante</p>
            <p><strong>404</strong> — Ressource non trouvée</p>
            <p><strong>429</strong> — Rate limit dépassé</p>
            <p><strong>400</strong> — Erreur de validation</p>
            <p><strong>500</strong> — Erreur interne</p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      {endpoints.map((group) => (
        <div key={group.category} className='mb-6'>
          <h3 className='text-sm font-semibold mb-3'>{group.category}</h3>
          <div className='space-y-2'>
            {group.routes.map((endpoint) => (
              <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
            ))}
          </div>
        </div>
      ))}
    </ContentSection>
  )
}
