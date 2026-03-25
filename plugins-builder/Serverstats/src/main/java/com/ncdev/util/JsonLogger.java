package com.ncdev.util;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.bukkit.Bukkit;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Structured JSON logging utility for NCDev plugin.
 */
public class JsonLogger {

    private static final Gson GSON = new GsonBuilder()
            .disableHtmlEscaping()
            .create();
    
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter
            .ofPattern("yyyy-MM-dd HH:mm:ss.SSS")
            .withZone(ZoneId.systemDefault());
    
    private static Logger logger;

    public static void init(Logger logger) {
        JsonLogger.logger = logger;
    }

    public static void info(String event, Map<String, Object> context) {
        log(Level.INFO, event, context, null);
    }

    public static void warn(String event, Map<String, Object> context, Throwable throwable) {
        log(Level.WARNING, event, context, throwable);
    }

    public static void error(String event, Map<String, Object> context, Throwable throwable) {
        log(Level.SEVERE, event, context, throwable);
    }

    public static void debug(String event, Map<String, Object> context) {
        log(Level.FINE, event, context, null);
    }

    private static void log(Level level, String event, Map<String, Object> context, Throwable throwable) {
        if (logger == null) return;
        
        Map<String, Object> logEntry = new HashMap<>();
        logEntry.put("timestamp", Instant.now().toString());
        logEntry.put("event", event);
        
        if (context != null) {
            logEntry.putAll(context);
        }
        
        if (throwable != null) {
            logEntry.put("error", throwable.getMessage());
            logEntry.put("error_type", throwable.getClass().getSimpleName());
        }
        
        String json = GSON.toJson(logEntry);
        
        // Check if running on main thread
        if (Bukkit.isPrimaryThread()) {
            logger.log(level, json);
        } else {
            // Schedule logging on main thread
            Bukkit.getScheduler().runTask(
                    Bukkit.getPluginManager().getPlugin("ncdev"),
                    () -> logger.log(level, json)
            );
        }
    }

    public static void info(String event) {
        info(event, Map.of());
    }

    public static void warn(String event, Throwable throwable) {
        warn(event, Map.of(), throwable);
    }

    public static void error(String event, Throwable throwable) {
        error(event, Map.of(), throwable);
    }

    public static void debug(String event) {
        debug(event, Map.of());
    }
}
