import Packet from '../packet';

import { Packets } from '@acacia/common/network';

import type { EntityDisplayInfo } from '@acacia/common/types/entity';

export type UpdatePacketCallback = (info: EntityDisplayInfo[]) => void;

export default class UpdatePacket extends Packet {
    public constructor(data?: EntityDisplayInfo[]) {
        super(Packets.Update, undefined, data);
    }
}
