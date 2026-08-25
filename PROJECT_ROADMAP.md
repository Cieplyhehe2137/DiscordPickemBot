# Pick'Em Platform Roadmap

## ✅ Done / Current Foundation

### Public Platform

- Public home page `/public`
- Community hub `/public/:guildSlug`
- Event page `/public/event/:slug`
- Public player profile `/public/users/:userId`
- Public leaderboard `/public/leaderboard`
- My predictions dashboard `/public/me/predictions`

### Public Event Features

- Live event overview
- Match cards
- Featured match
- Match details modal
- Public match stats
- Public prediction modal
- Save/load/edit match predictions
- My Pick'Em progress
- Sticky progress bar
- My Picks filter
- Next Pick shortcut

### Player Features

- Public profiles
- Accuracy stats
- Exact score hits
- Achievements
- Activity timeline
- Recent predictions

### Leaderboard

- Global public leaderboard
- Sort by points, accuracy, exact hits, predictions
- Player profile links
- Leaderboard preview on public home

---

## 🔥 Next Priority

### 1. Discord OAuth Stabilization

Goal: make login/session reliable and use Discord identity everywhere.

Tasks:

- Verify `/api/auth/discord`
- Verify `/api/auth/discord/callback`
- Verify `/api/auth/me`
- Verify `/api/auth/logout`
- Store session user consistently
- Show Discord username/avatar in public UI
- Use session user for prediction saving
- Remove any frontend-sent `user_id` trust

### 2. Event Leaderboard

Goal: leaderboard scoped to one event.

Tasks:

- `/api/public/events/:slug/leaderboard`
- `/public/event/:slug/leaderboard`
- Link from event page
- Points, accuracy, exact hits, prediction count
- Profile links

### 3. Full Pick'Em Web UI

Goal: support main Pick'Em phase predictions from the website.

Priority order:

- Swiss 3-0 / 0-3 / advancing
- Play-In
- Playoffs
- Double Elimination
- MVP

---

## 🧱 Core Systems To Protect

### Multi-Guild

- Every public/admin query must respect `guild_id`
- Never mix data between guilds
- Event slug alone may not be enough long-term
- Prefer event id + guild id internally

### Locking / Deadlines

- Website predictions must respect match locks
- Full Pick'Em predictions must respect phase deadlines
- Backend must enforce locks, not only frontend

### Scoring

- Match predictions
- Swiss predictions
- Playoffs predictions
- Double Elim predictions
- Play-In predictions
- MVP predictions

---

## 🕒 Later

### Social / Platform Features

- Seasons
- Badges v2
- ELO / ranked system
- Profile customization
- Compare players
- Prediction sharing cards

### Visual Polish

- Event banners
- Team logos
- Discord avatars
- Better mobile layouts
- Loading skeletons
- Empty states

### SaaS / Multi-Community

- Community onboarding
- Admin billing/subscription
- Public community discovery
- Custom branding per guild

---

## Rule

Do not add random new features until the current priority block is finished.
