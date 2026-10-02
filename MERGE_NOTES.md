# Merge notes

This build combines the original `sapo-tazuhakkasonn` application with the Slack-style team/profile UI.

## Preserved
- Supabase browser/server clients and authentication callback/login flow
- Existing `/api/team` endpoints and original team-setting behavior
- Original profile functionality and public profile route
- Original private-note utilities/components
- Original Slack integration component

## Added / unified
- Slack-style application shell/sidebar/top bar
- `/teams` team list
- `/teams/new` team creation
- `/teams/[teamId]` team details
- `/profile` Slack-style profile editor
- `/profile/settings` original detailed profile/public-profile settings
- `/intro` profile reference UI with personal-note panel
- `/api/teams` and `/api/teams/[id]`
- `/api/users/search`
- `/api/users/me/profile`
- `/api/users/[id]/profile`
- `/api/users/[id]/notes`

## Important
The new UI API client uses same-origin `/api/...` endpoints by default. `NEXT_PUBLIC_API_URL` can still be set if a separate backend is desired.

`node_modules` and `.next` are intentionally not included in the ZIP. Run `npm install` before `npm run dev` or `npm run build`.

A full production build could not be completed in this environment because the dependency cache was incomplete; the source tree and package configuration were checked manually and the project is packaged without generated dependency directories.
