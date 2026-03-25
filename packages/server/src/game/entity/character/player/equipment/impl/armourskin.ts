import Equipment from '../equipment';

import { Modules } from '@acacia/common/network';

export default class ArmourSkin extends Equipment {
    public constructor(key = '', count = -1) {
        super(Modules.Equipment.ArmourSkin, key, count);
    }
}
