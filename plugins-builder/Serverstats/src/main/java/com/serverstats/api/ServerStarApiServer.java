package com.serverstats.api;

import com.serverstats.ServerStarPlugin;
import com.serverstats.util.JsonLogger;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import graphql.ExecutionResult;
import graphql.GraphQL;
import graphql.schema.*;
import org.bukkit.Bukkit;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ServerStarApiServer {
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();
    private final int port;
    private final ServerStarPlugin plugin;
    private final GraphQL graphQL;
    private HttpServer server;
    private ExecutorService executorService;

    public ServerStarApiServer(int port, ServerStarPlugin plugin) {
        this.port = port;
        this.plugin = plugin;
        this.graphQL = buildGraphQLSchema();
    }

    private GraphQL buildGraphQLSchema() {
        // Define GraphQL schema
        String schemaDefinition = """
            type Query {
                players(limit: Int, offset: Int): [Player!]!
                player(uuid: String!): Player
                serverStats: ServerStats!
                inventory(uuid: String!): [InventoryItem!]!
                friends(uuid: String!): [Player!]!
                friendRequests(uuid: String!): [Player!]!
                reports(status: String): [Report!]!
                activeBans: [Ban!]!
                transactionHistory(uuid: String!, limit: Int): [Transaction!]!
                activeAuctions: [Auction!]!
            }

            type Mutation {
                sendFriendRequest(receiverUuid: String!): Boolean!
                acceptFriendRequest(requesterUuid: String!): Boolean!
                removeFriend(friendUuid: String!): Boolean!
                followPlayer(targetUuid: String!): Boolean!
                unfollowPlayer(targetUuid: String!): Boolean!
                submitReport(targetUuid: String!, reason: String!): Boolean!
                transferItem(toUuid: String!, itemType: String!, amount: Int!): Boolean!
                sellItem(itemType: String!, amount: Int!, price: Float!): Boolean!
                createAuction(itemType: String!, amount: Int!, startingPrice: Float!, durationHours: Int!): ID
                bidOnAuction(auctionId: ID!, bidAmount: Float!): Boolean!
                lockItem(itemId: ID!, locked: Boolean!): Boolean!
                deleteItem(itemId: ID!, amount: Int!): Boolean!
                banPlayer(targetUuid: String!, reason: String, durationMinutes: Int): Boolean!
                unbanPlayer(targetUuid: String!): Boolean!
                kickPlayer(targetUuid: String!, reason: String): Boolean!
                freezePlayer(targetUuid: String!, frozen: Boolean!): Boolean!
                jailPlayer(targetUuid: String!, jailed: Boolean!): Boolean!
                timeoutPlayer(targetUuid: String!, durationSeconds: Int!, reason: String): Boolean!
                slapPlayer(targetUuid: String!, damage: Float!): Boolean!
                warnPlayer(targetUuid: String!, message: String!): Boolean!
            }

            type Player {
                uuid: String!
                name: String!
                ping: Int!
                role: String!
                health: Float!
                food: Int!
                gamemode: String!
                location: Location
                lastSeen: String
                totalPlaytime: Long!
                roles: [String!]!
                stats: PlayerStats
                inventory: [InventoryItem!]!
                recentActivities(limit: Int): [Activity!]!
                friends: [Player!]!
                followers: [Player!]!
                moderationHistory: [ModerationRecord!]!
            }

            type PlayerStats {
                health: Float!
                food: Int!
                saturation: Float!
                experienceLevel: Int!
                experienceProgress: Float!
                gamemode: String!
                ping: Int!
            }

            type Location {
                world: String!
                x: Int!
                y: Int!
                z: Int!
            }

            type InventoryItem {
                id: ID!
                itemType: String!
                amount: Int!
                displayName: String
                lore: String
                enchantments: String
                locked: Boolean!
                slot: Int
            }

            type Activity {
                id: ID!
                action: String!
                target: String
                amount: Int!
                location: Location
                timestamp: String!
            }

            type Transaction {
                id: ID!
                fromUuid: String
                toUuid: String
                itemType: String!
                amount: Int!
                type: String!
                status: String!
                timestamp: String!
            }

            type Auction {
                id: ID!
                sellerUuid: String!
                sellerName: String!
                itemType: String!
                amount: Int!
                endTime: String!
            }

            type Report {
                id: ID!
                reporterUuid: String!
                reporterName: String!
                targetUuid: String!
                targetName: String!
                reason: String!
                timestamp: String!
                status: String!
            }

            type Ban {
                id: ID!
                playerUuid: String!
                playerName: String!
                reason: String
                bannedBy: String!
                bannedAt: String!
                expiresAt: String
            }

            type ModerationRecord {
                id: ID!
                reason: String
                bannedBy: String
                bannedAt: String
                expiresAt: String
                active: Boolean!
            }

            type ServerStats {
                onlinePlayers: Int!
                maxPlayers: Int!
                tps: Float!
                averagePing: Int!
                timestamp: String!
            }
            """;

        // This is a simplified implementation - in production, you'd use a proper GraphQL library
        // For now, we'll implement basic REST endpoints with GraphQL support planned

        GraphQLSchema schema = GraphQLSchema.newSchema()
            .query(GraphQLObjectType.newObject()
                .name("Query")
                .field(GraphQLFieldDefinition.newFieldDefinition()
                    .name("players")
                    .type(GraphQLList.list(GraphQLTypeReference.typeRef("Player")))
                    .build())
                .build())
            .build();

        return GraphQL.newGraphQL(schema).build();
    }

    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);

            // REST API endpoints
            server.createContext("/api/players", new PlayersHandler());
            server.createContext("/api/player", new PlayerHandler());
            server.createContext("/api/inventory", new InventoryHandler());
            server.createContext("/api/moderation", new ModerationHandler());
            server.createContext("/api/social", new SocialHandler());
            server.createContext("/api/trading", new TradingHandler());
            server.createContext("/api/search", new SearchHandler());
            server.createContext("/api/admin", new AdminHandler());

            // GraphQL endpoint
            server.createContext("/graphql", new GraphQLHandler());

            // Health check
            server.createContext("/health", new HealthHandler());

            executorService = Executors.newCachedThreadPool();
            server.setExecutor(executorService);
            server.start();

            JsonLogger.info("api_server_started", Map.of("port", port));
        } catch (IOException e) {
            JsonLogger.error("api_server_start_failed", Map.of("port", port), e);
            throw new RuntimeException("Failed to start API server", e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            JsonLogger.info("api_server_stopped", Map.of("port", port));
        }
        if (executorService != null && !executorService.isShutdown()) {
            executorService.shutdownNow();
        }
    }

    // Handler classes for different endpoints
    private class PlayersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                List<Map<String, Object>> players = new ArrayList<>();
                for (org.bukkit.entity.Player player : Bukkit.getOnlinePlayers()) {
                    Map<String, Object> playerData = plugin.getPlayerService().getPlayerFullData(player.getUniqueId());
                    if (playerData != null) {
                        players.add(playerData);
                    }
                }

                Map<String, Object> response = Map.of("players", players);
                sendResponse(exchange, 200, GSON.toJson(response));
            } catch (Exception e) {
                JsonLogger.error("players_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class PlayerHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                String uuid = getQueryParam(exchange, "uuid");
                if (uuid == null) {
                    sendResponse(exchange, 400, "{\"error\":\"Missing uuid parameter\"}");
                    return;
                }

                Map<String, Object> playerData = plugin.getPlayerService().getPlayerFullData(UUID.fromString(uuid));
                if (playerData == null) {
                    sendResponse(exchange, 404, "{\"error\":\"Player not found\"}");
                    return;
                }

                sendResponse(exchange, 200, GSON.toJson(playerData));
            } catch (Exception e) {
                JsonLogger.error("player_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class InventoryHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            try {
                if ("GET".equalsIgnoreCase(method)) {
                    handleGetInventory(exchange);
                } else if ("POST".equalsIgnoreCase(method)) {
                    handleInventoryAction(exchange);
                } else {
                    sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                }
            } catch (Exception e) {
                JsonLogger.error("inventory_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }

        private void handleGetInventory(HttpExchange exchange) throws IOException {
            String uuid = getQueryParam(exchange, "uuid");
            if (uuid == null) {
                sendResponse(exchange, 400, "{\"error\":\"Missing uuid parameter\"}");
                return;
            }

            List<Map<String, Object>> inventory = plugin.getInventoryService().getPlayerInventory(UUID.fromString(uuid));
            sendResponse(exchange, 200, GSON.toJson(Map.of("inventory", inventory)));
        }

        private void handleInventoryAction(HttpExchange exchange) throws IOException {
            // Parse JSON body for transfer/sell actions
            String body = readRequestBody(exchange);
            Map<String, Object> request = GSON.fromJson(body, Map.class);

            String action = (String) request.get("action");
            UUID playerUuid = UUID.fromString((String) request.get("playerUuid"));

            boolean success = false;
            switch (action) {
                case "transfer":
                    success = plugin.getInventoryService().transferItem(
                        playerUuid,
                        UUID.fromString((String) request.get("toUuid")),
                        (String) request.get("itemType"),
                        ((Double) request.get("amount")).intValue()
                    );
                    break;
                case "sell":
                    success = plugin.getTradingService().sellItem(
                        playerUuid,
                        (String) request.get("itemType"),
                        ((Double) request.get("amount")).intValue(),
                        ((Double) request.get("price"))
                    );
                    break;
                case "lock":
                    success = plugin.getInventoryService().lockItem(
                        playerUuid,
                        ((Double) request.get("itemId")).longValue(),
                        (Boolean) request.get("locked")
                    );
                    break;
                case "delete":
                    success = plugin.getInventoryService().deleteItem(
                        playerUuid,
                        ((Double) request.get("itemId")).longValue(),
                        ((Double) request.get("amount")).intValue()
                    );
                    break;
            }

            sendResponse(exchange, success ? 200 : 400,
                GSON.toJson(Map.of("success", success)));
        }
    }

    private class ModerationHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = GSON.fromJson(body, Map.class);

                String action = (String) request.get("action");
                UUID moderatorUuid = UUID.fromString((String) request.get("moderatorUuid"));
                UUID targetUuid = UUID.fromString((String) request.get("targetUuid"));

                boolean success = false;
                switch (action) {
                    case "ban":
                        success = plugin.getModerationService().banPlayer(
                            targetUuid, moderatorUuid,
                            (String) request.get("reason"),
                            request.get("durationMinutes") != null ?
                                Instant.now().plusSeconds(((Double) request.get("durationMinutes")).longValue() * 60) :
                                null
                        );
                        break;
                    case "unban":
                        success = plugin.getModerationService().unbanPlayer(targetUuid, moderatorUuid);
                        break;
                    case "kick":
                        success = plugin.getModerationService().kickPlayer(
                            targetUuid, moderatorUuid, (String) request.get("reason")
                        );
                        break;
                    case "freeze":
                        success = plugin.getModerationService().freezePlayer(
                            targetUuid, moderatorUuid, (Boolean) request.get("frozen")
                        );
                        break;
                    case "jail":
                        success = plugin.getModerationService().jailPlayer(
                            targetUuid, moderatorUuid, (Boolean) request.get("jailed")
                        );
                        break;
                    case "timeout":
                        success = plugin.getModerationService().timeoutPlayer(
                            targetUuid, moderatorUuid,
                            ((Double) request.get("durationSeconds")).intValue(),
                            (String) request.get("reason")
                        );
                        break;
                    case "slap":
                        success = plugin.getModerationService().slapPlayer(
                            targetUuid, moderatorUuid, ((Double) request.get("damage")).floatValue()
                        );
                        break;
                    case "warn":
                        success = plugin.getModerationService().warnPlayer(
                            targetUuid, moderatorUuid, (String) request.get("message")
                        );
                        break;
                }

                sendResponse(exchange, success ? 200 : 400,
                    GSON.toJson(Map.of("success", success)));
            } catch (Exception e) {
                JsonLogger.error("moderation_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class SocialHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = GSON.fromJson(body, Map.class);

                String action = (String) request.get("action");
                UUID playerUuid = UUID.fromString((String) request.get("playerUuid"));

                boolean success = false;
                switch (action) {
                    case "sendFriendRequest":
                        success = plugin.getSocialService().sendFriendRequest(
                            playerUuid, UUID.fromString((String) request.get("receiverUuid"))
                        );
                        break;
                    case "acceptFriendRequest":
                        success = plugin.getSocialService().acceptFriendRequest(
                            playerUuid, UUID.fromString((String) request.get("requesterUuid"))
                        );
                        break;
                    case "removeFriend":
                        success = plugin.getSocialService().removeFriend(
                            playerUuid, UUID.fromString((String) request.get("friendUuid"))
                        );
                        break;
                    case "followPlayer":
                        success = plugin.getSocialService().followPlayer(
                            playerUuid, UUID.fromString((String) request.get("targetUuid"))
                        );
                        break;
                    case "unfollowPlayer":
                        success = plugin.getSocialService().unfollowPlayer(
                            playerUuid, UUID.fromString((String) request.get("targetUuid"))
                        );
                        break;
                    case "submitReport":
                        success = plugin.getSocialService().submitReport(
                            playerUuid,
                            UUID.fromString((String) request.get("targetUuid")),
                            (String) request.get("reason")
                        );
                        break;
                }

                sendResponse(exchange, success ? 200 : 400,
                    GSON.toJson(Map.of("success", success)));
            } catch (Exception e) {
                JsonLogger.error("social_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class TradingHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = GSON.fromJson(body, Map.class);

                String action = (String) request.get("action");

                boolean success = false;
                Map<String, Object> response = new HashMap<>();

                switch (action) {
                    case "createAuction":
                        UUID sellerUuid = UUID.fromString((String) request.get("sellerUuid"));
                        long auctionId = plugin.getTradingService().createAuction(
                            sellerUuid,
                            (String) request.get("itemType"),
                            ((Double) request.get("amount")).intValue(),
                            ((Double) request.get("startingPrice")),
                            Instant.now().plusSeconds(((Double) request.get("durationHours")).longValue() * 3600)
                        );
                        if (auctionId != -1) {
                            success = true;
                            response.put("auctionId", auctionId);
                        }
                        break;
                    case "bidOnAuction":
                        success = plugin.getTradingService().bidOnAuction(
                            ((Double) request.get("auctionId")).longValue(),
                            UUID.fromString((String) request.get("bidderUuid")),
                            ((Double) request.get("bidAmount"))
                        );
                        break;
                }

                response.put("success", success);
                sendResponse(exchange, success ? 200 : 400, GSON.toJson(response));
            } catch (Exception e) {
                JsonLogger.error("trading_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class SearchHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                String query = getQueryParam(exchange, "q");
                String type = getQueryParam(exchange, "type");

                if (query == null) {
                    sendResponse(exchange, 400, "{\"error\":\"Missing query parameter\"}");
                    return;
                }

                List<Map<String, Object>> results = new ArrayList<>();

                // Simple search implementation - in production, use proper indexing
                if ("players".equals(type) || type == null) {
                    // Search players by name
                    for (org.bukkit.entity.Player player : Bukkit.getOnlinePlayers()) {
                        if (player.getName().toLowerCase().contains(query.toLowerCase())) {
                            Map<String, Object> playerData = new HashMap<>();
                            playerData.put("uuid", player.getUniqueId().toString());
                            playerData.put("name", player.getName());
                            playerData.put("ping", player.getPing());
                            playerData.put("role", plugin.getPlayerService().getHighestRole(player.getUniqueId()));
                            results.add(playerData);
                        }
                    }
                }

                sendResponse(exchange, 200, GSON.toJson(Map.of("results", results)));
            } catch (Exception e) {
                JsonLogger.error("search_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class AdminHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Admin endpoints - would need authentication in production
            if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                String path = exchange.getRequestURI().getPath();
                if (path.endsWith("/bans")) {
                    List<Map<String, Object>> bans = plugin.getModerationService().getActiveBans();
                    sendResponse(exchange, 200, GSON.toJson(Map.of("bans", bans)));
                } else if (path.contains("/reports")) {
                    String status = getQueryParam(exchange, "status");
                    List<Map<String, Object>> reports = plugin.getSocialService().getReports(status);
                    sendResponse(exchange, 200, GSON.toJson(Map.of("reports", reports)));
                } else {
                    sendResponse(exchange, 404, "{\"error\":\"Not found\"}");
                }
            } else {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
            }
        }
    }

    private class GraphQLHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = GSON.fromJson(body, Map.class);
                String query = (String) request.get("query");

                // For now, return a placeholder - full GraphQL implementation would be complex
                Map<String, Object> response = Map.of(
                    "data", Map.of("message", "GraphQL endpoint available"),
                    "errors", new ArrayList<>()
                );

                sendResponse(exchange, 200, GSON.toJson(response));
            } catch (Exception e) {
                JsonLogger.error("graphql_api_error", Map.of("path", exchange.getRequestURI().getPath()), e);
                sendResponse(exchange, 500, "{\"error\":\"Internal server error\"}");
            }
        }
    }

    private class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            Map<String, Object> health = Map.of(
                "status", "healthy",
                "timestamp", Instant.now().toString(),
                "online_players", Bukkit.getOnlinePlayers().size(),
                "server_port", port
            );
            sendResponse(exchange, 200, GSON.toJson(health));
        }
    }

    // Utility methods
    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);

        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[1024];
            int length;
            while ((length = is.read(buffer)) != -1) {
                baos.write(buffer, 0, length);
            }
            return baos.toString(StandardCharsets.UTF_8);
        }
    }

    private String getQueryParam(HttpExchange exchange, String name) {
        String query = exchange.getRequestURI().getQuery();
        if (query == null) return null;

        for (String param : query.split("&")) {
            String[] pair = param.split("=");
            if (pair.length == 2 && name.equals(pair[0])) {
                return pair[1];
            }
        }
        return null;
    }
}