import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirmation } from '@/hooks/use-confirmation'

import { Trash2, Edit, Plus } from 'lucide-react'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useToast } from '@/hooks/use-toast'

// Utility function to generate a safe value from a label that supports Unicode
function generateValue(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .normalize('NFKC')

  const sanitized = normalized
    .replace(/\s+/g, '-') // Replace whitespace with hyphens
    .replace(/[^-\p{L}\p{N}]/gu, '') // Keep letters/numbers (including CJK) and hyphens

  // Ensure we always return a non-empty value for API usage
  return sanitized || `option-${Date.now()}`
}

interface EditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  currentLabel: string
  onSave: (newName: string) => void
}

function EditDialog({ open, onOpenChange, title, currentLabel, onSave }: EditDialogProps) {
  const { t } = useTranslation(['common', 'settings'])
  const [name, setName] = useState(currentLabel)

  useEffect(() => {
    if (open) {
      setName(currentLabel)
    }
  }, [open, currentLabel])

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim()) {
      onSave(name.trim())
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('settings:editOptionTitle', { type: title })}</DialogTitle>
            <DialogDescription>
              {t('settings:editOptionDesc', { type: title.toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="name">{t('common:name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings:enterNamePlaceholder', { type: title.toLowerCase() })}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {t('common:save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface AddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onAdd: (name: string) => void
}

function AddDialog({ open, onOpenChange, title, onAdd }: AddDialogProps) {
  const { t } = useTranslation(['common', 'settings'])
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
    }
  }, [open])

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim()) {
      onAdd(name.trim())
      setName('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleAdd} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('settings:addOptionTitle', { type: title })}</DialogTitle>
            <DialogDescription>
              {t('settings:addOptionDesc', { type: title.toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-name">{t('common:name')}</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings:enterNamePlaceholder', { type: title.toLowerCase() })}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {t('settings:addOption', { type: title })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface OptionItemProps {
  value: string
  label: string
  onEdit: () => void
  onDelete: () => void
  canDelete?: boolean
}

function OptionItem({ value, label, onEdit, onDelete, canDelete = true }: OptionItemProps) {
  return (
    <div className="group relative rounded-2xl border bg-card px-3.5 py-3 transition-[border-color,background-color] duration-200 hover:border-foreground/20 hover:bg-accent/35">
      <div className="space-y-0.5 pr-14">
        <p className="truncate text-sm font-medium leading-5">{label}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {value}
        </p>
      </div>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-7 w-7"
          aria-label={`Edit ${label}`}
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function OptionsManager() {
  const { t } = useTranslation(['common', 'settings'])
  const { toast } = useToast()
  const {
    categories,
    paymentMethods,
    addCategory,
    editCategory,
    deleteCategory,
    addPaymentMethod,
    editPaymentMethod,
    deletePaymentMethod,
    fetchCategories,
    fetchPaymentMethods
  } = useSubscriptionStore()

  // Fetch data on component mount
  useEffect(() => {
    fetchCategories()
    fetchPaymentMethods()
  }, [fetchCategories, fetchPaymentMethods])

  // Dialog states
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    type: 'category' | 'payment'
    value: string
    label: string
  }>({ open: false, type: 'category', value: '', label: '' })

  const [addDialog, setAddDialog] = useState<{
    open: boolean
    type: 'category' | 'payment'
  }>({ open: false, type: 'category' })
  
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'payment'; value: string; label: string } | null>(null)

  const handleEdit = (type: 'category' | 'payment', value: string, label: string) => {
    setEditDialog({ open: true, type, value, label })
  }

  const handleSaveEdit = async (newName: string) => {
    const { type, value: oldValue } = editDialog
    const newValue = generateValue(newName)
    // Find the existing option to get its ID
    const existingOption = type === 'category'
      ? categories.find(cat => cat.value === oldValue)
      : paymentMethods.find(method => method.value === oldValue)

    if (!existingOption) {
      throw new Error(`${type} option not found`)
    }

    const newOption = { id: existingOption.id, value: newValue, label: newName }

    try {
      switch (type) {
        case 'category':
          await editCategory(oldValue, newOption)
          break
        case 'payment':
          await editPaymentMethod(oldValue, newOption)
          break
      }

      toast({
        title: t('settings:optionUpdated'),
        description: t('settings:optionUpdateSuccess', { type: t(`settings:${type}`) })
      })
    } catch {
      toast({
        title: t('common:error'),
        description: t('settings:errorUpdatingOption', { type: t(`settings:${type}`) }),
        variant: "destructive"
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    
    try {
      switch (deleteTarget.type) {
        case 'category':
          await deleteCategory(deleteTarget.value)
          break
        case 'payment':
          await deletePaymentMethod(deleteTarget.value)
          break
      }

      toast({
        title: t('settings:optionDeleted'),
        description: t('settings:optionDeleteSuccess', { type: t(`settings:${deleteTarget.type}`) })
      })
    } catch {
      toast({
        title: t('common:error'),
        description: t('settings:errorDeletingOption', { type: t(`settings:${deleteTarget.type}`) }),
        variant: "destructive"
      })
    }
    
    setDeleteTarget(null)
  }
  
  const deleteConfirmation = useConfirmation({
    title: deleteTarget?.type === 'category' ? t('settings:deleteCategory') : t('settings:deletePaymentMethod'),
    description: deleteTarget ? t('settings:deleteConfirmation', {
      name: deleteTarget.label,
      type: t(`settings:${deleteTarget.type}`)
    }) : "",
    confirmText: t('common:delete'),
    onConfirm: handleDelete,
  })
  
  const handleDeleteClick = (type: 'category' | 'payment', value: string, label: string) => {
    setDeleteTarget({ type, value, label })
    deleteConfirmation.openDialog()
  }

  const handleAdd = (type: 'category' | 'payment') => {
    setAddDialog({ open: true, type })
  }

  const handleSaveAdd = async (name: string) => {
    const { type } = addDialog
    const value = generateValue(name)
    // For new options, we don't need to provide an ID as the server will assign one
    const newOption = { id: 0, value, label: name }

    try {
      switch (type) {
        case 'category':
          await addCategory(newOption)
          break
        case 'payment':
          await addPaymentMethod(newOption)
          break
      }

      toast({
        title: t('settings:optionAdded'),
        description: t('settings:optionAddSuccess', { type: t(`settings:${type}`) })
      })
    } catch {
      toast({
        title: t('common:error'),
        description: t('settings:errorAddingOption', { type: t(`settings:${type}`) }),
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid h-8 w-full grid-cols-2 p-0.5 sm:inline-grid sm:w-fit sm:min-w-[200px]">
          <TabsTrigger value="categories" className="h-7 px-3 text-xs">{t('settings:categories')}</TabsTrigger>
          <TabsTrigger value="payment-methods" className="h-7 px-3 text-xs">{t('settings:paymentMethods')}</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{t('settings:categories')}</CardTitle>
                  <CardDescription>
                    {t('settings:manageCategoriesDesc')}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => handleAdd('category')}>
                  <Plus className="h-4 w-4" />
                  {t('settings:addCategory')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {categories.map((category) => (
                  <OptionItem
                    key={category.value}
                    value={category.value}
                    label={category.label}
                    onEdit={() => handleEdit('category', category.value, category.label)}
                    onDelete={() => handleDeleteClick('category', category.value, category.label)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-methods">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{t('settings:paymentMethods')}</CardTitle>
                  <CardDescription>
                    {t('settings:managePaymentMethodsDesc')}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => handleAdd('payment')}>
                  <Plus className="h-4 w-4" />
                  {t('settings:addPaymentMethod')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {paymentMethods.map((method) => (
                  <OptionItem
                    key={method.value}
                    value={method.value}
                    label={method.label}
                    onEdit={() => handleEdit('payment', method.value, method.label)}
                    onDelete={() => handleDeleteClick('payment', method.value, method.label)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Edit Dialog */}
      <EditDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog(prev => ({ ...prev, open }))}
        title={editDialog.type === 'category' ? t('settings:category') : editDialog.type === 'payment' ? t('settings:paymentMethod') : t('subscription:plan')}
        currentLabel={editDialog.label}
        onSave={handleSaveEdit}
      />

      {/* Add Dialog */}
      <AddDialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog(prev => ({ ...prev, open }))}
        title={addDialog.type === 'category' ? t('settings:category') : addDialog.type === 'payment' ? t('settings:paymentMethod') : t('subscription:plan')}
        onAdd={handleSaveAdd}
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </div>
  )
}
