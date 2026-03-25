package com.ncdev.redis;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.util.JsonLogger;
import io.lettuce.core.*;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Redis Manager for multi-server scaling via Pub/Sub.
 * Handles player data synchronization across multiple server instances.
 */
public class RedisManager {

    private final NcDevConfig.Redis config;
    private final NcDevPlugin plugin;
    
    private RedisClient redisClient;
    private StatefulRedisConnection<String, String> connection;
    private StatefulRedisPubSubConnection<String, String> pubSubConnection;
    
    private final Map<String, List<Consumer<String>>> subscribers = new ConcurrentHashMap<>();
    private boolean connected = false;

    public RedisManager(NcDevConfig.Redis config, NcDevPlugin plugin) {
        this.config = config;
        this.plugin = plugin;
    }

    /**
     * Connect to Redis server
     */
    public void connect() {
        try {
            String host = config.host();
            int port = config.port();
            
            RedisURI redisUri = RedisURI.builder()
                    .withHost(host)
                    .withPort(port)
                    .withDatabase(config.database())
                    .withTimeout(Duration.ofMillis(config.timeoutMs()))
                    .build();
            
            if (config.password() != null && !config.password().isEmpty()) {
                redisUri = RedisURI.builder()
                        .withHost(host)
                        .withPort(port)
                        .withDatabase(config.database())
                        .withPassword(config.password().toCharArray())
                        .withTimeout(Duration.ofMillis(config.timeoutMs()))
                        .build();
            }
            
            if (config.ssl()) {
                redisUri.setSsl(true);
            }
            
            redisClient = RedisClient.create(redisUri);
            
            // Create main connection for commands
            connection = redisClient.connect();
            
            // Create pub/sub connection
            pubSubConnection = redisClient.connectPubSub();
            
            // Setup listeners
            setupPubSubListeners();
            
            connected = true;
            JsonLogger.info("redis_connected", Map.of(
                    "host", config.host(),
                    "port", config.port()
            ));
            
        } catch (Exception e) {
            JsonLogger.error("redis_connection_failed", Map.of(
                    "host", config.host(),
                    "port", config.port(),
                    "error", e.getMessage()
            ), e);
            connected = false;
        }
    }

    /**
     * Setup Pub/Sub listeners
     */
    private void setupPubSubListeners() {
        pubSubConnection.addListener(new RedisPubSubListener<String, String>() {
            @Override
            public void message(String channel, String message) {
                handleMessage(channel, message);
            }
            
            @Override
            public void message(String pattern, String channel, String message) {
                handleMessage(channel, message);
            }
            
            @Override
            public void subscribed(String channel, long count) {}
            
            @Override
            public void patternSubscribed(String pattern, long count) {}
            
            @Override
            public void unsubscribed(String channel, long count) {}
            
            @Override
            public void patternUnsubscribed(String pattern, long count) {}
            
            @Override
            public void psubscribed(String pattern, long count) {}
            
            @Override
            public void punsubscribed(String pattern, long count) {}
        });
        
        // Subscribe to default channels
        subscribe(config.channels().playerUpdates());
        subscribe(config.channels().serverStats());
        subscribe(config.channels().activity());
        subscribe(config.channels().moderation());
        subscribe(config.channels().economy());
        subscribe(config.channels().marketplace());
    }

    private void handleMessage(String channel, String message) {
        List<Consumer<String>> channelSubscribers = subscribers.get(channel);
        if (channelSubscribers != null) {
            for (Consumer<String> subscriber : channelSubscribers) {
                try {
                    subscriber.accept(message);
                } catch (Exception e) {
                    JsonLogger.error("pubsub_message_handler_error", 
                            Map.of("channel", channel), e);
                }
            }
        }
    }

    /**
     * Disconnect from Redis
     */
    public void disconnect() {
        try {
            if (pubSubConnection != null) {
                pubSubConnection.close();
            }
            if (connection != null) {
                connection.close();
            }
            if (redisClient != null) {
                redisClient.shutdown();
            }
            connected = false;
            JsonLogger.info("redis_disconnected", Map.of());
        } catch (Exception e) {
            JsonLogger.error("redis_disconnect_failed", Map.of(), e);
        }
    }

