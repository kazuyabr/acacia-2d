#!/usr/bin/env python3
from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

ROOT_DIR = Path(__file__).resolve().parent
BASE_COMPOSE_FILE = ROOT_DIR / 'docker-compose.yml'
GATEWAY_COMPOSE_FILE = ROOT_DIR / 'docker-compose.gateway.yml'
MONGO_COMPOSE_FILE = ROOT_DIR / 'docker-compose.mongo-local.yml'
WORLD_TEMPLATE_DIR = ROOT_DIR / 'world'
WORLD_ENV_TEMPLATE = WORLD_TEMPLATE_DIR / '.env.example'
STACK_ENV_FILE = ROOT_DIR / '.env.stack'
HUB_ENV_FILE = ROOT_DIR / 'hub' / '.env'
CLIENT_ENV_FILE = ROOT_DIR / 'client' / '.env'
MONGO_ENV_FILE = ROOT_DIR / 'mongo-local' / '.env'
SCALABLE_ENV_SOURCE_FILE = ROOT_DIR.parent / '.env.scalable'
WORLD_NAME_PATTERN = re.compile(r'^world-(\d+)$')
BASE_START_WORLDS = ('world-1', 'world-2')
BASE_WORLD_NAMES = frozenset(BASE_START_WORLDS)
NETWORK_NAME = 'acacia-scalable-runtime'
DEFAULT_GATEWAY_MODE = 'external'
DEFAULT_GATEWAY_PORT = '80'
DEFAULT_GATEWAY_HOST = 'localhost'
DEFAULT_MONGO_PORT = '27017'
DEFAULT_MONGO_USER = 'sorameshi'
DEFAULT_MONGO_PASSWORD = 'lotus10'
DEFAULT_MONGO_DATABASE = 'acacia-game'
DEFAULT_MONGO_AUTH_SOURCE = 'admin'
DEFAULT_HUB_API_PORT = '9526'
DEFAULT_STACK_SETTINGS = {
    'GATEWAY_MODE': DEFAULT_GATEWAY_MODE,
    'GATEWAY_PUBLIC_PORT': DEFAULT_GATEWAY_PORT,
    'GATEWAY_PUBLIC_HOST': DEFAULT_GATEWAY_HOST,
    'USE_MONGO_LOCAL': 'true',
    'MONGODB_HOST': 'mongo-local',
    'MONGODB_PORT': DEFAULT_MONGO_PORT,
    'MONGODB_USER': DEFAULT_MONGO_USER,
    'MONGODB_PASSWORD': DEFAULT_MONGO_PASSWORD,
    'MONGODB_DATABASE': DEFAULT_MONGO_DATABASE,
    'MONGODB_AUTH_SOURCE': DEFAULT_MONGO_AUTH_SOURCE,
    'MONGODB_TLS': 'false',
    'MONGODB_SRV': 'false',
}
STACK_PROPAGATED_KEYS = (
    'GATEWAY_MODE',
    'GATEWAY_PUBLIC_PORT',
    'GATEWAY_PUBLIC_HOST',
    'MONGODB_HOST',
    'MONGODB_PORT',
    'MONGODB_USER',
    'MONGODB_PASSWORD',
    'MONGODB_DATABASE',
    'MONGODB_AUTH_SOURCE',
    'MONGODB_TLS',
    'MONGODB_SRV',
)
LOG_LABELS = {
    'gateway': ('gateway', 'nginx'),
    'hub': ('hub',),
    'client': ('client',),
    'mongo': ('mongo', 'mongodb'),
    'world': ('world',),
}
OS_FAMILY = 'windows' if os.name == 'nt' else 'unix'


class StackError(RuntimeError):
    pass


@dataclass(frozen=True)
class WorldInfo:
    number: int
    name: str
    directory: Path
    env_file: Path
    compose_file: Path
    channel_id: int
    server_id: int
    game_port: int
    api_port: int
    compose_project_name: str
    display_name: str
    realm_id: str = 'realm-1'


@dataclass(frozen=True)
class DockerContainer:
    container_id: str
    name: str
    status: str
    image: str


@dataclass(frozen=True)
class LogTarget:
    label: str
    description: str
    container_name: str


@dataclass(frozen=True)
class StackSettings:
    gateway_mode: str
    gateway_public_port: str
    gateway_public_host: str
    use_mongo_local: bool
    mongodb_host: str
    mongodb_port: str
    mongodb_user: str
    mongodb_password: str
    mongodb_database: str
    mongodb_auth_source: str
    mongodb_tls: str
    mongodb_srv: str

    def gateway_managed(self) -> bool:
        return self.gateway_mode == 'managed'

    def as_stack_env(self) -> dict[str, str]:
        return {
            'GATEWAY_MODE': self.gateway_mode,
            'GATEWAY_PUBLIC_PORT': self.gateway_public_port,
            'GATEWAY_PUBLIC_HOST': self.gateway_public_host,
            'USE_MONGO_LOCAL': 'true' if self.use_mongo_local else 'false',
            'MONGODB_HOST': self.mongodb_host,
            'MONGODB_PORT': self.mongodb_port,
            'MONGODB_USER': self.mongodb_user,
            'MONGODB_PASSWORD': self.mongodb_password,
            'MONGODB_DATABASE': self.mongodb_database,
            'MONGODB_AUTH_SOURCE': self.mongodb_auth_source,
            'MONGODB_TLS': self.mongodb_tls,
            'MONGODB_SRV': self.mongodb_srv,
        }


