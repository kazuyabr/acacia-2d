import Skill from '../skill';

import { Modules } from '@acacia/common/network';

export default class Loitering extends Skill {
    public constructor() {
        super(Modules.Skills.Loitering);
    }
}
