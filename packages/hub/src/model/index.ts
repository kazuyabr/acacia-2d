import Utils from '@acacia/common/util/utils';

import type Models from '../controllers/models';
import type Connection from '../network/connection';
import type { Packets } from '@acacia/common/network';

export default abstract class Model {
    public address;

    public constructor(
        public controller: Models,
        public instance: string,
        public connection: Connection
    ) {
        this.address = Utils.bufferToAddress(this.connection.socket.getRemoteAddressAsText());
    }

    public abstract handlePacket(packet: Packets, opcode: never, data: never): void;
}
