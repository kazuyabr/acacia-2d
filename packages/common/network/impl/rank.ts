import Packet from '../packet';

import { Packets } from '@acacia/common/network';

import type { Modules } from '@acacia/common/network';

export type RankPacketCallback = (rank: Modules.Ranks) => void;

export default class RankPacket extends Packet {
    public constructor(rank: Modules.Ranks) {
        super(Packets.Rank, undefined, rank);
    }
}
