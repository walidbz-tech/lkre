import type { StorageMode } from "./types"

/** Mode de stockage, fixé au build par `NEXT_PUBLIC_STORAGE_MODE`. */
export const STORAGE_MODE: StorageMode = process.env.NEXT_PUBLIC_STORAGE_MODE === "local" ? "local" : "file"

export const LOCAL_DB_KEY = "lkre_db_v1"
export const LOCAL_SESSION_KEY = "lkre_session_v1"
