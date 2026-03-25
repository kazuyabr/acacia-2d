import Packet from '../packet';

import { Packets } from '@acacia/common/network';

export interface CountdownPacketData {
    instance: string;
    time: number;
}

export type CountdownPacketCallback = (info: CountdownPacketData) => void;

export default class CountdownPacket extends Packet {
    public constructor(data: CountdownPacketData) {
        super(Packets.Countdown, undefined, data);
    }
}
