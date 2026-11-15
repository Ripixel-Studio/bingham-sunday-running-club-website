# Content Model

Understanding how content flows from the Admin Panel to the final HTML.

## 1. The Schema (`admin/config.yml`)
The "CMS" is just a UI layer over your JSON files. The `collections` block in `admin/config.yml` defines the fields.

Example:
```yaml
collections:
  - name: "pages"
    files:
      - name: "home"
        file: "content/pages/home.json" # <--- Where data is saved
        fields:
          - { name: "title", widget: "string" }
```

## 2. The Data (`content/`)
When you save in the CMS, it writes to the JSON file specified above.
`content/pages/home.json`:
```json
{
  "title": "Welcome to BSRC"
}
```

## 3. The Templates (`pages/` & `skier.tasks.cjs`)
The build tool [Skier](https://github.com/ripixel/skier) reads these JSON files and makes them available to your HTML templates.

In `skier.tasks.cjs`, the `generatePagesTask` is where the magic happens. It typically loads the JSON and injects it into the page context.

**How to use data in HTML (`pages/index.html`):**
Skier uses Template Literals syntax (`${...}`).
```html
<h1>${page.hero.title}</h1>
```
*Note: `page` usually refers to the specific content file for the current page (e.g., `home.json` data).*

## Adding a New Field
1.  **Edit `admin/config.yml`**: Add the field definition (e.g., `{ name: "subtitle", widget: "string" }`).
2.  **Wait/Deploy**: The CMS needs the new config to show the input.
3.  **Add Content**: Go to Admin, fill in the new field, save.
4.  **Update Template**: Edit `pages/your-page.html` to display `${page.subtitle}`.
5.  **Build**: `npm run dev` to see it locally.

## Run Results (`content/staging/runs/` → `content/results/`)
The race tracker writes `content/staging/runs/{YYYY-MM-DD}.json`; the `process-staging` build task turns it into `content/results/{YYYY-MM-DD}.md`.

Each participant is one of two kinds:
- **Loop runner**: `smallLoops` / `mediumLoops` / `longLoops` counts. If `distance` is absent it is computed from `content/settings/recurring-run.json` (`loopDistances`, plus `approach` once).
- **Own route (free-form)**: all loop counts `0` and an explicit `distance` (km). Staging adds `route: <ownRouteLabel>` (from `recurring-run.json`, CMS: Settings → Recurring Run) so the results show that label in orange instead of loops.

`time` is `MM:SS` or `H:MM:SS`. Own-route runs count towards totals, distance/pace PBs and leaderboards like any other run; they add nothing to the loop legends.
