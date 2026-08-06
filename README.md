# Retrofit Portal

Frontend-only implementation (React + Vite + Tailwind CSS v4) matching the provided Figma design.

## Run locally
```bash
npm install
npm run dev
```

## Build for production
```bash
npm run build
```

## Structure
- `src/pages/auth` — Login, Signup (role selector: client/admin)
- `src/pages/client` — Client portal: Dashboard, My Projects, Project Detail (5 tabs), Profile, Billing, Plans
- `src/pages/admin` — Admin portal: Dashboard, Projects Directory, Task Board, Services, Users, Settings
- `src/layouts` — Sidebar, Topbar, DashboardLayout, ProjectTabs
- `src/components` — Reusable UI: Button, StatCard, StatusPill, ProjectHeaderCard, PaymentMethodCard
- `src/data` — Dummy/mock data (no backend)

## Notes
- 100% frontend, no backend/API — all data is mocked in `src/data/`
- Login redirects based on selected role: Client → `/dashboard`, Admin → `/admin/dashboard`
