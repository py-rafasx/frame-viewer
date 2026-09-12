#!/usr/bin/env python3
"""
Simple HTTP server for testing the frame-view project locally.
Starts a server on port 8000 by default.
Supports auto-reload on file changes when watchdog is installed.
"""

import http.server
import socketserver
import os
import sys
import time
import threading
from pathlib import Path

# Optional dependency: auto-reload when watchdog is installed (see requirements-dev.txt).
try:
    from watchdog.observers import Observer  # type: ignore[import-not-found]
    from watchdog.events import FileSystemEventHandler  # type: ignore[import-not-found]

    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    Observer = None

    class FileSystemEventHandler:
        """Stub base so ReloadHandler can be defined when watchdog is not installed."""

        pass

# Default port
PORT = 8000

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent.absolute()
os.chdir(SCRIPT_DIR)

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler with CORS headers, no-cache and dotfile blocking."""

    def translate_path(self, path):
        """Block hidden files/folders (.git, etc.) from being served."""
        path = super().translate_path(path)
        rel = os.path.relpath(path, SCRIPT_DIR)
        if any(part.startswith('.') for part in rel.split(os.sep)):
            return os.path.join(SCRIPT_DIR, '__blocked__')
        return path

    def end_headers(self):
        # Add CORS headers to allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable browser caching: always serve the latest files on refresh
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        """Override to provide cleaner log messages."""
        print(f"[{self.address_string()}] {format % args}")


class ReloadHandler(FileSystemEventHandler):
    """Handler for file system events to trigger server reload."""
    
    def __init__(self, server_instance):
        """
        Initialize the reload handler.
        
        Args:
            server_instance: The HTTP server instance to restart
        """
        self.server = server_instance
        self.last_reload = time.time()
        self.reload_delay = 1.0  # Minimum delay between reloads (in seconds)
        # Files to ignore (like .pyc, __pycache__, etc.)
        self.ignore_patterns = ['.pyc', '__pycache__', '.git', '.DS_Store']
    
    def should_ignore(self, path):
        """
        Check if a file path should be ignored.
        
        Args:
            path: The file path to check
            
        Returns:
            True if the path should be ignored, False otherwise
        """
        path_str = str(path).lower()
        return any(pattern in path_str for pattern in self.ignore_patterns)
    
    def on_modified(self, event):
        """
        Handle file modification events.
        
        Args:
            event: The file system event
        """
        if event.is_directory:
            return
        
        if self.should_ignore(event.src_path):
            return
        
        # Prevent too frequent reloads
        current_time = time.time()
        if current_time - self.last_reload < self.reload_delay:
            return
        
        self.last_reload = current_time
        
        # Only reload for relevant file types
        relevant_extensions = ['.html', '.js', '.css', '.py', '.json', '.png', '.jpg', '.jpeg']
        if any(event.src_path.lower().endswith(ext) for ext in relevant_extensions):
            print(f"\n[Auto-reload] File changed: {event.src_path}")
            print("[Auto-reload] Restarting server...")
            # Schedule server shutdown in a separate thread to avoid blocking
            threading.Thread(target=self._restart_server, daemon=True).start()
    
    def _restart_server(self):
        """
        Restart the server by shutting it down.
        The main process will detect this and restart.
        """
        time.sleep(0.5)  # Small delay to ensure file write is complete
        if self.server:
            self.server.shutdown()

def start_server():
    """
    Start the HTTP server and return the server instance.
    
    Returns:
        The HTTP server instance
    """
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), MyHTTPRequestHandler)  # localhost apenas
    httpd.allow_reuse_address = True  # Allow address reuse for quick restarts
    
    print("=" * 60)
    print("Frame Viewer - Local Test Server")
    print("=" * 60)
    print(f"\nServer running at:")
    print(f"  Desktop: http://localhost:{PORT}/desktop/")
    print(f"  Mobile:  http://localhost:{PORT}/mobile/")
    print(f"\nServing directory: {SCRIPT_DIR}")
    
    if WATCHDOG_AVAILABLE:
        print(f"\n[Auto-reload] Enabled - Server will restart on file changes")
    else:
        print(f"\n[Auto-reload] Disabled - Install 'watchdog' for auto-reload:")
        print(f"  pip install watchdog")
    
    print(f"\nPress Ctrl+C to stop the server")
    print("=" * 60)
    print()
    
    return httpd


def main():
    """Start the HTTP server with optional auto-reload support."""
    observer = None
    
    try:
        while True:
            httpd = start_server()
            
            # Set up file watching if watchdog is available
            if WATCHDOG_AVAILABLE and observer is None:
                event_handler = ReloadHandler(httpd)
                observer = Observer()
                # Watch the entire project directory
                observer.schedule(event_handler, str(SCRIPT_DIR), recursive=True)
                observer.start()
                print("[Auto-reload] Watching for file changes...\n")
            
            # Start serving (this will block until server is shut down)
            httpd.serve_forever()
            
            # If we get here, the server was shut down (likely for reload)
            httpd.server_close()
            print("\n[Auto-reload] Server stopped, restarting...\n")
            time.sleep(0.5)  # Brief pause before restart
            
    except KeyboardInterrupt:
        print("\n\nServer stopped by user.")
        if observer:
            observer.stop()
            observer.join()
        sys.exit(0)
    except OSError as e:
        if e.errno == 48 or e.errno == 98:  # Address already in use
            print(f"\nError: Port {PORT} is already in use!")
            print(f"Please close the application using port {PORT} or change the PORT variable.")
            if observer:
                observer.stop()
                observer.join()
            sys.exit(1)
        else:
            print(f"\nError starting server: {e}")
            if observer:
                observer.stop()
                observer.join()
            sys.exit(1)

if __name__ == "__main__":
    main()
