"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { useAuth } from "@/components/auth/auth-provider"
import { Spinner } from "@/components/common/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { STORAGE_MODE } from "@/lib/data/config"
import { loginSchema, type LoginInput } from "@/lib/schemas"

export function LoginForm() {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await login(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.")
    }
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold">Connexion</h1>
        <p className="text-sm text-muted-foreground">Accédez à vos biens et à vos loyers.</p>
      </div>
      {STORAGE_MODE === "local" ? (
        <Alert>
          <AlertDescription>
            Mode démo : votre compte et vos données restent dans ce navigateur. Créez un compte pour commencer.
          </AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FieldGroup>
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
                <Input
                  {...field}
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  className="h-10"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                <Input
                  {...field}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  className="h-10"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
        {error ? (
          <p role="alert" className="rounded-lg bg-status-late-bg px-3 py-2 text-sm text-status-late">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          Se connecter
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-primary underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
