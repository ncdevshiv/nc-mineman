package com.ncdev.socketio;

import com.ncdev.NcDevPlugin;
import com.ncdev.cache.PlayerCache;
import com.ncdev.config.NcDevConfig;
import com.ncdev.util.JsonLogger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiConsumer;

/**
 * Socket.IO compatible server implementation using standard WebSocket.
 * Provides Socket.IO-like features (rooms, namespaces, events) on top of WebSocket.
 * 
 * This implementation supports Socket.IO 4.x protocol emulation, allowing
 * connection from any Socket.IO 4.x compatible client.
 */
public class SocketIOManager extends WebSocketServer {

    private final NcDevPlugin plugin;
    private final NcDevConfig.Socketio config;
    
    // Connection tracking
    private final Map<UUID, ClientInfo> clients = new ConcurrentHashMap<>();
    private final Map<String, Set<UUID>> rooms = new ConcurrentHashMap<>();
    private final Map<String, Set<UUID>> namespaceRooms = new ConcurrentHashMap<>();
    private final Map<UUID, Set<String>> clientRooms = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> roomMemberCounts = new ConcurrentHashMap<>();
    
    // Event handlers
    private final Map<String, BiConsumer<UUID, Object>> eventHandlers = new ConcurrentHashMap<>();
    
    // Namespaces
    private final Set<String> namespaces = ConcurrentHashMap.newKeySet();
    
    // Batching for performance
    private final Map<UUID, List<Map<String, Object>>> clientBatches = new ConcurrentHashMap<>();
    private Timer batchFlushTimer;

    public SocketIOManager(int port, NcDevConfig.Socketio config, NcDevPlugin plugin) {
        super(new InetSocketAddress(port));
        this.config = config;
        this.plugin = plugin;
        
        // Add default namespaces
        for (var ns : config.namespaces()) {
            namespaces.add(ns.name());
        }
        
        // Initialize batch flush timer
        if (config.batching().enabled()) {
            batchFlushTimer = new Timer();
            batchFlushTimer.scheduleAtFixedRate(new TimerTask() {
                @Override
                public void run() {
                    flushBatches();
                }
            }, config.batching().intervalMs(), config.batching().intervalMs());
        }
    }

    /**
     * Start the Socket.IO server
     */
    public void start() {
        if (!config.enabled()) {
            JsonLogger.info("socketio_disabled", Map.of());
            return;
        }
        
        try {
            setReuseAddr(true);
            setConnectionLostTimeout(60);
            
            start();
            
            JsonLogger.info("socketio_started", Map.of(
                    "port", config.port(),
                    "namespaces", namespaces.size()
            ));
            
        } catch (Exception e) {
            JsonLogger.error("socketio_start_failed", Map.of("port", config.port()), e);
        }
    }

