"""Import pinned SpriteCollab sheets unchanged; author basketball frame metadata.

Development only: Python 3 + Pillow. --check validates local files without network.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import urllib.request
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
SPRITES = PUBLIC / 'assets/sprites'
REVISION = '6e4cbc000566b1628daff88c317e15c907acf98f'
BASE = f'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{REVISION}/sprite'
SPECIES = dict(hitmontop='0237', infernape='0392', celebi='0251', gallade='0475',
    breloom='0286', wartortle='0008', blastoise='0009', drednaw='0834', tyrantrum='0697',
    sceptile='0254', aerodactyl='0142', lycanroc='0745', mightyena='0262', lucario='0448',
    kingdra='0230', nidoking='0034', slowking='0199')
ACTIONS = {'idle':'Idle', 'run':'Walk', 'dribble':'Walk', 'pass':'Shoot', 'shoot':'Shoot',
    'dunk':'Hop', 'block':'Hop', 'stagger':'Hurt', 'signature':'Attack'}
BALL_HEIGHT = dict(kingdra=.32, aerodactyl=.45, drednaw=.55, lycanroc=.53, mightyena=.53)


def fetch(species_id, directory, filename):
    path = directory / filename
    if not path.exists():
        with urllib.request.urlopen(f'{BASE}/{species_id}/{filename}', timeout=30) as response:
            path.write_bytes(response.read())
    return path


def import_species(item):
    key, species_id = item
    directory = SPRITES / key
    directory.mkdir(parents=True, exist_ok=True)
    xml = ET.parse(fetch(species_id, directory, 'AnimData.xml'))
    credits = fetch(species_id, directory, 'credits.txt').read_text(encoding='utf-8-sig')
    animations = {a.findtext('Name'): a for a in xml.findall('./Anims/Anim')}

    def resolve(name, visited=()):
        if name in visited:
            raise ValueError(f'{key}: cyclic CopyOf: {name}')
        node = animations[name]
        target = node.findtext('CopyOf')
        return resolve(target, (*visited, name)) if target else (name, node)

    entry = dict(name=key, sources=[], animations={})
    source_names = set()
    max_width = max_height = 1
    for action, requested in ACTIONS.items():
        if requested not in animations:
            requested = 'Charge' if action in ('pass', 'shoot') else requested
        name, node = resolve(requested)
        filename = f'{name}-Anim.png'
        path = fetch(species_id, directory, filename)
        with Image.open(path) as source:
            sheet = source.convert('RGBA')
        width, height = int(node.findtext('FrameWidth')), int(node.findtext('FrameHeight'))
        durations = [int(n.text) for n in node.findall('./Durations/Duration')]
        if len(durations) < 2 or sheet.width < width * len(durations) or sheet.height < 7 * height:
            raise ValueError(f'{key} {name}: insufficient frames/directions')
        image_path = path.relative_to(PUBLIC).as_posix()
        if name not in source_names:
            records = [line.split('\t') for line in credits.splitlines() if len(line.split('\t')) >= 5]
            relevant = [r for r in records if name in r[4].split(',')]
            if not relevant:
                raise ValueError(f'{key} {name}: missing credits')
            entry['sources'].append(dict(image=image_path, sourceUrl=f'{BASE}/{species_id}/{filename}',
                revision=REVISION, authors=sorted({r[1] for r in relevant}),
                terms='; '.join(sorted({r[3] for r in relevant})),
                modified='Original PNG unchanged; new basketball sequencing, timing and ball anchors'))
            source_names.add(name)
        entry['animations'][action] = {}
        for direction, row in [('right', 2), ('left', 6)]:
            frames = []
            for i, duration in enumerate(durations):
                frame = sheet.crop((i * width, row * height, (i + 1) * width, (row + 1) * height))
                bounds = frame.getchannel('A').getbbox()
                if bounds is None:
                    raise ValueError(f'{key} {name} {direction} frame {i}: transparent frame')
                left, top, right, bottom = bounds
                pivot = [(left + right) / 2, bottom - 1]
                anchor = [right - 2 if direction == 'right' else left + 2,
                          top + (bottom - top) * BALL_HEIGHT.get(key, .52)]
                # Keep the ball visible in front even on a narrow profile frame.
                anchor[0] = max(anchor[0], pivot[0] + 3) if direction == 'right' else min(anchor[0], pivot[0] - 3)
                frames.append(dict(image=image_path, rect=[i * width, row * height, width, height],
                    durationMs=max(35, round(duration * 1000 / 60)), pivot=pivot, ballAnchor=anchor, flipX=False))
                max_width = max(max_width, right - left)
                if action == 'idle':
                    max_height = max(max_height, bottom - top)
            entry['animations'][action][direction] = frames
    entry['courtScale'] = round(min(2.1, 82 / max_height, 108 / max_width), 3)
    entry['portraitScale'] = round(min(3, 120 / max_height, 180 / max_width), 3)
    print(f'Imported {key}: {len(source_names)} credited sheets', flush=True)
    return key, entry


def check(manifest):
    assert len(manifest) == 21, f'Expected 21 species, found {len(manifest)}'
    for key, entry in manifest.items():
        images = {}
        for source in entry['sources']:
            assert source['authors'] and source['terms'] and source['sourceUrl']
            images[source['image']] = Image.open(PUBLIC / source['image']).convert('RGBA')
        for action in ACTIONS:
            for direction, row in [('right', 2), ('left', 6)]:
                frames = entry['animations'][action][direction]
                assert len(frames) > 1, (key, action)
                for frame in frames:
                    x, y, w, h = frame['rect']
                    source = images[frame['image']]
                    assert y == row * h and x >= 0 and x + w <= source.width and y + h <= source.height
                    assert source.crop((x, y, x+w, y+h)).getchannel('A').getbbox(), (key, action, frame['rect'])
                    assert frame['durationMs'] > 0
                    assert (frame['ballAnchor'][0] - frame['pivot'][0]) * (1 if direction == 'right' else -1) > 0
    print('PASS 21 species: nine actions, both directions, nonempty frames, bounds, credits and anchors')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    options = parser.parse_args()
    manifest_path = SPRITES / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if not options.check:
        with ThreadPoolExecutor(max_workers=4) as pool:
            manifest.update(dict(pool.map(import_species, SPECIES.items())))
        for key in ('tauros', 'machamp', 'heatmor', 'charizard'):
            manifest[key].update(courtScale=1.85, portraitScale=2.4)
        check(manifest)
        manifest_path.write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
        credits_path = PUBLIC / 'assets/CREDITS.md'
        credits = credits_path.read_text(encoding='utf-8').split('<!-- roster-import -->')[0].rstrip()
        rows = ['\n\n<!-- roster-import -->', '## Seven-team roster additions', '',
            'Additional sheets use the same pinned revision above. Creator IDs are retained verbatim from upstream records. Per-action history and terms remain in each character’s `credits.txt`; source images are unchanged.', '',
            '| Pokémon | Source ID | Recorded creators | Recorded terms |', '| --- | --- | --- | --- |']
        for key, species_id in SPECIES.items():
            sources = manifest[key]['sources']
            authors = ', '.join(sorted({a for s in sources for a in s['authors']}))
            terms = '; '.join(sorted({s['terms'] for s in sources}))
            rows.append(f'| {key.title()} | {species_id} | {authors} | {terms} |')
        credits_path.write_text(credits + '\n'.join(rows) + '\n', encoding='utf-8')
    else:
        check(manifest)


if __name__ == '__main__':
    main()
