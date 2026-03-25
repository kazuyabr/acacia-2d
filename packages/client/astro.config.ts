import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import webmanifest from 'astro-webmanifest';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';
import partytown from '@astrojs/partytown';
import compress from 'astro-compress';
import compressor from 'astro-compressor';
import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'astro/config';
import { VitePWA as pwa } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import config, { exposedConfig } from '@acacia/common/config';
import { i18n } from 'astro-i18n-aut/integration';
import { locales, defaultLocale, dir, t, type Locale } from '@acacia/common/i18n';

const { name, description } = require('../../package.json');

export let env = exposedConfig(
    'name',
    'host',
    'ssl',
    'nginx',
    'serverId',
    'sentryDsn',
    'acceptLicense'
);

let clientHost = config.clientRemoteHost || (config.hubEnabled ? config.hubHost : config.host),
    clientPort = config.clientRemotePort || (config.hubEnabled ? config.hubPort : config.port),
    hub = config.ssl ? `https://${clientHost}` : `http://${clientHost}:${clientPort}`;

Object.assign(env, {
    version: config.gver,
    minor: config.minor,
    host: clientHost,
    port: clientPort,
    hub: config.hubEnabled && hub
});

let plugins = [
    glsl(),
    pwa({
        registerType: 'autoUpdate',
        workbox: {
            cacheId: name,
            globDirectory: 'dist',
            globPatterns: ['**/*.{js,css,svg,png,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,ico}'],
            navigateFallback: null
        }
    })
];

if (config.sentryDsn && !config.debugging)
    plugins.push(
        sentryVitePlugin({
            org: config.sentryOrg,
            project: config.sentryProject,
            authToken: config.sentryAuthToken,
            sourcemaps: { assets: './dist/**' }
        })
    );

let integrations = [i18n({ locales, defaultLocale })];

if (import.meta.env.PROD)
    integrations.push(
        webmanifest({
            icon: 'public/icon.png',
            name: config.name,
            description,
            categories: ['entertainment', 'games'],
            lang: 'en-US',
            dir: 'ltr',
            start_url: '/',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'fullscreen',
            orientation: 'landscape-primary',
            locales: Object.fromEntries(
                Object.entries(locales).map(([locale, lang]) => [
                    locale,
                    {
                        lang,
                        dir: dir(locale as Locale),
                        name: t('game:NAME', { lng: locale }),
                        description: t('game:DESCRIPTION', { lng: locale })
                    }
                ])
            ),
            config: {
                insertAppleTouchLinks: true,
                iconPurpose: ['any', 'maskable']
            }
        }),
        sitemap({
            i18n: { locales, defaultLocale }
            // filter: filterSitemapByDefaultLocale({ defaultLocale })
        }),
        partytown({ config: { debug: false } }),
        robotsTxt({ host: true }),
        compress({ Logger: 1, Image: false }),
        compressor({ gzip: true, brotli: true })
    );

// https://astro.build/config
export default defineConfig({
    srcDir: './',
    site: 'https://shinobifarm.jogatinando.com.br/',
    trailingSlash: 'always',
    integrations,
    server: { host: true, port: config.clientRemotePort | 9000 },
    vite: {
        plugins,
        build: { sourcemap: true },
        server: {
            strictPort: true,
            hmr: { protocol: 'ws', host: config.host, port: 5183 }
        },
        define: { globalConfig: env }
    }
});
