# Recovery

Addon installs create dated copies under `backups\addons`.

Restore one backup:

```powershell
npm run restore:addon -- ForeverBridge "C:\full\path\to\the\backup"
```

The original cleanup backup is stored in the main project at:

```text
C:\Users\44750\Documents\ChatGPT\WoW\backups\client-addons\2026-09-21-before-wow-forever-workspace
```

That backup contains ForeverDeck, Lorewalker, Midas and ProfitProphet. Auctionator was never moved or changed.

