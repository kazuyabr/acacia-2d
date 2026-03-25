import Packet from '../packet';

import { Packets } from '@acacia/common/network';

import type { Opcodes } from '@acacia/common/network';

export interface EnchantPacketData {
    index: number;
    isShard?: boolean;
}

export type EnchantPacketCallback = (opcode: Opcodes.Enchant, info: EnchantPacketData) => void;

export default class EnchantPacket extends Packet {
    public constructor(opcode: Opcodes.Enchant, data: unknown) {
        super(Packets.Enchant, opcode, data);
    }
}
