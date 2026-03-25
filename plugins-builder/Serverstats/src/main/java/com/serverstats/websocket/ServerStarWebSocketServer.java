package com.serverstats.websocket;

import com.serverstats.ServerStarPlugin;
import com.serverstats.model.PlayerData;
import com.serverstats.model.ServerData;
import com.serverstats.util.JsonLogger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class ServerStarWebSocketServer extends WebSocketServer {
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();
    private final ServerStarPlugin plugin;
    private final Map<WebSocket, String> connections = new ConcurrentHashMap<>();
    private final Map<String, WebSocket> playerSockets = new ConcurrentHashMap<>();

    public ServerStarWebSocketServer(int port, ServerStarPlugin plugin) {
        super(new InetSocketAddress(port));
        this.plugin = plugin;
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        String clientId = handshake.getFieldValue("client-id");
        if (clientId == null || clientId.isEmpty()) {
            clientId = "anonymous-" + conn.hashCode();
        }

        connections.put(conn, clientId);
        JsonLogger.info("websocket_connection_opened", Map.of("client_id", clientId));

        // Send initial data
        sendToClient(conn, "connection_established", Map.of("client_id", clientId));
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String clientId = connections.remove(conn);
        playerSockets.values().removeIf(socket -> socket == conn);

        JsonLogger.info("websocket_connection_closed", Map.of(
            "client_id", clientId,
            "code", code,
            "reason", reason,
            "remote", remote
        ));
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            Map<String, Object> request = GSON.fromJson(message, Map.class);
            String type = (String) request.get("type");
            String clientId = connections.get(conn);

            switch (type) {
                case "subscribe_player":
                    String playerUuid = (String) request.get("uuid");
                    playerSockets.put(playerUuid, conn);
                    sendToClient(conn, "subscribed_player", Map.of("uuid", playerUuid));
                    break;

                case "unsubscribe_player":
                    playerUuid = (String) request.get("uuid");
                    playerSockets.remove(playerUuid, conn);
                    sendToClient(conn, "unsubscribed_player", Map.of("uuid", playerUuid));
                    break;

                case "ping":
                    sendToClient(conn, "pong", Map.of("timestamp", System.currentTimeMillis()));
                    break;

                default:
                    sendToClient(conn, "error", Map.of("message", "Unknown message type: " + type));
                    break;
            }

            JsonLogger.info("websocket_message_received", Map.of(
                "client_id", clientId,
                "type", type
            ));

        } catch (Exception e) {
            JsonLogger.error("websocket_message_error", Map.of(
                "client_id", connections.get(conn),
                "message", message
            ), e);
            sendToClient(conn, "error", Map.of("message", "Invalid message format"));
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        JsonLogger.error("websocket_error", Map.of(
            "client_id", connections.get(conn)
        ), ex);
    }

    @Override
    public void onStart() {
        JsonLogger.info("websocket_server_started", Map.of("port", getPort()));
    }

    public void broadcastPlayerUpdate(java.util.UUID uuid, PlayerData data) {
        WebSocket socket = playerSockets.get(uuid.toString());
        if (socket != null && socket.isOpen()) {
            sendToClient(socket, "player_update", data.toMap());
        }

        // Also broadcast to admin clients
        broadcastToAdmins("player_update", data.toMap());
    }

    public void broadcastServerUpdate(ServerData data) {
        Map<String, Object> payload = data.toMap();
        broadcast("server_update", payload);
    }

    public void broadcastActivity(com.serverstats.model.PlayerActivityRecord activity) {
        Map<String, Object> payload = activity.toMap();
        broadcast("activity", payload);

        // Send to specific player's subscribers
        WebSocket socket = playerSockets.get(activity.getPlayerId().toString());
        if (socket != null && socket.isOpen()) {
            sendToClient(socket, "own_activity", payload);
        }
    }

    public void broadcastInventoryUpdate(java.util.UUID uuid) {
        WebSocket socket = playerSockets.get(uuid.toString());
        if (socket != null && socket.isOpen()) {
            Map<String, Object> inventory = Map.of(
                "uuid", uuid.toString(),
                "inventory", plugin.getInventoryService().getPlayerInventory(uuid)
            );
            sendToClient(socket, "inventory_update", inventory);
        }
    }

    public void broadcastEvent(String eventType, Map<String, Object> data) {
        broadcast(eventType, data);
    }

    private void broadcast(String eventType, Map<String, Object> data) {
        Map<String, Object> message = Map.of(
            "type", eventType,
            "data", data,
            "timestamp", System.currentTimeMillis()
        );

        String jsonMessage = GSON.toJson(message);

        for (WebSocket conn : connections.keySet()) {
            if (conn.isOpen()) {
                conn.send(jsonMessage);
            }
        }
    }

    private void broadcastToAdmins(String eventType, Map<String, Object> data) {
        Map<String, Object> message = Map.of(
            "type", eventType,
            "data", data,
            "timestamp", System.currentTimeMillis()
        );

        String jsonMessage = GSON.toJson(message);

        // In a real implementation, you'd check if the client is an admin
        // For now, broadcast to all (admin filtering would need authentication)
        for (WebSocket conn : connections.keySet()) {
            if (conn.isOpen()) {
                conn.send(jsonMessage);
            }
        }
    }

    private void sendToClient(WebSocket conn, String eventType, Map<String, Object> data) {
        if (conn.isOpen()) {
            Map<String, Object> message = Map.of(
                "type", eventType,
                "data", data,
                "timestamp", System.currentTimeMillis()
            );
            conn.send(GSON.toJson(message));
        }
    }

    private void sendToClient(WebSocket conn, String eventType, Object data) {
        if (conn.isOpen()) {
            Map<String, Object> message = Map.of(
                "type", eventType,
                "data", data,
                "timestamp", System.currentTimeMillis()
            );
            conn.send(GSON.toJson(message));
        }
    }
}