package com.serverstats.util;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class JsonLogger {
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME.withZone(ZoneOffset.UTC);
    private static final String SERVICE_NAME = "serverstats";

    private JsonLogger() {
    }

    public static void info(String event, Map<String, Object> context) {
        log("INFO", event, context, null);
    }

    public static void warn(String event, Map<String, Object> context, Throwable t) {
        log("WARN", event, context, t);
    }

    public static void error(String event, Map<String, Object> context, Throwable t) {
        log("ERROR", event, context, t);
    }

    private static void log(String level, String event, Map<String, Object> context, Throwable t) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("timestamp", FORMATTER.format(Instant.now()));
        payload.put("trace_id", UUID.randomUUID().toString());
        payload.put("level", level);
        payload.put("service", SERVICE_NAME);
        payload.put("event", event);
        payload.put("context", context);
        if (t != null) {
            payload.put("error", t.getMessage());
        }
        System.out.println(GSON.toJson(payload));
    }
}
