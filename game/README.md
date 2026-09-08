# game/

Plain JavaScript, meant to be **pasted into the in-game editor** (`nano <name>.js`).

Everything under `src/` is TypeScript that reaches the game through the Remote
File API; everything here is copied by hand. Same ideas, no build step — useful
when you're playing on a machine that isn't running `npm run watch`.

`tsconfig.json` only compiles `src/`, so nothing here is typechecked. Keep it
plain and keep it small.

## hwgw/

A HWGW batcher. `batch.js` is the controller and runs on `home`; `w.js`, `g.js`
and `h.js` are the workers it spreads across the fleet.

```
run hwgw/batch.js phantasy 0.10
```

See the repo README and `notes/progression.md` for what it's doing and why.