    @Override
    public void onStart() {
        JsonLogger.info("socketio_server_started", Map.of(
                "port", getPort(),
                "max_connections", config.maxPayloadBytes()
        ));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        String clientId = handshake.getFieldValue("client-id");
        if (clientId == null || clientId.isEmpty()) {
            clientId = "anon-" + UUID.randomUUID().toString().substring(0, 8);
        }
        
        UUID sessionId = UUID.randomUUID();
        
        ClientInfo info = new ClientInfo(
                sessionId,
                clientId,
                conn.getRemoteSocketAddress().getAddress().getHostAddress(),
                System.currentTimeMillis(),
                handshake.getResourceDescriptor()
        );
        
        clients.put(sessionId, info);
        
        // Send Socket.IO connection packet
        sendSocketIOPacket(conn, "open", Map.of(
                "sid", sessionId.toString(),
                "upgrades", List.of("websocket"),
                "pingInterval", config.pingIntervalMs(),
                "pingTimeout", config.pingTimeoutMs()
        ));
        
        JsonLogger.info("socketio_client_connected", Map.of(
                "session_id", sessionId.toString(),
                "client_id", clientId
        ));
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        UUID sessionId = findSessionByConnection(conn);
        if (sessionId != null) {
            ClientInfo info = clients.remove(sessionId);
            if (info != null) {
                // Remove from all rooms
                Set<String> myRooms = clientRooms.remove(sessionId);
                if (myRooms != null) {
                    for (String room : myRooms) {
                        Set<UUID> roomClients = rooms.get(room);
                        if (roomClients != null) {
                            roomClients.remove(sessionId);
                        }
                        AtomicInteger count = roomMemberCounts.get(room);
                        if (count != null) {
                            count.decrementAndGet();
                        }
                    }
                }
                
                JsonLogger.info("socketio_client_disconnected", Map.of(
                        "session_id", sessionId.toString(),
                        "code", code,
                        "reason", reason
                ));
            }
        }
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        UUID sessionId = findSessionByConnection(conn);
        if (sessionId == null) return;
        
        try {
            // Parse Socket.IO message format
            // Format: <packet type>[<data>]
            // Packet types: 0=connect, 2=event, 3=ack, 4=error, 40=connect to namespace, 42=event to namespace
            
            if (message.startsWith("40")) {
                // Connect to namespace
                handleNamespaceConnect(conn, sessionId, message);
            } else if (message.startsWith("42")) {
                // Event on namespace
                handleNamespaceEvent(conn, sessionId, message);
            } else if (message.startsWith("2")) {
                // Ping (Socket.IO uses '2' for ping)
                handlePing(conn, sessionId);
            } else if (message.equals("3")) {
                // Pong response
                handlePong(conn, sessionId);
            }
            
        } catch (Exception e) {
            JsonLogger.error("socketio_message_error", Map.of(
                    "session_id", sessionId.toString(),
                    "message", message
            ), e);
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        JsonLogger.error("socketio_error", Map.of(), ex);
    }

    // ==================== HANDLERS ====================

    private void handleNamespaceConnect(WebSocket conn, UUID sessionId, String message) {
        // Extract namespace from message (format: 40/<namespace>)
        String namespace = "/";
        String fullMsg = message.substring(2);
        if (fullMsg.contains(",")) {
            namespace = fullMsg.substring(0, fullMsg.indexOf(','));
        } else if (fullMsg.startsWith("/")) {
            namespace = fullMsg;
        }
        
        // Store namespace for this client
        ClientInfo info = clients.get(sessionId);
        if (info != null) {
            clients.put(sessionId, new ClientInfo(
                    info.sessionId(),
                    info.clientId(),
                    info.address(),
                    info.connectedAt(),
                    namespace
            ));
        }
        
        // Send connect acknowledgment
        sendSocketIOPacket(conn, "0", namespace);  // 0 = CONNECT packet
        
        JsonLogger.info("socketio_namespace_connect", Map.of(
                "session_id", sessionId.toString(),
                "namespace", namespace
        ));
    }

    private void handleNamespaceEvent(WebSocket conn, UUID sessionId, String message) {
        // Extract event data (format: 42/<namespace>,<json array>)
        String fullMsg = message.substring(2);
        int commaIndex = fullMsg.indexOf(',');
        
        if (commaIndex == -1) return;
        
        String namespace = fullMsg.substring(0, commaIndex);
        String jsonData = fullMsg.substring(commaIndex + 1);
        
        try {
            // Parse JSON array: ["eventName", {...data}]
            var eventData = plugin.GSON.fromJson(jsonData, List.class);
            if (eventData == null || eventData.isEmpty()) return;
            
            String eventName = String.valueOf(eventData.get(0));
            Object data = eventData.size() > 1 ? eventData.get(1) : null;
            
            // Handle built-in events
            switch (eventName) {
                case "subscribe" -> handleSubscribe(conn, sessionId, data);
                case "unsubscribe" -> handleUnsubscribe(conn, sessionId, data);
                case "ping" -> handlePing(conn, sessionId);
                default -> {
                    // Call custom event handlers
                    BiConsumer<UUID, Object> handler = eventHandlers.get(eventName);
                    if (handler != null) {
                        handler.accept(sessionId, data);
                    }
                }
            }
            
        } catch (Exception e) {
            JsonLogger.error("socketio_event_parse_error", Map.of(
                    "session_id", sessionId.toString(),
                    "data", jsonData
            ), e);
        }
    }

    private void handleSubscribe(WebSocket conn, UUID sessionId, Object data) {
        if (data == null) return;
        
        String room;
        if (data instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> mapData = (Map<String, Object>) data;
            room = (String) mapData.get("room");
        } else {
            room = String.valueOf(data);
        }
        
        if (room == null || room.isEmpty()) return;
        
        // Check room limits
        if (config.rooms().enabled() && config.rooms().maxRoomsPerSocket() > 0) {
            Set<String> rooms = clientRooms.computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet());
            if (rooms.size() >= config.rooms().maxRoomsPerSocket()) {
                sendSocketIOEvent(conn, "error", Map.of(
                        "message", "Maximum rooms reached",
                        "max", config.rooms().maxRoomsPerSocket()
                ));
                return;
            }
        }
        
        // Join room
        rooms.computeIfAbsent(room, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        clientRooms.computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet()).add(room);
        roomMemberCounts.computeIfAbsent(room, k -> new AtomicInteger(0)).incrementAndGet();
        
        // Send acknowledgment
        sendSocketIOEvent(conn, "subscribed", Map.of("room", room));
        
        JsonLogger.info("socketio_client_subscribed", Map.of(
                "session_id", sessionId.toString(),
                "room", room
        ));
    }

