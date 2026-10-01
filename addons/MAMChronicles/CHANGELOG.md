# Changelog

## 0.2.0-alpha25

Guild hub (for guilds that run a Raspberry Pi hub). Nothing in this part is whispered or posted in guild chat: it all travels as hidden addon messages on the guild channel, like medal announcements and map positions do.

- Stats sharing (asks first): when the guild's hub gateway is online, the addon asks once whether to share a small summary: level, class, race, title, medal count, Mom Money and a few activity counts (wine, ale, coffee, food, jumps, creatures killed, quests, deaths, dungeons, flight paths and similar). Never chat, whispers, gold, item names, BattleTag or account details. Nothing is sent until you say yes. Settings > Alerts > "Share my stats with the guild hub", or `/mam share on`, `/mam share off`, `/mam share forget` (asks the hub to delete everything it holds about you).
- Guild announcements, weekly Mom Quest overrides and a guild message from the guild's rank 0 and rank 1 leaders now show up for everyone (the same roster rank check as medal awards).
- Gateway mode (owner only, rank 0 or 1): Settings > Guild hub, or `/mam gateway on|off|sync`. Announces the hub, collects members' shared stats and locations, and keeps them for the companion app. "Sync now" reloads the interface so the game writes the data to disk.
- The welcome text and Getting started card now say exactly what is shared and how to opt out.
- Technical: guild messages longer than 64 characters are now accepted for the new hub types only (each has its own limit); everything else keeps the old limit.

Midnight (12.x) hardening and clean-up.

- Secret values: enemy names, loot chat text and addon-message text/senders can be hidden from addons inside instances. They are now skipped instead of raising errors, so a death in a dungeon is still recorded (without the enemy name).
- Guild medal announcements now wait out a chat messaging lockdown (boss fights, Mythic+) instead of being thrown away, and are sent when it ends or when you zone in. A realm that restricts outgoing addon messages is detected before sending. The held queue is capped at ten.
- Guild medal totals: 20 seconds after login the addon sends one tiny T1 message (medal count and Mom Money only) so guildmates who missed live toasts can see where you stand; /mam guild lists the totals received. Controlled by the existing "Announce my Mom Medals to the guild" setting. Older builds simply ignore it.
- /mam mute [minutes] holds every toast for a while (default 30, up to 8 hours) without losing any; /mam unmute shows them again.
- Levelling pace: the Statistics tab shows how long your last levels took (time actually played, not days away), your average, and roughly how much more play it takes to reach the level cap. The level-up toast says how long that level took.
- New Guild tab: a leaderboard of your guildmates' Mom Money and medal counts (with you in it) and the latest guild medals. Guildmate totals are now saved between sessions, so the board is not empty after a /reload. /mam guild opens it and /mam guild send shares your own totals right away. There are now nine tabs.
- Two new medal families: Postmaster Mom (mail sent) and Savings Account (bank visits), with titles, in Mom Habits.
- Settings redesigned in the style of the big QoL addons: a category list on the left (click to jump, highlights the section you are reading), a search box that fades non-matching options and scrolls to the first match, and an info pane on the right that describes whichever option you point at. The window widens to fit when you open Settings.
- Window size slider (70-130%) and a Reset window position and size button in Settings > Appearance.
- The minimap and data-broker tooltip now shows Mom Money, medals earned, your next goal and this week's Mom Quest progress.
- Key binding: Key Bindings > AddOns > Moms Against Magic Chronicles > Open or close the Chronicle. /chronicle also works as a short command.
- Tracker polish: hover tips on every row, right-click a goal or guildmate to unpin it, and a Lock option so it cannot be dragged by accident.
- Shift-click an earned medal to put a line about it in your chat box (nothing is sent for you).
- Follow mode no longer forces the arrow back on at every update, and stopping it leaves a waypoint you placed yourself. Guild medal totals are rate limited per sender and the announce setting's tooltip now says totals are sent once per login.
- Goal tracker (new): a small movable window with your pinned medal goals, this week's unfinished Mom Quests and pinned guildmates. Click a goal to open Medals, click a guildmate to open the map at them. Settings > Goal tracker, or /mam tracker.
- /mam map follow <name>: the map waypoint follows a guildmate as their position updates; /mam map follow off stops it.
- Leaving a dungeon or raid shows one wrap-up toast (notable drops, quests, deaths recorded inside).
- Optional LibDataBroker launcher, so Titan Panel, ElvUI, Bazooka and similar can open the Chronicle.
- The ground check that counts jumps pauses while dead or on a flight path.
- Settings now have a numbered migration list; /mam diag shows how many guild announcements are queued.
- The Home subtitle shows roughly how much play is left to the level cap, the minimap tooltip shows your login streak, and clicking a guildmate's medal toast opens the Guild tab.
- Tidy-up: one shared safe-method helper instead of six copies, six unused functions removed, /mam help lists /mam map follow, and the README now matches what the addon records and shares.
- Map: removed a duplicated test helper. Counters: the ten-times-a-second ground check no longer allocates.

