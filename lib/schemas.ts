import { z } from "zod"

/**
 * Schémas zod partagés entre le client, les routes API et les adaptateurs de
 * stockage. Les dates « métier » sont des chaînes ISO `yyyy-MM-dd`, les
 * horodatages (`createdAt`, `updatedAt`) des ISO complets.
 */

const isoDate = z
  .string({ error: "Date requise" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide (jj/mm/aaaa)" })
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    error: "Date invalide",
  })

const optionalIsoDate = z.union([isoDate, z.literal("")]).optional()

const money = z
  .number({ error: "Montant requis" })
  .finite({ error: "Montant invalide" })
  .min(0, { error: "Le montant doit être positif" })
  .transform((value) => Math.round(value * 100) / 100)

const positiveMoney = z
  .number({ error: "Montant requis" })
  .finite({ error: "Montant invalide" })
  .gt(0, { error: "Le montant doit être supérieur à 0" })
  .transform((value) => Math.round(value * 100) / 100)

const text = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum` })

export const MAX_FILE_SIZE = 2 * 1024 * 1024

export const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"], {
    error: "Format accepté : PDF, PNG, JPEG ou WebP",
  }),
  size: z.number().int().max(MAX_FILE_SIZE, { error: "Fichier trop volumineux (2 Mo maximum)" }),
  dataUrl: z.string().startsWith("data:"),
})
export type Attachment = z.infer<typeof attachmentSchema>

export const baseEntitySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type BaseEntity = z.infer<typeof baseEntitySchema>

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type User = z.infer<typeof userSchema>
export type SessionUser = Pick<User, "id" | "email" | "name">

export const loginSchema = z.object({
  email: z.email({ error: "Adresse e-mail invalide" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Mot de passe requis" }),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Au moins 2 caractères" }).max(80),
    email: z.email({ error: "Adresse e-mail invalide" }).trim().toLowerCase(),
    password: z
      .string()
      .min(8, { error: "Au moins 8 caractères" })
      .max(128, { error: "128 caractères maximum" })
      .regex(/[A-Za-z]/, { error: "Doit contenir au moins une lettre" })
      .regex(/\d/, { error: "Doit contenir au moins un chiffre" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
export type RegisterInput = z.infer<typeof registerSchema>

/* ------------------------------------------------------------------ */
/* Biens                                                               */
/* ------------------------------------------------------------------ */

export const PROPERTY_TYPES = ["appartement", "maison", "studio", "local commercial", "parking", "autre"] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const addressSchema = z.object({
  street: text(200).min(1, { error: "Adresse requise" }),
  complement: text(200).default(""),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z -]{3,10}$/, { error: "Code postal invalide" }),
  city: text(100).min(1, { error: "Ville requise" }),
  country: text(100).min(1, { error: "Pays requis" }).default("France"),
})
export type Address = z.infer<typeof addressSchema>

export const propertyInputSchema = z.object({
  name: text(120).min(1, { error: "Nom requis" }),
  type: z.enum(PROPERTY_TYPES, { error: "Type requis" }),
  address: addressSchema,
  surface: z.number({ error: "Surface requise" }).min(0, { error: "Surface invalide" }).max(100000),
  rooms: z.number({ error: "Nombre de pièces requis" }).int({ error: "Nombre entier attendu" }).min(0).max(100),
  furnished: z.boolean(),
  defaultRent: money,
  defaultCharges: money,
  purchasePrice: money.optional(),
  notes: text(2000).default(""),
})
export type PropertyInput = z.input<typeof propertyInputSchema>
export const propertySchema = baseEntitySchema.extend(propertyInputSchema.shape)
export type Property = z.infer<typeof propertySchema>
export type PropertyStatus = "loué" | "vacant"

/* ------------------------------------------------------------------ */
/* Locataires                                                          */
/* ------------------------------------------------------------------ */

export const tenantInputSchema = z.object({
  firstName: text(80).min(1, { error: "Prénom requis" }),
  lastName: text(80).min(1, { error: "Nom requis" }),
  email: z.union([z.email({ error: "Adresse e-mail invalide" }).trim(), z.literal("")]),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 ().-]{0,20}$/, { error: "Numéro de téléphone invalide" }),
  birthDate: optionalIsoDate,
  idNumber: text(60).optional(),
  emergencyContact: text(200).optional(),
  guarantor: z
    .object({
      name: text(120).default(""),
      phone: z
        .string()
        .trim()
        .regex(/^[+0-9 ().-]{0,20}$/, { error: "Numéro invalide" })
        .default(""),
    })
    .optional(),
  notes: text(2000).default(""),
})
export type TenantInput = z.input<typeof tenantInputSchema>
export const tenantSchema = baseEntitySchema.extend(tenantInputSchema.shape)
export type Tenant = z.infer<typeof tenantSchema>

/* ------------------------------------------------------------------ */
/* Contrats                                                            */
/* ------------------------------------------------------------------ */

export const PAYMENT_FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual"] as const
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number]
export const LEASE_STATUSES = ["actif", "terminé", "à venir"] as const
export type LeaseStatus = (typeof LEASE_STATUSES)[number]

export const rentRevisionSchema = z.object({
  date: isoDate,
  oldRent: money,
  newRent: money,
  oldCharges: money.optional(),
  newCharges: money.optional(),
  note: text(500).optional(),
})
export type RentRevision = z.infer<typeof rentRevisionSchema>

export const leaseInputSchema = z
  .object({
    propertyId: z.string().min(1, { error: "Bien requis" }),
    tenantIds: z.array(z.string().min(1)).min(1, { error: "Au moins un locataire" }),
    startDate: isoDate,
    endDate: optionalIsoDate,
    status: z.enum(LEASE_STATUSES).default("actif"),
    terminatedAt: optionalIsoDate,
    rentAmount: money,
    chargesAmount: money,
    depositAmount: money,
    paymentDay: z
      .number({ error: "Jour requis" })
      .int({ error: "Nombre entier attendu" })
      .min(1, { error: "Entre 1 et 31" })
      .max(31, { error: "Entre 1 et 31" }),
    paymentFrequency: z.enum(PAYMENT_FREQUENCIES),
    contractFile: attachmentSchema.optional(),
    notes: text(2000).default(""),
    rentRevisions: z.array(rentRevisionSchema).default([]),
  })
  .refine((lease) => !lease.endDate || lease.endDate >= lease.startDate, {
    error: "La date de fin doit être postérieure au début",
    path: ["endDate"],
  })
export type LeaseInput = z.input<typeof leaseInputSchema>
export const leaseSchema = baseEntitySchema.extend(leaseInputSchema.shape)
export type Lease = z.infer<typeof leaseSchema>

/* ------------------------------------------------------------------ */
/* Relevés de compteurs                                                */
/* ------------------------------------------------------------------ */

export const METER_TYPES = ["electricity", "gas", "water"] as const
export type MeterType = (typeof METER_TYPES)[number]
export const METER_CONTEXTS = ["entrée", "sortie", "périodique"] as const
export type MeterContext = (typeof METER_CONTEXTS)[number]

export const meterReadingInputSchema = z.object({
  leaseId: z.string().default(""),
  propertyId: z.string().min(1, { error: "Bien requis" }),
  type: z.enum(METER_TYPES),
  date: isoDate,
  index: z.number({ error: "Index requis" }).min(0, { error: "Index invalide" }),
  unit: z.enum(["kWh", "m³"]),
  context: z.enum(METER_CONTEXTS),
  note: text(500).default(""),
})
export type MeterReadingInput = z.input<typeof meterReadingInputSchema>
export const meterReadingSchema = baseEntitySchema.extend(meterReadingInputSchema.shape)
export type MeterReading = z.infer<typeof meterReadingSchema>

/* ------------------------------------------------------------------ */
/* Échéances et paiements                                              */
/* ------------------------------------------------------------------ */

export const rentDueInputSchema = z.object({
  leaseId: z.string().min(1),
  propertyId: z.string().min(1),
  periodStart: isoDate,
  periodEnd: isoDate,
  dueDate: isoDate,
  amountDue: money,
})
export type RentDueInput = z.input<typeof rentDueInputSchema>
export const rentDueSchema = baseEntitySchema.extend(rentDueInputSchema.shape)
export type RentDue = z.infer<typeof rentDueSchema>
export type RentDueStatus = "payé" | "partiel" | "impayé" | "en retard"

export const PAYMENT_METHODS = ["cash", "cheque", "virement"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const paymentInputSchema = z.object({
  rentDueId: z.string().min(1, { error: "Échéance requise" }),
  leaseId: z.string().min(1),
  propertyId: z.string().min(1),
  tenantId: z.string().default(""),
  amount: positiveMoney,
  date: isoDate,
  method: z.enum(PAYMENT_METHODS, { error: "Moyen de paiement requis" }),
  reference: text(120).default(""),
  note: text(500).default(""),
})
export type PaymentInput = z.input<typeof paymentInputSchema>
export const paymentSchema = baseEntitySchema.extend(paymentInputSchema.shape)
export type Payment = z.infer<typeof paymentSchema>

/* ------------------------------------------------------------------ */
/* Factures                                                            */
/* ------------------------------------------------------------------ */

export const BILL_CATEGORIES = ["energy", "water"] as const
export type BillCategory = (typeof BILL_CATEGORIES)[number]
export const BILL_STATUSES = ["à payer", "payée"] as const
export type BillStatus = (typeof BILL_STATUSES)[number]
export const BILL_PAYERS = ["propriétaire", "locataire"] as const
export type BillPayer = (typeof BILL_PAYERS)[number]

export const utilityBillInputSchema = z
  .object({
    propertyId: z.string().min(1, { error: "Bien requis" }),
    leaseId: z.string().optional(),
    category: z.enum(BILL_CATEGORIES),
    provider: text(120).min(1, { error: "Fournisseur requis" }),
    invoiceNumber: text(80).default(""),
    periodStart: isoDate,
    periodEnd: isoDate,
    issueDate: isoDate,
    dueDate: isoDate,
    amount: money,
    status: z.enum(BILL_STATUSES),
    paidDate: optionalIsoDate,
    paidBy: z.enum(BILL_PAYERS),
    note: text(1000).default(""),
    file: attachmentSchema.optional(),
  })
  .refine((bill) => bill.periodEnd >= bill.periodStart, {
    error: "La fin de période doit suivre le début",
    path: ["periodEnd"],
  })
  .refine((bill) => bill.status !== "payée" || !!bill.paidDate, {
    error: "Date de paiement requise",
    path: ["paidDate"],
  })
export type UtilityBillInput = z.input<typeof utilityBillInputSchema>
export const utilityBillSchema = baseEntitySchema.extend(utilityBillInputSchema.shape)
export type UtilityBill = z.infer<typeof utilityBillSchema>

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export const COLLECTIONS = [
  "properties",
  "tenants",
  "leases",
  "rentDues",
  "payments",
  "utilityBills",
  "meterReadings",
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

export interface EntityMap {
  properties: Property
  tenants: Tenant
  leases: Lease
  rentDues: RentDue
  payments: Payment
  utilityBills: UtilityBill
  meterReadings: MeterReading
}

export const entitySchemas = {
  properties: propertySchema,
  tenants: tenantSchema,
  leases: leaseSchema,
  rentDues: rentDueSchema,
  payments: paymentSchema,
  utilityBills: utilityBillSchema,
  meterReadings: meterReadingSchema,
} as const

export function isCollectionName(value: string): value is CollectionName {
  return (COLLECTIONS as readonly string[]).includes(value)
}

/** Données d'un utilisateur (toutes collections). */
export type UserData = { [C in CollectionName]: EntityMap[C][] }

/** Contenu complet du fichier JSON. */
export interface Database extends UserData {
  version: 1
  users: User[]
}

export const userDataSchema = z.object({
  properties: z.array(propertySchema).default([]),
  tenants: z.array(tenantSchema).default([]),
  leases: z.array(leaseSchema).default([]),
  rentDues: z.array(rentDueSchema).default([]),
  payments: z.array(paymentSchema).default([]),
  utilityBills: z.array(utilityBillSchema).default([]),
  meterReadings: z.array(meterReadingSchema).default([]),
})

export function emptyUserData(): UserData {
  return {
    properties: [],
    tenants: [],
    leases: [],
    rentDues: [],
    payments: [],
    utilityBills: [],
    meterReadings: [],
  }
}

export function emptyDatabase(): Database {
  return { version: 1, users: [], ...emptyUserData() }
}