    private void handleUnsubscribe(WebSocket conn, UUID sessionId, Object data) {
        if (data == null) return;
        
        String room;
        if (data instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> mapData = (Map<String, Object>) data;
            room = (String) mapData.get("room");
        } else {
            room = String.valueOf(data);
        }
        
        if (room == null || room.isEmpty()) return;
        
        Set<UUID> roomClients = rooms.get(room);
        if (roomClients != null) {
            roomClients.remove(sessionId);
        }
        
        Set<String> clientRoomsList = clientRooms.get(sessionId);
        if (clientRoomsList != null) {
            clientRoomsList.remove(room);
        }
        
        AtomicInteger count = roomMemberCounts.get(room);
        if (count != null) {
            count.decrementAndGet();
        }
        
        sendSocketIOEvent(conn, "unsubscribed", Map.of("room", room));
    }

    private void handlePing(WebSocket conn, UUID sessionId) {
        // Socket.IO ping/pong
        conn.send("3");  // Pong packet
    }

    private void handlePong(WebSocket conn, UUID sessionId) {
        // Connection is alive
    }

    // ==================== SEND METHODS ====================

    /**
     * Send raw Socket.IO packet
     */
    private void sendSocketIOPacket(WebSocket conn, String type, Object data) {
        if (conn == null || !conn.isOpen()) return;
        
        String json = plugin.GSON.toJson(data);
        String packet = type + json;
        conn.send(packet);
    }

    /**
     * Send Socket.IO event
     */
    private void sendSocketIOEvent(WebSocket conn, String event, Object data) {
        if (conn == null || !conn.isOpen()) return;
        
        // Socket.IO event packet: 42["eventName", {data}]
        String jsonData = plugin.GSON.toJson(Arrays.asList(event, data));
        String packet = "42" + jsonData;
        conn.send(packet);
    }

    /**
     * Send to specific session
     */
    private void sendToSession(UUID sessionId, String event, Object data) {
        WebSocket conn = findConnectionBySession(sessionId);
        if (conn != null) {
            sendSocketIOEvent(conn, event, data);
        }
    }

    // ==================== BROADCAST METHODS ====================

