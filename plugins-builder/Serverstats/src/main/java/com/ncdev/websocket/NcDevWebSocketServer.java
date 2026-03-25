package com.ncdev.websocket;

import com.ncdev.NcDevPlugin;
import com.ncdev.cache.PlayerCache;
import com.ncdev.config.NcDevConfig;
import com.ncdev.util.JsonLogger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Native WebSocket Server for real-time communication.
 * Provides lightweight real-time updates.
 */
public class NcDevWebSocketServer extends WebSocketServer {

    private final NcDevPlugin plugin;
    private final NcDevConfig.Websocket config;
    
    private final Map<UUID, ClientInfo> connections = new ConcurrentHashMap<>();
    private final Map<String, Set<UUID>> rooms = new ConcurrentHashMap<>();
    private final AtomicInteger totalConnections = new AtomicInteger(0);
    
    private volatile boolean running = false;

    public NcDevWebSocketServer(int port, NcDevConfig.Websocket config, NcDevPlugin plugin) {
        super(new InetSocketAddress(port));
        this.config = config;
        this.plugin = plugin;
    }

    @Override
    public void onStart() {
        setReuseAddr(true);
        running = true;
        
        JsonLogger.info("websocket_server_started", Map.of(
                "port", getPort(),
                "max_connections", config.maxConnections()
        ));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        if (totalConnections.get() >= config.maxConnections()) {
            conn.close(1008, "Server at capacity");
            return;
        }
        
        String clientId = handshake.getFieldValue("client-id");
        if (clientId == null || clientId.isEmpty()) {
            clientId = "anon-" + conn.getRemoteSocketAddress().getAddress().getHostAddress();
        }
        
        UUID sessionId = UUID.randomUUID();
        
        ClientInfo info = new ClientInfo(
                sessionId,
                clientId,
                conn.getRemoteSocketAddress().getAddress().getHostAddress(),
                System.currentTimeMillis()
        );
        
        connections.put(sessionId, info);
        connectionsByWebSocket.put(conn, sessionId);
        totalConnections.incrementAndGet();
        
        // Send welcome message
        sendToClient(conn, "connected", Map.of(
                "client_id", clientId,
                "server_id", plugin.PLUGIN_NAME,
                "server_version", plugin.PLUGIN_VERSION,
                "timestamp", System.currentTimeMillis()
        ));
        
        JsonLogger.info("websocket_client_connected", Map.of(
                "client_id", clientId,
                "address", info.address()
        ));
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        UUID sessionId = connectionsByWebSocket.remove(conn);
        if (sessionId != null) {
            ClientInfo info = connections.remove(sessionId);
            if (info != null) {
                // Remove from all rooms
                for (Set<UUID> room : rooms.values()) {
                    room.remove(sessionId);
                }
                
                totalConnections.decrementAndGet();
                
                JsonLogger.info("websocket_client_disconnected", Map.of(
                        "client_id", info.clientId(),
                        "code", code,
                        "reason", reason
                ));
            }
        }
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        UUID sessionId = connectionsByWebSocket.get(conn);
        if (sessionId == null) return;
        
        try {
            // Parse message
            @SuppressWarnings("unchecked")
            Map<String, Object> json = plugin.GSON.fromJson(message, Map.class);
            String type = (String) json.get("type");
            
            switch (type) {
                case "subscribe" -> handleSubscribe(sessionId, json);
                case "unsubscribe" -> handleUnsubscribe(sessionId, json);
                case "ping" -> sendToSession(sessionId, "pong", Map.of("timestamp", System.currentTimeMillis()));
                default -> {
                    if (json.containsKey("event")) {
                        // Handle custom events
                    }
                }
            }
            
        } catch (Exception e) {
            JsonLogger.error("websocket_message_parse_error", Map.of(
                    "session_id", sessionId.toString()
            ), e);
            sendToClient(conn, "error", Map.of("message", "Invalid message format"));
        }
    }

    @Override
    public void onMessage(WebSocket conn, ByteBuffer message) {
        // Handle binary messages
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        JsonLogger.error("websocket_error", Map.of(), ex);
    }

    // Track WebSocket to UUID mapping
    private final Map<WebSocket, UUID> connectionsByWebSocket = new ConcurrentHashMap<>();

    // ==================== HANDLERS ====================

