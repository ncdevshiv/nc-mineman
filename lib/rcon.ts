import net from 'net';

export class RconClient {
  private socket: net.Socket | null = null;
  private host: string;
  private port: number;
  private password: string;
  private connected = false;
  private requestId = 0;

  private static PACKET_TYPE_AUTH = 3;
  private static PACKET_TYPE_EXEC_COMMAND = 2;
  private static PACKET_TYPE_RESPONSE = 0;

  constructor(host: string, port: number, password: string) {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  private async connectSocket(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private encodePacket(type: number, body: string): Buffer {
    const bodyBytes = Buffer.from(body, 'utf8');
    const length = 4 + 4 + bodyBytes.length + 2;
    const buffer = Buffer.alloc(4 + length);
    buffer.writeInt32LE(length, 0);
    buffer.writeInt32LE(this.requestId, 4);
    buffer.writeInt32LE(type, 8);
    bodyBytes.copy(buffer, 12);
    buffer.writeInt16LE(0, 12 + bodyBytes.length);
    return buffer;
  }

  private async sendPacket(type: number, body: string): Promise<string> {
    if (!this.socket || !this.connected) {
      this.socket = await this.connectSocket() as net.Socket;
      await this.authenticate();
    }

    const id = ++this.requestId;
    const packet = this.encodePacket(type, body);
    packet.writeInt32LE(id, 4);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let expectedLen = -1;
      let receivedLen = 0;

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        receivedLen += chunk.length;

        if (expectedLen === -1 && receivedLen >= 4) {
          expectedLen = chunks.reduce((buf: Buffer[]) => buf, []).reduce((acc, b) => acc + b.length, 0);
          const lenBuffer = Buffer.concat(chunks);
          expectedLen = lenBuffer.readInt32LE(0) + 4;
        }

        if (expectedLen > 0 && receivedLen >= expectedLen) {
          this.socket!.removeListener('data', onData);
          const fullBuffer = Buffer.concat(chunks);
          const responseId = fullBuffer.readInt32LE(4);
          if (responseId === -1) {
            reject(new Error('Invalid RCON password'));
            return;
          }
          const bodyLen = fullBuffer.readInt32LE(0) - 4 - 4;
          const body = fullBuffer.toString('utf8', 12, 12 + bodyLen - 2);
          resolve(body);
        }
      };

      this.socket!.on('data', onData);
      this.socket!.write(packet, (err) => {
        if (err) reject(err);
      });

      setTimeout(() => {
        this.socket?.removeListener('data', onData);
        reject(new Error('RCON command timeout'));
      }, 10000);
    });
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const authPacket = this.encodePacket(RconClient.PACKET_TYPE_AUTH, this.password);
      const chunks: Buffer[] = [];
      let receivedLen = 0;

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        receivedLen += chunk.length;

        if (receivedLen >= 14) {
          this.socket!.removeListener('data', onData);
          const fullBuffer = Buffer.concat(chunks);
          const responseId = fullBuffer.readInt32LE(4);
          if (responseId === -1) {
            this.connected = false;
            reject(new Error('Invalid RCON password'));
          } else {
            this.connected = true;
            resolve();
          }
        }
      };

      this.socket!.on('data', onData);
      this.socket!.write(authPacket, (err) => {
        if (err) reject(err);
      });

      setTimeout(() => {
        this.socket?.removeListener('data', onData);
        reject(new Error('RCON authentication timeout'));
      }, 5000);
    });
  }

  public async send(command: string): Promise<string> {
    try {
      return await this.sendPacket(RconClient.PACKET_TYPE_EXEC_COMMAND, command);
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }
}

export class RconPool {
  private clients: Map<string, RconClient> = new Map();

  public get(host: string, port: number, password: string): RconClient {
    const key = `${host}:${port}:${password}`;
    let client = this.clients.get(key);
    if (!client) {
      client = new RconClient(host, port, password);
      this.clients.set(key, client);
    }
    return client;
  }

  public closeAll() {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}

export const rconPool = new RconPool();
