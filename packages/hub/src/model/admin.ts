import Model from '.';

import log from '@acacia/common/util/log';

import type { Packets } from '@acacia/common/network';
import type Packet from '@acacia/common/network/packet';

export default class Admin extends Model {
    /**
     * Handles sending a message to the admin's websocket connection.
     * @param packet The packet object that we want to send to the admin.
     */

    public send(packet: Packet): void {
        this.connection.send(JSON.stringify(packet.serialize()));
    }

    /**
     * A broadcast message is sent to all the admins currently connected to the hub.
     * We also want to relay an update to the Discord bot to update population
     * if it's a login/logout-based packet.
     * @param packet The packet that we want to broadcast to all admins.
     */

    public broadcast(packet: Packet): void {
        this.controller.broadcastAdmins(packet, this.instance);
    }

    public override handlePacket(packet: Packets, opcode: never, info: never): void {
        log.info(`Received packet ${packet} from admin ${this.address}`);
    }
}
