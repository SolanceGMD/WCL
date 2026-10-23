# WCL — Wave Challenge List

**A static HTML/CSS/JavaScript website for GitHub Pages, backed by Supabase.** No Node.js build step is needed to serve the site.

## Live website

After the GitHub Pages deployment workflow succeeds, the project site is normally available at:

https://solancegmd.github.io/WCL/

If it does not open, go to **Settings → Pages** in this repository and set **Build and deployment → Source** to **GitHub Actions**. Then open the **Actions** tab and inspect the latest “Deploy WCL to GitHub Pages” run.

## Features

- Responsive dark/neon layout, challenge search, difficulty filtering, sorting, and YouTube thumbnails.
- Supabase email/password account creation and sign-in, with Geometry Dash usernames and player points.
- Public challenge list and player rankings.
- Level suggestions with difficulty, length, description, proposed points, and YouTube showcase URL.
- Completion proof submissions. Points are assigned from the level's authoritative reward only after an authorized moderator approves the run. Pending/approved duplicates for the same player and level are blocked.
- Staff dashboard: approve/reject submissions, add/edit challenges, change point rewards and YouTube URLs, remove/restore levels, manage role permissions, ban/unban users, and inspect audit history.
- Row-level security policies and database triggers for points and audit events.

## Database and security

The WCL Supabase project is `xvdinlyertutpddeilvq` in `eu-west-1`. The production schema has been applied to that project. The browser contains only the **publishable** Supabase key; it does not contain a service-role key.

### First admin setup — required once

1. Open the site and create an account with the email you want to use for the owner account.
2. Confirm the email if Supabase Auth requires it, then sign in once.
3. Open the [WCL Supabase SQL Editor](https://supabase.com/dashboard/project/xvdinlyertutpddeilvq/sql/new).
4. Run this query, replacing the email with your own account email:

```sql
update public.user_roles
set role = 'admin', permissions = '{}'::jsonb, updated_at = now()
where user_id = (
  select id from auth.users where lower(email) = lower('YOUR-EMAIL-HERE')
);
```

5. Refresh the website. The **Admin** tab will appear. Admins have all permissions; moderators can be assigned only the permissions they need in **Admin → Users & roles**.

Do not grant yourself an admin role by editing browser data. The database intentionally has no self-service role assignment.

## GitHub Pages deployment

The workflow in `.github/workflows/pages.yml` deploys the repository root on each push to `main`. The root `index.html` imports `styles.css` and `app.js`, so it can also be tested locally by serving the directory with any static file server. Opening `index.html` as a `file://` URL may block module imports in some browsers.

## Important launch notes

- Configure allowed redirect URLs and email confirmation settings in Supabase Auth.
- The site requires an internet connection for Supabase and the Supabase JavaScript CDN import.
- Moderator actions are controlled by database policies; UI visibility is not the security boundary.
- The site is a fan/community project and is not affiliated with RobTop Games. Geometry Dash and related marks belong to their respective owners.
