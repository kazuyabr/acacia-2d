import Skill from '../skill';

import { Modules } from '@acacia/common/network';

export default class Smithing extends Skill {
    public constructor() {
        super(Modules.Skills.Smithing);
    }
}
