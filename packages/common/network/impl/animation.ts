import Packet from '../packet';

import { Packets } from '@acacia/common/network';

import type { Modules } from '@acacia/common/network';

export interface AnimationPacketData {
    instance: string;
    action: Modules.Actions;
    resourceInstance?: string;
}

export type AnimationPacketCallback = (info: AnimationPacketData) => void;

export default class AnimationPacket extends Packet {
    public constructor(data: AnimationPacketData) {
        super(Packets.Animation, undefined, data);
    }
}
