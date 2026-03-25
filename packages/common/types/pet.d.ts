import type { EntityData } from '@acacia/common/types/entity';

export interface PetData extends EntityData {
    owner: string;
    movementSpeed: number;
}
