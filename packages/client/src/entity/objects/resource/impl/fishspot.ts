import Resource from '../resource';

import { Modules } from '@acacia/common/network';

export default class FishSpot extends Resource {
    public constructor(instance: string) {
        super(instance, Modules.EntityType.FishSpot);
    }
}
