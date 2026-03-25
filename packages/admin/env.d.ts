/// <reference types="astro/client" />

import type config from '@acacia/common/config';

declare global {
    let globalConfig: typeof config;
}

export {};
