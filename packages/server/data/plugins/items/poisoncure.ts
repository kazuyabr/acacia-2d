import type { Plugin } from '.';
import type Player from '@acacia/server/src/game/entity/character/player/player';

export default class PoisonCure implements Plugin {
    public onUse(player: Player): boolean {
        player.setPoison();

        return true;
    }
}
