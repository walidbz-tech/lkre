"use client"

import { DatabaseIcon, DownloadIcon, EraserIcon, SparklesIcon, UploadIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth/auth-provider"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { InfoList, SectionCard } from "@/components/common/detail"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDataStore } from "@/components/data-provider"
import { useBatch, useDb, useReplaceAll, useToday } from "@/hooks/use-data"
import { STORAGE_MODE } from "@/lib/data/config"
import { prepareDemoData, syncAllDuesOps } from "@/lib/data/operations"
import { formatFileSize } from "@/lib/format"
import { emptyUserData, userDataSchema, type UserData } from "@/lib/schemas"
import demo from "@/data/db.example.json"

type Pending = { kind: "demo" } | { kind: "clear" } | { kind: "import"; data: UserData; name: string }

function countItems(data: UserData): number {
  return Object.values(data).reduce((total, items) => total + items.length, 0)
}

export function SettingsPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const store = useDataStore()
  const { data } = useDb()
  const today = useToday()
  const replaceAll = useReplaceAll()
  const batch = useBatch()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const total = countItems(data)
  const size = new Blob([JSON.stringify(data)]).size

  const exportData = async () => {
    try {
      const all = await store.getAll()
      const payload = { app: "lkre", version: 1, exportedAt: new Date().toISOString(), ...all }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `lkre-export-${today}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Base exportée", { description: `${countItems(all)} éléments sauvegardés.` })
    } catch (error) {
      toast.error("Export impossible", { description: error instanceof Error ? error.message : undefined })
    }
  }

  const readImport = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text())
      const parsed = userDataSchema.safeParse(raw)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new Error(`Format non reconnu (${issue?.path.join(".")}) : ${issue?.message}`)
      }
      setPending({ kind: "import", data: parsed.data, name: file.name })
    } catch (error) {
      toast.error("Fichier illisible", {
        description:
          error instanceof SyntaxError
            ? "Le fichier n'est pas un JSON valide."
            : error instanceof Error
              ? error.message
              : undefined,
      })
    }
  }

  const confirm = async () => {
    if (!pending) return
    try {
      if (pending.kind === "demo") {
        const prepared = prepareDemoData(demo, today)
        await replaceAll.mutateAsync(prepared)
        const ops = syncAllDuesOps(prepared, today)
        if (ops.length) await batch.mutateAsync(ops)
        toast.success("Données de démonstration chargées", {
          description: "2 biens, 2 locataires et 1 contrat avec son historique.",
        })
      } else if (pending.kind === "import") {
        await replaceAll.mutateAsync(pending.data)
        toast.success("Base importée", {
          description: `${countItems(pending.data)} éléments restaurés depuis ${pending.name}.`,
        })
      } else {
        await replaceAll.mutateAsync(emptyUserData())
        toast.success("Données effacées")
      }
    } catch (error) {
      toast.error("L'opération a échoué", { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <>
      <PageHeader title="Paramètres" description="Compte, apparence et sauvegarde de vos données." />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Compte">
          <InfoList
            items={[
              { label: "Nom", value: user?.name },
              { label: "E-mail", value: user?.email },
              {
                label: "Stockage",
                value: STORAGE_MODE === "local" ? "Navigateur (mode démo)" : "Fichier JSON sur le serveur",
              },
              { label: "Volume de données", value: `${total} éléments · ${formatFileSize(size)}` },
            ]}
          />
        </SectionCard>

        <SectionCard title="Apparence">
          <p className="mb-3 text-sm text-muted-foreground">Choisissez le thème de l&apos;interface.</p>
          <ToggleGroup
            type="single"
            variant="outline"
            value={theme}
            onValueChange={(value) => value && setTheme(value)}
            aria-label="Thème"
          >
            <ToggleGroupItem value="light" className="px-3">
              Clair
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="px-3">
              Sombre
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="px-3">
              Système
            </ToggleGroupItem>
          </ToggleGroup>
        </SectionCard>

        <SectionCard title="Sauvegarde" className="lg:col-span-2">
          <p className="mb-4 max-w-prose text-sm text-muted-foreground">
            {STORAGE_MODE === "local"
              ? "Vos données ne sont stockées que dans ce navigateur. Exportez-les régulièrement : vider le cache ou changer d'appareil les ferait disparaître."
              : "Exportez vos données au format JSON pour les sauvegarder ou les transférer vers une autre installation."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData}>
              <DownloadIcon /> Exporter la base (JSON)
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <UploadIcon /> Importer une base (JSON)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Fichier JSON à importer"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void readImport(file)
              }}
            />
          </div>
        </SectionCard>

        <SectionCard title="Données de démonstration">
          <p className="mb-4 text-sm text-muted-foreground">
            Chargez un exemple réaliste pour découvrir l&apos;application : 2 biens, 2 locataires, 1 contrat avec
            paiements, factures et relevés. Vos données actuelles seront remplacées.
          </p>
          <Button variant="outline" onClick={() => setPending({ kind: "demo" })}>
            <SparklesIcon /> Charger des données de démo
          </Button>
        </SectionCard>

        <SectionCard title="Réinitialiser">
          <p className="mb-4 text-sm text-muted-foreground">
            Supprime tous vos biens, locataires, contrats, paiements, factures et relevés. Votre compte est conservé.
          </p>
          <Button variant="destructive" onClick={() => setPending({ kind: "clear" })} disabled={total === 0}>
            <EraserIcon /> Effacer toutes mes données
          </Button>
        </SectionCard>
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === "demo"
            ? "Charger les données de démonstration ?"
            : pending?.kind === "import"
              ? `Importer ${pending.name} ?`
              : "Effacer toutes vos données ?"
        }
        description={
          pending?.kind === "import"
            ? `${countItems(pending.data)} éléments vont remplacer vos ${total} éléments actuels.`
            : total > 0
              ? `Vos ${total} éléments actuels seront définitivement remplacés. Pensez à exporter une sauvegarde avant.`
              : undefined
        }
        confirmLabel={
          pending?.kind === "demo" ? "Charger la démo" : pending?.kind === "import" ? "Importer" : "Tout effacer"
        }
        destructive={total > 0}
        onConfirm={confirm}
      >
        {total > 0 && pending?.kind !== "clear" ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={exportData}>
            <DatabaseIcon /> Exporter d&apos;abord une sauvegarde
          </Button>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
