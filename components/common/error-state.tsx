"use client"

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Erreur inconnue."
  return (
    <Alert variant="destructive" className="my-4">
      <TriangleAlertIcon />
      <AlertTitle>Impossible de charger les données</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RefreshCwIcon /> Réessayer
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
