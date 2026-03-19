import { nodeManager } from '@/lib/server-manager';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  
  if (!server) {
    return new Response('Server not found', { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const onLog = (msg: string) => controller.enqueue(`data: ${JSON.stringify({ type: 'log', msg })}\n\n`);
      const onStatus = (status: string) => controller.enqueue(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
      const onTunnelLog = (msg: string) => controller.enqueue(`data: ${JSON.stringify({ type: 'tunnelLog', msg })}\n\n`);
      const onTunnelStatus = (status: string) => controller.enqueue(`data: ${JSON.stringify({ type: 'tunnelStatus', status })}\n\n`);
      const onTunnelAddress = (address: string | null) => controller.enqueue(`data: ${JSON.stringify({ type: 'tunnelAddress', address })}\n\n`);
      const onMetrics = (metric: any) => controller.enqueue(`data: ${JSON.stringify({ type: 'metrics', metric })}\n\n`);

      controller.enqueue(`data: ${JSON.stringify({ 
        type: 'init', 
        logs: server.logs, 
        status: server.status, 
        tunnelLogs: server.tunnelLogs, 
        tunnelStatus: server.tunnelStatus,
        tunnelAddress: server.tunnelAddress,
        metrics: server.metrics 
      })}\n\n`);

      server.on('log', onLog);
      server.on('status', onStatus);
      server.on('tunnelLog', onTunnelLog);
      server.on('tunnelStatus', onTunnelStatus);
      server.on('tunnelAddress', onTunnelAddress);
      server.on('metrics', onMetrics);

      req.signal.addEventListener('abort', () => {
        server.off('log', onLog);
        server.off('status', onStatus);
        server.off('tunnelLog', onTunnelLog);
        server.off('tunnelStatus', onTunnelStatus);
        server.off('tunnelAddress', onTunnelAddress);
        server.off('metrics', onMetrics);
        try { controller.close(); } catch (e) {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