    /**
     * Send event to a specific room
     */
    public void broadcastToRoom(String room, String event, Object data) {
        Set<UUID> roomClients = rooms.get(room);
        if (roomClients == null || roomClients.isEmpty()) return;
        
        String jsonData = plugin.GSON.toJson(Arrays.asList(event, data));
        String packet = "42" + jsonData;
        
        for (UUID sessionId : roomClients) {
            WebSocket conn = findConnectionBySession(sessionId);
            if (conn != null && conn.isOpen()) {
                try {
                    conn.send(packet);
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
        String jsonData = plugin.GSON.toJson(Arrays.asList(event, data));
        String packet = "42" + jsonData;
        
        for (WebSocket conn : connections()) {
            if (conn.isOpen()) {
                try {
                    conn.send(packet);
                } catch (Exception e) {
                    // Ignore
                }
            }
        }
    }

    /**
     * Broadcast to specific namespace
     */
    public void broadcastToNamespace(String namespace, String event, Object data) {
        String jsonData = plugin.GSON.toJson(Arrays.asList(event, data));
        String packet = "42" + jsonData;
        
        for (Map.Entry<UUID, ClientInfo> entry : clients.entrySet()) {
            if (entry.getValue().namespace().equals(namespace)) {
                WebSocket conn = findConnectionBySession(entry.getKey());
                if (conn != null && conn.isOpen()) {
                    try {
                        conn.send(packet);
                    } catch (Exception e) {
                        // Ignore
                    }
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
        broadcastToRoom(room, "player:update", data.toMap());
        broadcastToNamespace("/admin", "player:update", data.toMap());
    }

    /**
     * Broadcast server stats
     */
    public void broadcastServerStats(Map<String, Object> stats) {
        broadcast("server:stats", stats);
        broadcastToNamespace("/admin", "server:stats", stats);
    }

    /**
     * Broadcast activity event
     */
    public void broadcastActivity(Object activity) {
        broadcast("activity", activity);
    }

    /**
     * Broadcast moderation event
     */
    public void broadcastModerationEvent(String eventType, Object data) {
        broadcastToNamespace("/admin", "moderation:" + eventType, data);
    }

    /**
     * Broadcast marketplace update
     */
    public void broadcastMarketplaceUpdate(Object update) {
        broadcastToNamespace("/marketplace", "marketplace:update", update);
        broadcast("marketplace:update", update);
    }

    /**
     * Broadcast economy update
     */
    public void broadcastEconomyUpdate(UUID playerUuid, Object data) {
        String room = "economy:" + playerUuid.toString();
        broadcastToRoom(room, "economy:update", data);
        broadcastToNamespace("/economy", "economy:update", data);
    }

    /**
     * Broadcast player event
     */
    public void broadcastEvent(String eventType, Map<String, Object> data) {
        broadcast("player:" + eventType, data);
        broadcastToNamespace("/admin", "player:" + eventType, data);
    }

    // ==================== UTILITY METHODS ====================

    private void flushBatches() {
        int maxEvents = config.batching().maxEventsPerBatch();
        
        for (Map.Entry<UUID, List<Map<String, Object>>> entry : clientBatches.entrySet()) {
            List<Map<String, Object>> batch = entry.getValue();
            if (!batch.isEmpty()) {
                sendToSession(entry.getKey(), "batch", batch);
                batch.clear();
            }
        }
    }

    private UUID findSessionByConnection(WebSocket conn) {
        for (Map.Entry<UUID, ClientInfo> entry : clients.entrySet()) {
            if (entry.getValue().connection() == conn) {
                return entry.getKey();
            }
        }
        return null;
    }

    private WebSocket findConnectionBySession(UUID sessionId) {
        ClientInfo info = clients.get(sessionId);
        return info != null ? info.connection() : null;
    }

    /**
     * Get connected client count
     */
    public int getConnectedClients() {
        return clients.size();
    }

    /**
     * Get room member count
     */
    public int getRoomMemberCount(String room) {
        AtomicInteger count = roomMemberCounts.get(room);
        return count != null ? count.get() : 0;
    }

    /**
     * Check if server is running
     */
    public boolean isRunning() {
        return isStarted();
    }

    /**
     * Stop the server
     */
    public void stop() {
        if (batchFlushTimer != null) {
            batchFlushTimer.cancel();
        }
        super.stop();
        JsonLogger.info("socketio_stopped", Map.of());
    }

    // ==================== INNER CLASSES ====================

    /**
     * Client connection info
     */
    private record ClientInfo(
            UUID sessionId,
            String clientId,
            String address,
            long connectedAt,
            String namespace,
            WebSocket connection
    ) {
        public ClientInfo(UUID sessionId, String clientId, String address, long connectedAt, String namespace) {
            this(sessionId, clientId, address, connectedAt, namespace, null);
        }
        
        public WebSocket connection() {
            return null; // Connection stored externally
        }
    }
}
