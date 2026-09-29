"use client"

import { toast } from "sonner"

/** Exécute une mutation avec toasts de succès / d'erreur. Retourne `true` si succès. */
export async function runMutation(
  action: () => Promise<unknown>,
  success: string,
  description?: string
): Promise<boolean> {
  try {
    await action()
    toast.success(success, description ? { description } : undefined)
    return true
  } catch (error) {
    toast.error("L'opération a échoué", {
      description: error instanceof Error ? error.message : "Erreur inconnue.",
    })
    return false
  }
}
