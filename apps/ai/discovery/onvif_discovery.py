import socket
import struct
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional
import threading
import time


PROBE_MESSAGE = """<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:{message_id}</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>"""

MULTICAST_ADDR = "239.255.255.250"
MULTICAST_PORT = 3702
SOAP_NS = "http://www.w3.org/2003/05/soap-envelope"
WS_DISCOVERY_NS = "http://schemas.xmlsoap.org/ws/2005/04/discovery"
ONVIF_NS = "http://www.onvif.org/ver10/network/wsdl"
DEVICE_NS = "http://schemas.xmlsoap.org/ws/2004/08/addressing"


def _generate_uuid() -> str:
    import uuid
    return str(uuid.uuid4())


def _parse_probe_match(xml_data: str) -> Optional[Dict]:
    try:
        root = ET.fromstring(xml_data)
        ns = {
            's': SOAP_NS,
            'd': WS_DISCOVERY_NS,
            'dn': ONVIF_NS,
            'w': DEVICE_NS,
        }

        matches = root.findall('.//d:ProbeMatch', ns)
        if not matches:
            return None

        match = matches[0]
        scopes_elem = match.find('.//d:Scopes', ns)
        scopes = scopes_elem.text if scopes_elem is not None else ''

        xaddrs_elem = match.find('.//d:XAddrs', ns)
        xaddrs = xaddrs_elem.text if xaddrs_elem is not None else ''

        manufacturer = ''
        model = ''
        if 'onvif' in scopes.lower():
            parts = scopes.split('/')
            for part in parts:
                if 'hardware' in part.lower():
                    model = part.split(':')[-1] if ':' in part else part
                if 'name' in part.lower():
                    manufacturer = part.split(':')[-1] if ':' in part else part

        ip = ''
        if xaddrs:
            import re
            ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', xaddrs)
            if ip_match:
                ip = ip_match.group(1)

        return {
            'ip': ip,
            'xaddrs': xaddrs,
            'scopes': scopes,
            'manufacturer': manufacturer or 'Unknown',
            'model': model or 'Unknown',
            'onvif_enabled': True,
        }
    except ET.ParseError:
        return None


class OnvifDiscovery:
    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self._devices: List[Dict] = []
        self._lock = threading.Lock()

    def discover(self) -> List[Dict]:
        self._devices = []
        message_id = _generate_uuid()
        probe = PROBE_MESSAGE.format(message_id=message_id)

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(self.timeout)

            ttl = struct.pack('b', 4)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, ttl)

            sock.sendto(probe.encode('utf-8'), (MULTICAST_ADDR, MULTICAST_PORT))

            start = time.time()
            while time.time() - start < self.timeout:
                try:
                    data, addr = sock.recvfrom(65535)
                    xml_data = data.decode('utf-8', errors='ignore')
                    device = _parse_probe_match(xml_data)
                    if device and device['ip']:
                        with self._lock:
                            existing = [d for d in self._devices if d['ip'] == device['ip']]
                            if not existing:
                                device['discovered_ip'] = addr[0]
                                self._devices.append(device)
                except socket.timeout:
                    break

            sock.close()
        except Exception as e:
            print(f"ONVIF discovery error: {e}")

        with self._lock:
            return list(self._devices)

    def discover_async(self, callback):
        def _run():
            devices = self.discover()
            callback(devices)
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        return thread
