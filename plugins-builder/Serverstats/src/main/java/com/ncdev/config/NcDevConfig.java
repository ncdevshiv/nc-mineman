package com.ncdev.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.ncdev.NcDevPlugin;
import com.ncdev.util.JsonLogger;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Configuration manager for NCDev plugin.
 * Provides both file-based and API-based configuration access.
 */
public class NcDevConfig {

    private final NcDevPlugin plugin;
    private final Path configPath;
    private final ObjectMapper yamlMapper;
    
    private ConfigRoot config;

    public NcDevConfig(NcDevPlugin plugin) {
        this.plugin = plugin;
        this.configPath = plugin.getDataFolder().toPath().resolve("config.yml");
        this.yamlMapper = new ObjectMapper(new YAMLFactory()
                .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
                .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES));
    }

    /**
     * Load configuration from file
     */
    public void load() throws IOException {
        File configFile = configPath.toFile();
        
        if (!configFile.exists()) {
            plugin.saveResource("config.yml", true);
            JsonLogger.info("config_created", Map.of("path", configPath.toString()));
        }
        
        config = yamlMapper.readValue(configFile, ConfigRoot.class);
        validateConfig();
    }

    /**
     * Save configuration to file
     */
    public void save() throws IOException {
        yamlMapper.writerWithDefaultPrettyPrinter().writeValue(configPath.toFile(), config);
        JsonLogger.info("config_saved", Map.of("path", configPath.toString()));
    }

    /**
     * Reload configuration from file
     */
    public void reload() throws IOException {
        load();
        JsonLogger.info("config_reloaded", Map.of());
    }

    /**
     * Validate configuration values
     */
    private void validateConfig() {
        // Validate ports
        if (config.configApi().port() <= 0 || config.configApi().port() > 65535) {
            throw new IllegalStateException("Invalid config API port: " + config.configApi().port());
        }
        if (config.websocket().port() <= 0 || config.websocket().port() > 65535) {
            throw new IllegalStateException("Invalid WebSocket port: " + config.websocket().port());
        }
        if (config.socketio().port() <= 0 || config.socketio().port() > 65535) {
            throw new IllegalStateException("Invalid Socket.IO port: " + config.socketio().port());
        }
        
        // Validate database
        if (config.database().type() == null || 
            !config.database().type().matches("h2|postgresql|mysql")) {
            throw new IllegalStateException("Invalid database type: " + config.database().type());
        }
        
        // Validate lifecycle retention values
        if (config.lifecycle().retention().activity().days() < 0 ||
            config.lifecycle().retention().transactions().days() < 0) {
            throw new IllegalStateException("Retention days cannot be negative");
        }
        
        // Validate currency
        if (config.currency().primary().decimalPlaces() < 0 || 
            config.currency().primary().decimalPlaces() > 8) {
            throw new IllegalStateException("Invalid decimal places: " + 
                    config.currency().primary().decimalPlaces());
        }
    }

    // ==================== UPDATE METHODS ====================

    /**
     * Update a specific config value via API
     */
    public void updateValue(String path, Object value) throws IOException {
        String[] parts = path.split("\\.");
        Object current = config;
        
        for (int i = 0; i < parts.length - 1; i++) {
            // Navigate to parent
            current = getNestedValue(current, parts[i]);
        }
        
        if (current != null) {
            // Use reflection to set the value
            setNestedValue(current, parts[parts.length - 1], value);
            save();
            JsonLogger.info("config_value_updated", Map.of("path", path, "value", value.toString()));
        }
    }

    /**
     * Update multiple config values at once
     */
    public void updateValues(Map<String, Object> updates) throws IOException {
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            updateValue(entry.getKey(), entry.getValue());
        }
    }

    /**
     * Get a config section by name
     */
    @SuppressWarnings("unchecked")
    private Object getNestedValue(Object obj, String key) {
        try {
            if (obj instanceof Map) {
                return ((Map<String, Object>) obj).get(key);
            }
            return obj.getClass().getField(key).get(obj);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Set a nested config value
     */
    @SuppressWarnings("unchecked")
    private void setNestedValue(Object obj, String key, Object value) {
        try {
            if (obj instanceof Map) {
                ((Map<String, Object>) obj).put(key, value);
            } else {
                var field = obj.getClass().getField(key);
                field.setAccessible(true);
                
                // Convert value to field type if needed
                Object convertedValue = convertValue(value, field.getType());
                field.set(obj, convertedValue);
            }
        } catch (Exception e) {
            JsonLogger.error("config_set_value_failed", 
                    Map.of("key", key, "error", e.getMessage()), e);
        }
    }

    /**
     * Convert value to target type
     */
    private Object convertValue(Object value, Class<?> targetType) {
        if (value == null) return null;
        
        if (targetType == int.class || targetType == Integer.class) {
            return ((Number) value).intValue();
        }
        if (targetType == long.class || targetType == Long.class) {
            return ((Number) value).longValue();
        }
        if (targetType == double.class || targetType == Double.class) {
            return ((Number) value).doubleValue();
        }
        if (targetType == float.class || targetType == Float.class) {
            return ((Number) value).floatValue();
        }
        if (targetType == boolean.class || targetType == Boolean.class) {
            return value;
        }
        if (targetType == String.class) {
            return value.toString();
        }
        
        return value;
    }

    // ==================== GETTERS ====================

    public ConfigApi configApi() { return config.configApi(); }
    public Server server() { return config.server(); }
    public Database database() { return config.database(); }
    public Redis redis() { return config.redis(); }
    public Websocket websocket() { return config.websocket(); }
    public Socketio socketio() { return config.socketio(); }
    public Lifecycle lifecycle() { return config.lifecycle(); }
    public Currency currency() { return config.currency(); }
    public Marketplace marketplace() { return config.marketplace(); }
    public Moderation moderation() { return config.moderation(); }
    public ModerationCommands moderationCommands() { return config.moderationCommands(); }
    public Social social() { return config.social(); }
    public Tracking tracking() { return config.tracking(); }
    public Logging logging() { return config.logging(); }
    public Performance performance() { return config.performance(); }

    // ==================== CONFIG CLASSES ====================

    // Root config class
    public record ConfigRoot(
            ConfigApi configApi,
            Server server,
            Database database,
            Redis redis,
            Websocket websocket,
            Socketio socketio,
            Lifecycle lifecycle,
            Currency currency,
            Marketplace marketplace,
            Moderation moderation,
            ModerationCommands moderationCommands,
            Social social,
            Tracking tracking,
            Logging logging,
            Performance performance
    ) {}

    // Config API settings
    public record ConfigApi(
            boolean enabled,
            int port,
            Cors cors,
            Auth auth,
            RateLimit rateLimit,
            Dashboard dashboard
    ) {}
    public record Cors(boolean enabled, java.util.List<String> allowedOrigins) {}
    public record Auth(boolean enabled, String jwtSecret, int jwtExpirationHours, boolean requireAdminForWrite) {}
    public record RateLimit(boolean enabled, int requestsPerMinute, int burst) {}
    public record Dashboard(boolean enableCheckboxes, boolean enableSliders, boolean enableToggles, 
            boolean enableDropdowns, java.util.List<String> categories) {}

    // Server settings
    public record Server(String type, String minecraftVersionMin, Folia folia, Velocity velocity) {}
    public record Folia(boolean enabled, boolean useRegionizedScheduling, boolean asyncTasks) {}
    public record Velocity(boolean enabled, String serverId) {}

    // Database settings
    public record Database(
            String type,
            H2Config h2,
            Postgresql postgresql,
            MySQL mysql,
            PoolConfig pool
    ) {}
    public record H2Config(String path, boolean autoServer) {}
    public record Postgresql(String host, int port, String database, String username, String password, 
            boolean ssl, String schema) {}
    public record MySQL(String host, int port, String database, String username, String password, boolean ssl) {}
    public record PoolConfig(int size, int minIdle, long connectionTimeoutMs, long idleTimeoutMs, 
            long maxLifetimeMs, String validationQuery) {}

    // Redis settings
    public record Redis(
            boolean enabled,
            String host,
            int port,
            String password,
            int database,
            int timeoutMs,
            boolean ssl,
            RedisPool pool,
            Channels channels,
            RedisFeatures features
    ) {}
    public record RedisPool(int maxActive, int maxIdle, int minIdle, int maxWaitMs) {}
    public record Channels(String playerUpdates, String serverStats, String activity, 
            String moderation, String economy, String marketplace) {}
    public record RedisFeatures(boolean pubsubEnabled, boolean cacheEnabled, 
            boolean distributedLocks, boolean sessionSharing) {}

    // WebSocket settings
    public record Websocket(
            boolean enabled,
            int port,
            int maxConnections,
            long connectionTimeoutMs,
            int pingIntervalSeconds,
            int pingTimeoutSeconds,
            int maxMessageSizeBytes,
            String textMessageMode,
            Compression compression,
            ThreadPoolConfig threadPool
    ) {}
    public record Compression(boolean enabled, int minThresholdBytes) {}
    public record ThreadPoolConfig(int size, String namePrefix) {}

    // Socket.IO settings
    public record Socketio(
            boolean enabled,
            int port,
            int pingIntervalMs,
            int pingTimeoutMs,
            int maxPayloadBytes,
            java.util.List<Namespace> namespaces,
            Rooms rooms,
            Batching batching,
            Reconnection reconnection
    ) {}
    public record Namespace(String name, String description, boolean authRequired) {}
    public record Rooms(boolean enabled, int maxRoomsPerSocket, boolean autoCreate) {}
    public record Batching(boolean enabled, int intervalMs, int maxEventsPerBatch) {}
    public record Reconnection(boolean enabled, int attempts, int delayMs, int maxDelayMs) {}

    // Lifecycle settings
    public record Lifecycle(
            boolean enabled,
            Retention retention,
            Cleanup cleanup,
            Archive archive,
            Notifications notifications,
            boolean dryRun
    ) {}
    public record Retention(
            RetentionConfig activity,
            RetentionConfig stats,
            RetentionConfig transactions,
            RetentionConfig chatLogs,
            RetentionConfig moderationLogs,
            RetentionConfig inactivePlayers,
            MarketplaceRetention marketplace,
            EconomyRetention economy
    ) {}
    public record RetentionConfig(boolean enabled, int days, int batchSize, int batchIntervalMinutes) {}
    public record MarketplaceRetention(int expiredListingsDays, int completedListingsDays, int cancelledListingsDays) {}
    public record EconomyRetention(int balanceHistoryDays, int transactionHistoryDays) {}
    public record Cleanup(String schedule, int intervalMinutes) {}
    public record Archive(boolean enabled, String path, String format, boolean compress) {}
    public record Notifications(int beforeCleanupDays, String webhookUrl) {}

    // Currency settings
    public record Currency(
            boolean enabled,
            CurrencyConfig primary,
            double startingBalance,
            double maxBalance,
            double minTransaction,
            DailyBonus dailyBonus,
            TransactionLimit transaction,
            boolean allowNegative,
            Interest interest,
            Leaderboard leaderboard
    ) {}
    public record CurrencyConfig(String name, String symbol, String pluralName, String singularName, 
            int decimalPlaces, String format) {}
    public record DailyBonus(boolean enabled, double amount, double streakMultiplier, int maxStreakDays) {}
    public record TransactionLimit(double maxSingle, double dailyLimit, double hourlyLimit) {}
    public record Interest(boolean enabled, double ratePercent, boolean compound) {}
    public record Leaderboard(boolean enabled, java.util.List<Reward> rewards, int payoutIntervalDays) {}
    public record Reward(int rank, String name, double amount, String item) {}

    // Marketplace settings
    public record Marketplace(
            boolean enabled,
            Listings listings,
            java.util.List<Category> categories,
            Search search,
            MarketplaceNotifications notifications
    ) {}
    public record Listings(
            ItemSaleConfig itemSale,
            AuctionConfig auction,
            ExchangeConfig exchange
    ) {}
    public record ItemSaleConfig(boolean enabled, double taxPercent, double minPrice, double maxPrice, 
            int maxPerPlayer, int durationDays) {}
    public record AuctionConfig(boolean enabled, double taxPercent, double minStartingBid, int maxDurationHours, 
            int minDurationHours, int extensionOnBidMinutes, int extensionThresholdSeconds, boolean buyoutEnabled) {}
    public record ExchangeConfig(boolean enabled, double taxPercent, boolean allowMultipleItems, int durationDays) {}
    public record Category(String name, String icon, boolean enabled) {}
    public record Search(int maxResults, boolean fuzzySearch, java.util.List<String> sortOptions) {}
    public record MarketplaceNotifications(boolean outbid, boolean auctionEnding, boolean listingExpired, boolean saleCompleted) {}

    // Moderation settings
    public record Moderation(
            boolean enabled,
            ModerationLogging logging,
            AutoModeration autoModeration,
            Ban ban,
            Mute mute,
            Freeze freeze,
            Jail jail,
            SlowMode slowMode,
            Vanish vanish,
            Warn warn,
            History history
    ) {}
    public record ModerationLogging(boolean enabled, boolean logToFile, boolean logToDiscord, 
            String discordWebhook, boolean logModActions, boolean logPlayerActions) {}
    public record AutoModeration(boolean enabled, ChatFilter chatFilter, SpamDetection spamDetection, 
            ExploitDetection exploitDetection) {}
    public record ChatFilter(boolean enabled, String mode, java.util.List<String> blockedWords, String replaceWith) {}
    public record SpamDetection(boolean enabled, int maxMessagesPerMinute, int maxSimilarMessages, boolean muteOnViolation) {}
    public record ExploitDetection(boolean enabled, int packetFloodThreshold, boolean illegalBlockDetection) {}
    public record Ban(String defaultReason, boolean permanentByDefault, int defaultDurationMinutes, 
            boolean allowAppeal, boolean notifyPlayer) {}
    public record Mute(int defaultDurationMinutes, boolean showMutedMessage, String muteFormat) {}
    public record Freeze(boolean notifyOnFreeze, boolean allowCommands, boolean allowMovement, boolean allowChat) {}
    public record Jail(boolean enabled, String defaultLocation, boolean allowCommands, boolean allowChat, 
            boolean allowMovement, boolean allowInventory, int checkIntervalSeconds) {}
    public record SlowMode(int defaultDelaySeconds, int maxDelaySeconds) {}
    public record Vanish(boolean showToStaffOnly, boolean notifyOnJoin, boolean affectsTabList, boolean grantFlight) {}
    public record Warn(int maxWarns, java.util.List<AutoAction> autoActions) {}
    public record AutoAction(int warns, String action, int durationMinutes, String reason) {}
    public record History(boolean showToStaff, boolean showToPlayer, boolean publicDisplayNames) {}

    // Moderation commands settings
    public record ModerationCommands(
            BanCommand ban, BanCommand tempban, BanCommand unban, BanCommand kick,
            MuteCommand mute, MuteCommand tempmute, MuteCommand unmute, SlowModeCommand slowmode,
            CommandConfig freeze, CommandConfig unfreeze, CommandConfig jail, CommandConfig unjail,
            CommandConfig warn, CommandConfig warns, CommandConfig clearwarns,
            SlapCommand slap, CommandConfig strike, CommandConfig heal, CommandConfig feed,
            CommandConfig invsee, CommandConfig enderchest,
            TeleportCommands teleport, VanishCommand vanish,
            ReportCommand report, CommandConfig reports, CommandConfig handlereport
    ) {}
    public record BanCommand(boolean enabled, java.util.List<String> aliases, boolean notifyPlayer, boolean notifyStaff) {}
    public record MuteCommand(boolean enabled, java.util.List<String> aliases) {}
    public record SlowModeCommand(boolean enabled, java.util.List<String> aliases) {}
    public record CommandConfig(boolean enabled, java.util.List<String> aliases) {}
    public record SlapCommand(boolean enabled, java.util.List<String> aliases, double defaultDamage, double velocity) {}
    public record TeleportCommands(TpCommand tp, TpCommand tphere, TpCommand tpall, TpCommand tpa, TpCommand tpaccept, TpCommand tpdeny) {}
    public record TpCommand(boolean enabled, java.util.List<String> aliases) {}
    public record VanishCommand(boolean enabled, java.util.List<String> aliases) {}
    public record ReportCommand(boolean enabled, java.util.List<String> aliases) {}

    // Social settings
    public record Social(
            boolean enabled,
            Friends friends,
            Follow follow,
            Party party,
            Chat chat
    ) {}
    public record Friends(boolean enabled, int maxFriends, boolean allowBlock, FriendNotifications notifications) {}
    public record FriendNotifications(boolean requestReceived, boolean requestAccepted, boolean friendRemoved) {}
    public record Follow(boolean enabled, int maxFollowers, int maxFollowing, boolean notifyOnJoin) {}
    public record Party(boolean enabled, int maxPartySize) {}
    public record Chat(boolean privateMessages, boolean allowReply, boolean ignoreSystem, boolean socialSpy) {}

    // Tracking settings
    public record Tracking(
            boolean enabled,
            TrackingEvents events,
            Sampling sampling,
            TrackingCache cache
    ) {}
    public record TrackingEvents(boolean join, boolean quit, boolean death, boolean kill, 
            boolean blockBreak, boolean blockPlace, boolean itemPickup, boolean itemDrop, 
            boolean chat, boolean command, boolean craft, boolean fish, boolean adventureStats) {}
    public record Sampling(boolean enabled, double rate, java.util.List<String> highPriority) {}
    public record TrackingCache(int maxActivitiesPerPlayer, int cleanupIntervalSeconds) {}

    // Logging settings
    public record Logging(
            String level,
            ConsoleLog console,
            FileLog file,
            boolean json,
            java.util.Map<String, Boolean> categories
    ) {}
    public record ConsoleLog(boolean enabled, String format, boolean colors) {}
    public record FileLog(boolean enabled, String path, int maxSizeMb, int maxFiles, boolean archive) {}

    // Performance settings
    public record Performance(
            AsyncConfig async,
            BatchingConfig batching,
            CacheConfig cache,
            Limits limits
    ) {}
    public record AsyncConfig(boolean enabled, int threadPoolSize, int queueSize) {}
    public record BatchingConfig(boolean enabled, int activityBatchSize, int activityFlushMs) {}
    public record CacheConfig(int playerDataTtlSeconds, int serverStatsTtlSeconds, int marketplaceListingsTtlSeconds) {}
    public record Limits(int maxConcurrentApiRequests, int maxQueryTimeMs) {}
}
