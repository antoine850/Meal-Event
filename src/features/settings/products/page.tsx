import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Edit, Loader2, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  type ProductWithRestaurants,
  type PackageWithRelations,
  PRODUCT_TYPES,
  useProducts,
  useDeleteProduct,
  usePackages,
  useDeletePackage,
} from '../hooks/use-products'
import { ProductDialog } from './product-dialog'
import { PackageDialog } from './package-dialog'

export function ProductsPage() {
  const { data: products = [], isLoading: isLoadingProducts } = useProducts()
  const { data: packages = [], isLoading: isLoadingPackages } = usePackages()
  const { mutate: deleteProduct } = useDeleteProduct()
  const { mutate: deletePackage } = useDeletePackage()

  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithRestaurants | null>(null)
  const [duplicatingProduct, setDuplicatingProduct] = useState<ProductWithRestaurants | null>(null)

  // Package dialog state
  const [packageDialogOpen, setPackageDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<PackageWithRelations | null>(null)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'package'; id: string; name: string } | null>(null)

  const handleNewProduct = () => {
    setEditingProduct(null)
    setDuplicatingProduct(null)
    setProductDialogOpen(true)
  }

  const handleEditProduct = (product: ProductWithRestaurants) => {
    setEditingProduct(product)
    setDuplicatingProduct(null)
    setProductDialogOpen(true)
  }

  const handleDuplicateProduct = (product: ProductWithRestaurants) => {
    setEditingProduct(null)
    setDuplicatingProduct(product)
    setProductDialogOpen(true)
  }

  const handleNewPackage = () => {
    setEditingPackage(null)
    setPackageDialogOpen(true)
  }

  const handleEditPackage = (pkg: PackageWithRelations) => {
    setEditingPackage(pkg)
    setPackageDialogOpen(true)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'product') {
      deleteProduct(deleteTarget.id, {
        onSuccess: () => toast.success('Produit supprimé'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    } else {
      deletePackage(deleteTarget.id, {
        onSuccess: () => toast.success('Package supprimé'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    }
    setDeleteTarget(null)
  }

  const isLoading = isLoadingProducts || isLoadingPackages

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue='products'>
        <TabsList className='mb-4'>
          <TabsTrigger value='products' className='gap-1.5'>
            <ShoppingCart className='h-4 w-4' />
            Produits ({products.length})
          </TabsTrigger>
          <TabsTrigger value='packages' className='gap-1.5'>
            <Package className='h-4 w-4' />
            Packages ({packages.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Products Tab ── */}
        <TabsContent value='products'>
          <div className='flex justify-end mb-4'>
            <Button size='sm' onClick={handleNewProduct} className='gap-1.5'>
              <Plus className='h-4 w-4' />
              Nouveau produit
            </Button>
          </div>

          {products.length === 0 ? (
            <Card>
              <CardContent className='py-8 text-center text-muted-foreground'>
                Aucun produit pour le moment.
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-2'>
              {PRODUCT_TYPES.map(typeInfo => {
                const typeProducts = products.filter(p => p.type === typeInfo.value)
                if (typeProducts.length === 0) return null
                return (
                  <Card key={typeInfo.value}>
                    <CardHeader className='py-3'>
                      <CardTitle className='text-sm font-semibold'>{typeInfo.label} ({typeProducts.length})</CardTitle>
                    </CardHeader>
                    <CardContent className='p-0'>
                      <div className='divide-y'>
                        {typeProducts.map(product => (
                          <div key={product.id} className='flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors'>
                            <div className='flex items-center gap-3 min-w-0 flex-1'>
                              <div className='min-w-0'>
                                <div className='flex items-center gap-2'>
                                  <span className='text-sm font-medium truncate'>{product.name}</span>
                                  {!product.is_active && <Badge variant='secondary' className='text-[10px]'>Inactif</Badge>}
                                  {product.price_per_person && <Badge variant='outline' className='text-[10px]'>Par pers.</Badge>}
                                </div>
                                <div className='flex items-center gap-2 mt-0.5'>
                                  <span className='text-xs text-muted-foreground'>{product.unit_price_ht}€ HT</span>
                                  <span className='text-xs text-muted-foreground'>TVA {product.tva_rate}%</span>
                                  <span className='text-xs font-medium'>{product.unit_price_ttc}€ TTC</span>
                                  {product.margin > 0 && <span className='text-xs text-green-600'>Marge {product.margin}%</span>}
                                </div>
                              </div>
                              <div className='flex flex-wrap gap-1 ml-auto mr-2'>
                                {product.product_restaurants?.map(pr => (
                                  <Badge key={pr.restaurant_id} variant='secondary' className='text-[10px]'>
                                    <div
                                      className='h-1.5 w-1.5 rounded-full mr-1'
                                      style={{ backgroundColor: pr.restaurant?.color || '#ccc' }}
                                    />
                                    {pr.restaurant?.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className='flex items-center gap-1 shrink-0'>
                              <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => handleDuplicateProduct(product)} title='Dupliquer'>
                                <Copy className='h-3.5 w-3.5' />
                              </Button>
                              <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => handleEditProduct(product)} title='Modifier'>
                                <Edit className='h-3.5 w-3.5' />
                              </Button>
                              <Button size='icon' variant='ghost' className='h-7 w-7 text-destructive hover:text-destructive' onClick={() => setDeleteTarget({ type: 'product', id: product.id, name: product.name })} title='Supprimer'>
                                <Trash2 className='h-3.5 w-3.5' />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Packages Tab ── */}
        <TabsContent value='packages'>
          <div className='flex justify-end mb-4'>
            <Button size='sm' onClick={handleNewPackage} className='gap-1.5'>
              <Plus className='h-4 w-4' />
              Nouveau package
            </Button>
          </div>

          {packages.length === 0 ? (
            <Card>
              <CardContent className='py-8 text-center text-muted-foreground'>
                Aucun package pour le moment.
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-2'>
              {packages.map(pkg => {
                const totalHt = pkg.package_products?.reduce((sum, pp) => {
                  return sum + ((pp.product as any)?.unit_price_ht || 0) * pp.quantity
                }, 0) || 0
                return (
                  <Card key={pkg.id}>
                    <div className='flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-medium'>{pkg.name}</span>
                          {!pkg.is_active && <Badge variant='secondary' className='text-[10px]'>Inactif</Badge>}
                          <Badge variant='outline' className='text-[10px]'>{pkg.package_products?.length || 0} produits</Badge>
                        </div>
                        {pkg.description && <p className='text-xs text-muted-foreground mt-0.5 truncate'>{pkg.description}</p>}
                        <div className='flex items-center gap-2 mt-1'>
                          <span className='text-xs font-medium'>Total HT: {totalHt.toFixed(2)}€</span>
                          <div className='flex gap-1 ml-2'>
                            {pkg.package_restaurants?.map(pr => (
                              <Badge key={pr.restaurant_id} variant='secondary' className='text-[10px]'>
                                <div
                                  className='h-1.5 w-1.5 rounded-full mr-1'
                                  style={{ backgroundColor: pr.restaurant?.color || '#ccc' }}
                                />
                                {pr.restaurant?.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {pkg.package_products && pkg.package_products.length > 0 && (
                          <div className='flex flex-wrap gap-1 mt-1.5'>
                            {pkg.package_products.map(pp => (
                              <span key={pp.product_id} className='text-[10px] bg-muted rounded px-1.5 py-0.5'>
                                {(pp.product as any)?.name} ×{pp.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className='flex items-center gap-1 shrink-0'>
                        <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => handleEditPackage(pkg)} title='Modifier'>
                          <Edit className='h-3.5 w-3.5' />
                        </Button>
                        <Button size='icon' variant='ghost' className='h-7 w-7 text-destructive hover:text-destructive' onClick={() => setDeleteTarget({ type: 'package', id: pkg.id, name: pkg.name })} title='Supprimer'>
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        duplicateFrom={duplicatingProduct}
      />

      {/* Package Dialog */}
      <PackageDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        pkg={editingPackage}
        products={products}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.type === 'product' ? 'le produit' : 'le package'} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer &quot;{deleteTarget?.name}&quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
