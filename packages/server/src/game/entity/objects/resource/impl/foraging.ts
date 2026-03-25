import Resource from '../resource';
import foragingSpots from '../../../../../../data/foraging.json';

import Utils from '@acacia/common/util/utils';
import { Modules } from '@acacia/common/network';

export default class Foraging extends Resource {
    public constructor(key: string, x: number, y: number) {
        super(Utils.createInstance(Modules.EntityType.Foraging), key, x, y);

        this.setData(foragingSpots[key as keyof typeof foragingSpots]);
    }
}
