import { MapPinOffIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <MapPinOffIcon aria-hidden className="size-6" />
      </div>
      <div className="space-y-2">
        <p className="font-heading text-5xl font-bold text-primary">404</p>
        <h1 className="font-heading text-xl font-semibold">Cette page n&apos;existe pas</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          L&apos;adresse est peut-être incorrecte, ou la page a été déplacée.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
      </Button>
    </main>
  )
}
