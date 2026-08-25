import os
import re
import subprocess


_DEVICE_LINE = re.compile(r'"([^"]+)"')


def _ffmpeg_bin() -> str:
    return os.environ.get('FFMPEG_PATH', 'ffmpeg')


def list_usb_cameras() -> list:
    """Enumerate DirectShow video devices (Windows) via ffmpeg.

    Returns a list of {index, name}. The index matches the enumeration
    order used by OpenCV's CAP_DSHOW backend in most cases.
    On non-Windows systems returns an empty list.
    """
    if os.name != 'nt':
        return []

    try:
        result = subprocess.run(
            [_ffmpeg_bin(), '-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
            capture_output=True,
            timeout=10,
            text=True,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("ffmpeg not found for USB device enumeration. Set FFMPEG_PATH.")
        return []

    output = result.stderr or ''
    devices = []
    in_video_section = False
    seen = set()
    for line in output.splitlines():
        if 'DirectShow video devices' in line:
            in_video_section = True
            continue
        if 'DirectShow audio devices' in line:
            break
        if 'Alternative name' in line:
            continue
        # ffmpeg >= 7: '... "Name" (video)' / '(audio)' / '(none)'
        typed = re.search(r'"([^"]+)"\s*\((video|audio)\)', line)
        if typed:
            name, dev_type = typed.group(1), typed.group(2)
            if dev_type == 'video' and name.strip() and name not in seen:
                seen.add(name)
                devices.append({'index': len(devices), 'name': name.strip()})
            continue
        # legacy ffmpeg: '"Name"' lines under the video devices section
        if not in_video_section:
            continue
        match = _DEVICE_LINE.search(line)
        if match and '(video)' not in match.group(1):
            name = match.group(1).strip()
            if name and name not in seen:
                seen.add(name)
                devices.append({'index': len(devices), 'name': name})
    return devices