    /**
     * Check if connected to Redis
     */
    public boolean isConnected() {
        return connected && connection != null && !connection.isClosed();
    }

    /**
     * Subscribe to a channel
     */
    public void subscribe(String channel) {
        if (!isConnected()) return;
        
        try {
            pubSubConnection.sync().subscribe(channel);
            JsonLogger.info("redis_subscribed", Map.of("channel", channel));
        } catch (Exception e) {
            JsonLogger.error("redis_subscribe_failed", Map.of("channel", channel), e);
        }
    }

    /**
     * Unsubscribe from a channel
     */
    public void unsubscribe(String channel) {
        if (!isConnected()) return;
        
        try {
            pubSubConnection.sync().unsubscribe(channel);
        } catch (Exception e) {
            JsonLogger.error("redis_unsubscribe_failed", Map.of("channel", channel), e);
        }
    }

    /**
     * Add a message handler for a channel
     */
    public void addMessageHandler(String channel, Consumer<String> handler) {
        subscribers.computeIfAbsent(channel, k -> new ArrayList<>()).add(handler);
    }

    /**
     * Remove a message handler
     */
    public void removeMessageHandler(String channel, Consumer<String> handler) {
        List<Consumer<String>> handlers = subscribers.get(channel);
        if (handlers != null) {
            handlers.remove(handler);
        }
    }

    /**
     * Publish to a channel
     */
    public void publish(String channel, String message) {
        if (!isConnected()) return;
        
        try {
            connection.sync().publish(channel, message);
        } catch (Exception e) {
            JsonLogger.error("redis_publish_failed", Map.of("channel", channel), e);
        }
    }

    /**
     * Publish player update to all servers
     */
    public void publishPlayerUpdate(Object playerData) {
        String json = plugin.GSON.toJson(playerData);
        publish(config.channels().playerUpdates(), json);
    }

    /**
     * Publish server stats to all servers
     */
    public void publishServerStats(Object stats) {
        String json = plugin.GSON.toJson(stats);
        publish(config.channels().serverStats(), json);
    }

    /**
     * Publish activity event to all servers
     */
    public void publishActivity(Object activity) {
        String json = plugin.GSON.toJson(activity);
        publish(config.channels().activity(), json);
    }

    /**
     * Publish moderation event
     */
    public void publishModerationEvent(Object event) {
        String json = plugin.GSON.toJson(event);
        publish(config.channels().moderation(), json);
    }

    /**
     * Publish economy transaction
     */
    public void publishEconomyTransaction(Object transaction) {
        String json = plugin.GSON.toJson(transaction);
        publish(config.channels().economy(), json);
    }

    /**
     * Publish marketplace update
     */
    public void publishMarketplaceUpdate(Object update) {
        String json = plugin.GSON.toJson(update);
        publish(config.channels().marketplace(), json);
    }

    // ==================== CACHE OPERATIONS ====================

    /**
     * Set a value with TTL
     */
    public void cacheSet(String key, String value, long ttlSeconds) {
        if (!isConnected()) return;
        
        try {
            connection.sync().setex(key, ttlSeconds, value);
        } catch (Exception e) {
            JsonLogger.error("redis_cache_set_failed", Map.of("key", key), e);
        }
    }

    /**
     * Get a cached value
     */
    public String cacheGet(String key) {
        if (!isConnected()) return null;
        
        try {
            return connection.sync().get(key);
        } catch (Exception e) {
            JsonLogger.error("redis_cache_get_failed", Map.of("key", key), e);
            return null;
        }
    }

    /**
     * Delete a cached value
     */
    public void cacheDelete(String key) {
        if (!isConnected()) return;
        
        try {
            connection.sync().del(key);
        } catch (Exception e) {
            JsonLogger.error("redis_cache_delete_failed", Map.of("key", key), e);
        }
    }

