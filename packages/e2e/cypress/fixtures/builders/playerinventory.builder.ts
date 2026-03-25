import defaultPlayerInventory from '@acacia/e2e/cypress/fixtures/playerinventory.default.json';

import type { PlayerInventory } from '@acacia/e2e/cypress/entities/playerinventory';

export function buildPlayerInventory(
    username: string,
    overwrites: Partial<PlayerInventory> = {},
    defaults: PlayerInventory = defaultPlayerInventory
): PlayerInventory {
    return {
        ...defaults,
        ...overwrites,
        username
    };
}
