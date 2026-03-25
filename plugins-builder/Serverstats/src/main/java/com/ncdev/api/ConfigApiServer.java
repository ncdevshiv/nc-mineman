package com.ncdev.api;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.util.JsonLogger;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/**
 * REST API server for configuration management and dashboard access.
 */
public class ConfigApiServer {

    private final int port;
    private final NcDevConfig config;
    private final NcDevPlugin plugin;
    private HttpServer server;

    public ConfigApiServer(int port, NcDevConfig config, NcDevPlugin plugin) {
        this.port = port;
        this.config = config;
        this.plugin = plugin;
    }

    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            
            // API endpoints
            server.createContext("/api/config", new ConfigHandler());
            server.createContext("/api/config/validate", new ConfigValidateHandler());
            server.createContext("/api/stats", new StatsHandler());
            server.createContext("/api/health", new HealthHandler());
            
            server.setExecutor(java.util.concurrent.Executors.newFixedThreadPool(4));
            server.start();
            
            JsonLogger.info("config_api_started", Map.of("port", port));
        } catch (IOException e) {
            JsonLogger.error("config_api_start_failed", Map.of("port", port), e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            JsonLogger.info("config_api_stopped", Map.of());
        }
    }

    // ==================== HANDLERS ====================

    private class ConfigHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCORSHeaders(exchange);
            
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod()) && 
                !"PUT".equalsIgnoreCase(exchange.getRequestMethod()) &&
                !"PATCH".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
                return;
            }
            
            try {
                if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                    // Get config value(s)
                    String query = exchange.getRequestURI().getQuery();
                    if (query != null && query.startsWith("path=")) {
                        String configPath = query.substring(5);
                        Object value = getConfigValue(configPath);
                        sendResponse(exchange, 200, Map.of("path", configPath, "value", value));
                    } else {
                        // Return all config (sanitized)
                        sendResponse(exchange, 200, getSanitizedConfig());
                    }
                } else {
                    // Update config
                    String body = readRequestBody(exchange);
                    Map<String, Object> request = plugin.GSON.fromJson(body, Map.class);
                    
                    String configPath = (String) request.get("path");
                    Object value = request.get("value");
                    
                    if (configPath != null && value != null) {
                        config.updateValue(configPath, value);
                        sendResponse(exchange, 200, Map.of(
                                "success", true,
                                "path", configPath,
                                "value", value
                        ));
                    } else {
                        sendResponse(exchange, 400, Map.of("error", "Missing path or value"));
                    }
                }
            } catch (Exception e) {
                sendResponse(exchange, 500, Map.of("error", e.getMessage()));
            }
        }
    }

    private class ConfigValidateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCORSHeaders(exchange);
            
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
                return;
            }
            
            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = plugin.GSON.fromJson(body, Map.class);
                
                String configPath = (String) request.get("path");
                Object value = request.get("value");
                
                // Validate value
                ValidationResult result = validateConfigValue(configPath, value);
                sendResponse(exchange, result.valid ? 200 : 400, result.toMap());
            } catch (Exception e) {
                sendResponse(exchange, 500, Map.of("error", e.getMessage()));
            }
        }
    }

    private class StatsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCORSHeaders(exchange);
            
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
                return;
            }
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("online_players", plugin.getServer().getOnlinePlayers().size());
            stats.put("max_players", plugin.getServer().getMaxPlayers());
            stats.put("uptime_seconds", (System.currentTimeMillis() - plugin.getServer().getWorlds().get(0).getFullTime()) / 1000);
            stats.put("memory_usage", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory());
            stats.put("timestamp", Instant.now().toString());
            
            sendResponse(exchange, 200, stats);
        }
    }

    private class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCORSHeaders(exchange);
            
            Map<String, Object> health = new HashMap<>();
            health.put("status", "healthy");
            health.put("timestamp", Instant.now().toString());
            health.put("database", plugin.getDatabaseManager().isHealthy());
            health.put("redis", plugin.getRedisManager() != null && plugin.getRedisManager().isConnected());
            health.put("websocket", plugin.getWebSocketServer() != null && plugin.getWebSocketServer().isRunning());
            health.put("socketio", plugin.getSocketIOManager() != null && plugin.getSocketIOManager().isRunning());
            
            sendResponse(exchange, 200, health);
        }
    }

    // ==================== HELPERS ====================

    private void addCORSHeaders(HttpExchange exchange) {
        if (config.configApi().cors().enabled()) {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", 
                    config.configApi().cors().allowedOrigins().contains("*") ? "*" : 
                            config.configApi().cors().allowedOrigins().get(0));
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            exchange.getResponseHeaders().add("Access-Control-Max-Age", "3600");
        }
    }

    private void sendResponse(HttpExchange exchange, int statusCode, Map<String, Object> data) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        byte[] bytes = plugin.GSON.toJson(data).getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private String readRequestBody(HttpExchange exchange) throws IOException {
        try (var is = exchange.getRequestBody();
             var baos = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[1024];
            int length;
            while ((length = is.read(buffer)) != -1) {
                baos.write(buffer, 0, length);
            }
            return baos.toString(StandardCharsets.UTF_8);
        }
    }

    private Object getConfigValue(String path) {
        // Return specific config value based on path
        return switch (path) {
            case "currency.enabled" -> config.currency().enabled();
            case "currency.startingBalance" -> config.currency().startingBalance();
            case "marketplace.enabled" -> config.marketplace().enabled();
            case "moderation.enabled" -> config.moderation().enabled();
            default -> null;
        };
    }

    private Map<String, Object> getSanitizedConfig() {
        // Return config without sensitive values
        Map<String, Object> sanitized = new HashMap<>();
        sanitized.put("currency", Map.of(
                "enabled", config.currency().enabled(),
                "startingBalance", config.currency().startingBalance()
        ));
        sanitized.put("marketplace", Map.of(
                "enabled", config.marketplace().enabled()
        ));
        sanitized.put("moderation", Map.of(
                "enabled", config.moderation().enabled()
        ));
        return sanitized;
    }

    private ValidationResult validateConfigValue(String path, Object value) {
        // Basic validation
        if (path == null || value == null) {
            return new ValidationResult(false, "Path and value required", "MISSING_PARAMS");
        }
        
        // Validate based on path
        if (path.contains("port") && value instanceof Number num) {
            if (num.intValue() < 1 || num.intValue() > 65535) {
                return new ValidationResult(false, "Port must be between 1 and 65535", "INVALID_PORT");
            }
        }
        
        if (path.contains("enabled") && !(value instanceof Boolean)) {
            return new ValidationResult(false, "Enabled must be true or false", "INVALID_TYPE");
        }
        
        return new ValidationResult(true, "Valid", "OK");
    }

    // ==================== INNER CLASSES ====================

    private record ValidationResult(boolean valid, String message, String code) {
        Map<String, Object> toMap() {
            return Map.of("valid", valid, "message", message, "code", code);
        }
    }
}