## 0.2.0-alpha24

- Location sharing is now ON by default (new installs and anyone who never touched the setting). Untick Settings, Guild map, Share my location to stop. Still never saved, never sent in instances, and only guildmates running the addon receive it. If you had already turned it off, it stays off.

## 0.2.0-alpha23

- Medal progress bars (jumps, food and so on) now update live while the Medals tab is open.
- /mam map fake adds three pretend guildmates (in memory only) so you can try the Map tab, click-to-go and world-map pins alone. /mam map fake off removes them.

## 0.2.0-alpha22

Jump fix, guild dungeons and a live guild map.

- Jumps are now counted by watching for the character leaving the ground (the jump key never reached the old hook). Short hops and ledge drops may also count.
- Dungeons and raids with guildmates: new counters, medals, titles and a weekly Mom Quest.
- New Map tab: live guildmate locations on the right, click a name to open the world map at them. Sharing your own location is controlled in Settings, Guild map, never saved, never sent in instances. /mam map opens it.
- You can now pin up to 6 medal goals (was 3).

## 0.2.0-alpha21

Fixes from the first live Retail screenshots of the Modern theme.

- Medal rows are taller and the art progress bar is slimmer, so the bar no longer sits on top of the description text.
- Home tile numbers use a larger game font instead of a stretched one, so they are sharper. If a client lacks that font the addon falls back to the previous one.
- Weekly Mom Quests: before the Forever launch the preview week now rolls over every real week, and "Log in on N different days" counts this week's logins (it showed 0 right after you logged in).

## 0.2.0-alpha20

- **Modern theme with real texture art**, now the default: an ornate gold-trimmed window frame with a soft shadow, hanging tabs, inset panels, brown and red buttons with hover, pressed and disabled states, art checkboxes, a gold scrollbar thumb, ornate section dividers, art progress bars, and tier medal badges (bronze, silver, gold, platinum) on every medal row. Toasts get an ornate frame with a coloured glow behind the icon, and the minimap glow uses soft glow art.
- The art is 13 texture sheets in the new `Art` folder, all original and generated by a script, drawn with the same rounded-corner nine-slice technique the big UI addons use. The window transparency slider fades the art.
- Midnight, Parchment, Crimson and Slate are still available in Settings > Appearance > Theme (Apply reloads the interface). An old default Midnight setting moves to Modern once.

## 0.2.0-alpha19

- **Animations:** the window and each page fade in softly, medal progress bars grow out from the left when you open the Medals tab or change a filter, medal and guildmate toasts shimmer and pop their icon, toasts ease in and drift out, and the minimap button glows gently while something new is waiting (a toast appeared while the window was closed) until you open the window. They use the game's own animation system, so they cost nothing per frame, and **Settings > Appearance > Animations** turns them all off.
- Medal rows light up when you hover them, and the window has a slim accent line along the top.

## 0.2.0-alpha18

