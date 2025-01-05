import type { Packets } from '@kaetram/common/network';

export interface ConnectionInfo {
    instance: string;
}

export interface SerializedServer {
    id: number;
    name: string;
    host: string;
    port: number;
    nginx: boolean;
    players: number;
    maxPlayers: number;
}

export type MessageCallback = (message: [Packets, never, never]) => void;
