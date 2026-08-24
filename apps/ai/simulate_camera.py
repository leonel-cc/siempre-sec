#!/usr/bin/env python3
"""
Camera Simulator for Development
Streams a video file as RTSP via FFmpeg.
Use this when you don't have a real IP camera.

Usage:
    python simulate_camera.py --file video.mp4 --name camera1
    python simulate_camera.py --file video.mp4 --name camera1 --port 8554

Prerequisites:
    - FFmpeg installed and in PATH
    - MediaMTX running (or any RTSP server)
"""

import argparse
import subprocess
import sys
import os


def simulate_camera(file_path: str, name: str, port: int = 8554, loop: bool = True):
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    rtsp_url = f"rtsp://localhost:{port}/{name}"

    cmd = [
        'ffmpeg',
        '-re',
    ]

    if loop:
        cmd.extend(['-stream_loop', '-1'])

    cmd.extend([
        '-i', file_path,
        '-c', 'copy',
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        rtsp_url,
    ])

    print(f"Simulating camera '{name}'")
    print(f"  Source: {file_path}")
    print(f"  RTSP URL: {rtsp_url}")
    print(f"  Loop: {loop}")
    print(f"\nPress Ctrl+C to stop\n")

    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nSimulator stopped")
    except FileNotFoundError:
        print("Error: FFmpeg not found. Please install FFmpeg and add it to PATH.")
        print("  Windows: https://ffmpeg.org/download.html")
        print("  Linux: sudo apt install ffmpeg")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg error: {e}")
        sys.exit(1)


def create_test_video(output_path: str = "test_video.mp4", duration: int = 30):
    cmd = [
        'ffmpeg',
        '-f', 'lavfi',
        '-i', f'testsrc=duration={duration}:size=1280x720:rate=25',
        '-f', 'lavfi',
        '-i', f'sine=frequency=440:duration={duration}',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        output_path,
    ]

    print(f"Creating test video: {output_path} ({duration}s)")
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"Test video created: {output_path}")
    except FileNotFoundError:
        print("Error: FFmpeg not found. Cannot create test video.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Camera Simulator for Security AI')
    parser.add_argument('--file', '-f', help='Video file to stream')
    parser.add_argument('--name', '-n', default='camera_sim', help='Camera name (default: camera_sim)')
    parser.add_argument('--port', '-p', type=int, default=8554, help='RTSP port (default: 8554)')
    parser.add_argument('--no-loop', action='store_true', help='Do not loop the video')
    parser.add_argument('--create-test', action='store_true', help='Create a test video file')

    args = parser.parse_args()

    if args.create_test:
        create_test_video()
        return

    if not args.file:
        parser.error("--file is required (unless using --create-test)")

    simulate_camera(args.file, args.name, args.port, not args.no_loop)


if __name__ == '__main__':
    main()
