# WCL — Wave Challenge List

A responsive Geometry Dash wave-challenge community site built with React, TypeScript, Vite, and Supabase.

## Current state

The first UI build is in place: challenge browsing, search and difficulty filters, sorting, sample rankings, level-submission preview, completion-proof preview, and a responsive dark/neon layout. The current app uses sample data. It is **not yet connected to live authentication or database writes**, so preview submissions do not persist after refresh and points are not awarded.

## Run locally

Requirements: Node.js 20+ and npm.

    npm install
    cp .env.example .env.local
    npm run dev

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local when connecting the frontend. Use only a Supabase publishable/anon key in browser code — never put a service-role or secret key in a VITE_ variable.

Build the production bundle:

    npm run build
    npm run preview

## Supabase setup

The schema draft is in supabase/schema.sql. Review it, then apply it to the intended WCL Supabase project through the Supabase SQL editor. The schema enables row-level security and separates public levels, user-owned submissions, role/permission records, and audit logs.

Important setup steps before launch:

1. Apply and test the schema in the WCL project only.
2. Configure Supabase Auth providers and redirect URLs.
3. Create the first trusted admin role manually through the Supabase dashboard/SQL editor using a known authenticated user's UUID. Never let a public client self-assign moderator/admin permissions.
4. Implement and deploy server-side moderation/approval operations. Point awards, bans, role changes, restores, and audit-log writes must happen in trusted server-side code, not directly in the browser.
5. Connect the UI to Supabase and test policies with separate anonymous, player, moderator, and admin accounts.
6. Configure a production domain and deploy the Vite app (for example, Cloudflare Pages or Vercel).

## Planned product scope

- Geometry Dash username profiles, player points, and rankings.
- Challenge entries with creator, description, points, YouTube showcase, and generated thumbnail.
- Completion proof submissions with moderator review before points are awarded.
- Granular moderator permissions, ban/unban, restore actions, and append-only moderation audit history.
- Admin dashboard for list management and community moderation.

## Data and attribution

This is a fan/community project and is not affiliated with RobTop Games. Geometry Dash and related marks belong to their respective owners.
