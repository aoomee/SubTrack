import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  isDestructive?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  isDestructive = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] gap-4 p-5 sm:p-6">
        <DialogHeader className="space-y-1.5 pr-6 text-left">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 space-x-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-4 text-xs"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            size="sm"
            className="h-8 px-4 text-xs"
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}