import Skill from '../skill';

import { Modules } from '@acacia/common/network';

export default class Alchemy extends Skill {
    public constructor() {
        super(Modules.Skills.Alchemy);
    }
}
