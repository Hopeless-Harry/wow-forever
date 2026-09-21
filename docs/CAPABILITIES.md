# Capability Status

## VERIFIED

- Detect the local `wow_classic_beta` client, build and interface.
- List addon names and TOC versions.
- Read approved Blizzard log tails.
- Redact account, realm and character names from SavedVariables paths.
- Back up, install and restore project addons.
- Expose local resources and tools through MCP stdio.
- Refuse path traversal and changes to Auctionator.
- Detect the running Forever beta and build `1.60.1.69913` from the real installation.
- Install ForeverBridge while keeping all 696 Auctionator files byte-identical.

## AVAILABLE

- Watch whether `WowB.exe` is running.
- Diagnose new FrameXML errors while WoW is open.
- Read ForeverBridge saved state after WoW saves it.
- Connect Codex after the project configuration is merged, built and Codex is restarted.

## LIMITED

- WoW addons cannot connect directly to MCP.
- SavedVariables update on `/reload`, logout or exit, not continuously.
- Combat logs contain only information Blizzard chooses to write.

## NOT ALLOWED

- Reading game memory.
- Inspecting or changing packets.
- Automated character control.
- Automatic gameplay input.
- Bypassing protected actions or combat restrictions.
