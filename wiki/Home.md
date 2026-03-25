# NC-Mineman Wiki

Welcome to the NC-Mineman wiki - your guide to the Minecraft Server Management Dashboard.

## Getting Started

- [Installation](docs/getting-started.md) — How to install and run
- [Quick Start Guide](docs/QUICK-START.md) — Get up and running fast
- [DNS & Network Setup](docs/DNS-NETWORK-SETUP.md) — Configure public access

## Features

- [Server Management](docs/architecture.md) — Creating and managing Minecraft servers
- [Player Management](wiki/player-management.md) — Tracking players via SQLite database
- [Database Schema](docs/database.md) — SQLite tables and operations
- [Automation](automation.md) — Rule-based automation
- [Backups](backups.md) — Backup and restore
- [Networking](networking.md) — Cloudflare Tunnel setup
- [Troubleshooting](wiki/troubleshooting.md) — Common issues and fixes

## User Guide

### Authentication
- Discord OAuth2 is used for authentication
- Admin access granted via ADMIN_USERNAMES in .env.local
- Users can link their Minecraft username after login

### Profile Management
- Users can edit: Site display name, Discord username, Phone number
- Email is read-only (from OAuth)
- **Minecraft username can only be changed by Admins/Moderators**

### Roles & Permissions
- **Owner/Admin** - Full access to all features
- **God** - Full admin access
- **Helper** - Moderator access (can change Minecraft usernames)
- **Member** - Standard user access

## Development

- [Architecture Overview](docs/architecture.md)
- [API Reference](docs/api-reference.md)
- [Production Setup](docs/PRODUCTION-SETUP.md)

## Quick Links

- [README](../README.md)
- [GitHub](https://github.com/ncdevshiv/nc-mineman)
- [Report Issues](https://github.com/ncdevshiv/nc-mineman/issues)