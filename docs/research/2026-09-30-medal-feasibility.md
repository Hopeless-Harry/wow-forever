# Mom Medals: can each one actually be earned?

Date: 30 September 2026. Method: every medal was checked against (a) the Warcraft Wiki API pages for Retail and WoW Forever 1.60.1, (b) what this addon really records, and (c) the user's own Retail Statistics screenshots. **Nothing here has been run in a live client yet.** "Verified" below means confirmed from documentation or from data the user showed us; "live check" means the mechanism is sound on paper but needs one real-game confirmation.

## Defects found and fixed by this check

| Problem | Effect before | Fix |
|---|---|---|
| The death collector never recorded how you died | **Gravity's Favourite could never be earned** (and the older Statistics award of the same name never fired) | The addon now remembers when the player was last falling (a 5-per-second `IsFalling` check) and marks a death within 1.5 s of a fall as `falling`. Live check needed |
| Logout events had no session length | Marathon Mom could never fire | Logout now records the session duration |
| Hugs, dances and kisses were tied to game statistics | The user's Retail Statistics Social group has only two entries (waves and cheers), so those medals could never fire | They now use emote counters. Waves and cheers use the larger of the statistic and the counter |
| Medal progress was rebuilt from stored events | Old events are compacted away after 10,000, so progress would shrink | Event-derived progress is now kept as persisted tallies |
| First event after login was counted twice when the tally was first built | Slight over-count | The first build no longer double counts |
| Level medals assumed a cap of 80 or more | Adventurer IV (80) can never be earned on WoW Forever (cap 60) | Level medals are now hidden when the client's level cap is too low; a level 90 medal was added for Retail |

## Verdicts by family

**Verified from the user's own Retail Statistics (names seen on screen):** Slayer (Creatures killed), Quest Machine (Quests completed), Commitment Issues (Quests abandoned), The Daily Grind (Daily quests completed), Home Is Where the Heart Is (Number of times hearthed), Frequent Flyer (Flight paths taken), Carpool Lane (Summons accepted), Dungeon Regular (Total 5-player dungeons entered), Treasure Hunter Mom (Mislaid Curiosities looted), Delver (Total delves completed), Battlemaster (Battlegrounds played), Auction House Goblin (Auctions posted), Impulse Buyer (Auction purchases), Healthy Snack (Healthstones used), Crazy Cat Mom (Vanity pets owned), Pet Playdate (Pet Battles won at max level, so it counts max-level wins only), Friendly Neighbourhood Mom (Total waves), Cheerleader Mom (Total cheers).

**Chronicle events the addon already records (works):** Fresh Start, Memory Keeper, Explorer, Comeback Kid, Oops-a-Daisy, Shiny Collector, Achiever, Up Past Bedtime, Early Bird Special, Kitchen Witch, Patient Angler, Jack of All Trades, Mom of Many, Long Haul, Clean Run, Learning Experience, Raid Night, Regular Regular, Weekend Warrior, Just Five More Minutes, Marathon Mom. The dungeon ones rely on `instance.entered` / `instance.exited` carrying the instance type, which the collector already records.

**Emote medals (Sit Down Everyone, Nap Time, Mom Stare, Are You Serious, Because I Said So, Thank-You Note, Hugs and Kisses, Kitchen Dance Party, Smooches, plus waves and cheers):** `DoEmote` was deprecated in patch 12.0.0 and replaced by `C_ChatInfo.PerformEmote`, which exists on Retail and on Forever 1.60.1. The addon hooks whichever exist. **Live check:** whether typing `/sit` reaches those functions. `/mam diag` lists the hooks that installed (`Medals: ... hooks ...`). Only the emote name is counted, never chat.

**Consumable medals (wine, ale, coffee, food, cheese, cookies, pie, soup, fish, juice, water, bandages, potions):** hooks on `UseAction` and `C_Container.UseContainerItem`, confirmed by the player's next successful cast within 2 seconds. Item names are matched as whole words and never stored. **Live check:** that every food and drink type fires a cast event. Known gap: using the very last item of a bag stack may be missed.

