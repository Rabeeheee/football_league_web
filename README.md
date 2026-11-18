# Culvert Football League

Local football league web app: teams with eFootball-style 5+2 pitch editor, Champions League–style league fixtures, and points table.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + SQLite
- NextAuth (credentials)
- @dnd-kit for pitch drag-and-drop

## Setup

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed admin

- Email: `admin@league.local`
- Password: `admin123`

## Roles

| Role | Capabilities |
|------|----------------|
| League admin | Set team slots & entry fee, create teams, assign managers, record fixture scores |
| Team manager | Edit own team name/logo/squad positions |
| Visitor | Browse teams, fixtures, standings |

Entry fee (default ₹100) is per person and displayed on the site; payment is offline for v1.