    private void handleSubscribe(UUID sessionId, Map<String, Object> data) {
        String room = (String) data.get("room");
        if (room == null || room.isEmpty()) {
            return;
        }
        
        rooms.computeIfAbsent(room, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        
        sendToSession(sessionId, "subscribed", Map.of("room", room));
        
        JsonLogger.info("websocket_client_subscribed", Map.of(
                "room", room,
                "session_id", sessionId.toString()
        ));
    }

    private void handleUnsubscribe(UUID sessionId, Map<String, Object> data) {
        String room = (String) data.get("room");
        if (room == null || room.isEmpty()) {
            return;
        }
        
        Set<UUID> roomClients = rooms.get(room);
        if (roomClients != null) {
            roomClients.remove(sessionId);
        }
        
        sendToSession(sessionId, "unsubscribed", Map.of("room", room));
    }

    // ==================== SEND METHODS ====================

    /**
     * Send message to specific client
     */
    public void sendToClient(WebSocket conn, String event, Object data) {
        if (conn == null || !conn.isOpen()) return;
        
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("type", event);
            message.put("data", data);
            message.put("timestamp", System.currentTimeMillis());
            
            String json = plugin.GSON.toJson(message);
            conn.send(json);
        } catch (Exception e) {
            JsonLogger.error("websocket_send_failed", Map.of("event", event), e);
        }
    }

    /**
     * Send to session by UUID
     */
    public void sendToSession(UUID sessionId, String event, Object data) {
        WebSocket conn = findConnectionBySession(sessionId);
        if (conn != null) {
            sendToClient(conn, event, data);
        }
    }

    /**
     * Send message to room
     */
    public void sendToRoom(String room, String event, Object data) {
        Set<UUID> roomClients = rooms.get(room);
        if (roomClients == null || roomClients.isEmpty()) return;
        
        Map<String, Object> message = new HashMap<>();
        message.put("type", event);
        message.put("data", data);
        message.put("timestamp", System.currentTimeMillis());
        
        String json = plugin.GSON.toJson(message);
        
        for (UUID sessionId : roomClients) {
            WebSocket conn = findConnectionBySession(sessionId);
            if (conn != null && conn.isOpen()) {
                try {
                    conn.send(json);
                } catch (Exception e) {
                    // Client might have disconnected
                }
            }
        }
    }

    /**
     * Broadcast to all connected clients
     */
    public void broadcast(String event, Object data) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", event);
        message.put("data", data);
        message.put("timestamp", System.currentTimeMillis());
        
        String json = plugin.GSON.toJson(message);
        
        for (UUID sessionId : connections.keySet()) {
            WebSocket conn = findConnectionBySession(sessionId);
            if (conn != null && conn.isOpen()) {
                try {
                    conn.send(json);
                } catch (Exception e) {
                    // Client might have disconnected
                }
            }
        }
    }

    // ==================== SPECIALIZED BROADCASTS ====================

    /**
     * Broadcast player update
     */
    public void broadcastPlayerUpdate(UUID playerUuid, PlayerCache.PlayerData data) {
        String room = "player:" + playerUuid.toString();
        sendToRoom(room, "player:update", data.toMap());
    }

    /**
     * Broadcast server stats
     */
    public void broadcastServerStats(Map<String, Object> stats) {
        broadcast("server:stats", stats);
    }

    /**
     * Broadcast activity
     */
    public void broadcastActivity(Map<String, Object> activity) {
        broadcast("activity", activity);
    }

    // ==================== UTILITY METHODS ====================

    private WebSocket findConnectionBySession(UUID sessionId) {
        for (Map.Entry<WebSocket, UUID> entry : connectionsByWebSocket.entrySet()) {
            if (entry.getValue().equals(sessionId)) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * Get connected client count
     */
    public int getConnectedCount() {
        return totalConnections.get();
    }

    /**
     * Get room count
     */
    public int getRoomCount() {
        return rooms.size();
    }

    /**
     * Get clients in room
     */
    public int getRoomSize(String room) {
        Set<UUID> roomClients = rooms.get(room);
        return roomClients != null ? roomClients.size() : 0;
    }

    /**
     * Check if server is running
     */
    public boolean isRunning() {
        return running;
    }

    /**
     * Stop the server
     */
    public void stop() {
        running = false;
        super.stop();
        JsonLogger.info("websocket_server_stopped", Map.of());
    }

    // ==================== INNER CLASSES ====================

    /**
     * Client connection info
     */
    public record ClientInfo(
            UUID sessionId,
            String clientId,
            String address,
            long connectedAt
    ) {}
}
