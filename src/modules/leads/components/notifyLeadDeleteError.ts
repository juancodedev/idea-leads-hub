import { toast } from 'sonner';
import { ConflictError } from '@/infrastructure/repositories/errors';

/**
 * User feedback for a failed lead deletion. A refused deletion (for example a
 * lead that still has Instagram conversations) is shown as a warning with its
 * reason; anything else keeps the generic error toast.
 */
export function notifyLeadDeleteError(error: unknown): void {
  if (error instanceof ConflictError) {
    toast.warning(error.message);
    return;
  }
  toast.error('Error al eliminar el lead');
}
