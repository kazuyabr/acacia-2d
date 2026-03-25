import Packet from '../packet';

import { Packets } from '@acacia/common/network';

import type { Opcodes } from '@acacia/common/network';

export type CameraPacketCallback = (opcode: Opcodes.Camera) => void;

export default class CameraPacket extends Packet {
    public constructor(opcode: Opcodes.Camera) {
        super(Packets.Camera, opcode);
    }
}
