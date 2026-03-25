import Equipment from '../equipment';

import { Modules } from '@acacia/common/network';

import type { Enchantments } from '@acacia/common/types/item';

export default class Cape extends Equipment {
    public constructor(key = '', count = -1, enchantments: Enchantments = {}) {
        super(Modules.Equipment.Cape, key, count, enchantments);
    }
}
