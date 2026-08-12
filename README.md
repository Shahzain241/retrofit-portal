# Retrofit Portal

A centralized digital platform to modernize and scale PAS 2035 retrofit service delivery. Homeowners, housing providers, and retrofit teams can browse services, purchase assessments and designs, and track projects end-to-end — with full compliance documentation.

This is a **frontend-only implementation** (no backend/API). All data is mocked in `src/data/` and user profile/settings are persisted to `localStorage`.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- [React Router 7](https://reactrouter.com/)
- [Tailwind CSS v4](https://tailwindcss.com/) (design tokens defined in `src/styles/index.css`)
- [Recharts](https://recharts.org/) for dashboard charts
- [lucide-react](https://lucide.dev/) for icons
- [oxlint](https://oxc.rs/) for linting

## Getting started

```bash
npm install
npm run dev        # start the dev server
```

Other scripts:

```bash
npm run build      # production build (outputs to dist/)
npm run preview    # preview the production build
npm run lint       # run oxlint
```

## Login

The app is a single-role mock. On `/login` you can switch between **Client** and **Admin**, which redirect to the matching dashboard:

- Client → `/dashboard`
- Admin → `/admin/dashboard`

Any email/password is accepted (no real authentication).

## Routes

**Public**

| Path | Page |
|------|------|
| `/` | Landing |
| `/services` | Services catalogue (search + category/budget filters) |
| `/services/:id` | Service detail (tiers, add-ons, timeline, compliance) |
| `/login`, `/signup` | Auth |

**Client** (inside `DashboardLayout`)

| Path | Page |
|------|------|
| `/dashboard` | Client dashboard |
| `/projects` | My projects |
| `/projects/:id` | Project detail (Overview, Task & Docs, Communication, Timeline, Deliverables) |
| `/profile` | Profile & property |
| `/billing` | Billing & subscription |
| `/billing/plans` | Plans |

**Admin** (inside `DashboardLayout`)

| Path | Page |
|------|------|
| `/admin/dashboard` | Admin dashboard (charts + priority queue) |
| `/admin/projects` | Projects directory |
| `/admin/projects/:id/board` | Task board |
| `/admin/services` | Services management |
| `/admin/services/new` | Create/edit service form |
| `/admin/users` | User directory |
| `/admin/users/invite` | Invite staff |
| `/admin/settings` | Platform settings |

## Project structure

```
src/
  components/   shared UI (Button, Badge, StatCard, StatusPill, ProgressBar,
                Toggle, Header, Footer, CtaBanner, Sidebar, Topbar,
                DashboardLayout, ProjectTabs, ProjectHeaderCard, PaymentMethodCard)
  pages/        route-level pages
    auth/       Login, Signup, AuthLayout
    client/     ClientDashboard, MyProjects, ProjectDetail, Profile, Billing, Plans,
                project-tabs/ (Overview, TaskDocs, Communication, Timeline, Deliverables)
    admin/      AdminDashboard, ProjectsDirectory, TaskBoard, Services, ServiceForm,
                Users, InviteStaff, Settings
  styles/       all CSS (one file per component/page)
  assets/       images, icons, logo
  data/         mock data (services, projects, stats, testimonials, etc.)
  context/      ProfileContext (profile/settings, persisted to localStorage)
  utils/        pdf.js (invoice PDF generation)
```

## Notes

- No backend — replace the imports in `src/data/` with real API calls when ready.
- SPA fallback for hosting is configured in `vercel.json` (rewrites all routes to `index.html`).
