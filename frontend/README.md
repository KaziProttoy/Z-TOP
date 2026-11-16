# Z-TOP frontend

The frontend is a Next.js application that provides the dashboard, course
workspace, chat, study tools, planner, progress views, and student profile.

## Run locally

From this directory:

```powershell
npm install
npm run dev
```

The app runs on http://localhost:3000 by default. Set
`NEXT_PUBLIC_API_URL` in `.env.local` when the backend is not running on
`http://localhost:8000`.

## Source layout

- `src/app/` contains the Next.js route entry point and global styles.
- `src/lib/types.ts` contains shared frontend data types.
- `src/lib/api.ts` contains authenticated API request helpers.
- `public/` contains static browser assets.
