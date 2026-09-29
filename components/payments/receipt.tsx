"use client"

import { ArrowLeftIcon, PrinterIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth/auth-provider"
import { NotFoundState } from "@/components/common/detail"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { LogoMark } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { useLookups } from "@/hooks/use-lookups"
import { FREQUENCY_MONTHS, rentAt } from "@/lib/business/leases"
import { formatCurrency, formatDate, formatPeriod, METHOD_LABELS, roundMoney, tenantName } from "@/lib/format"

/** Quittance de loyer (échéance soldée) ou reçu de paiement partiel, imprimable. */
export function Receipt() {
  const id = useSearchParams().get("id")
  const { user } = useAuth()
  const { isLoading, duesById, leases, properties, tenants, today } = useLookups()
  if (isLoading) return <PageSkeleton />
  const due = id ? duesById.get(id) : undefined
  const lease = due ? leases.get(due.leaseId) : undefined
  const property = due ? properties.get(due.propertyId) : undefined
  if (!due || !lease || !property) {
    return <NotFoundState what="Échéance" href="/loyers" label="Retour aux loyers" />
  }

  const months = FREQUENCY_MONTHS[lease.paymentFrequency]
  const { rent, charges } = rentAt(lease, due.periodStart)
  const rentPart = roundMoney(rent * months)
  const chargesPart = roundMoney(charges * months)
  const isFull = due.status === "payé"
  const title = isFull ? "Quittance de loyer" : "Reçu de paiement partiel"
  const names = lease.tenantIds.map((tenantId) => tenantName(tenants.get(tenantId))).join(" et ")
  const address = [
    property.address.street,
    property.address.complement,
    `${property.address.postalCode} ${property.address.city}`,
  ]
    .filter(Boolean)
    .join(", ")
  const lastPayment = due.payments.at(-1)

  return (
    <div className="min-h-dvh bg-muted/50 px-4 py-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link href={`/contrats/detail?id=${lease.id}`}>
            <ArrowLeftIcon /> Retour au contrat
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon /> Imprimer
        </Button>
      </div>

      <article className="print-sheet mx-auto max-w-3xl rounded-xl border bg-white p-8 text-[#16201c] shadow-sm sm:p-12">
        <header className="flex items-start justify-between gap-6 border-b border-[#d9e0dc] pb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-[#56645e]">Période : {formatPeriod(due.periodStart, due.periodEnd)}</p>
          </div>
          <LogoMark className="size-10 shrink-0" />
        </header>

        <section className="grid gap-6 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-[#56645e]">Bailleur</p>
            <p className="font-medium">{user?.name}</p>
            <p>{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-[#56645e]">Locataire{lease.tenantIds.length > 1 ? "s" : ""}</p>
            <p className="font-medium">{names}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-[#56645e]">Adresse du logement</p>
            <p className="font-medium">{address}</p>
          </div>
        </section>

        <p className="text-sm leading-relaxed">
          {isFull ? (
            <>
              Je soussigné(e) <strong>{user?.name}</strong>, bailleur du logement désigné ci-dessus, déclare avoir reçu
              de <strong>{names}</strong> la somme de <strong>{formatCurrency(due.paid)}</strong> au titre du loyer et
              des charges pour la période du {formatDate(due.periodStart)} au {formatDate(due.periodEnd)}, et lui en
              donne quittance, sous réserve de tous mes droits.
            </>
          ) : (
            <>
              Je soussigné(e) <strong>{user?.name}</strong> déclare avoir reçu de <strong>{names}</strong> la somme de{" "}
              <strong>{formatCurrency(due.paid)}</strong> en paiement partiel du loyer de la période du{" "}
              {formatDate(due.periodStart)} au {formatDate(due.periodEnd)}. Ce reçu ne vaut pas quittance : il reste{" "}
              <strong>{formatCurrency(due.balance)}</strong> à régler.
            </>
          )}
        </p>

        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Détail du montant</caption>
          <tbody className="divide-y divide-[#d9e0dc]">
            <tr>
              <td className="py-2">Loyer hors charges</td>
              <td className="tabular py-2 text-right">{formatCurrency(rentPart)}</td>
            </tr>
            <tr>
              <td className="py-2">Provisions pour charges</td>
              <td className="tabular py-2 text-right">{formatCurrency(chargesPart)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-2">Total dû pour la période</td>
              <td className="tabular py-2 text-right">{formatCurrency(due.amountDue)}</td>
            </tr>
            <tr>
              <td className="py-2">Total reçu</td>
              <td className="tabular py-2 text-right">{formatCurrency(due.paid)}</td>
            </tr>
          </tbody>
        </table>

        {due.payments.length ? (
          <div className="mt-6">
            <p className="mb-2 text-xs text-[#56645e]">Règlements</p>
            <ul className="space-y-1 text-sm">
              {due.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-4">
                  <span>
                    {formatDate(payment.date)} · {METHOD_LABELS[payment.method]}
                    {payment.reference ? ` (${payment.reference})` : ""}
                  </span>
                  <span className="tabular">{formatCurrency(payment.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <footer className="mt-10 flex items-end justify-between gap-6 text-sm">
          <p>Fait le {formatDate(lastPayment?.date ?? today)}</p>
          <div className="w-48 border-t border-[#16201c] pt-2 text-center text-xs text-[#56645e]">
            Signature du bailleur
          </div>
        </footer>
        <p className="mt-8 text-[0.7rem] leading-snug text-[#56645e]">
          La quittance ne libère le locataire que pour la période indiquée. Le paiement d&apos;une échéance ne présume
          pas du paiement des échéances antérieures.
        </p>
      </article>
    </div>
  )
}
