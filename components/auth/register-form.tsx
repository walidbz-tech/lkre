"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { useAuth } from "@/components/auth/auth-provider"
import { Spinner } from "@/components/common/spinner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DataError } from "@/lib/data/types"
import { registerSchema, type RegisterInput } from "@/lib/schemas"

const FIELDS: {
  name: keyof RegisterInput
  label: string
  type: string
  autoComplete: string
  description?: string
}[] = [
  { name: "name", label: "Nom complet", type: "text", autoComplete: "name" },
  { name: "email", label: "Adresse e-mail", type: "email", autoComplete: "email" },
  {
    name: "password",
    label: "Mot de passe",
    type: "password",
    autoComplete: "new-password",
    description: "8 caractères minimum, avec au moins une lettre et un chiffre.",
  },
  { name: "confirmPassword", label: "Confirmer le mot de passe", type: "password", autoComplete: "new-password" },
]

export function RegisterForm() {
  const { register } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await register(values)
      toast.success("Compte créé. Bienvenue !")
    } catch (err) {
      if (err instanceof DataError && err.code === "email_taken") {
        form.setError("email", { message: err.message })
        return
      }
      setError(err instanceof Error ? err.message : "Inscription impossible.")
    }
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold">Créer un compte</h1>
        <p className="text-sm text-muted-foreground">Quelques secondes suffisent pour démarrer.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FieldGroup>
          {FIELDS.map((config) => (
            <Controller
              key={config.name}
              control={form.control}
              name={config.name}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={config.name}>{config.label}</FieldLabel>
                  <Input
                    {...field}
                    id={config.name}
                    type={config.type}
                    autoComplete={config.autoComplete}
                    aria-invalid={fieldState.invalid}
                    className="h-10"
                  />
                  {config.description && !fieldState.error ? (
                    <FieldDescription>{config.description}</FieldDescription>
                  ) : null}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ))}
        </FieldGroup>
        {error ? (
          <p role="alert" className="rounded-lg bg-status-late-bg px-3 py-2 text-sm text-status-late">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          Créer mon compte
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-primary underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