def configure_terminal_output() -> None:
    for stream_name in ('stdout', 'stderr'):
        stream = getattr(sys, stream_name)
        reconfigure = getattr(stream, 'reconfigure', None)
        if callable(reconfigure):
            reconfigure(line_buffering=True, write_through=True)


def print_command_header(printable: str, description: str | None = None) -> None:
    title = description or 'Executando comando'
    print(f'\n{"=" * 60}', flush=True)
    print(title, flush=True)
    print(f'> {printable}', flush=True)
    print('=' * 60, flush=True)


def print_command_status(returncode: int, description: str | None = None) -> None:
    title = description or 'Comando'
    status = 'OK' if returncode == 0 else 'ERRO'
    print(f'[{status}] {title} finalizado com código {returncode}.', flush=True)


def run_command(
    args: Sequence[str],
    *,
    check: bool = True,
    interactive: bool = False,
    stream_output: bool = False,
    description: str | None = None,
) -> subprocess.CompletedProcess[str]:
    printable = ' '.join(str(part) for part in args)
    should_stream = interactive or stream_output
    should_print_header = should_stream or description is not None

    if should_print_header:
        print_command_header(printable, description=description)

    completed = subprocess.run(
        args,
        cwd=ROOT_DIR,
        text=True,
        capture_output=not should_stream,
    )
    if not should_stream:
        if completed.stdout:
            print(completed.stdout, end='' if completed.stdout.endswith('\n') else '\n')
        if completed.stderr:
            print(completed.stderr, end='' if completed.stderr.endswith('\n') else '\n', file=sys.stderr)
    else:
        print_command_status(completed.returncode, description=description)
    if check and completed.returncode != 0:
        raise StackError(f'Command failed with exit code {completed.returncode}: {printable}')
    return completed


def ensure_prerequisites() -> None:
    if shutil.which('docker') is None:
        raise StackError('Docker CLI não encontrado no PATH.')
    if not BASE_COMPOSE_FILE.is_file():
        raise StackError(f'Compose base não encontrado em {BASE_COMPOSE_FILE}')
    if not GATEWAY_COMPOSE_FILE.is_file():
        raise StackError(f'Compose do gateway local não encontrado em {GATEWAY_COMPOSE_FILE}')
    if not MONGO_COMPOSE_FILE.is_file():
        raise StackError(f'Compose de Mongo local não encontrado em {MONGO_COMPOSE_FILE}')
    if not WORLD_TEMPLATE_DIR.is_dir():
        raise StackError(f'Template de world não encontrado em {WORLD_TEMPLATE_DIR}')
    if not WORLD_ENV_TEMPLATE.is_file():
        raise StackError(f'Env template de world não encontrado em {WORLD_ENV_TEMPLATE}')
    if not SCALABLE_ENV_SOURCE_FILE.is_file():
        raise StackError(f'Env base do stack escalável não encontrado em {SCALABLE_ENV_SOURCE_FILE}')
    ensure_service_env_files()
    if not MONGO_ENV_FILE.is_file():
        raise StackError(f'Env do mongo local não encontrado em {MONGO_ENV_FILE}')
    ensure_stack_env_file()


def docker_compose(
    compose_file: Path,
    *extra_args: str,
    env_file: Path | None = None,
    interactive: bool = False,
    stream_output: bool = True,
    description: str | None = None,
) -> subprocess.CompletedProcess[str]:
    command = ['docker', 'compose', '--env-file', str(STACK_ENV_FILE)]
    if env_file is not None:
        command.extend(['--env-file', str(env_file)])
    command.extend(['-f', str(compose_file)])
    command.extend(extra_args)
    return run_command(
        command,
        interactive=interactive,
        stream_output=stream_output,
        description=description,
    )


def run_command_quiet(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        text=True,
        capture_output=True,
    )


def get_compose_service_container_id(
    compose_file: Path,
    service_name: str,
    *,
    env_file: Path | None = None,
) -> str:
    command = ['docker', 'compose', '--env-file', str(STACK_ENV_FILE)]
    if env_file is not None:
        command.extend(['--env-file', str(env_file)])
    command.extend(['-f', str(compose_file), 'ps', '-q', service_name])
    result = run_command_quiet(command)
    if result.returncode != 0:
        return ''
    return result.stdout.strip()


def wait_for_compose_service_running(
    compose_file: Path,
    service_name: str,
    *,
    env_file: Path | None = None,
    timeout_seconds: int = 60,
    poll_interval: float = 2.0,
) -> str:
    print(f'Aguardando container de {service_name} ficar em execução...', flush=True)
    deadline = time.monotonic() + timeout_seconds
    last_status = ''
    while time.monotonic() < deadline:
        container_id = get_compose_service_container_id(compose_file, service_name, env_file=env_file)
        if container_id:
            inspect_result = run_command_quiet(['docker', 'inspect', '--format', '{{.State.Status}}', container_id])
            if inspect_result.returncode == 0:
                status = inspect_result.stdout.strip()
                last_status = status or last_status
                if status == 'running':
                    print(f'{service_name} em execução.', flush=True)
                    return container_id
        time.sleep(poll_interval)
    status_suffix = f' Último status observado: {last_status}.' if last_status else ''
    raise StackError(f'O serviço {service_name} não entrou em execução dentro do tempo esperado.{status_suffix}')


