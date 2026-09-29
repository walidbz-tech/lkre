import type { CollectionName, EntityMap, SystemFields, UserData } from "@/types"

/** Données saisissables d'une entité (sans les champs système). */
export type NewEntity<C extends CollectionName> = Omit<EntityMap[C], SystemFields>
export type EntityPatch<C extends CollectionName> = Partial<NewEntity<C>>

export type BatchOp = {
  [C in CollectionName]:
    | { op: "create"; collection: C; data: NewEntity<C>; id?: string }
    | { op: "update"; collection: C; id: string; patch: EntityPatch<C> }
    | { op: "remove"; collection: C; id: string }
}[CollectionName]

export interface BatchResult {
  created: string[]
  updated: string[]
  removed: string[]
}

/**
 * Contrat unique d'accès aux données. L'UI n'utilise que cette interface et
 * ignore tout du mode de stockage (fichier JSON via API, ou localStorage).
 * Toutes les opérations sont implicitement limitées à l'utilisateur connecté.
 */
export interface DataStore {
  readonly mode: StorageMode
  list<C extends CollectionName>(collection: C): Promise<EntityMap[C][]>
  get<C extends CollectionName>(collection: C, id: string): Promise<EntityMap[C] | null>
  create<C extends CollectionName>(collection: C, data: NewEntity<C>): Promise<EntityMap[C]>
  update<C extends CollectionName>(collection: C, id: string, patch: EntityPatch<C>): Promise<EntityMap[C]>
  remove(collection: CollectionName, id: string): Promise<void>
  /** Applique plusieurs opérations de façon atomique. */
  batch(ops: BatchOp[]): Promise<BatchResult>
  getAll(): Promise<UserData>
  /** Remplace toutes les données de l'utilisateur connecté. */
  replaceAll(data: UserData): Promise<void>
}

export type StorageMode = "file" | "local"

export class DataError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "invalid"
  ) {
    super(message)
    this.name = "DataError"
  }
}
