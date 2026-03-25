import Character from '../character';

import Utils from '@acacia/common/util/utils';
import { Modules } from '@acacia/common/network';

import type Player from '../player/player';
import type { PetData } from '@acacia/common/types/pet';

export default class Pet extends Character {
    public constructor(
        public owner: Player,
        key: string,
        x = owner.x,
        y = owner.y
    ) {
        super(Utils.createInstance(Modules.EntityType.Pet), owner.world, key, x, y);
    }

    /**
     * Serializes the pet data and includes the owner and the movement speed.
     * @returns A serialized pet data object.
     */

    public override serialize(): PetData {
        return {
            ...super.serialize(),
            owner: this.owner.instance,
            movementSpeed: this.owner.movementSpeed
        };
    }
}
