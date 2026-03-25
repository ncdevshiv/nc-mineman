package com.serverstats.http;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.serverstats.service.PlayerStatsService;
import com.serverstats.util.JsonLogger;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ServerStatsHttpServer {
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    private final int port;
    private final PlayerStatsService playerStatsService;
    private HttpServer server;
    private ExecutorService executorService;

    public ServerStatsHttpServer(int port, PlayerStatsService playerStatsService) {
        this.port = port;
        this.playerStatsService = playerStatsService;
    }

    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/api/snapshot", new JsonHandler(() -> Map.of(
                    "players", playerStatsService.allPlayerSnapshots(),
                    "server", playerStatsService.serverSnapshot(),
                    "activities", playerStatsService.activitiesSnapshot()
            )));
            server.createContext("/api/players", new JsonHandler(playerStatsService::allPlayerSnapshots));
            server.createContext("/api/activities", new JsonHandler(playerStatsService::activitiesSnapshot));
            executorService = Executors.newCachedThreadPool();
            server.setExecutor(executorService);
            server.start();
            JsonLogger.info("http_started", Map.of("port", port));
        } catch (IOException e) {
            JsonLogger.error("http_start_failed", Map.of("port", port), e);
            throw new IllegalStateException("Failed to start HTTP server", e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            JsonLogger.info("http_stopped", Map.of("port", port));
        }
        if (executorService != null && !executorService.isShutdown()) {
            executorService.shutdownNow();
        }
    }

    private record JsonHandler(SupplierWithException<Object> supplier) implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                byte[] resp = "{}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(405, resp.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(resp);
                }
                return;
            }
            try {
                Object data = supplier.get();
                byte[] bytes = GSON.toJson(data).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            } catch (Exception ex) {
                JsonLogger.error("http_handler_error", Map.of("path", exchange.getRequestURI().getPath()), ex);
                byte[] resp = "{\"error\":true}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(500, resp.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(resp);
                }
            }
        }
    }

    @FunctionalInterface
    private interface SupplierWithException<T> {
        T get() throws Exception;
    }
}
