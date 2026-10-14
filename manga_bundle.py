"""Resolve optional weights shipped inside the one-click package.

Lookup order for every model path helper:
1. Explicit environment variable (LAMA_MODEL, SAM2_MODEL, …)
2. ``bundled_models/`` next to this file (installer / portable zip)
3. The usual user cache under XDG_CACHE_HOME / ~/.cache

Large weight files are never committed to git; CI downloads them into
``bundled_models/`` while building the Windows Setup and portable zip.
"""
import os

_ROOT = os.path.dirname(os.path.abspath(__file__))


def app_root():
    return _ROOT


def bundled_root():
    return os.path.join(_ROOT, "bundled_models")


def bundled_file(*parts):
    path = os.path.join(bundled_root(), *parts)
    return path if os.path.isfile(path) else None


def bundled_dir(*parts):
    path = os.path.join(bundled_root(), *parts)
    return path if os.path.isdir(path) else None


def prefer(explicit, *candidates):
    """Return the first existing path among explicit (if set) then candidates."""
    if explicit:
        path = os.path.abspath(os.path.expanduser(str(explicit).strip()))
        if os.path.exists(path):
            return path
        return path  # honour the override even if missing (caller reports)
    for c in candidates:
        if c and os.path.exists(c):
            return os.path.abspath(c)
    return os.path.abspath(candidates[-1]) if candidates else None
