# Crew Book: hand-off notes for adding it to the company website

Crew Book is a small internal tool: a list of **locations**, the **baristas** at each one, their **skills**, and a **daily coffee check** log (checked? recipe problem? brewing well?). Managers see everything. Baristas sign in and see their own skills and can log and edit their own checks.

It is plain HTML, CSS and JavaScript. There is **no build step** and no framework. The back end is a Supabase project (Postgres and login). The files can sit in any folder on any web host.

## Files

| File | What it is |
|---|---|
| `index.html` | The page and all the styles |
| `app.js` | All the app logic |
| `motion.js` | Optional animations (opening screen, scroll effects). Safe to delete along with its `<script>` line |
| `config.js` | The Supabase address and public key. **The only file to edit when moving to a new project** |
| `manifest.webmanifest`, `icon-*.png` | Lets people add it to a phone home screen |
| `supabase/001_setup.sql`, `002_upgrade.sql` | Database setup. Run in order in the Supabase SQL Editor, once |
| `.github/workflows/keepalive.yml` | Pings the database twice a week so a free Supabase project does not pause. Not needed on a paid plan |

## Putting it on the company site

1. **Easiest:** copy all the files into a folder, for example `yourcompany.com/crew/`, or a subdomain such as `crew.yourcompany.com`. It then works at that address.
2. **As an iframe or inside an existing page:** possible, but sign-in uses browser storage and a full-height layout, so a separate folder or subdomain is cleaner.
3. **Restyling:** all colours and fonts are CSS variables at the top of the `<style>` block in `index.html` (`--bg`, `--ink`, `--accent`, ...). Light and dark themes are both defined there.

## Supabase settings to check

- In Supabase, go to **Authentication > URL Configuration** and set the **Site URL** to the final address. Add it to **Redirect URLs** too. Password-reset and confirmation emails use it.
- The `anonKey` in `config.js` is a **public** key by design. Data is protected by the login and by database rules (row level security) defined in the SQL files. Never put the `service_role` key in these files.
- Sign-ups are **invite only** by default. Managers create an invite code for each person in the Access screen.
- The first account created becomes the manager.

## How the data is stored

One generic table, `docs(collection, id, data jsonb)`, plus `profiles` (who can sign in, and whether they are a manager) and two small manager-only tables (`invites`, `app_settings`).

Collections in use: `locations`, `baristas` (name, role, location), `staff` (skills and private notes, readable only by managers and that barista), `checks` (coffee checks) and `settings`.

Row level security decides who can read and write each collection. Baristas can edit or delete their own checks for 24 hours.

## External resources the page loads

- `@supabase/supabase-js` 2.116.0 from jsDelivr
- Geist and Geist Mono fonts from Google Fonts
- SheetJS from cdnjs, only when someone clicks "Download Excel"

If the company site uses a strict Content-Security-Policy, allow those three hosts and `https://*.supabase.co` for connections.

## Notes

- Works in current Safari, Chrome, Firefox and Edge, on phones and computers.
- Everything animated switches off for people with "reduce motion" turned on.
- The previous, fuller version (leadership group, ideas, responsibilities, charts) is kept in git under the tag `full-v2` if it is ever wanted back.
