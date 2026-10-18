"""Tes konfigurasi lokal; tidak membuat layanan atau mengakses akun Render."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]


class RenderConfigTests(unittest.TestCase):
    def setUp(self):
        self.service = yaml.safe_load((ROOT / 'render.yaml').read_text())['services'][0]

    def test_publication_is_manual_and_single_instance(self):
        self.assertEqual(self.service['autoDeployTrigger'], 'off')
        self.assertEqual(self.service['numInstances'], 1)
        self.assertEqual(self.service['region'], 'singapore')
        self.assertEqual(self.service['plan'], '0.5c-512mb')

    def test_database_is_on_persistent_disk(self):
        env = {e['key']: e['value'] for e in self.service['envVars']}
        disk = self.service['disk']
        self.assertTrue(env['XYROPLAY_DB'].startswith(disk['mountPath'] + '/'))
        self.assertEqual(disk['sizeGB'], 1)
        self.assertEqual(env['TRUST_PROXY_HOPS'], '1')
        self.assertEqual(env['SYNOX_API_KEY'], '')
        self.assertEqual(self.service['healthCheckPath'], '/api/health')

    def run_entrypoint(self, port):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            # Stub filesystem mutations and privilege changes; never touch system users/data.
            for name in ('mkdir', 'chown', 'chmod'):
                script = folder / name
                script.write_text('#!/bin/sh\nexit 0\n')
                script.chmod(0o755)
            su = folder / 'su'
            su.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\n')
            su.chmod(0o755)
            env = dict(os.environ, PATH=str(folder) + ':' + os.environ['PATH'],
                       PORT=port, XYROPLAY_DB='/var/lib/xyroplay/xyroplay.sqlite3')
            return subprocess.run(['sh', str(ROOT / 'deploy/render-entrypoint.sh')],
                                  env=env, text=True, capture_output=True)

    def test_dynamic_port_and_unprivileged_runtime(self):
        result = self.run_entrypoint('10000')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('xyroplay', result.stdout)
        self.assertIn('gunicorn --bind=0.0.0.0:10000', result.stdout)

    def test_port_cannot_inject_shell_commands(self):
        result = self.run_entrypoint('10000;echo BAD')
        self.assertEqual(result.returncode, 2)
        self.assertNotIn('gunicorn', result.stdout)

    def test_container_copies_required_runtime(self):
        docker = (ROOT / 'Dockerfile').read_text()
        for required in ('backend/', 'web/', 'scripts/backup_db.py',
                         'deploy/render-entrypoint.sh',
                         'ENTRYPOINT ["/usr/local/bin/render-entrypoint"]'):
            self.assertIn(required, docker)


if __name__ == '__main__':
    unittest.main()
