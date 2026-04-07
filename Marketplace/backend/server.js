/* global console, process */

import http from 'node:http';
import { URL } from 'node:url';

import { closePool } from './db.js';
import {
  getCatalogStats,
  listCatalogItems,
  listSellableCatalogItems,
} from './catalog.repository.js';
import { ensureSchema } from './schema.js';

const API_HOST = process.env.MARKETPLACE_API_HOST || '0.0.0.0',
  API_PORT = Number(process.env.MARKETPLACE_API_PORT || 3301);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  response.end(JSON.stringify(payload, null, 2));
}

function sendNotFound(response) {
  sendJson(response, 404, {
    error: 'not_found',
    message: 'Endpoint não encontrado.',
  });
}

function parseCatalogQuery(requestUrl) {
  let searchTerm = requestUrl.searchParams.get('q') || '',
    category = requestUrl.searchParams.get('category') || '',
    requiredSkill = requestUrl.searchParams.get('required_skill') || '',
    hasImageParam = requestUrl.searchParams.get('has_image');

  return {
    searchTerm,
    category,
    requiredSkill,
    limit: Number(requestUrl.searchParams.get('limit') || 200),
    hasImage:
      hasImageParam === null
        ? undefined
        : ['1', 'true', 'yes', 'on'].includes(hasImageParam.toLowerCase()),
  };
}

async function handleCatalogRequest(requestUrl, response, sellableOnly = false) {
  let filters = parseCatalogQuery(requestUrl),
    [stats, items] = await Promise.all([
      getCatalogStats(),
      sellableOnly ? listSellableCatalogItems(filters) : listCatalogItems(filters),
    ]),
    // Garantir que itens sem imagem válida não sejam retornados na API pública
    filteredItems = sellableOnly ? items.filter((item) => item.isImageMapped) : items;

  sendJson(response, 200, {
    source: {
      primary: 'postgres.catalog_items',
      mode: sellableOnly ? 'sellable_view' : 'catalog_table',
      bootstrap: 'Marketplace/postgres/*.sql',
    },
    filters,
    stats,
    items: filteredItems,
  });
}

async function handleHealth(response) {
  let stats = await getCatalogStats();

  sendJson(response, 200, {
    status: 'ok',
    database: 'postgres',
    catalog: stats,
  });
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendNotFound(response);
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, {
      error: 'method_not_allowed',
      message: 'A API de catálogo aceita apenas GET nesta etapa.',
    });
    return;
  }

  try {
    let requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/health') {
      await handleHealth(response);
      return;
    }

    if (requestUrl.pathname === '/api/catalog/items') {
      await handleCatalogRequest(requestUrl, response, false);
      return;
    }

    if (requestUrl.pathname === '/api/catalog/public-items') {
      await handleCatalogRequest(requestUrl, response, true);
      return;
    }

    sendNotFound(response);
  } catch (error) {
    console.error('Erro ao processar requisição da API do marketplace:', error);
    sendJson(response, 500, {
      error: 'internal_error',
      message: 'Falha interna ao consultar catálogo persistido do marketplace.',
    });
  }
});

await ensureSchema();

server.listen(API_PORT, API_HOST, () => {
  console.log(`Marketplace API listening on http://${API_HOST}:${API_PORT}`);
});

process.on('SIGINT', async () => {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
});