**Habit medals:**
- Jumps, mounting, going AFK, resting, screenshots: standard events and `JumpOrAscendStart`. Live check.
- Group joins and leaves: `GROUP_JOINED` and `GROUP_LEFT` exist on Retail and Forever (wiki confirmed). Debounced two seconds.
- Ready checks: `READY_CHECK_CONFIRM` exists on both; the wiki notes it can fire twice, so it is debounced five seconds and only counts the player's own "ready".
- Outfit changes: `PLAYER_EQUIPMENT_CHANGED` exists on both but the wiki says its payload semantics are unclear; the addon ignores changes for 10 seconds after entering the world and debounces half a second.
- Repairs: `RepairAllItems` exists on both. There is no repair event, so the hook only counts calls made while a merchant window is open; it cannot prove gold was paid.
- Vendor sales and purchases: `BuyMerchantItem` is protected but hooking it is fine; `C_MerchantFrame.SellAllJunkItems` exists on Retail and Forever; right-clicking a bag item at an open merchant is counted as a sale.

**Cut:** Splash Landing (drowning). There is no reliable signal for the cause of death, so it was removed rather than shipped broken.

**Deferred until guild sharing is proven between real players:** Moms Unite, Family Dinner, Group Hug, Forever Family. They need trustworthy guild data.

**Merged:** First Raid Ever (Forever) is Raid Night I; Master Chef and Master Angler are skipped because profession skill scales differ between expansions.

## WoW Forever medals

What is known from Blizzard's announcement: level cap 60, a reimagined original Azeroth set before Molten Core, new regions, dungeons and raids, a new Skyborne race, launch on 4 November 2026. From the Warcraft Wiki: Forever is build 1.60.1 with interface 16001, and the APIs used here exist on it. The addon treats any client with an interface number below 100000 as Forever.

| Medal | How it is earned | Status |
|---|---|---|
| The Journey Matters I to V, Ready for the Core | Levels 10 to 50, then level 60 | Verified logic; level cap 60 is from Blizzard |
| Old World, New Tricks | Zone discoveries on Forever | Same data as Explorer |
| Beta Testing Mom | A login recorded before 4 November 2026 on a Forever client | Verified logic; the launch date is from Blizzard and could move |
| Day One Mom | A login on 4 November 2026 (local time) | Same |
| One Year Later | 365 days since this client's database was created | Same |
| Skyborne Landing | The character's race token contains "sky" | **Live check.** The wiki says a new race gets a discoverable token but not what it is; `/mam diag` prints the race token so it can be confirmed |

Retail and Forever keep separate SavedVariables, so Forever medals never leak onto Retail.

## WoW Forever review (alpha9)

Sources checked on 30 September 2026: Blizzard's announcement, the Warcraft Wiki page for Forever, and beta guides (Blizzard Watch, ClassicWoW.gg, ForeverChanges) for the camping system. Facts used: permanent level cap 60; Normal, PvP and Hardcore rulesets; new zones Mount Hyjal, Riverglades, Shen'dralas and Zephras Isle; nine new dungeons (Hall of Thanes, Ruins of Lordaeron, Excavation Site: Wetlands, City of Dalaran, The Drowned City, Krol'dok Stronghold, Alcaz Prison, Blackmaw Hold, Shaper's Terrace); raids Hyjal Summit and The Barrow Deeps; the Darkspear Islands battleground; six new race and class combinations plus the Skyborne race; Basic, Journeyman and Expert campfire kits with profession camp objects; launch on 4 November 2026. Delves, Mislaid Curiosities and pet battles do not exist on Forever.

### What each medal family does on Forever

