import Equipment from '../equipment';

import { Modules } from '@acacia/common/network';

import type { Enchantments } from '@acacia/common/types/item';

export default class Ring extends Equipment {
    public constructor(key = '', count = -1, enchantments: Enchantments = {}) {
        super(Modules.Equipment.Ring, key, count, enchantments);
    }
}