def wait_for_mongo_local_ready(settings: StackSettings, timeout_seconds: int = 90, poll_interval: float = 3.0) -> None:
    container_id = wait_for_compose_service_running(MONGO_COMPOSE_FILE, 'mongo-local', timeout_seconds=timeout_seconds)
    print('Aguardando Mongo local responder a ping...', flush=True)
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        ping_result = run_command_quiet(
            [
                'docker',
                'exec',
                container_id,
                'mongosh',
                '--quiet',
                '--port',
                settings.mongodb_port,
                '--eval',
                "db.adminCommand('ping').ok",
            ]
        )
        if ping_result.returncode == 0:
            output = ping_result.stdout.strip()
            if output == '1' or output.endswith('\n1') or output.endswith('1'):
                print('Mongo local pronto para conexões.', flush=True)
                return
        time.sleep(poll_interval)
    raise StackError('Mongo local não respondeu ao ping dentro do tempo esperado.')


def wait_for_hub_api_ready(timeout_seconds: int = 90, poll_interval: float = 3.0) -> None:
    container_id = wait_for_compose_service_running(BASE_COMPOSE_FILE, 'hub', timeout_seconds=timeout_seconds)
    print('Aguardando hub responder pela API HTTP...', flush=True)
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        probe_result = run_command_quiet(
            [
                'docker',
                'exec',
                container_id,
                'node',
                '-e',
                (
                    "const http=require('http');"
                    f"const req=http.get({{'host':'127.0.0.1','port':{DEFAULT_HUB_API_PORT},'path':'/'}},res=>{{process.exit(res.statusCode===200?0:1);}});"
                    "req.on('error',()=>process.exit(1));"
                    "req.setTimeout(2000,()=>{req.destroy();process.exit(1);});"
                ),
            ]
        )
        if probe_result.returncode == 0:
            print('Hub pronto para atender dependências.', flush=True)
            return
        time.sleep(poll_interval)
    raise StackError('Hub não respondeu pela API HTTP dentro do tempo esperado.')


def parse_world_number(name: str) -> int | None:
    match = WORLD_NAME_PATTERN.match(name)
    if match is None:
        return None
    return int(match.group(1))


def build_world_info(number: int) -> WorldInfo:
    name = f'world-{number}'
    directory = ROOT_DIR / name
    game_port = 9101 + ((number - 1) * 2)
    api_port = game_port + 1
    return WorldInfo(
        number=number,
        name=name,
        directory=directory,
        env_file=directory / '.env',
        compose_file=directory / 'docker-compose.yml',
        channel_id=number,
        server_id=100 + number,
        game_port=game_port,
        api_port=api_port,
        compose_project_name=f'acacia-scalable-{name}',
        display_name=f'Shinobi Farm - Realm 1 Channel {number}',
    )


def list_world_directories() -> list[WorldInfo]:
    worlds: list[WorldInfo] = []
    for entry in ROOT_DIR.iterdir():
        if not entry.is_dir():
            continue
        number = parse_world_number(entry.name)
        if number is None:
            continue
        worlds.append(build_world_info(number))
    return sorted(worlds, key=lambda item: item.number)


def list_existing_worlds() -> list[WorldInfo]:
    worlds = []
    for world in list_world_directories():
        if world.compose_file.is_file() and world.env_file.is_file():
            worlds.append(world)
    return worlds


def get_next_world_info() -> WorldInfo:
    worlds = list_world_directories()
    next_number = worlds[-1].number + 1 if worlds else 1
    return build_world_info(next_number)


