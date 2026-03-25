import Default from './default';

import type Mob from '@acacia/server/src/game/entity/character/mob/mob';

export default class Spider extends Default {
    public constructor(mob: Mob) {
        super(mob);
    }
}
