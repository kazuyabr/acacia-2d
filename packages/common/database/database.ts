import MongoDB from './mongodb/mongodb';

import config from '@acacia/common/config';
import log from '@acacia/common/util/log';

import type { DatabaseTypes } from '@acacia/common/types/database';

export type DatabaseType = MongoDB | null;

export default class Database {
    private database: DatabaseType = null;

    public constructor(databaseType: DatabaseTypes) {
        switch (databaseType) {
            case 'mongo':
            case 'mongodb': {
                this.database = new MongoDB(
                    config.mongodbHost,
                    config.mongodbPort,
                    config.mongodbUser,
                    config.mongodbPassword,
                    config.mongodbDatabase,
                    config.mongodbTls,
                    config.mongodbSrv,
                    config.mongodbAuthSource
                );
                break;
            }

            default: {
                log.error(`The database ${databaseType} could not be found.`);
                break;
            }
        }
    }

    public getDatabase(): DatabaseType {
        if (!this.database)
            log.error(
                '[Database] No database is currently present. It is advised against proceeding in this state.'
            );

        return this.database;
    }
}
