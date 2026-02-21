import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { 
  Download, 
  ExternalLink, 
  FileText, 
  Receipt,
  Euro,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { 
  contracts, 
  invoices, 
  contractStatuses, 
  invoiceStatuses,
  getContractStats,
  getInvoiceStats,
} from './data/contracts'

export function Contracts() {
  const [activeTab, setActiveTab] = useState('contracts')
  const contractStats = getContractStats()
  const invoiceStats = getInvoiceStats()

  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Contrats & Factures</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className='flex items-center justify-between'>
            <TabsList>
              <TabsTrigger value='contracts' className='gap-2'>
                <FileText className='h-4 w-4' />
                Contrats
              </TabsTrigger>
              <TabsTrigger value='invoices' className='gap-2'>
                <Receipt className='h-4 w-4' />
                Factures
              </TabsTrigger>
            </TabsList>
            <Button>
              <Download className='mr-2 h-4 w-4' />
              Exporter
            </Button>
          </div>

          <TabsContent value='contracts' className='space-y-4 mt-4'>
            {/* Contract Stats */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Total Contrats</CardTitle>
                  <FileText className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{contractStats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Signés</CardTitle>
                  <CheckCircle className='h-4 w-4 text-green-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-green-600'>{contractStats.signed}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>En attente</CardTitle>
                  <Clock className='h-4 w-4 text-yellow-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-yellow-600'>{contractStats.sent}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>CA Contracté</CardTitle>
                  <Euro className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{contractStats.totalAmount.toLocaleString('fr-FR')} €</div>
                </CardContent>
              </Card>
            </div>

            {/* Contracts Table */}
            <Card>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Contrat</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Date événement</TableHead>
                      <TableHead className='text-right'>Montant TTC</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className='w-12'></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => {
                      const status = contractStatuses.find(s => s.value === contract.status)
                      return (
                        <TableRow key={contract.id}>
                          <TableCell className='font-medium'>{contract.number}</TableCell>
                          <TableCell>
                            <div>
                              <p className='font-medium text-sm'>{contract.clientName}</p>
                              <p className='text-xs text-muted-foreground'>{contract.clientEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className='text-sm'>{contract.restaurant}</TableCell>
                          <TableCell className='text-sm'>{contract.eventType}</TableCell>
                          <TableCell className='text-sm'>
                            {format(contract.eventDate, 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className='text-right font-medium'>
                            {contract.amountTTC.toLocaleString('fr-FR')} €
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant='outline' 
                              className={cn('text-xs', status?.color.replace('bg-', 'border-'))}
                            >
                              {status?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant='ghost' size='icon' className='h-8 w-8'>
                              <ExternalLink className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='invoices' className='space-y-4 mt-4'>
            {/* Invoice Stats */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Total Factures</CardTitle>
                  <Receipt className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{invoiceStats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Payées</CardTitle>
                  <CheckCircle className='h-4 w-4 text-green-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-green-600'>{invoiceStats.paid}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>En retard</CardTitle>
                  <AlertCircle className='h-4 w-4 text-red-500' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-red-600'>{invoiceStats.overdue}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>En attente</CardTitle>
                  <Euro className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{invoiceStats.totalPending.toLocaleString('fr-FR')} €</div>
                </CardContent>
              </Card>
            </div>

            {/* Invoices Table */}
            <Card>
              <CardContent className='p-0'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead className='text-right'>Montant TTC</TableHead>
                      <TableHead className='text-right'>Payé</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className='w-12'></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const status = invoiceStatuses.find(s => s.value === invoice.status)
                      const isOverdue = invoice.status === 'overdue'
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className='font-medium'>{invoice.number}</TableCell>
                          <TableCell>
                            <div>
                              <p className='font-medium text-sm'>{invoice.clientName}</p>
                              <p className='text-xs text-muted-foreground'>{invoice.clientEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className='text-sm'>{invoice.restaurant}</TableCell>
                          <TableCell className='text-right font-medium'>
                            {invoice.amountTTC.toLocaleString('fr-FR')} €
                          </TableCell>
                          <TableCell className='text-right'>
                            <span className={cn(
                              'font-medium',
                              invoice.paidAmount === invoice.amountTTC && 'text-green-600',
                              invoice.paidAmount > 0 && invoice.paidAmount < invoice.amountTTC && 'text-orange-600'
                            )}>
                              {invoice.paidAmount.toLocaleString('fr-FR')} €
                            </span>
                          </TableCell>
                          <TableCell className={cn('text-sm', isOverdue && 'text-red-600 font-medium')}>
                            {format(invoice.dueDate, 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant='outline' 
                              className={cn('text-xs', status?.color.replace('bg-', 'border-'))}
                            >
                              {status?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant='ghost' size='icon' className='h-8 w-8'>
                              <ExternalLink className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
