import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Package, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  useProducts,
  useDeleteProduct,
  usePackages,
  useDeletePackage,
} from '../hooks/use-products'
import { useRestaurants } from '../hooks/use-settings'
import { ProductDialog } from './product-dialog'
import { PackageDialog } from './package-dialog'
import { ProductsTable } from './products-table'
import { PackagesTable } from './packages-table'

export function ProductsPage() {
  const { data: products = [], isLoading: isLoadingProducts } = useProducts()
  const { data: packages = [], isLoading: isLoadingPackages } = usePackages()
  const { data: restaurants = [] } = useRestaurants()
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

  const handleEditProduct = useCallback((product: ProductWithRestaurants) => {
    setEditingProduct(product)
    setDuplicatingProduct(null)
    setProductDialogOpen(true)
  }, [])

  const handleDuplicateProduct = useCallback((product: ProductWithRestaurants) => {
    setEditingProduct(null)
    setDuplicatingProduct(product)
    setProductDialogOpen(true)
  }, [])

  const handleDeleteProduct = useCallback((product: ProductWithRestaurants) => {
    setDeleteTarget({ type: 'product', id: product.id, name: product.name })
  }, [])

  const handleNewPackage = () => {
    setEditingPackage(null)
    setPackageDialogOpen(true)
  }

  const handleEditPackage = useCallback((pkg: PackageWithRelations) => {
    setEditingPackage(pkg)
    setPackageDialogOpen(true)
  }, [])

  const handleDeletePackage = useCallback((pkg: PackageWithRelations) => {
    setDeleteTarget({ type: 'package', id: pkg.id, name: pkg.name })
  }, [])

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
        <div className='flex items-center justify-between mb-4'>
          <TabsList>
            <TabsTrigger value='products' className='gap-1.5'>
              <ShoppingCart className='h-4 w-4' />
              Produits ({products.length})
            </TabsTrigger>
            <TabsTrigger value='packages' className='gap-1.5'>
              <Package className='h-4 w-4' />
              Packages ({packages.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Products Tab ── */}
        <TabsContent value='products'>
          <ProductsTable
            data={products}
            restaurants={restaurants}
            onEdit={handleEditProduct}
            onDuplicate={handleDuplicateProduct}
            onDelete={handleDeleteProduct}
            actionButton={
              <Button size='sm' onClick={handleNewProduct} className='gap-1.5'>
                <Plus className='h-4 w-4' />
                Nouveau produit
              </Button>
            }
          />
        </TabsContent>

        {/* ── Packages Tab ── */}
        <TabsContent value='packages'>
          <PackagesTable
            data={packages}
            restaurants={restaurants}
            onEdit={handleEditPackage}
            onDelete={handleDeletePackage}
            actionButton={
              <Button size='sm' onClick={handleNewPackage} className='gap-1.5'>
                <Plus className='h-4 w-4' />
                Nouveau package
              </Button>
            }
          />
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