def normalize_env_value(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
        return stripped[1:-1]
    return stripped


def read_env_lines(path: Path) -> list[str]:
    return path.read_text(encoding='utf-8').splitlines()


def write_env_lines(path: Path, lines: Iterable[str]) -> None:
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def read_env_map(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.is_file():
        return data
    for line in read_env_lines(path):
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or '=' not in stripped:
            continue
        key, value = stripped.split('=', 1)
        data[key] = value
    return data


def upsert_env_values(path: Path, updates: dict[str, str]) -> None:
    lines = read_env_lines(path) if path.is_file() else []
    remaining = dict(updates)
    updated_lines: list[str] = []
    for line in lines:
        if '=' not in line or line.lstrip().startswith('#'):
            updated_lines.append(line)
            continue
        key, _ = line.split('=', 1)
        if key in remaining:
            updated_lines.append(f'{key}={remaining.pop(key)}')
        else:
            updated_lines.append(line)
    for key, value in remaining.items():
        updated_lines.append(f'{key}={value}')
    write_env_lines(path, updated_lines)


def ensure_service_env_files() -> None:
    for target in (HUB_ENV_FILE, CLIENT_ENV_FILE):
        if target.is_file():
            continue
        shutil.copyfile(SCALABLE_ENV_SOURCE_FILE, target)
        print(f'Env criado a partir de {SCALABLE_ENV_SOURCE_FILE.name}: {target}')


def env_has_drift(path: Path, expected: dict[str, str]) -> bool:
    current = read_env_map(path)
    for key, expected_value in expected.items():
        current_value = current.get(key)
        if current_value is None:
            return True
        if normalize_env_value(current_value) != normalize_env_value(expected_value):
            return True
    return False


def quote_env(value: str) -> str:
    escaped = value.replace("'", "\\'")
    return f"'{escaped}'"


def bool_to_env(value: bool) -> str:
    return 'true' if value else 'false'


def bool_to_pt(value: bool) -> str:
    return 'sim' if value else 'não'


def env_to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return normalize_env_value(value).lower() in {'1', 'true', 'yes', 'y', 'sim', 's'}


def normalize_gateway_mode(value: str | None, default: str = DEFAULT_GATEWAY_MODE) -> str:
    normalized = normalize_env_value(value or '').lower()
    if normalized in {'managed', 'local'}:
        return 'managed'
    if normalized in {'external', 'shared'}:
        return 'external'
    return default


def prompt_non_empty(prompt: str, default: str) -> str:
    while True:
        value = input(f'{prompt} [{default}]: ').strip()
        result = value or default
        if result:
            return result
        print('Valor obrigatório.')


def prompt_numeric(prompt: str, default: str) -> str:
    while True:
        value = prompt_non_empty(prompt, default)
        if value.isdigit():
            return value
        print('Informe apenas números.')


def collect_stack_settings(current: StackSettings | None = None) -> StackSettings:
    baseline = current or load_stack_settings()
    manage_gateway_locally = confirm(
        (
            'A opção 1 deve subir também o gateway/nginx local dedicado deste projeto? '
            f'atual={bool_to_pt(baseline.gateway_managed())}'
        ),
        default=baseline.gateway_managed(),
    )
    gateway_mode = 'managed' if manage_gateway_locally else 'external'
    gateway_public_port = prompt_numeric('Porta pública do gateway/proxy do projeto', baseline.gateway_public_port)
    gateway_public_host = prompt_non_empty('Host público do gateway/proxy do projeto', baseline.gateway_public_host)
    use_mongo_local = confirm(
        f'Usar Mongo local? atual={bool_to_pt(baseline.use_mongo_local)}',
        default=baseline.use_mongo_local,
    )
    default_mongo_host = 'mongo-local' if use_mongo_local else baseline.mongodb_host
    mongodb_host = prompt_non_empty('Host do MongoDB', default_mongo_host)
    mongodb_port = prompt_numeric('Porta do MongoDB', baseline.mongodb_port)
    mongodb_user = prompt_non_empty('Usuário do MongoDB', baseline.mongodb_user)
    mongodb_password = prompt_non_empty('Senha do MongoDB', baseline.mongodb_password)
    mongodb_database = prompt_non_empty('Nome do banco MongoDB', baseline.mongodb_database)
    mongodb_auth_source = prompt_non_empty('Auth source do MongoDB', baseline.mongodb_auth_source)
    mongodb_tls_current = env_to_bool(baseline.mongodb_tls)
    mongodb_srv_current = env_to_bool(baseline.mongodb_srv)
    mongodb_tls = bool_to_env(
        confirm(
            f'Habilitar TLS no MongoDB? atual={bool_to_pt(mongodb_tls_current)}',
            default=mongodb_tls_current,
        )
    )
    mongodb_srv = bool_to_env(
        confirm(
            f'Usar SRV no MongoDB? atual={bool_to_pt(mongodb_srv_current)}',
            default=mongodb_srv_current,
        )
    )
    return StackSettings(
        gateway_mode=gateway_mode,
        gateway_public_port=gateway_public_port,
        gateway_public_host=gateway_public_host,
        use_mongo_local=use_mongo_local,
        mongodb_host=mongodb_host,
        mongodb_port=mongodb_port,
        mongodb_user=mongodb_user,
        mongodb_password=mongodb_password,
        mongodb_database=mongodb_database,
        mongodb_auth_source=mongodb_auth_source,
        mongodb_tls=mongodb_tls,
        mongodb_srv=mongodb_srv,
    )


def ensure_stack_env_file() -> None:
    if STACK_ENV_FILE.is_file():
        current = read_env_map(STACK_ENV_FILE)
        merged = dict(DEFAULT_STACK_SETTINGS)
        merged.update(current)
        upsert_env_values(STACK_ENV_FILE, merged)
        return
    upsert_env_values(STACK_ENV_FILE, dict(DEFAULT_STACK_SETTINGS))


def load_stack_settings() -> StackSettings:
    ensure_stack_env_file()
    env = dict(DEFAULT_STACK_SETTINGS)
    env.update(read_env_map(STACK_ENV_FILE))

    def resolve(key: str) -> str:
        value = normalize_env_value(env.get(key, ''))
        return value or DEFAULT_STACK_SETTINGS[key]

    return StackSettings(
        gateway_mode=normalize_gateway_mode(env.get('GATEWAY_MODE'), default=DEFAULT_GATEWAY_MODE),
        gateway_public_port=resolve('GATEWAY_PUBLIC_PORT'),
        gateway_public_host=resolve('GATEWAY_PUBLIC_HOST'),
        use_mongo_local=env_to_bool(env.get('USE_MONGO_LOCAL'), default=True),
        mongodb_host=resolve('MONGODB_HOST'),
        mongodb_port=resolve('MONGODB_PORT'),
        mongodb_user=resolve('MONGODB_USER'),
        mongodb_password=resolve('MONGODB_PASSWORD'),
        mongodb_database=resolve('MONGODB_DATABASE'),
        mongodb_auth_source=resolve('MONGODB_AUTH_SOURCE'),
        mongodb_tls=resolve('MONGODB_TLS'),
        mongodb_srv=resolve('MONGODB_SRV'),
    )


def apply_stack_settings(settings: StackSettings) -> bool:
    ensure_service_env_files()
    upsert_env_values(STACK_ENV_FILE, settings.as_stack_env())

    shared_updates = {
        'GATEWAY_MODE': settings.gateway_mode,
        'GATEWAY_PUBLIC_HOST': quote_env(settings.gateway_public_host),
        'GATEWAY_PUBLIC_PORT': settings.gateway_public_port,
        'REMOTE_SERVER_HOST': quote_env(settings.gateway_public_host),
        'REMOTE_API_HOST': quote_env(settings.gateway_public_host),
        'CLIENT_REMOTE_HOST': quote_env(settings.gateway_public_host),
        'CLIENT_REMOTE_PORT': settings.gateway_public_port,
        'MONGODB_HOST': quote_env(settings.mongodb_host),
        'MONGODB_PORT': settings.mongodb_port,
        'MONGODB_USER': quote_env(settings.mongodb_user),
        'MONGODB_PASSWORD': quote_env(settings.mongodb_password),
        'MONGODB_DATABASE': quote_env(settings.mongodb_database),
        'MONGODB_AUTH_SOURCE': quote_env(settings.mongodb_auth_source),
        'MONGODB_TLS': settings.mongodb_tls,
        'MONGODB_SRV': settings.mongodb_srv,
    }

    hub_updates = dict(shared_updates)
    hub_updates['HUB_HOST'] = quote_env('hub')
    hub_updates['HUB_WS_HOST'] = quote_env('hub')
    hub_updates['HUB_PORT'] = '9526'
    hub_updates['HUB_WS_PORT'] = '9527'
    hub_updates['NGINX'] = 'true'

    client_updates = dict(shared_updates)
    client_updates['HUB_ENABLED'] = 'true'
    client_updates['HUB_HOST'] = quote_env(settings.gateway_public_host)
    client_updates['HUB_WS_HOST'] = quote_env(settings.gateway_public_host)
    client_updates['HUB_PORT'] = settings.gateway_public_port
    client_updates['HUB_WS_PORT'] = settings.gateway_public_port
    client_updates['NGINX'] = 'true'

    world_updates = dict(shared_updates)
    world_updates['HUB_HOST'] = quote_env('hub')
    world_updates['HUB_WS_HOST'] = quote_env('hub')
    world_updates['HUB_PORT'] = '9526'
    world_updates['HUB_WS_PORT'] = '9527'
    world_updates['ADMIN_HOST'] = quote_env('hub')
    world_updates['ADMIN_PORT'] = '9528'
    world_updates['NGINX'] = 'true'

    mongo_updates = {
        'MONGODB_USER': quote_env(settings.mongodb_user),
        'MONGODB_PASSWORD': quote_env(settings.mongodb_password),
        'MONGODB_DATABASE': quote_env(settings.mongodb_database),
        'MONGODB_PORT': settings.mongodb_port,
    }

    client_rebuild_required = env_has_drift(CLIENT_ENV_FILE, client_updates)

    upsert_env_values(HUB_ENV_FILE, hub_updates)
    upsert_env_values(CLIENT_ENV_FILE, client_updates)
    upsert_env_values(MONGO_ENV_FILE, mongo_updates)
    upsert_env_values(WORLD_ENV_TEMPLATE, world_updates)

    for world in list_existing_worlds():
        upsert_env_values(world.env_file, world_updates)

    return client_rebuild_required


def describe_gateway_mode(settings: StackSettings) -> str:
    return 'local dedicado' if settings.gateway_managed() else 'externo/compartilhado'



def print_stack_settings(settings: StackSettings) -> None:
    gateway_mode_label = describe_gateway_mode(settings)
    print('\nConfiguração operacional atual:')
    print(f'- Gateway público: http://{settings.gateway_public_host}:{settings.gateway_public_port} | modo={gateway_mode_label}')
    if settings.gateway_managed():
        print('- Opção 1 inicia o gateway/nginx local dedicado junto com hub, client e worlds.')
    else:
        print('- Opção 1 não inicia nginx local. O acesso público depende de gateway externo/compartilhado.')
    print(f'- Mongo local: {"sim" if settings.use_mongo_local else "não"}')
    print(f'- Mongo host/porta: {settings.mongodb_host}:{settings.mongodb_port}')
    print(f'- Mongo database: {settings.mongodb_database}')
    print(f'- Mongo authSource: {settings.mongodb_auth_source}')


def create_world(start_after_create: bool = False) -> WorldInfo:
    settings = load_stack_settings()
    world = get_next_world_info()
    if world.directory.exists():
        raise StackError(f'Diretório alvo já existe: {world.directory}')

    print(f'Criando {world.name} a partir de {WORLD_TEMPLATE_DIR.name}/ ...')
    shutil.copytree(WORLD_TEMPLATE_DIR, world.directory)
    shutil.copyfile(WORLD_ENV_TEMPLATE, world.env_file)

    replacements = {
        'COMPOSE_PROJECT_NAME': world.compose_project_name,
        'WORLD_DIRECTORY': world.name,
        'REALM_ID': world.realm_id,
        'CHANNEL_ID': str(world.channel_id),
        'PUBLIC_GAME_PORT': str(world.game_port),
        'PUBLIC_API_PORT': str(world.api_port),
        'NAME': quote_env(world.display_name),
        'PORT': str(world.game_port),
        'API_PORT': str(world.api_port),
        'SERVER_ID': str(world.server_id),
        'DISCORD_CHANNEL_ID': str(world.channel_id),
        'GATEWAY_MODE': settings.gateway_mode,
        'GATEWAY_PUBLIC_HOST': quote_env(settings.gateway_public_host),
        'GATEWAY_PUBLIC_PORT': settings.gateway_public_port,
        'REMOTE_SERVER_HOST': quote_env(settings.gateway_public_host),
        'REMOTE_API_HOST': quote_env(settings.gateway_public_host),
        'CLIENT_REMOTE_HOST': quote_env(settings.gateway_public_host),
        'CLIENT_REMOTE_PORT': settings.gateway_public_port,
        'NGINX': 'true',
        'MONGODB_HOST': quote_env(settings.mongodb_host),
        'MONGODB_PORT': settings.mongodb_port,
        'MONGODB_USER': quote_env(settings.mongodb_user),
        'MONGODB_PASSWORD': quote_env(settings.mongodb_password),
        'MONGODB_DATABASE': quote_env(settings.mongodb_database),
        'MONGODB_AUTH_SOURCE': quote_env(settings.mongodb_auth_source),
        'MONGODB_TLS': settings.mongodb_tls,
        'MONGODB_SRV': settings.mongodb_srv,
    }

    updated_lines: list[str] = []
    for line in read_env_lines(world.env_file):
        if '=' in line:
            key, _ = line.split('=', 1)
            if key in replacements:
                updated_lines.append(f'{key}={replacements[key]}')
                continue
        updated_lines.append(line)
    write_env_lines(world.env_file, updated_lines)

    print_world_summary(world)

    if start_after_create:
        start_world(world)
    else:
        print(
            'Comando manual equivalente: '
            f'docker compose --env-file {STACK_ENV_FILE} --env-file {world.env_file} -f {world.compose_file} up --build -d'
        )

    return world


def start_world(world: WorldInfo) -> None:
    if not world.compose_file.is_file() or not world.env_file.is_file():
        raise StackError(f'World inválido: {world.name}')
    docker_compose(
        world.compose_file,
        'up',
        '--build',
        '-d',
        env_file=world.env_file,
        description=f'Iniciando {world.name}',
    )
    print(f'{world.name} ativo.', flush=True)


def stop_world(world: WorldInfo) -> None:
    if not world.compose_file.is_file() or not world.env_file.is_file():
        raise StackError(f'World inválido: {world.name}')
    docker_compose(
        world.compose_file,
        'down',
        env_file=world.env_file,
        description=f'Parando {world.name}',
    )
    print(f'{world.name} parado.', flush=True)


def start_base_stack(settings: StackSettings) -> None:
    print('\nFase 1/3: subindo dependências fundamentais...', flush=True)
    if settings.use_mongo_local:
        docker_compose(
            MONGO_COMPOSE_FILE,
            'up',
            '-d',
            description='Subindo Mongo local opcional',
        )
        wait_for_mongo_local_ready(settings)

    print('\nFase 2/3: subindo serviços de aplicação dependentes...', flush=True)
    docker_compose(
        BASE_COMPOSE_FILE,
        'up',
        '--build',
        '-d',
        'hub',
        description='Subindo hub após Mongo pronto',
    )
    wait_for_hub_api_ready()

    docker_compose(
        BASE_COMPOSE_FILE,
        'up',
        '--build',
        '-d',
        'client',
        description='Subindo client após hub pronto',
    )
    wait_for_compose_service_running(BASE_COMPOSE_FILE, 'client')


def ensure_gateway_runtime_network() -> None:
    result = run_command_quiet(['docker', 'network', 'inspect', NETWORK_NAME])
    if result.returncode != 0:
        raise StackError(
            f'A rede Docker {NETWORK_NAME} não existe. Inicie primeiro a base do projeto antes do gateway local dedicado.'
        )


def start_managed_gateway(settings: StackSettings | None = None, *, source_label: str = 'opção dedicada') -> None:
    effective_settings = settings or load_stack_settings()
    if not effective_settings.gateway_managed():
        print(
            'Gateway configurado como externo/compartilhado. '
            f'Nenhum gateway local será iniciado pela {source_label}.'
        )
        return
    ensure_gateway_runtime_network()
    print(f'\nSubindo gateway local dedicado em compose separado via {source_label}...', flush=True)
    docker_compose(
        GATEWAY_COMPOSE_FILE,
        'up',
        '--build',
        '-d',
        'gateway',
        description='Subindo gateway local dedicado',
    )
    wait_for_compose_service_running(GATEWAY_COMPOSE_FILE, 'gateway')


def start_initial_worlds() -> None:
    for world_name in BASE_START_WORLDS:
        world = next((item for item in list_existing_worlds() if item.name == world_name), None)
        if world is None:
            raise StackError(f'World inicial ausente: {world_name}')
        start_world(world)


def start_full_stack() -> None:
    current_settings = load_stack_settings()
    print_stack_settings(current_settings)
    selected_settings = collect_stack_settings(current=current_settings)
    client_rebuild_required = apply_stack_settings(selected_settings)
    effective_settings = load_stack_settings()
    print('\nConfiguração persistida nos envs do stack.')
    if client_rebuild_required:
        print('Env do client atualizado. A base será rebuildada para recompilar o bundle com a configuração escalável.')
    else:
        print('Env do client já estava coerente. A base ainda será validada com up --build.')
    print_stack_settings(effective_settings)
    start_base_stack(effective_settings)
    start_initial_worlds()
    if effective_settings.gateway_managed():
        print('Modo de gateway local dedicado ativo. A opção 1 concluirá o stack subindo também o nginx local.')
        start_managed_gateway(effective_settings, source_label='opção 1 (stack completo/local)')
        wait_for_compose_service_running(GATEWAY_COMPOSE_FILE, 'gateway')
    else:
        print('Modo externo/compartilhado ativo. A opção 1 conclui sem iniciar nginx local.')
    print('Stack escalável iniciado.')


def remove_world(world: WorldInfo) -> None:
    stop_world(world)
    if world.name in BASE_WORLD_NAMES:
        print(f'{world.name} é canal-base. O diretório será mantido.')
        return
    shutil.rmtree(world.directory)
    print(f'Diretório removido: {world.directory}')


def list_active_worlds() -> list[WorldInfo]:
    worlds = list_existing_worlds()
    active: list[WorldInfo] = []
    for world in worlds:
        project_name = world.compose_project_name
        result = run_command(
            [
                'docker',
                'ps',
                '--filter',
                f'label=com.docker.compose.project={project_name}',
                '--format',
                '{{.Names}}',
            ],
            check=False,
        )
        names = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if names:
            active.append(world)
    return active


def print_world_summary(world: WorldInfo) -> None:
    print(f'- Diretório: {world.directory}')
    print(f'- Env file: {world.env_file}')
    print(f'- Realm ID: {world.realm_id}')
    print(f'- Channel ID: {world.channel_id}')
    print(f'- Server ID: {world.server_id}')
    print(f'- Portas game/api: {world.game_port} / {world.api_port}')


def print_active_worlds() -> None:
    active = list_active_worlds()
    if not active:
        print('Nenhum world ativo encontrado.')
        return
    print('\nWorlds ativos:')
    for world in active:
        print(f'[{world.number}] {world.name} | realm={world.realm_id} | channel={world.channel_id} | portas={world.game_port}/{world.api_port}')


def get_running_containers() -> list[DockerContainer]:
    result = run_command(
        ['docker', 'ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}'],
        check=False,
    )
    containers: list[DockerContainer] = []
    for line in result.stdout.splitlines():
        parts = line.split('\t')
        if len(parts) != 4:
            continue
        containers.append(DockerContainer(parts[0], parts[1], parts[2], parts[3]))
    return containers


def simplify_container_label(container_name: str) -> str:
    lowered = container_name.lower()
    if any(token in lowered for token in LOG_LABELS['gateway']):
        return 'gateway/nginx'
    if any(token in lowered for token in LOG_LABELS['hub']):
        return 'hub'
    if any(token in lowered for token in LOG_LABELS['client']):
        return 'client'
    if any(token in lowered for token in LOG_LABELS['mongo']):
        return 'mongo'
    if 'world-' in lowered or re.search(r'world[-_]\d+', lowered):
        match = re.search(r'world[-_]?(\d+)', lowered)
        if match:
            return f'world-{match.group(1)}'
        return 'world'
    return container_name


def build_log_targets() -> list[LogTarget]:
    targets: list[LogTarget] = []
    seen_labels: set[str] = set()
    for container in get_running_containers():
        if 'acacia' not in container.name.lower() and 'mongo' not in container.name.lower():
            continue
        label = simplify_container_label(container.name)
        if label in seen_labels:
            continue
        seen_labels.add(label)
        description = f'{label} | {container.name} | {container.status}'
        targets.append(LogTarget(label=label, description=description, container_name=container.name))

    def sort_key(item: LogTarget) -> tuple[int, str]:
        if item.label.startswith('world-'):
            return (1, item.label)
        return (0, item.label)

    return sorted(targets, key=sort_key)


def choose_from_menu(title: str, items: Sequence[str], allow_back: bool = True) -> int | None:
    print(f'\n{title}')
    for index, item in enumerate(items, start=1):
        print(f'[{index}] {item}')
    if allow_back:
        print('[ESC] Voltar')
    while True:
        choice = input('Escolha: ').strip()
        if choice.upper() == 'ESC' and allow_back:
            return None
        if choice.isdigit():
            number = int(choice)
            if 1 <= number <= len(items):
                return number - 1
        print('Opção inválida.')


def confirm(prompt: str, default: bool | None = None) -> bool:
    suffix = ' [s/n]: ' if default is None else f' [s/n] (Enter={bool_to_pt(default)}): '
    while True:
        value = input(f'{prompt}{suffix}').strip().lower()
        if not value and default is not None:
            return default
        if value in {'s', 'sim', 'y', 'yes'}:
            return True
        if value in {'n', 'nao', 'não', 'no'}:
            return False
        print('Resposta inválida.')


def show_logs_menu() -> None:
    targets = build_log_targets()
    if not targets:
        print('Nenhum container compatível encontrado em execução.')
        return
    selection = choose_from_menu('Containers disponíveis para logs', [target.description for target in targets])
    if selection is None:
        return
    target = targets[selection]
    run_command(
        ['docker', 'logs', '-f', target.container_name],
        interactive=True,
        description=f'Acompanhando logs de {target.label}',
    )


def show_remove_world_menu() -> None:
    worlds = list_existing_worlds()
    if not worlds:
        print('Nenhum world configurado encontrado.')
        return
    selection = choose_from_menu(
        'Selecione o canal para remover/parar',
        [f'{world.name} | portas={world.game_port}/{world.api_port}' for world in worlds],
    )
    if selection is None:
        return
    world = worlds[selection]
    if world.name in BASE_WORLD_NAMES:
        print(f'{world.name} é um canal-base e terá apenas stop do container.')
        if not confirm(f'Confirmar parada de {world.name}?'):
            print('Operação cancelada.')
            return
    else:
        if not confirm(f'Confirmar remoção de {world.name} e do diretório correspondente?'):
            print('Operação cancelada.')
            return
    remove_world(world)


def restart_worlds(worlds: Sequence[WorldInfo]) -> None:
    for world in worlds:
        start_world(world)


def show_bulk_world_env_menu() -> None:
    worlds = list_existing_worlds()
    if not worlds:
        print('Nenhum world configurado encontrado.')
        return
    key = prompt_non_empty('Chave de env para aplicar em todos os worlds', 'GVER')
    current_value = normalize_env_value(read_env_map(worlds[0].env_file).get(key, ''))
    value = prompt_non_empty(f'Novo valor para {key}', current_value or '0.1.0')
    updates = {key: quote_env(value) if not value.isdigit() and key not in {'PORT', 'API_PORT', 'PUBLIC_GAME_PORT', 'PUBLIC_API_PORT'} else value}
    print(f'Aplicando {key}={updates[key]} em {len(worlds)} world(s)...')
    for world in worlds:
        upsert_env_values(world.env_file, updates)
        print(f'- Atualizado: {world.env_file}')
    if confirm('Reiniciar os worlds afetados agora?'):
        restart_worlds(worlds)
    else:
        print('Reinício não executado.')


def show_main_menu() -> int:
    menu_items = [
        'Iniciar stack completo/local',
        'Novo canal',
        'Remover canal',
        'Listar mundos ativos',
        'Logs',
        'Editar chave de env em lote nos worlds',
        'Iniciar apenas gateway local dedicado',
        'Exit',
    ]
    while True:
        choice = choose_from_menu('Menu do stack multiworld escalável', menu_items, allow_back=False)
        assert choice is not None
        if choice == len(menu_items) - 1:
            print('Encerrando menu com código 0.')
            return 0
        if choice == 0:
            start_full_stack()
        elif choice == 1:
            start_after_create = confirm('Subir o novo canal imediatamente após criar?')
            create_world(start_after_create=start_after_create)
        elif choice == 2:
            show_remove_world_menu()
        elif choice == 3:
            print_active_worlds()
        elif choice == 4:
            show_logs_menu()
        elif choice == 5:
            show_bulk_world_env_menu()
        elif choice == 6:
            start_managed_gateway()


def print_header() -> None:
    print('=============================================')
    print(' Acacia scalable stack menu')
    print('=============================================')
    print(f'Root: {ROOT_DIR}')
    print(f'SO detectado: {platform.system()} ({OS_FAMILY})')
    settings = load_stack_settings()
    gateway_mode_label = describe_gateway_mode(settings)
    print(f'Gateway atual: http://{settings.gateway_public_host}:{settings.gateway_public_port} | modo={gateway_mode_label}')
    if settings.gateway_managed():
        print('Opção 1 irá subir também o gateway/nginx local dedicado.')
    else:
        print('Opção 1 não sobe nginx local; o acesso público depende de gateway externo/compartilhado.')
    print(f'Mongo atual: {settings.mongodb_host}:{settings.mongodb_port} | local={"sim" if settings.use_mongo_local else "não"}')


def main() -> int:
    try:
        configure_terminal_output()
        ensure_prerequisites()
        print_header()
        return show_main_menu()
    except KeyboardInterrupt:
        print('\nOperação interrompida pelo usuário.')
        return 130
    except StackError as error:
        print(f'Erro: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