- **Weekly Mom Quests:** three small tasks a week (adventure, Mom life and a stretch goal) that pay extra Mom Money, plus a bonus for finishing all three. Week one counts from the WoW Forever launch (4 November 2026) and is gentle: a few quests, a few meals, a level 10 goal. Difficulty ramps up every two weeks to about week twelve (level goals follow the usual Forever pace and never pass 60). Every guildmate on the same version gets the same quests without any messages. They show on Home and with `/mam quests`.
- **Holiday medals:** Brewfest, Hallow's End, Winter Veil, Lunar Festival, Love Is in the Air and Midsummer each have a "log in on days" series and a themed activity series that only counts while the holiday runs, plus a toast when a holiday starts. Holiday dates are approximate and may differ on Forever. New Holidays category.
- **Characters tab:** all your characters on the account with level, class, title, medals, Mom Money, professions and when you last played. Local only.
- **Memory Book:** `/mam book` or the Memory Book button on Home: your firsts (quest, death, dungeon, loot, medal), level milestones, best medals, pinned memories and close calls.
- **Quiet mode:** toasts are held in dungeons, raids, scenarios and battlegrounds and shown when you are back in the open world (Settings > Alerts, on by default).
- Mom Money now includes quest rewards; the Medals tab shows what you have earned and what is left.

## 0.2.0-alpha17

- **Medal categories:** every medal is now in one of Progress, Kitchen & Bar, Mom Habits, Emotes, Play Pattern or WoW Forever. A **Category** button on the Medals tab cycles through them and works together with the filters, Next up and search. Empty categories (for example WoW Forever on Retail) are skipped.
- **A title for every medal family:** all 96 families now have their own Mom title (Stare Mom, Facepalm Mom, Camp Decorator Mom and so on). The Medals tab shows how many titles you have earned.
- **New title toast:** the first medal you earn in a family unlocks its title and shows a "New title" toast. Titles from your starting history are not announced.

## 0.2.0-alpha16

- The Medals tab now opens on **Next up** (one medal per family, the next tier to aim for). Click All to see every medal.

## 0.2.0-alpha15

- **Next up** filter on the Medals tab: one medal per family, the next tier to aim for, so the long list becomes short. The filter buttons now sit on their own row.
- **Mom titles:** you get a title from the medal family you have earned the most Mom Money in (Wine Mom, Trampoline Mom, Night Owl Mom and more), shown on Home, the Medals tab and recaps. Settings has a button to pick any title you have earned.
- **Mom Money shop** (Settings): spend Mom Money on toast colours (Rose, Teal, Violet, Sunset) and title flourishes (the Great, Supreme, of Legend). Purely cosmetic and local; nothing is sent to the guild. Your Mom Money total shows what is left and what you earned.
- **Hall of Shame and Fame** on the Statistics tab: most dangerous place, worst day, falls, busiest day, longest session, time played, favourite place and highest level, worked out from your recorded events.
- **Last session** line on Home: levels, quests, discoveries, deaths and medals from your previous session and how long ago it was.
- **Weekly recap:** `/mam recap week` for the last seven days. Recaps now include your title.

## 0.2.0-alpha14

- **Toast sound choices:** nine stock game sounds (Chime, Quest complete, Fanfare, Loot toast, Ready check, Raid warning, Map ping, Whisper, Coins). Settings > Alerts > "Toast sound" plays each one as you click through and keeps your choice. Sounds still only play when "Play a sound with toasts" is ticked.
- The statistics scan now waits 0.05 seconds between slices, so its roughly 3 seconds of total work is spread thinly instead of adding a few milliseconds to every frame.

## 0.2.0-alpha13

Fixes from the first live Retail screenshots of alpha12.

- The statistics scan is now split after every single statistic. It took 2.7 seconds for 441 statistics on Retail, and the previous split only paused between categories, so one large category could still cause a hitch.
- Chronicle and Home rows show readable text: "Logged in", "Logged out after 1h 1m", "Reached level N" and medal names with their Mom Money, instead of raw event names.
- The Statistics tab shows the reporting window as dates instead of raw numbers.
- Statistics that only mention "gold" in their name (for example Gold Challenge ratings) are no longer treated as money.

## 0.2.0-alpha12

