import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  bucket?: string
  folder?: string
  maxSizeMB?: number
  maxWidthOrHeight?: number
  className?: string
  placeholder?: string
  aspectRatio?: 'square' | 'video' | 'auto'
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'restaurant-images',
  folder = 'uploads',
  maxSizeMB = 1,
  maxWidthOrHeight = 1920,
  className,
  placeholder = 'Cliquez ou glissez une image',
  aspectRatio = 'auto',
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const options = {
        maxSizeMB,
        maxWidthOrHeight,
        useWebWorker: true,
        fileType: 'image/webp' as const,
      }

      const compressedFile = await imageCompression(file, options)
      
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      onChange(publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Erreur lors de l\'upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleRemove = async () => {
    if (value) {
      try {
        const url = new URL(value)
        const pathParts = url.pathname.split('/')
        const bucketIndex = pathParts.indexOf(bucket)
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/')
          await supabase.storage.from(bucket).remove([filePath])
        }
      } catch {
        // Ignore errors when removing
      }
    }
    onChange('')
  }

  return (
    <div className={cn('space-y-2', className)}>
      {value ? (
        <div className='relative group'>
          <img
            src={value}
            alt='Uploaded'
            className={cn(
              'rounded-lg border bg-muted/50',
              aspectRatio === 'square' && 'aspect-square w-32 object-contain',
              aspectRatio === 'video' && 'aspect-video w-full object-cover',
              aspectRatio === 'auto' && 'h-40 w-full object-cover'
            )}
          />
          <Button
            type='button'
            variant='destructive'
            size='icon'
            className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'
            onClick={handleRemove}
          >
            <X className='h-4 w-4' />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
            isUploading && 'pointer-events-none opacity-50',
            aspectRatio === 'square' && 'w-32 aspect-square flex items-center justify-center'
          )}
        >
          <input
            ref={inputRef}
            type='file'
            accept='image/*'
            onChange={handleInputChange}
            className='hidden'
          />
          {isUploading ? (
            <div className='flex flex-col items-center gap-2'>
              <Loader2 className={cn('animate-spin text-muted-foreground', aspectRatio === 'square' ? 'h-6 w-6' : 'h-8 w-8')} />
              {aspectRatio !== 'square' && <p className='text-sm text-muted-foreground'>Compression et upload...</p>}
            </div>
          ) : (
            <div className='flex flex-col items-center gap-1'>
              {isDragging ? (
                <Upload className={cn('text-primary', aspectRatio === 'square' ? 'h-6 w-6' : 'h-8 w-8')} />
              ) : (
                <ImageIcon className={cn('text-muted-foreground', aspectRatio === 'square' ? 'h-6 w-6' : 'h-8 w-8')} />
              )}
              {aspectRatio !== 'square' && (
                <>
                  <p className='text-sm text-muted-foreground'>{placeholder}</p>
                  <p className='text-xs text-muted-foreground'>PNG, JPG, WebP (max {maxSizeMB}MB)</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {error && <p className='text-sm text-destructive'>{error}</p>}
    </div>
  )
}
