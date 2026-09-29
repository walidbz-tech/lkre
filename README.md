# LKRE — Gestion locative

Application web de gestion de biens locatifs pour propriétaires particuliers : biens, locataires, contrats, échéances de loyer, paiements (y compris par tranches), quittances imprimables, factures d'énergie et d'eau, relevés de compteurs et tableau de bord.

**Démo en ligne :** https://walidbz-tech.github.io/lkre/ (mode démo, données stockées dans votre navigateur)

## Fonctionnalités

- **Biens** : liste filtrable (type, statut loué/vacant), fiche détaillée (locataire actuel, historique des contrats, paiements, factures, relevés). Suppression bloquée si un contrat actif est lié.
- **Locataires** : fiche avec contrats, historique des paiements et solde dû.
- **Contrats** : formulaire en sections (bien, locataires, dates, conditions financières, fréquence et jour d'échéance, contrat en PDF/image, relevés d'entrée). Chevauchement de contrats interdit sur un même bien. Révision du loyer, fin de contrat avec relevés de sortie, régénération de l'échéancier.
- **Loyers** : échéances générées automatiquement (mensuel, trimestriel, semestriel, annuel ; jour 31 → dernier jour du mois), paiements multiples par échéance, statuts payé / partiel / impayé / en retard, report d'un excédent sur les échéances suivantes, quittance ou reçu imprimable.
- **Factures** : énergie (électricité + gaz sur une seule facture) et eau, justificatif joint, rappels des factures en retard ou à payer sous 7 jours.
- **Relevés** : électricité, gaz, eau ; consommation calculée entre deux relevés consécutifs.
- **Tableau de bord** : période (mois, trimestre, année, tout) avec navigation, filtre par bien, revenu net (encaissé − dépenses), attendu, impayés, taux de recouvrement et d'occupation, graphiques, vision par bien, retards, prochaines échéances, dernières opérations.
- Interface en français, responsive (360 px → grand écran), thème clair/sombre, accessible au clavier.

## Stack

| Domaine | Outils |
| --- | --- |
| Framework | Next.js 16 (App Router, TypeScript strict), React 19 |
| UI | shadcn/ui (Radix UI), Tailwind CSS v4, lucide-react |
| Graphiques | Recharts via les composants `chart` de shadcn |
| Formulaires | react-hook-form + zod (`@hookform/resolvers`) |
| Tableaux | TanStack Table v9 (tri, recherche, pagination) |
| Données client | TanStack Query |
| Dates / toasts / thème | date-fns (locale `fr`), sonner, next-themes |
| Auth (mode fichier) | bcryptjs, JWT signé par `jose` en cookie httpOnly |
| Qualité | Vitest, ESLint, Prettier, `tsc --noEmit` |

## Lancement local

Prérequis : Node.js 22 LTS (voir `.nvmrc`, minimum 20.9).

```bash
npm i
cp .env.example .env.local   # puis renseignez AUTH_SECRET
npm run dev                  # http://localhost:3000
```

Créez un compte, puis dans **Paramètres** cliquez sur **Charger des données de démo** pour explorer l'application.

### Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Développement, mode `file` (API + `data/db.json`) |
| `npm run dev:local` | Développement en mode `local` (comme GitHub Pages) |
| `npm run build` / `npm start` | Build et serveur de production (mode `file`) |
| `npm run build:pages` | Export statique pour GitHub Pages dans `out/` |
| `npm test` | Tests unitaires (Vitest) |
| `npm run check` | Typecheck + lint + tests |
| `npm run format` | Formatage Prettier |

### Variables d'environnement