- A pinned medal goal now shows one "Nearly there" toast when you reach 90 percent of its target (targets of 5 or more). It follows your toast settings and waits for combat to end.

## 0.2.0-alpha11

- **Monthly recap:** `/mam recap` or the Copy recap button on Home gives a short, shareable summary of the month (sessions, deaths, quests, medals earned with their Mom Money, top statistic changes). It never includes your character name, realm or gold.
- **Medal goals:** click an unearned medal on the Medals tab to pin it as a goal (up to three). Goals and their progress show on Home. A pinned medal drops off the list when you earn it.
- **Safer saved data:** one damaged event no longer erases your history. Valid events are kept, the broken ones are dropped, and `/mam diag` shows a `Recovery:` line saying how many.
- **Guild sharing versions:** medals sent by a newer or older build are counted quietly as "unknown" or "other version" in `/mam diag` instead of being treated as dropped or forged messages.

## 0.2.0-alpha10

- Getting started card on Home for new testers (dismissible and remembered) and a "What's new" line after an update. The chat welcome is one short line.
- Diagnostics tab has a **Copy diagnostics** button and a note on what to paste back. The report now includes the level cap, SavedVariables counts (events, medals, guild feed entries) and a handler error count with the last short message.
- Medals tab: All / Earned / In progress / Locked filters, a search box, a tooltip on every medal saying how it is tracked and how far along you are, a NEW marker for medals earned this session, and rows created only for what is on screen.
- Forever-first: Home shows Campfires lit instead of the Retail-only Delves tile, the guild sharing line shows its real state, and empty statistics explain which medals still work.
- Stability: every growing table is bounded (sessions, duplicate filter, counters); the statistics scan is split across frames on slow machines and reports its cost in `/mam diag`; a failure in one handler no longer affects the others and is counted.
- Combat safety: the window, minimap button and layout changes wait until combat ends. Counters stop while recording is switched off.
- Item lookups use the modern `C_Item` API where it exists.
- Parchment theme: readable labels, event colours and medal tiers.
- New commands `/mam medals` and `/mam settings`; `/mam help` lists every command. The window never starts larger than the screen.

## 0.2.0-alpha9

- Reviewed every medal for WoW Forever. Retail-only medals (Delver, Treasure Hunter Mom, Pet Playdate, Achiever, level 80 and 90) are hidden on Forever. Medals that depend on a game statistic only appear when the client reports that statistic. Level medals stop at Forever's level 60 cap.
- New WoW Forever medals: camping (Happy Camper, Firestarter, Journeyman Camper, Expert Camper, Camp Decorator, Well Stocked Camp, Campfire Chef), new content (Unexplored Depths, Summit Seeker, Into the Barrow, Islander, New Horizons) and Plot Twist for the new race and class combinations.
- `/mam diag` lists camp-related spell names the client reports so campfire detection can be verified.
- Package is ready for CurseForge: licence, changelog and description added.

## 0.2.0-alpha8

- 235 Mom Medals, including the WoW Forever set (The Journey Matters, Ready for the Core, Beta Testing Mom, Day One Mom, One Year Later, Skyborne Landing).
- Emote, vendor, group, ready-check and equipment counters. Fall deaths are detected. Session length is recorded. Medal progress is stored permanently.

## 0.2.0-alpha7

- Mom-themed medals and activity counters. Send a test toast from Settings or `/mam toast`.

## 0.2.0-alpha6

- Mom Medals and Mom Money, combat-safe toast alerts, opt-out guild announcements of new medals, themes and window transparency, organised Settings.

## 0.2.0-alpha5

- Home dashboard, scrolling text areas, opaque window background.

## 0.2.0-alpha4

- Flat themed window, colour-coded timeline, tooltips.

## 0.2.0-alpha3

- Achievement statistics baseline and monthly changes (gold statistics off by default).

## 0.2.0-alpha2

- Minimap button, Addon Compartment, Blizzard Settings page, remembered window, erase confirmation.

## 0.2.0-alpha1

- Personal Chronicle: sessions, levels, deaths, quests, zones, instances, loot, professions, achievements and memories.