    /**
     * Check if key exists
     */
    public boolean cacheExists(String key) {
        if (!isConnected()) return false;
        
        try {
            return connection.sync().exists(key) > 0;
        } catch (Exception e) {
            return false;
        }
    }

    // ==================== DISTRIBUTED LOCKS ====================

    /**
     * Try to acquire a distributed lock
     */
    public boolean tryLock(String lockKey, String lockValue, long ttlSeconds) {
        if (!isConnected()) return false;
        
        try {
            String result = connection.sync().set(
                    lockKey,
                    lockValue,
                    SetArgs.Builder.nx().ex(ttlSeconds)
            );
            return "OK".equals(result);
        } catch (Exception e) {
            JsonLogger.error("redis_lock_acquire_failed", Map.of("key", lockKey), e);
            return false;
        }
    }

    /**
     * Release a distributed lock
     */
    public boolean releaseLock(String lockKey, String lockValue) {
        if (!isConnected()) return false;
        
        String script = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """;
        
        try {
            Object result = connection.sync().eval(
                    script,
                    ScriptOutputType.INTEGER,
                    new String[]{lockKey},
                    lockValue
            );
            return ((Long) result) == 1;
        } catch (Exception e) {
            JsonLogger.error("redis_lock_release_failed", Map.of("key", lockKey), e);
            return false;
        }
    }

    // ==================== HASH OPERATIONS ====================

    /**
     * Set hash field
     */
    public void hashSet(String key, String field, String value) {
        if (!isConnected()) return;
        
        try {
            connection.sync().hset(key, field, value);
        } catch (Exception e) {
            JsonLogger.error("redis_hash_set_failed", Map.of("key", key, "field", field), e);
        }
    }

    /**
     * Get hash field
     */
    public String hashGet(String key, String field) {
        if (!isConnected()) return null;
        
        try {
            return connection.sync().hget(key, field);
        } catch (Exception e) {
            JsonLogger.error("redis_hash_get_failed", Map.of("key", key, "field", field), e);
            return null;
        }
    }

    /**
     * Get all hash fields
     */
    public Map<String, String> hashGetAll(String key) {
        if (!isConnected()) return Collections.emptyMap();
        
        try {
            return connection.sync().hgetall(key);
        } catch (Exception e) {
            JsonLogger.error("redis_hash_getall_failed", Map.of("key", key), e);
            return Collections.emptyMap();
        }
    }

    // ==================== SET OPERATIONS ====================

    /**
     * Add to set
     */
    public void setAdd(String key, String... members) {
        if (!isConnected()) return;
        
        try {
            connection.sync().sadd(key, members);
        } catch (Exception e) {
            JsonLogger.error("redis_set_add_failed", Map.of("key", key), e);
        }
    }

    /**
     * Get set members
     */
    public Set<String> setMembers(String key) {
        if (!isConnected()) return Collections.emptySet();
        
        try {
            return connection.sync().smembers(key);
        } catch (Exception e) {
            JsonLogger.error("redis_set_members_failed", Map.of("key", key), e);
            return Collections.emptySet();
        }
    }

    /**
     * Check if member is in set
     */
    public boolean setIsMember(String key, String member) {
        if (!isConnected()) return false;
        
        try {
            return connection.sync().sismember(key, member);
        } catch (Exception e) {
            return false;
        }
    }

    // ==================== COUNTERS ====================

    /**
     * Increment counter
     */
    public long increment(String key) {
        if (!isConnected()) return 0;
        
        try {
            return connection.sync().incr(key);
        } catch (Exception e) {
            JsonLogger.error("redis_increment_failed", Map.of("key", key), e);
            return 0;
        }
    }

    /**
     * Decrement counter
     */
    public long decrement(String key) {
        if (!isConnected()) return 0;
        
        try {
            return connection.sync().decr(key);
        } catch (Exception e) {
            JsonLogger.error("redis_decrement_failed", Map.of("key", key), e);
            return 0;
        }
    }

    /**
     * Get channels config
     */
    public NcDevConfig.Channels getChannels() {
        return config.channels();
    }
}
