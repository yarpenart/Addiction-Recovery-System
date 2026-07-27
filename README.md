# Addiction Recovery System

Foundry VTT module for:

- Foundry Virtual Tabletop 13, build 351
- Dungeons & Dragons Fifth Edition 5.3.3
- Dice So Nice (automatic compatibility through Foundry chat rolls)

## Content warning

This module discusses addiction, recovery, sobriety, and relapse. The player
retains final authority over their character's Sobriety Triggers and how
recovery or relapse is portrayed.

## Included features

- Multiple addictions per character.
- GM actor search covering tokens on the current scene and world Actors.
- Addicted characters are sorted to the top.
- Per-addiction name, Sobriety Die, status, Triggers, GM notes, and
  "cannot be resolved through recovery alone" marker.
- Movable and lockable GM shortcut panel.
- GM-triggered private chat prompts sent to the character owners and GMs.
- A dedicated Sobriety Roll window with Roll Mode and Normal, Advantage, or
  Disadvantage controls instead of placing those controls directly in chat.
- The Sobriety Roll illustration changes between d4, d6, d8, d10, d12, and
  d20 to match the current Sobriety Die and uses packaged SVG artwork so it
  remains visible in the Foundry dialog.
- Public, Private GM, Blind GM, and Self roll modes.
- A natural 1 uses the classic dnd5e critical-failure styling.
- Automatic die reduction and relapse state.
- Inventory-tab counter and collapsible addiction entries inserted directly
  below the Loot section.
- Player-editable Sobriety Triggers (GM-configurable).
- Third "Addiction Recovery" section in the dnd5e Long Rest dialog.
- A GM-only module setting chooses whether Long Rest recovery applies to all
  active addictions or lets the player choose one active addiction in the
  Long Rest dialog. In single-addiction mode, the GM also chooses whether every
  other addiction loses one die step or remains unchanged.
- Addictions marked as unable to be resolved through recovery alone have their
  automatic die increases and decreases locked; only the GM manager can change
  those dice.
- Manual Sobriety Die controls are GM-only. Players roll from GM-sent Sobriety
  Trigger prompts.
- Addiction Recovery details appended to the standard Long Rest chat summary.
- GM-configurable die ladder, thresholds, step changes, downtime behavior,
  history size, default roll mode, and optional completion above the maximum die.
- English and Polish interface using the current Foundry language.

## Installation

### Manifest URL

Install or update the module in Foundry/The Forge with:

```text
https://github.com/yarpenart/addiction-recovery-system/releases/latest/download/module.json
```

For manual installation, create:

`FoundryVTT/Data/modules/addiction-recovery-system/`

and extract the ZIP contents into that directory so that `module.json` is
directly inside it.

After enabling the module:

1. Open **Configure Settings → Module Settings → Addiction Recovery System**.
2. Use the movable GM panel and open **Characters**.
3. Find a character and select **Add addiction**.
4. Configure the addiction and save it.
5. Enter a scene Trigger in that addiction's card and select **Send Trigger**.

## Publishing a release

The included GitHub Actions workflow creates a Foundry-ready release whenever a
version tag is pushed.

1. Set the new version in `module.json`.
2. Update the version in the `download` URL in `module.json`.
3. Commit and push the changes to `main`.
4. Create and push a matching tag, for example:

```bash
git tag v0.1.6
git push origin v0.1.6
```

The workflow verifies that the tag and manifest versions match, then publishes
`module.json` and `addiction-recovery-system.zip` as release assets.

## Original rule defaults

- Sobriety Dice: d4, d6, d8, d10, d12, d20.
- A result of 2 or higher maintains the current die.
- A result of 1 reduces the die by one step.
- A result of 1 on d4 begins a relapse event.
- Selecting recovery during Long Rest improves the die by one step.
- A character in relapse who selects recovery re-enters recovery at d4.
- Leaving the Long Rest recovery option unchecked causes no change by default.

The optional automatic "Recovered" status above d20 is disabled by default
because it is not part of the original rules.

## Rules credit

The supplied Addiction Recovery System text credits Brennan Lee Mulligan and
Joe DeSimone (Co-Founder of The Academy of Games), based on consultancy by
Joe DeSimone and Seosamh Lily. This Foundry module is an unofficial automation
tool and is not affiliated with Dimension 20.

## Development verification

Run the pure rules tests with:

```bash
node tests/engine.test.mjs
```
