<div align="center">
  <h1>MineServer2</h1>
  <p>A complete Minecraft server manager with Next.js dashboard</p>
</div>

MineServer2 is a comprehensive Minecraft server management solution built with Next.js, providing a modern web interface to manage multiple Minecraft servers, monitor performance, and handle player management.

## Features

- 🎮 **Multi-Server Management**: Manage multiple Minecraft servers from one dashboard
- 📊 **Real-time Monitoring**: Track server performance, player count, and resource usage
- 👥 **Player Management**: View online players, manage permissions, and handle player data
- 📁 **File Management**: Upload, download, and edit server files through the web interface
- 🔄 **Automated Backups**: Schedule and manage server backups
- 🛡️ **Security**: Secure authentication and authorization system
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Lucide React icons
- **Backend**: Next.js API routes, Node.js
- **Authentication**: NextAuth.js
- **Package Manager**: Bun
- **Database**: JSON-based server configuration

## Prerequisites

- Node.js 18+ or Bun
- Windows, macOS, or Linux
- Java runtime for Minecraft servers

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/ncdevshiv/nc-mineman.git
   cd MineServer2
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration.

4. **Start the development server**
   ```bash
   bun run dev
   # or
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run start:dev` - Start production server in dev mode
- `bun run lint` - Run ESLint
- `bun run typecheck` - Run TypeScript type checking
- `bun run clean` - Clean Next.js cache

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Application URL
APP_URL="http://localhost:3000"

# NextAuth.js configuration
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Optional: AI features (if using Gemini integration)
GEMINI_API_KEY="your-gemini-api-key"
```

### Server Configuration

Server configurations are stored in `servers.json`. Each server includes:

- Server ID and name
- Java path and memory allocation
- Server JAR file path
- Network settings (port, IP)
- Backup configuration

## Project Structure

```
MineServer2/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── dashboard/      # Dashboard pages
│   └── servers/        # Server management pages
├── components/         # React components
├── lib/               # Utility functions
├── scripts/           # Server management scripts
├── servers/           # Minecraft server instances
└── public/            # Static assets
```

## Managing Servers

### Adding a New Server

1. Create a new directory in `servers/`
2. Download and place your server JAR file
3. Configure server properties
4. Add server configuration to `servers.json`

### Server Controls

- **Start/Stop**: Control server instances from the dashboard
- **Restart**: Quick restart without losing players
- **Backup**: Create manual or scheduled backups
- **Logs**: View real-time server logs
- **Console**: Execute server commands

## Deployment

### Production Deployment

1. **Build the application**
   ```bash
   bun run build
   ```

2. **Start production server**
   ```bash
   bun run start
   ```

### Docker Deployment

A Docker setup can be configured for containerized deployment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

- 📖 Documentation: Check the inline documentation
- 🐛 Issues: Report bugs via GitHub Issues
- 💬 Discussions: Join our GitHub Discussions

## License

This project is licensed under the MIT License.

## Acknowledgments

- Minecraft server management community
- Next.js and React ecosystem
- All contributors and users

---

**MineServer2** - Making Minecraft server management simple and efficient.
