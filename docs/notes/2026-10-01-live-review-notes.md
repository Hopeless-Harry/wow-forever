# Live review notes: MAM Chronicles 0.2.0-alpha25 (Retail 12.1)

Reviewed in the running game on 1 October 2026: Home, Chronicle, Medals, Statistics, Characters, Map, Guild, Settings, the ? button and the tour, the goal tracker, and the minimap area. Character: level 90 Rogue, upgraded install (all tabs visible).

## What already works well

- The ? button sits cleanly beside the close button; its tooltip appears and the tour opens at step 1 of 9.
- Settings now reads like a proper options page: category list on the left, search box, info pane with icon on the right, section dividers, clear check boxes. Best-looking page in the addon.
- Medals rows are clear: name, description, progress bar, points, GOAL tag.
- The goal tracker is small, readable and out of the way; goal and quest colours are distinct.
- The Modern theme frame, gold trim and tab underline look consistent with the game.
- Home tiles (creatures killed, quests, deaths, dungeons, flight paths, delves) are big and readable.

## Problems seen

1. **Old data still shows repeated discoveries.** Chronicle and Statistics still list the same place several times ("Discoveries 6", "Favourite place: Crystalsong Forest (5 discoveries)"). The running game was loaded before the discovery fix, so it needs `/reload` for the one-time clean-up. Confirm after reload that the repeats are gone and `/mam diag` shows the removed count.
2. **Chronicle is flooded with Session login / logout rows.** About half the list is "Logged in" / "Logged out after 1m". This hides the interesting entries. Collapse sessions into one line per day, or hide them behind a filter that is off by default.
3. **Statistics and Characters are text walls.** Small font, no spacing between sections, everything the same weight. Hard to scan. Needs bigger headings, spacing, two columns or collapsible sections.
4. **Home "This month" panel is dense gold text** on a dark panel (events, deaths, Mom Money, quests, four goals, Explorer, statistics, guild line all in one block). Tiles above are good; this block should be split into small labelled rows with the numbers right-aligned.
5. **The "What's new" line is tiny.** One long sentence in small gold text with a small x. Make it a slim banner with a title and a "See more" link.
6. **The Characters tab label is cramped.** Nine tabs at 66 px leave "Characters" touching its border. Simple view (hiding Statistics, Characters, Map, Guild) fixes this, but upgraders do not have it on. Offer it in the tour's last step or shorten the label.
7. **The tutorial window sits on top of the action bars.** It is placed under the main window, which on this layout is over the bottom UI. Anchor it to the side of the window, or inside the window as a banner, and keep it away from the action bars.
8. **Tutorial text is small** and the first title wraps to two lines. Shorten it ("Welcome to Chronicles") and use a larger body font.
9. **Medals header is confusing.** "Mom Money 445 (1070 earned)" and "44 of 289 Mom Medals earned · 24 of 99 titles · showing 91". Two money numbers and three counts in two lines. Show one headline number, with the rest as small labels.
10. **Medals list is long** (Next up shows 91 rows). Cap Next up to about 12 with "Show more", or group by family.
11. **Medal icons are all the same star.** Every row shows the same grey star badge, so rows look identical at a glance. Use a per-category icon.
12. **Map tab is mostly empty** when nobody shares: a paragraph, two check boxes and "Nobody is sharing yet" shown twice (left and right panel and the footer). Merge into one empty state with a single "Invite guildmates" hint.
13. **Guild tab is plain text** and empty for someone not in a guild ("Guild sharing: not in guild" shows on Home). Show a friendly "Join a guild to see a leaderboard" state, and hide the tab when not in a guild.
14. **Settings has "Guild hub (owner only)" for everyone**, plus "Share my stats with the guild hub" ticked. Hide owner-only sections unless the character is rank 0 or 1, and confirm the consent default is off.
15. **Window is small on a large monitor.** Fonts are small at 100% size. The Window size slider helps, but the default could scale with the screen size, or offer a "Large text" option.

## New ideas

- **First-run checklist on Home:** four tick boxes (open Medals, pin a goal, try /mam map, finish the tour) that disappear when done.
- **Chronicle day view:** group entries by day with a heading and a count, and a "Today" jump button.
- **Medal icons and tiers:** per-category icons and a small bronze/silver/gold ring around each, so progress is visible without reading.
- **Medal detail pane** (like the Settings info pane): click a medal to see what counts, tips, and who in the guild has it.
- **Per-character dashboard cards** on the Characters tab instead of text: level, class colour, medals, Mom Money, professions as small bars.
- **Shareable summary card:** a one-click image-style frame of Home that can be screenshotted (names, level, top medal, Mom Money).
- **Quest log helper:** show Mom Quest progress in the objective tracker area next to the game's own quests.
- **Toast history:** a small list of the last 20 toasts so nothing is missed while muted.
- **Daily/weekly resets:** a "resets in 2d 4h" line for weekly Mom Quests.
- **Keyboard shortcuts inside the window:** number keys to switch tabs, Esc to close (already works), `/` to focus search.
- **Sound packs and toast styles** unlocked with Mom Money (the shop exists; add previews in the shop list).
- **Accessibility:** colour-blind friendly progress bars (pattern or percentage label) and a high-contrast theme.
- **Export a screenshot-friendly Memory Book** as plain text for forum posts.
- **Guild events:** weekly guild goal ("everyone log in 3 days") with a shared progress bar, built on the totals message.

## Suggested order

1. `/reload` and verify the discovery clean-up (problem 1).
2. Chronicle sessions collapse (2) and the Statistics/Characters/Home text layout (3, 4, 5).
3. Tutorial placement and sizing (7, 8) and the cramped tab label (6).
4. Guild and Map empty states, hide owner-only settings (12, 13, 14).
5. Medals header and icons (9, 10, 11), then the new ideas.