| Rule | Families |
|---|---|
| Shown on Forever (built on Chronicle events, hooks or counters) | Fresh Start, Memory Keeper, Explorer, Quest Machine, Dungeon Regular, Comeback Kid, Adventurer I to III, Shiny Collector, every consumable medal, every habit medal (jumps, mounts, AFK, rest, screenshots, outfits, repairs, sales, purchases, groups, ready checks), every emote medal, Up Past Bedtime, Early Bird Special, Marathon Mom, Just Five More Minutes, Regular Regular, Weekend Warrior, Learning Experience, Clean Run, Raid Night, Oops-a-Daisy, Kitchen Witch, Patient Angler, Jack of All Trades, Mom of Many, Long Haul, Gravity's Favourite, Murloc Magnet |
| Shown on Forever only if the client reports the statistic | Slayer, Frequent Flyer, Home Is Where the Heart Is, Carpool Lane, Commitment Issues, The Daily Grind, Impulse Buyer, Healthy Snack, Crazy Cat Mom, Auction House Goblin, Battlemaster. Forever's Statistics content is unverified, so these appear automatically when the data exists |
| Hidden on Forever (Retail only) | Delver, Treasure Hunter Mom, Pet Playdate, Achiever, Adventurer IV and V (levels 80 and 90) |
| WoW Forever only | The Journey Matters, Ready for the Core, Old World New Tricks, Beta Testing Mom, Day One Mom, One Year Later, Skyborne Landing, and the new camping and content set below |

Counts: 264 medals in 96 families in total. A Forever client shows 221 without any statistics and up to 250 with all of them.

### New Forever-only medals and how each is detected

| Medal | Detection | Confidence |
|---|---|---|
| Happy Camper | A completed quest whose name contains "The Great Outdoors" (the camping intro quest, around level 5) | Quest name from beta guides; live check |
| Firestarter I to IV | Player spell cast whose name contains the word "campfire" | Names from beta guides; live check via `Camp spells seen:` in `/mam diag` |
| Journeyman Camper, Expert Camper | The same spell name also contains "journeyman" or "expert" | Same |
| Camp Decorator, Well Stocked Camp | Spell name matches a known profession object (Sharpening Wheel, Mana Well, Faction Banner, Camp Tent, Incense Candle, Lodestone, Camp Chair, Enchanted Lute, Reagent Bot, First Aid Kit, Fish Bowl, Repair Bot, Anarchist's Workbench, Tanning Rack, Sewing Machine, Rock Garden, Molten Foundry); distinct kinds tracked separately | Object names from three guides; they may be placed by an item rather than a spell, in which case the counts stay at zero and diag shows what the client reports |
| Campfire Chef | Cooking skill 140, 220 and 300, the unlock levels for the three campfire kits | Skill levels from beta guides |
| Unexplored Depths I to IV | Distinct new dungeons entered (1, 3, 6, 9), matched by instance name | Names from Blizzard's list; two sources disagree on one name (Excavation Site: Wetlands or Whelgar's Excavation), so both are accepted |
| Summit Seeker, Into the Barrow | Enter Hyjal Summit, enter The Barrow Deeps | Names from Blizzard |
| Islander I to III | Enter the Darkspear Islands battleground | Name from Blizzard |
| New Horizons I to III | Discover an area in 1, 2 or 4 of the four new zones | Zone names from Blizzard; relies on the existing discovery events |
| Plot Twist | Race and class match one of Human Hunter, Gnome Priest, Dwarf Shaman, Orc Mage, Troll Warlock, Undead Paladin | Combinations from beta coverage; race token for Undead may be "Scourge" or "Undead" and both are accepted |

### Not added, and why

- Hardcore, PvP or Normal ruleset medals: there is no known API to read the realm ruleset. If the ruleset can be detected after the live check, hardcore-only medals can be added.
- Sitting by a campfire for a minute to gain the camp buffs, learning Blueprint recipes, the Legacy system and account-wide collections: no known event to detect them.
- Rested XP from the Camp Tent: the resting state is already counted for inns and cities; camp resting is not distinguishable.
