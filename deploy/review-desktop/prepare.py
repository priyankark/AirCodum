#!/usr/bin/env python3
"""Render cloud-init without creating cloud resources or embedding credentials."""
import argparse
import base64
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser()
parser.add_argument('--hostname', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,251}[a-z0-9]', args.hostname):
    parser.error('Use a DNS hostname, without a scheme, path or port')
root = Path(__file__).resolve().parent
files = []

def write(path, text, mode='0644', owner='root:root'):
    files.append(dict(path=path, content=base64.b64encode(text.encode()).decode(),
                      encoding='b64', permissions=mode, owner=owner, defer=True))

write('/opt/aircodum-review/bootstrap.cjs', (root / 'bootstrap.cjs').read_text())
write('/opt/aircodum-review/welcome.txt', (root / 'welcome.txt').read_text())
write('/opt/aircodum-review/package.json', json.dumps({
    'name': 'aircodum-review-bootstrap', 'publisher': 'aircodum-review',
    'version': '1.0.0', 'engines': {'vscode': '^1.121.0'},
    'activationEvents': ['onStartupFinished'], 'main': './bootstrap.cjs',
    'contributes': {'commands': [{'command': 'aircodumReview.resetSample',
                                 'title': 'AirCodum Review: Reset Sample'}]},
}))
write('/opt/aircodum-review/settings.json', json.dumps({
    'security.workspace.trust.enabled': False, 'update.mode': 'none',
    'extensions.autoUpdate': False, 'extensions.autoCheckUpdates': False,
    'telemetry.telemetryLevel': 'off', 'workbench.startupEditor': 'none',
    'window.restoreWindows': 'none', 'aircodum.bindAddress': '127.0.0.1',
}))
write('/etc/caddy/Caddyfile', args.hostname + ''' {
    reverse_proxy 127.0.0.1:11040
}
''')
write('/etc/systemd/system/aircodum-review.service', '''[Unit]
Description=Disposable AirCodum review desktop
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=reviewer
Group=reviewer
Environment=HOME=/home/reviewer
Environment=XDG_RUNTIME_DIR=/run/aircodum-review
RuntimeDirectory=aircodum-review
RuntimeDirectoryMode=0700
ExecStart=/usr/local/bin/aircodum-review-session
Restart=always
RestartSec=10
KillMode=control-group
UMask=0077
NoNewPrivileges=true
ProtectSystem=full
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
''')
write('/usr/local/bin/aircodum-review-session', '''#!/bin/bash
set -euo pipefail
exec xvfb-run --auto-servernum --server-args='-screen 0 1280x800x24 -nolisten tcp' \
  dbus-run-session -- /usr/local/bin/aircodum-review-code
''', '0755')
write('/usr/local/bin/aircodum-review-code', '''#!/bin/bash
set -euo pipefail
openbox &
exec /usr/share/code/code --disable-gpu --password-store=basic --new-window \
  --user-data-dir /home/reviewer/.config/aircodum-code \
  --extensions-dir /home/reviewer/.local/share/aircodum-extensions \
  --extensionDevelopmentPath=/opt/aircodum-review \
  /home/reviewer/review-workspace /home/reviewer/review-workspace/welcome.txt
''', '0755')
write('/usr/local/sbin/aircodum-review-install', '''#!/bin/bash
set -euo pipefail
umask 077
curl --fail --location --retry 4 https://update.code.visualstudio.com/1.121.0/linux-deb-x64/stable -o /tmp/aircodum-code.deb
apt-get install -y /tmp/aircodum-code.deb
curl --fail --location --retry 4 https://github.com/priyankark/AirCodum/releases/download/v0.2.0/aircodum-0.2.0.vsix -o /tmp/aircodum-review.vsix
echo '2817f4d109d8edd58c9819c77bf6c0e0e2105dc1da070e62c3d07ef893167c9e  /tmp/aircodum-review.vsix' | sha256sum --check
install -d -m 0700 -o reviewer -g reviewer /home/reviewer/.config/aircodum-code/User /home/reviewer/.local/share/aircodum-extensions /home/reviewer/review-workspace
install -m 0600 -o reviewer -g reviewer /opt/aircodum-review/settings.json /home/reviewer/.config/aircodum-code/User/settings.json
install -m 0600 -o reviewer -g reviewer /opt/aircodum-review/welcome.txt /home/reviewer/review-workspace/welcome.txt
chmod 0644 /tmp/aircodum-review.vsix
runuser -u reviewer -- /usr/bin/code --user-data-dir /home/reviewer/.config/aircodum-code --extensions-dir /home/reviewer/.local/share/aircodum-extensions --install-extension /tmp/aircodum-review.vsix
rm /tmp/aircodum-code.deb /tmp/aircodum-review.vsix
systemctl daemon-reload
systemctl enable --now aircodum-review
caddy validate --config /etc/caddy/Caddyfile
systemctl restart caddy
''', '0750')
config = {
    'package_update': True,
    'packages': ['ca-certificates', 'curl', 'caddy', 'xvfb', 'xauth', 'x11-xserver-utils',
                 'openbox', 'dbus-x11', 'imagemagick', 'scrot', 'libxtst6', 'libxinerama1',
                 'libxkbcommon0', 'libgtk-3-0', 'libnss3', 'libasound2', 'libsecret-1-0',
                 'unattended-upgrades'],
    'users': ['default', {'name': 'reviewer', 'lock_passwd': True, 'shell': '/bin/bash',
                          'groups': [], 'sudo': False}],
    'write_files': files,
    'runcmd': [['/usr/local/sbin/aircodum-review-install']],
}
Path(args.output).write_text('#cloud-config\n' + json.dumps(config, indent=2) + '\n')
print('Prepared cloud-init; no resources created and no credentials embedded.')