| Variable | Valeurs | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_STORAGE_MODE` | `file` (défaut) \| `local` | Mode de stockage, fixé au build |
| `AUTH_SECRET` | chaîne ≥ 32 caractères | Signature des sessions (mode `file`, obligatoire en production) |
| `LKRE_DATA_DIR` | chemin | Dossier du fichier JSON (défaut `./data`) |
| `GITHUB_PAGES` | `true` | Active l'export statique avec `basePath: /lkre` (utilisé par `build:pages`) |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## Deux modes de stockage

Les données sont un simple fichier JSON, derrière une couche d'accès abstraite (`lib/data`). L'interface `DataStore` expose `list`, `get`, `create`, `update`, `remove`, `batch` (opérations atomiques), `getAll` et `replaceAll`. Toute l'UI passe par le `DataProvider` et les hooks de `hooks/use-data.ts`, sans jamais connaître le mode.

Les deux adaptateurs partagent le même cœur pur (`lib/data/db-core.ts`) : filtrage par `userId`, validation zod de chaque écriture, lots atomiques.

1. **`file`** (développement, auto-hébergement) : le client appelle les routes `app/api/...`, qui lisent et écrivent `data/db.json`. Le fichier est créé automatiquement ; chaque écriture passe par un fichier temporaire puis un `rename` (atomique), sous verrou (file d'attente en mémoire et fichier `.lock` exclusif). Inscription et connexion réelles : mot de passe haché avec bcrypt, session JWT en cookie httpOnly, pages privées protégées par `proxy.ts` (l'ancien middleware de Next.js).
2. **`local`** (GitHub Pages) : mêmes opérations, persistées dans le `localStorage` (clé `lkre_db_v1`). Mots de passe hachés avec WebCrypto (PBKDF2), session en `localStorage`. Un bandeau signale le mode démo. **Paramètres → Exporter / Importer la base (JSON)** permet de sauvegarder et restaurer les données.

Chaque utilisateur ne voit que ses propres données (`userId` sur chaque entité).

### Limites du mode GitHub Pages

- C'est une **démo** : aucune sécurité réelle. Le « compte » et le hachage du mot de passe vivent dans le navigateur ; quiconque a accès à la machine peut lire les données.
- Les données sont **propres au navigateur et à l'appareil** : vider le cache, changer de navigateur ou utiliser la navigation privée les fait disparaître. Exportez régulièrement.
- Le `localStorage` est limité (environ 5 Mo) : les pièces jointes (2 Mo maximum chacune, en base64) le remplissent vite.

## Déploiement sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` s'exécute à chaque push sur `main` : `npm ci` → typecheck, lint, tests → `npm run build:pages` → publication du dossier `out` via `actions/upload-pages-artifact` et `actions/deploy-pages`.

`build:pages` (`scripts/build-pages.mjs`) déplace temporairement `app/api` et `proxy.ts` (incompatibles avec l'export statique), build avec `NEXT_PUBLIC_STORAGE_MODE=local GITHUB_PAGES=true`, puis restaure toujours les fichiers. Les pages de détail utilisent des paramètres de requête (`/biens/detail?id=…`) plutôt que des routes dynamiques. `public/.nojekyll` et une page 404 sont inclus.

Configuration du dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.

## Structure du projet

```
app/
  (auth)/connexion, inscription     Pages publiques
  (app)/…                           Pages privées (tableau de bord, biens, locataires,
                                    contrats, loyers, factures, relevés, paramètres)
  quittance/                        Quittance imprimable
  api/                              Routes API (mode file uniquement)
components/
  ui/                               Composants shadcn/ui
  common/                           Tableau générique, dialogues, champs FR (montant, date, fichier)
  auth/ layout/ dashboard/ properties/ tenants/ leases/ payments/ bills/ readings/ settings/
hooks/                              use-data (TanStack Query), use-lookups, use-mobile
lib/
  schemas.ts                        Schémas zod partagés et types
  business/                         Logique métier pure : échéances, statuts, tableau de bord…
  data/                             DataStore, cœur JSON, adaptateurs fichier / localStorage, opérations
  auth/                             Sessions JWT, client d'authentification
  format.ts                         Formats FR (€, dates, nombres)
types/                              Types exportés
data/db.example.json                Jeu de démonstration
tests/                              Tests Vitest
scripts/build-pages.mjs             Build statique GitHub Pages
proxy.ts                            Protection des pages (mode file)
```

## Tests

La logique métier est composée de fonctions pures testées avec Vitest (`tests/`) : génération des échéances pour les 4 fréquences (jour 31, fin février, années bissextiles, révisions de loyer), synchronisation sans doublon, statuts avec paiements partiels, répartition d'un excédent, chevauchement de contrats, consommation des relevés, agrégations du tableau de bord par mois, trimestre et année, isolation des données par utilisateur.

## Prochaines étapes conseillées

- Migrer le stockage vers une vraie base (PostgreSQL avec Prisma ou Drizzle) : il suffit d'écrire un nouvel adaptateur côté serveur respectant la même logique que `db-core`.
- Héberger avec un backend (Vercel, Railway, Fly.io…) plutôt que GitHub Pages, pour une authentification réelle et des données partagées entre appareils.
- Stocker les pièces jointes dans un stockage objet (S3, R2) plutôt qu'en base64.
- Ajouter l'envoi des quittances par e-mail, la révision automatique selon l'IRL et le prorata des loyers en cas d'entrée ou de sortie en cours de mois.
