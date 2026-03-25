#!/usr/bin/env python3
"""
MineManager - Interactive unified launcher
Starts Redis, Cloudflare tunnel, and Next.js app (dev or production mode)
"""

import os
import sys
import socket
import subprocess
import time
import re
import shutil
from pathlib import Path

# Port configuration
NEXTJS_PORT = 3000
REDIS_PORT = 6379
TUNNEL_PORT = 8089
WEBSOCKET_PORT = 3001

# Get project root (directory where this script is located)
PROJECT_ROOT = Path(__file__).parent.resolve()

# Bin directories
BIN_BUN = PROJECT_ROOT / "Bin" / "bun"
BIN_REDIS = PROJECT_ROOT / "Bin" / "redis"
BIN_CLOUDFLARED = PROJECT_ROOT / "Bin" / "cloudflared"
BIN_LIBSQL = PROJECT_ROOT / "Bin" / "libsql"

# Portable directories (preferred over Bin/)
PORTABLE_DIR = PROJECT_ROOT / "portable"
PORTABLE_CLOUDFLARED_EXE = PORTABLE_DIR / "cloudflared.exe"
PORTABLE_CLOUDFLARED_DIR = PORTABLE_DIR / "cloudflared"
PORTABLE_CLOUDFLARED_CONFIG = PORTABLE_CLOUDFLARED_DIR / "config.yml"
PORTABLE_BUN_EXE = PORTABLE_DIR / "bun.exe"

# Data directory for libsql
LIBSQL_DATA_DIR = PROJECT_ROOT / "data"
LIBSQL_DB_PATH = LIBSQL_DATA_DIR / "minemanager.db"


class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def print_status(message, color=Colors.CYAN):
    """Print a status message with color."""
    print(f"{color}[STATUS]{Colors.ENDC} {message}")


def print_success(message):
    print_status(message, Colors.GREEN)


def print_warning(message):
    print_status(message, Colors.YELLOW)


def print_error(message):
    print_status(message, Colors.RED)


def print_header(message):
    print(f"{Colors.HEADER}{Colors.BOLD}{message}{Colors.ENDC}")


def is_port_in_use(port):
    """Check if a port is in use using netstat on Windows."""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        for line in result.stdout.split("\n"):
            if f":{port}" in line and "LISTENING" in line:
                # Extract PID from the line
                parts = line.strip().split()
                if parts:
                    pid = parts[-1]
                    if pid.isdigit():
                        return True, int(pid)
        return False, None
    except Exception as e:
        print_error(f"Error checking port {port}: {e}")
        return False, None


def kill_process_on_port(port):
    """Kill any process using the specified port."""
    in_use, pid = is_port_in_use(port)
    if in_use and pid:
        try:
            print_warning(f"Killing process {pid} on port {port}...")
            subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            time.sleep(0.5)
            return True
        except Exception as e:
            print_error(f"Failed to kill process on port {port}: {e}")
            return False
    return False


