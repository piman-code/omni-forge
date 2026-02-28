# Chat UI Simplification

## Problem
- Expanding collapsible blocks in chat could consume too much vertical space.
- Parser/model/workflow controls mixed into chat runtime made the pane noisy.

## Applied Changes
- Added `Compact chat UI (recommended)` setting.
  - Default: ON
  - Effect: hides advanced parser/model/workflow blocks from chat pane.
- Kept chat essentials in-pane:
  - message thread
  - input box
  - send/stop
  - minimal runtime status
- Moved advanced controls to Settings flow:
  - parser inbox controls
  - model profile/detail controls
  - workflow maintenance tools
- Stabilized layout:
  - chat grid row structure expanded to prevent row overflow collision
  - collapsible advanced blocks capped with internal scroll

## Before/After Capture Checklist
- Before:
  - open chat pane
  - expand parser + workspace options
  - capture layout with thread/input overlap pressure
- After:
  - compact mode ON (default)
  - verify only essential controls are visible
  - verify thread/input region keeps stable height

## Suggested Screenshot Paths
- `docs/screenshots/chat-before.png`
- `docs/screenshots/chat-after.png`

## Regression Checks
- Send/stop works with compact mode ON/OFF
- Attachments (drag/drop/paste) still work
- Thread sync status visible in compact mode
