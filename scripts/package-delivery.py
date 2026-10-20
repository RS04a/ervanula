"""Genera el paquete académico desde una lista explícita de fuentes y lo verifica."""
from pathlib import Path
import hashlib
import re
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
NAME = 'ENTREGA_1_ARVELUNA'
DEST = ROOT / NAME
ARCHIVE = ROOT / 'ARVELUNA_Entrega_1.zip'
ROOT_FILES = ['README.md', 'ENTREGA.md', 'AGENTS.md', '.env.example', '.gitignore',
              'package.json', 'package-lock.json', 'docker-compose.yml',
              'eslint.config.mjs', 'playwright.config.ts']
DIRECTORIES = ['backend', 'frontend', 'docs', 'scripts']
FORBIDDEN = {'node_modules', '.git', 'dist', 'coverage', 'test-results',
             'playwright-report', '__pycache__', '.DS_Store', '.env'}
EXTENSIONS = {'.md', '.ts', '.js', '.mjs', '.json', '.html', '.css', '.prisma',
              '.sql', '.toml', '.yml', '.yaml', '.png', '.py', '.txt'}

def selected():
    result = [Path(name) for name in ROOT_FILES]
    for directory in DIRECTORIES:
        for path in (ROOT / directory).rglob('*'):
            relative = path.relative_to(ROOT)
            if any(part in FORBIDDEN for part in relative.parts):
                continue
            if path.is_file() and path.suffix in EXTENSIONS and relative.as_posix() != 'frontend/public/output.css':
                if path.is_symlink():
                    raise RuntimeError(f'Enlace simbólico no permitido: {relative}')
                result.append(relative)
    return sorted(set(result))

# El manifiesto está dentro y fuera del ZIP y enumera todos los miembros.
manifest = ROOT / 'docs/zip-files.txt'
manifest.touch(exist_ok=True)
paths = selected()
manifest.write_text('\n'.join(f'{NAME}/{path.as_posix()}' for path in paths) + '\n')
if DEST.exists():
    extras = {p.relative_to(DEST) for p in DEST.rglob('*') if p.is_file()} - set(paths)
    if extras:
        raise RuntimeError('La carpeta de entrega contiene archivos ajenos; no se sobrescriben')
for relative in paths:
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / relative, target)

with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for relative in paths:
        archive.write(DEST / relative, f'{NAME}/{relative.as_posix()}')

patterns = [rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
            rb'AKIA[0-9A-Z]{16}', rb'gh[pousr]_[A-Za-z0-9]{30,}',
            rb'sk-(?:proj-)?[A-Za-z0-9_-]{30,}']
extract = Path(tempfile.mkdtemp(prefix='arveluna-zip-review-'))
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.testzip() is None, 'CRC inválido'
    assert archive.namelist() == manifest.read_text().splitlines()
    for item in archive.infolist():
        path = Path(item.filename)
        assert not path.is_absolute() and '..' not in path.parts
        assert path.parts[0] == NAME
        assert not any(part in FORBIDDEN for part in path.parts)
        assert not path.name.endswith(('.log', '.zip', '.pem', '.key', '.tmp'))
        assert not (path.name.startswith('.env') and path.name != '.env.example')
        data = archive.read(item)
        # Imágenes se conservan como evidencia; escaneo de secretos en texto.
        if path.suffix != '.png':
            assert not any(re.search(pattern, data) for pattern in patterns), f'Posible secreto: {path}'
            text = data.decode('utf-8')
            for password in re.findall('mysql' + r'://[^:\s]+:([^@\s]+)@', text):
                assert password in {'REEMPLAZAR_CON_MYSQL_PASSWORD', '${password}'} or (path.name == 'AGENTS.md' and password == 'arveluna'), f'Credencial en URL: {path}'
    archive.extractall(extract)
for relative in paths:
    assert (extract / NAME / relative).read_bytes() == (ROOT / relative).read_bytes()
Path('/tmp/arveluna-final-extracted-path').write_text(str(extract / NAME))
print(f'ZIP: {ARCHIVE.name}; archivos: {len(paths)}; CRC, extracción, comparación byte a byte y escaneo: OK')
print(f'SHA-256: {hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()}')
print(f'Copia extraída para prueba: {extract / NAME}')