def kill_process_by_name(name):
    """Kill processes by name."""
    try:
        subprocess.run(
            ["taskkill", "/F", "/IM", f"{name}.exe"],
            capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
    except Exception:
        pass


def check_port_with_socket(port, timeout=1):
    """Check if port is reachable (for services that might not show in netstat)."""
    try:
        with socket.create_connection(("localhost", port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def find_executable(directory, patterns):
    """Find an executable in a directory based on common naming patterns."""
    if not directory.exists():
        return None

    for pattern in patterns:
        # Direct match
        exe_path = directory / pattern
        if exe_path.exists() and os.access(exe_path, os.X_OK):
            return str(exe_path)

        # Case-insensitive search for Windows executables
        for item in directory.iterdir():
            if item.is_file():
                item_name = item.name.lower()
                pattern_name = pattern.lower()
                # Check exact match or with .exe extension
                if item_name == pattern_name or item_name == f"{pattern_name}.exe":
                    if os.access(item, os.X_OK) or item.suffix.lower() == ".exe":
                        return str(item)
    return None


def find_cloudflared_executable():
    """Find cloudflared executable, preferring portable directory."""
    # First check portable directory (single .exe file)
    if PORTABLE_CLOUDFLARED_EXE.exists():
        return str(PORTABLE_CLOUDFLARED_EXE)
    # Fall back to Bin/cloudflared
    return find_executable(BIN_CLOUDFLARED, ["cloudflared.exe", "cloudflared"])


def find_bun_executable():
    """Find Bun executable, preferring portable directory."""
    # First check portable directory (single .exe file)
    if PORTABLE_BUN_EXE.exists():
        return str(PORTABLE_BUN_EXE)
    # Fall back to Bin/bun
    return find_executable(BIN_BUN, ["bun.exe", "bun"])


def check_dependency_exists(bin_dir, executable_patterns):
    """Check if a dependency exists in the Bin directory."""
    exe_path = find_executable(bin_dir, executable_patterns)
    return exe_path is not None, exe_path


def download_bun():
    """Download and install Bun to Bin/bun/."""
    print_warning("Bun not found. Please download Bun from https://bun.sh and place it in Bin/bun/")
    print_warning(f"Expected location: {BIN_BUN}")
    return False


def download_redis():
    """Download and install Redis to Bin/redis/."""
    print_warning("Redis not found. Please download Redis from https://github.com/tporadowski/redis/releases")
    print_warning(f"Expected location: {BIN_REDIS}")
    print_warning("Look for redis-server.exe in the downloaded package.")
    return False


def download_cloudflared():
    """Download and install Cloudflare tunnel to Bin/cloudflared/."""
    print_warning("Cloudflared not found. Please download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/")
    print_warning(f"Expected location: {BIN_CLOUDFLARED}")
    print_warning("Look for cloudflared.exe in the downloaded package.")
    return False


def download_libsql():
    """Download and install libsql CLI to Bin/libsql/."""
    print_warning("libsql CLI not found. Please download from https://github.com/libsql/libsql/releases")
    print_warning(f"Expected location: {BIN_LIBSQL}")
    print_warning("Look for libsql.exe or libsql-client.exe in the downloaded package.")
    return False


def check_and_install_dependencies():
    """Check if all required dependencies exist in Bin/ directories."""
    print_header("\n[DEPENDENCY CHECK]")
    print("")

    deps_status = []

    # Check Bun (prefer portable)
    bun_path = find_bun_executable()
    bun_exists = bun_path is not None
    if bun_exists:
        print_success(f"Bun found: {bun_path}")
    else:
        print_error("Bun not found")
        download_bun()
    deps_status.append(("Bun", bun_exists))

    # Check Redis
    redis_exists, redis_path = check_dependency_exists(BIN_REDIS, ["redis-server.exe", "redis-server", "redis-cli.exe", "redis-cli"])
    if redis_exists:
        print_success(f"Redis found: {redis_path}")
    else:
        print_error("Redis not found")
        download_redis()
    deps_status.append(("Redis", redis_exists))

    # Check Cloudflared (prefer portable)
    cf_path = find_cloudflared_executable()
    cf_exists = cf_path is not None
    if cf_exists:
        print_success(f"Cloudflared found: {cf_path}")
    else:
        print_error("Cloudflared not found")
        download_cloudflared()
    deps_status.append(("Cloudflared", cf_exists))

    # Check libsql
    libsql_exists, libsql_path = check_dependency_exists(BIN_LIBSQL, ["libsql.exe", "libsql-client.exe", "libsql", "libsql-client"])
    if libsql_exists:
        print_success(f"libsql found: {libsql_path}")
    else:
        print_error("libsql not found")
        download_libsql()
    deps_status.append(("libsql", libsql_exists))

    print("")

    missing = [name for name, exists in deps_status if not exists]
    if missing:
        print_error(f"Missing dependencies: {', '.join(missing)}")
        print_warning("Please download and install the missing dependencies.")
        print_warning("You can still continue, but some features may not work.")
        return False

    return True


def start_redis():
    """Start Redis server from Bin/redis/."""
    print_header("\n[STARTING REDIS]")
    print("")

    # First kill any existing process on Redis port
    kill_process_on_port(REDIS_PORT)

    # Find redis-server executable
    redis_exe = find_executable(BIN_REDIS, ["redis-server.exe", "redis-server", "redis-cli.exe", "redis-cli"])
    if not redis_exe:
        print_error("Redis executable not found!")
        return None

    redis_exe_name = Path(redis_exe).name.lower()

    # If it's redis-cli, we need redis-server instead
    if "cli" in redis_exe_name:
        redis_server = find_executable(BIN_REDIS, ["redis-server.exe", "redis-server"])
        if redis_server:
            redis_exe = redis_server

    print_status(f"Starting Redis server on port {REDIS_PORT}...")

    try:
        # Start redis-server in background
        process = subprocess.Popen(
            [redis_exe, "--port", str(REDIS_PORT), "--bind", "127.0.0.1"],
            cwd=str(BIN_REDIS),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )

        # Wait a moment for Redis to start
        time.sleep(2)

        # Check if Redis is running
        if process.poll() is None and is_port_in_use(REDIS_PORT)[0]:
            print_success("Redis server started successfully!")
            return process
        elif process.poll() is not None:
            print_error("Redis server failed to start!")
            return None
        else:
            print_success("Redis server started (status unclear, assuming success)")
            return process

    except Exception as e:
        print_error(f"Failed to start Redis: {e}")
        return None


def init_libsql_db():
    """Initialize libsql database."""
    print_header("\n[INITIALIZING LIBSQL DATABASE]")
    print("")

    # Create data directory if it doesn't exist
    if not LIBSQL_DATA_DIR.exists():
        print_status(f"Creating data directory: {LIBSQL_DATA_DIR}")
        try:
            LIBSQL_DATA_DIR.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print_error(f"Failed to create data directory: {e}")
            return False
    else:
        print_success(f"Data directory exists: {LIBSQL_DATA_DIR}")

    # Find libsql executable
    libsql_exe = find_executable(BIN_LIBSQL, ["libsql.exe", "libsql-client.exe", "libsql", "libsql-client"])
    if not libsql_exe:
        print_error("libsql executable not found!")
        return False

    # Check if database file exists
    if LIBSQL_DB_PATH.exists():
        print_success(f"Database file already exists: {LIBSQL_DB_PATH}")
        return True
    else:
        print_status(f"Database file will be created at: {LIBSQL_DB_PATH}")
        print_warning("Database initialization may require manual setup or first run of the app.")
        return True  # Return True as the app might create it on first run


def start_cloudflare_tunnel(tunnel_name=None):
    """Start Cloudflare tunnel using portable/configured setup."""
    print_header("\n[STARTING CLOUDFLARE TUNNEL]")
    print("")

    # First kill any existing process on Tunnel port
    kill_process_on_port(TUNNEL_PORT)

    # Find cloudflared executable
    cf_exe = find_cloudflared_executable()
    if not cf_exe:
        print_error("Cloudflared executable not found!")
        return None

    # Determine config directory and tunnel ID
    cf_config_dir = str(PORTABLE_CLOUDFLARED_DIR) if PORTABLE_CLOUDFLARED_CONFIG.exists() else str(BIN_CLOUDFLARED)

    # Check if we have a pre-configured tunnel
    if PORTABLE_CLOUDFLARED_CONFIG.exists():
        # Use the pre-configured tunnel from config.yml
        print_status("Using pre-configured tunnel from portable/cloudflared/")
        print_status(f"Cloudflared exe: {cf_exe}")
        print_status(f"Config dir: {cf_config_dir}")

        try:
            # Start cloudflared with configured tunnel (no --url needed, uses config.yml ingress)
            process = subprocess.Popen(
                [cf_exe, "tunnel", "--config", "config.yml", "run"],
                cwd=cf_config_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )

            # Wait for tunnel to start
            time.sleep(5)

            if process.poll() is not None:
                print_error("Cloudflare tunnel failed to start!")
                try:
                    stdout, stderr = process.communicate(timeout=1)
                    if stderr:
                        print_error(f"Error: {stderr.decode('utf-8', errors='ignore')}")
                    if stdout:
                        print_status(f"Output: {stdout.decode('utf-8', errors='ignore')[:500]}")
                except:
                    pass
                return None

            print_success("Cloudflare tunnel started (pre-configured)!")
            print_status("Tunnel should be active at hideoutsmp.com")
            return process

        except Exception as e:
            print_error(f"Failed to start Cloudflare tunnel: {e}")
            return None
    else:
        # Fall back to quick tunnel mode
        if not tunnel_name:
            import uuid
            tunnel_name = f"minemanager-{uuid.uuid4().hex[:8]}"

        print_status(f"Starting Cloudflare quick tunnel '{tunnel_name}'...")

        try:
            process = subprocess.Popen(
                [cf_exe, "tunnel", "--url", f"http://localhost:{NEXTJS_PORT}", "-p", str(TUNNEL_PORT), "--tunnel-name", tunnel_name],
                cwd=cf_config_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )

            time.sleep(3)

            if process.poll() is not None:
                print_error("Cloudflare tunnel failed to start!")
                return None

            print_success(f"Cloudflare tunnel started: {tunnel_name}")
            return process

        except Exception as e:
            print_error(f"Failed to start Cloudflare tunnel: {e}")
            return None


def start_nextjs_dev():
    """Start Next.js in development mode using Bun."""
    print_header("\n[STARTING NEXT.JS (DEVELOPMENT)]")
    print("")

    # Find bun executable (prefer portable)
    bun_exe = find_bun_executable()
    if not bun_exe:
        print_error("Bun executable not found!")
        return None

    print_status("Starting Next.js development server...")

    try:
        process = subprocess.Popen(
            [bun_exe, "run", "dev"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )

        print_success("Next.js development server started!")
        print_status(f"Dev server: http://localhost:{NEXTJS_PORT}")
        return process

    except Exception as e:
        print_error(f"Failed to start Next.js dev server: {e}")
        return None


def start_nextjs_production():
    """Start Next.js in production mode."""
    print_header("\n[STARTING NEXT.JS (PRODUCTION)]")
    print("")

    # First check if .next build exists and is complete
    next_build_dir = PROJECT_ROOT / ".next"
    next_server_dir = next_build_dir / "server"
    if not next_server_dir.exists():
        print_warning(".next build directory not found or incomplete. Running build first...")

        # Find bun executable (prefer portable)
        bun_exe = find_bun_executable()
        if not bun_exe:
            print_error("Bun executable not found for building!")
            return None

        try:
            print_status("Building Next.js application...")
            build_process = subprocess.run(
                [bun_exe, "run", "build"],
                cwd=str(PROJECT_ROOT),
                capture_output=False,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            if build_process.returncode != 0:
                print_error("Build failed!")
                return None
            print_success("Build completed!")
        except Exception as e:
            print_error(f"Build failed: {e}")
            return None

    # Find bun executable for starting (prefer portable)
    bun_exe = find_bun_executable()
    if not bun_exe:
        print_error("Bun executable not found!")
        return None

    print_status("Starting Next.js production server...")

    try:
        process = subprocess.Popen(
            [bun_exe, "run", "start"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )

        print_success("Next.js production server started!")
        print_status(f"Production server: http://localhost:{NEXTJS_PORT}")
        return process

    except Exception as e:
        print_error(f"Failed to start Next.js production server: {e}")
        return None


def cleanup_processes(*processes):
    """Clean up all spawned processes."""
    print_header("\n[CLEANING UP]")
    print_status("Shutting down services...")

    for name, proc in processes:
        if proc and proc.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/PID", str(proc.pid)],
                                 capture_output=True,
                                 creationflags=subprocess.CREATE_NO_WINDOW)
                else:
                    proc.terminate()
                print_status(f"Stopped {name}")
            except Exception as e:
                print_error(f"Error stopping {name}: {e}")


def main():
    """Main entry point."""
    print("")
    print_header("==============================================")
    print_header("  MineManager - Interactive Launcher")
    print_header("==============================================")
    print("")

    # Step 1: Show menu and get choice
    print("Select mode:")
    print(f"  [{Colors.GREEN}1{Colors.ENDC}] Production")
    print(f"  [{Colors.GREEN}2{Colors.ENDC}] Development")
    print("")

    while True:
        try:
            choice = input(f"{Colors.CYAN}Enter choice (1 or 2): {Colors.ENDC}").strip()
            if choice in ["1", "2"]:
                break
            print_error("Invalid choice. Please enter 1 or 2.")
        except (KeyboardInterrupt, EOFError):
            print("\n")
            print_warning("Launch cancelled by user.")
            sys.exit(0)

    is_production = choice == "1"
    mode_name = "Production" if is_production else "Development"
    print_success(f"Selected: {mode_name}")
    print("")

    # Step 2: Kill processes on required ports
    print_header("[CLEANING UP PORTS]")
    print("")

    ports_to_check = [
        (NEXTJS_PORT, "Next.js"),
        (REDIS_PORT, "Redis"),
        (TUNNEL_PORT, "Tunnel"),
        (WEBSOCKET_PORT, "WebSocket")
    ]

    for port, name in ports_to_check:
        if kill_process_on_port(port):
            print_success(f"Cleaned up {name} port ({port})")
        else:
            print(f"{name} port ({port}) was free")

    print("")

    # Step 3: Check dependencies
    deps_ok = check_and_install_dependencies()

    if not deps_ok:
        print_warning("Some dependencies are missing. Continue anyway? (y/n)")
        while True:
            try:
                confirm = input("> ").strip().lower()
                if confirm == "y":
                    break
                elif confirm == "n":
                    print_warning("Launch cancelled.")
                    sys.exit(0)
                print_error("Please enter y or n.")
            except (KeyboardInterrupt, EOFError):
                print("\n")
                print_warning("Launch cancelled by user.")
                sys.exit(0)

    # Step 4: Start Redis
    redis_process = start_redis()

    # Step 5: Initialize libsql database
    init_libsql_db()

    # Step 6: Start Cloudflare tunnel
    tunnel_process = start_cloudflare_tunnel()

    # Step 7: Start Next.js
    if is_production:
        nextjs_process = start_nextjs_production()
    else:
        nextjs_process = start_nextjs_dev()

    # Print final status
    print("")
    print_header("==============================================")
    print_header("  MineManager is starting!")
    print_header("==============================================")
    print("")
    print_status(f"Mode: {mode_name}")
    print_status(f"Next.js: http://localhost:{NEXTJS_PORT}")
    print_status(f"Redis: localhost:{REDIS_PORT}")
    if tunnel_process:
        print_status(f"Tunnel: localhost:{TUNNEL_PORT}")
    print("")
    print_warning("Press Ctrl+C to stop all services")
    print("")

    # Wait for interrupt
    try:
        # Monitor processes
        processes_to_monitor = [
            ("Redis", redis_process),
            ("Tunnel", tunnel_process),
            ("Next.js", nextjs_process)
        ]

        while True:
            time.sleep(1)

            # Check if any process died
            all_dead = True
            for name, proc in processes_to_monitor:
                if proc and proc.poll() is None:
                    all_dead = False
                elif proc and proc.poll() is not None:
                    print_error(f"{name} process died unexpectedly!")

            if all_dead:
                print_error("All processes have stopped.")
                break

    except KeyboardInterrupt:
        print("\n")
        print_warning("Shutting down...")

    # Cleanup
    cleanup_processes(*processes_to_monitor)
    print_success("Goodbye!")


if __name__ == "__main__":
    main()
