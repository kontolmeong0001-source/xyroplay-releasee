"""Rencana domain bukan konfigurasi backend aktif atau persetujuan cutover."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DomainPlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'deploy/domain-plan.json').read_text())

    def test_selected_domain_is_planned_only(self):
        self.assertEqual(self.plan['domain'], 'xyroplay.web.id')
        self.assertEqual(self.plan['status'], 'planned_only')
        self.assertTrue(self.plan['approvalRequired'])
        self.assertFalse(self.plan['dnsChangesApplied'])
        self.assertIsNone(self.plan['renderHostname'])
        self.assertIsNone(self.plan['plannedRecords']['www']['value'])

    def test_backend_is_not_activated_by_plan(self):
        release = json.loads((ROOT / 'release.json').read_text())
        self.assertEqual(release['apiBase'], '')
        self.assertFalse(release['releaseReady'])
        self.assertEqual(self.plan['apiBase'], '')
        self.assertIn('"apiBase": ""', (ROOT / 'web/config.js').read_text())

    def test_registrar_zone_is_not_treated_as_authoritative(self):
        self.assertEqual(self.plan['dnsAuthority'], 'netlify_ns1')
        self.assertFalse(self.plan['registrarDnsPanel']['authoritative'])
        self.assertFalse(self.plan['nameserverMigration']['default'])
        self.assertFalse(self.plan['publicDns']['fullAuthoritativeZoneInspected'])
        self.assertTrue(self.plan['plannedRecords']['removeWebRelatedAAAAOnlyAfterApprovedCutover'])


if __name__ == '__main__':
    unittest.main()
