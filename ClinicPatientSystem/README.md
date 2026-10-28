# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## System Admin Master Data

The authenticated System Admin page is available at `/admin/master-data`. It manages the existing Department records and MongoDB-backed shared reference records for job titles, services, patient and visit categories, queue types, medicine and laboratory catalogs, units, and general references. Staff accounts and daily queue processing remain in their separate workflows.

The backend idempotently seeds the requested department/unit names and reference options when it starts. It does not invent medicine catalog items or laboratory tests. Configure MongoDB and the JWT signing key in `server/.env`, then run the project from its root:

```powershell
npm run dev
```

The frontend is served by Vite and proxies `/api` requests to the backend. The main admin API requires the existing authenticated admin middleware:

- `GET /api/master-data?search=&category=all&status=all` — records and dashboard counts
- `POST /api/master-data` — create a reference record
- `PUT /api/master-data/:id` — update a reference record
- `PATCH /api/master-data/:id/status` — activate or deactivate a reference record
- `GET /api/master-data/:id/audit?entityType=master_data|department` — change history
- `GET /api/master-data/catalog/:category` — active, read-only reference values for authenticated clinic workflows

Department records continue to use the shared `Department` model and `/api/departments` endpoints. Management changes are recorded in the existing `AuditLog` collection; hard deletion is not exposed by the Master Data screen.

The existing clinic-head inventory creation API accepts an optional active medicine `masterDataId` from `/api/master-data/catalog/medicine`; when supplied, it snapshots the catalog name, code, and unit. Legacy inventory submissions without a catalog reference remain supported.

Run frontend checks from `ClinicPatientSystem`:

```powershell
npm run lint -- src/components/Admindashboared/MasterData.jsx src/components/Admindashboared/Departments.jsx src/App.jsx
npm run build
```

The project currently has no automated test script. Exercise CRUD, duplicate validation, status changes, and audit history with MongoDB running and an administrator session signed in.
