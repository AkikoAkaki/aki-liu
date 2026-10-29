"""Refresh self-hosted Noto Serif SC 400 and rendered external-link icons.

Run after a Hugo build: python scripts/cache-external-assets.py --site public_test
Normal builds use the checked-in assets and need no network access.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from pathlib import Path
import re
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': UA}), timeout=30) as response:
        return response.read()


def fonts():
    source = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&display=swap'
    css = fetch(source).decode('utf-8')
    font_dir = ROOT / 'static/fonts/noto-serif-sc/v36'
    font_dir.mkdir(parents=True, exist_ok=True)
    urls = sorted(set(re.findall(r'https://fonts\.gstatic\.com/[^)]+\.woff2', css)))
    if not urls:
        raise ValueError('Google Fonts did not return WOFF2 subsets')

    def download(url):
        name = url.rsplit('/', 1)[1]
        target = font_dir / name
        if not target.exists():
            target.write_bytes(fetch(url))
        return url, '/fonts/noto-serif-sc/v36/' + name

    with ThreadPoolExecutor(max_workers=8) as executor:
        for remote, local in executor.map(download, urls):
            css = css.replace(remote, local)
    css = css.replace('src: url(', 'src: local("Songti SC"), local("STSong"), url(')
    (ROOT / 'assets/css/fonts-cjk.css').write_text(
        '/* Noto Serif SC 400, Google Fonts v36; OFL in static/fonts/noto-serif-sc. */\n' + css,
        encoding='utf-8')
    (font_dir.parent / 'OFL.txt').write_bytes(fetch(
        'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt'))
    print(f'Cached {len(urls)} Noto Serif SC 400 subsets')


def icons(site):
    from html.parser import HTMLParser

    class Links(HTMLParser):
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == 'a' and 'md-link--external' in attrs.get('class', '').split():
                host = urlparse(attrs.get('href', '')).hostname
                if host:
                    hosts.add(host)

    hosts = set()
    for page in site.rglob('*.html'):
        Links().feed(page.read_text(encoding='utf-8'))
    directory = ROOT / 'assets/icons/external'
    directory.mkdir(parents=True, exist_ok=True)

    def download(host):
        name = hashlib.sha256(host.encode()).hexdigest() + '.png'
        target = directory / name
        if not target.exists():
            try:
                data = fetch(f'https://www.google.com/s2/favicons?domain={host}&sz=32')
                if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                    raise ValueError('Expected PNG icon')
                target.write_bytes(data)
            except Exception as error:
                return f'{host}: {error} (generic external-link icon retained)'
        return None

    with ThreadPoolExecutor(max_workers=8) as executor:
        for error in executor.map(download, sorted(hosts)):
            if error:
                print(error)
    print(f'Cached external-link icons for {len(hosts)} hosts')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, default=ROOT / 'public_test')
    parser.add_argument('--icons-only', action='store_true')
    args = parser.parse_args()
    if not args.site.is_dir():
        parser.error('--site must name an existing Hugo output directory')
    if not args.icons_only:
        fonts()
    icons(args.site)
