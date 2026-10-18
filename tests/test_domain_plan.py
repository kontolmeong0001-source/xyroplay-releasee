"""Rencana subdomain bukan konfigurasi backend aktif atau persetujuan DNS."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DomainPlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'deploy/domain-plan.json').read_text())

    def test_selected_subdomain_is_planned_only(self):
        self.assertEqual(self.plan['domain'], 'app.xyroplay.web.id')
        self.assertEqual(self.plan['zone'], 'xyroplay.web.id')
        self.assertEqual(self.plan['status'], 'planned_only')
        self.assertTrue(self.plan['approvalRequired'])
        self.assertFalse(self.plan['dnsChangesApplied'])
        self.assertIsNone(self.plan['renderHostname'])
        self.assertIsNone(self.plan['plannedRecords']['app']['value'])

    def test_backend_is_not_activated_by_plan(self):
        release = json.loads((ROOT / 'release.json').read_text())
        self.assertEqual(release['apiBase'], '')
        self.assertFalse(release['releaseReady'])
        self.assertEqual(self.plan['apiBase'], '')
        self.assertIn('"apiBase": ""', (ROOT / 'web/config.js').read_text())

    def test_registrar_zone_is_not_treated_as_authoritative(self):
        self.assertEqual(self.plan['dnsAuthority'], 'netlify_ns1')
        self.assertFalse(self.plan['registrarDnsPanel']['authoritative'])
        self.assertFalse(self.plan['publicDns']['fullAuthoritativeZoneInspected'])

    def test_only_app_cname_is_planned(self):
        self.assertEqual(set(self.plan['plannedRecords']), {'app'})
        record = self.plan['plannedRecords']['app']
        self.assertEqual(record['type'], 'CNAME')
        self.assertEqual(record['name'], 'app.xyroplay.web.id')
        self.assertEqual(record['hostLabel'], 'app')
        self.assertIsNone(record['value'])

    def test_netlify_site_and_delegation_are_protected(self):
        self.assertTrue(self.plan['preserveExistingNetlifySite'])
        self.assertEqual(set(self.plan['protectedNames']),
                         {'xyroplay.web.id', 'www.xyroplay.web.id'})
        self.assertFalse(self.plan['nameserverMigration']['default'])
        self.assertFalse(self.plan['nameserverMigration']['allowedByCurrentPlan'])


if __name__ == '__main__':
    unittest.main()
