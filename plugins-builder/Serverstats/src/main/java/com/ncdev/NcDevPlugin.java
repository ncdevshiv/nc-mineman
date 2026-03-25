package com.ncdev;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.ncdev.api.ConfigApiServer;
import com.ncdev.cache.PlayerCache;
import com.ncdev.config.NcDevConfig;
import com.ncdev.currency.CurrencyService;
import com.ncdev.database.DatabaseManager;
import com.ncdev.economy.EconomyService;
import com.ncdev.lifecycle.LifecycleManager;
import com.ncdev.marketplace.MarketplaceService;
import com.ncdev.moderation.ModerationService;
import com.ncdev.redis.RedisManager;
import com.ncdev.service.PlayerService;
import com.ncdev.service.PlayerStatsService;
import com.ncdev.social.SocialService;
import com.ncdev.socketio.SocketIOManager;
import com.ncdev.trading.TradingService;
import com.ncdev.util.JsonLogger;
import com.ncdev.websocket.NcDevWebSocketServer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.inventory.CraftItemEvent;
import org.bukkit.event.player.*;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * NCDev Plugin - Advanced Minecraft Server Plugin
 * 
 * Supports: Paper, Folia, Spigot, Velocity (1.20+)
 * 
 * Features:
 * - Real-time player tracking and monitoring
 * - Currency and economy system
 * - Marketplace with auctions and exchanges
 * - Advanced moderation tools
 * - Social features (friends, follows)
 * - Multi-server scaling via Redis Pub/Sub
 * - Socket.IO for real-time dashboard updates
 * - Configurable data lifecycle management
 * 
 * @version 0.0.1
 * @author ncdev
 */
public final class NcDevPlugin extends JavaPlugin implements Listener {

    // Plugin info
    public static final String PLUGIN_NAME = "ncdev";
    public static final String PLUGIN_VERSION = "0.0.1";
    
    // Gson instance for JSON operations
    public static final Gson GSON = new GsonBuilder()
            .disableHtmlEscaping()
            .setPrettyPrinting()
            .create();

    // Server compatibility detection
    private enum ServerType {
        PAPER, FOLIA, SPIGOT, VELOCITY, UNKNOWN
    }

    private ServerType serverType = ServerType.UNKNOWN;
    private String minecraftVersion = "unknown";
    private boolean isFoliaSupported = false;
    private boolean isVelocityProxy = false;

    // Configuration
    private NcDevConfig config;
    
    // Core services
    private DatabaseManager databaseManager;
    private RedisManager redisManager;
    
    // Player services
    private PlayerService playerService;
    private PlayerStatsService playerStatsService;
    private PlayerCache playerCache;
    
    // Economy and currency
    private CurrencyService currencyService;
    private EconomyService economyService;
    
    // Trading and marketplace
    private TradingService tradingService;
    private MarketplaceService marketplaceService;
    
    // Moderation
    private ModerationService moderationService;
    
    // Social
    private SocialService socialService;
    
    // Lifecycle
    private LifecycleManager lifecycleManager;
    
    // Real-time servers
    private NcDevWebSocketServer webSocketServer;
    private SocketIOManager socketIOManager;
    private ConfigApiServer configApiServer;
    
    // Thread pool for async operations
    private ExecutorService asyncExecutor;
    
    // Role hierarchy (higher number = higher priority)
    private static final Map<String, Integer> ROLE_HIERARCHY = new HashMap<>() {{
        put("Member", 1); put("Iron", 2); put("Silver", 3); put("Copper", 4); put("Gold", 5);
        put("Plat", 6); put("Diamond", 7); put("Olaf", 8); put("VIP", 9); put("VVIP", 10);
        put("Youtuber", 11); put("Helper", 12); put("God", 13); put("Admin", 14); put("Owner", 15);
    }};

    // Real-time player data cache
    private final Map<UUID, PlayerCache.PlayerData> playerDataCache = new ConcurrentHashMap<>();

    // Activity queue for batch processing
    private final Queue<ActivityEvent> activityQueue = new ConcurrentLinkedQueue<>();

    @Override
    public void onEnable() {
        long startTime = System.currentTimeMillis();
        
        // Initialize logger
        JsonLogger.init(getLogger());
        
        // Save default config
        saveDefaultConfig();
        
        // Load configuration
        loadConfiguration();
        
        // Detect server type and version
        detectServerType();
        
        // Initialize async executor
        initializeAsyncExecutor();
        
        // Initialize database
        initializeDatabase();
        
        // Initialize Redis (optional, for multi-server)
        initializeRedis();
        
        // Initialize services
        initializeServices();
        
        // Initialize real-time servers
        initializeRealTimeServers();
        
        // Initialize lifecycle manager
        initializeLifecycle();
        
        // Register event listeners
        registerEventListeners();
        
        // Start background tasks
        scheduleBackgroundTasks();
        
        // Register commands
        registerCommands();
        
        long loadTime = System.currentTimeMillis() - startTime;
        JsonLogger.info("plugin_enabled", Map.of(
            "plugin", PLUGIN_NAME,
            "version", PLUGIN_VERSION,
            "load_time_ms", loadTime,
            "server_type", serverType.name(),
            "minecraft_version", minecraftVersion,
            "redis_enabled", config.redis().enabled(),
            "socketio_enabled", config.socketio().enabled(),
            "currency_enabled", config.currency().enabled(),
            "marketplace_enabled", config.marketplace().enabled()
        ));
    }

    @Override
    public void onDisable() {
        long startTime = System.currentTimeMillis();
        
        // Stop background tasks
        stopBackgroundTasks();
        
        // Shutdown async executor
        shutdownAsyncExecutor();
        
        // Flush activity queue
        flushActivityQueue();
        
        // Stop real-time servers
        stopRealTimeServers();
        
        // Disable Redis
        disableRedis();
        
        // Close database
        closeDatabase();
        
        // Stop lifecycle manager
        stopLifecycleManager();
        
        long disableTime = System.currentTimeMillis() - startTime;
        JsonLogger.info("plugin_disabled", Map.of(
            "plugin", PLUGIN_NAME,
            "disable_time_ms", disableTime
        ));
    }

    // ==================== INITIALIZATION ====================

    private void loadConfiguration() {
        try {
            this.config = new NcDevConfig(this);
            this.config.load();
            JsonLogger.info("config_loaded", Map.of(
                "path", getDataFolder().getAbsolutePath()
            ));
        } catch (Exception e) {
            JsonLogger.error("config_load_failed", Map.of(), e);
            throw new IllegalStateException("Failed to load configuration", e);
        }
    }

    private void detectServerType() {
        String serverName = Bukkit.getServer().getName();
        String version = Bukkit.getServer().getVersion();

        // Extract Minecraft version
        if (version.contains("MC:")) {
            int mcIndex = version.indexOf("MC:");
            int endIndex = version.indexOf(")", mcIndex);
            if (endIndex > mcIndex) {
                minecraftVersion = version.substring(mcIndex + 3, endIndex).trim();
            }
        }

        // Detect server type
        if (serverName.toLowerCase().contains("paper")) {
            serverType = ServerType.PAPER;
            try {
                Class.forName("io.papermc.paper.threadedregions.RegionizedServer");
                isFoliaSupported = true;
            } catch (ClassNotFoundException e) {
                isFoliaSupported = false;
            }
        } else if (serverName.toLowerCase().contains("folia")) {
            serverType = ServerType.FOLIA;
            isFoliaSupported = true;
        } else if (serverName.toLowerCase().contains("spigot")) {
            serverType = ServerType.SPIGOT;
        } else {
            try {
                Class.forName("com.velocitypowered.api.plugin.Plugin");
                serverType = ServerType.VELOCITY;
                isVelocityProxy = true;
            } catch (ClassNotFoundException e) {
                serverType = ServerType.UNKNOWN;
            }
        }

        JsonLogger.info("server_detected", Map.of(
            "server_type", serverType.name(),
            "minecraft_version", minecraftVersion,
            "folia_supported", isFoliaSupported,
            "is_proxy", isVelocityProxy
        ));
    }

    private void initializeAsyncExecutor() {
        int poolSize = config.performance().async().threadPoolSize();
        this.asyncExecutor = Executors.newFixedThreadPool(poolSize);
        JsonLogger.info("async_executor_initialized", Map.of(
            "pool_size", poolSize
        ));
    }

    private void initializeDatabase() {
        try {
            String dbType = config.database().type();
            String dbUrl;
            String dbUser;
            String dbPass;
            
            switch (dbType.toLowerCase()) {
                case "postgresql" -> {
                    dbUrl = String.format("jdbc:postgresql://%s:%d/%s",
                            config.database().postgresql().host(),
                            config.database().postgresql().port(),
                            config.database().postgresql().database());
                    dbUser = config.database().postgresql().username();
                    dbPass = config.database().postgresql().password();
                }
                case "mysql" -> {
                    dbUrl = String.format("jdbc:mysql://%s:%d/%s",
                            config.database().mysql().host(),
                            config.database().mysql().port(),
                            config.database().mysql().database());
                    dbUser = config.database().mysql().username();
                    dbPass = config.database().mysql().password();
                }
                default -> { // h2
                    dbUrl = String.format("jdbc:h2:%s/%s",
                            getDataFolder().getAbsolutePath(),
                            config.database().h2().path());
                    dbUser = "sa";
                    dbPass = "";
                }
            }
            
            this.databaseManager = new DatabaseManager(dbType, dbUrl, dbUser, dbPass, this);
            this.databaseManager.initializeSchema();
            
            JsonLogger.info("database_initialized", Map.of(
                "type", dbType
            ));
        } catch (Exception e) {
            JsonLogger.error("database_init_failed", Map.of(), e);
            throw new IllegalStateException("Failed to initialize database", e);
        }
    }

    private void initializeRedis() {
        if (!config.redis().enabled()) {
            JsonLogger.info("redis_disabled", Map.of());
            return;
        }
        
        try {
            this.redisManager = new RedisManager(config.redis(), this);
            this.redisManager.connect();
            
            JsonLogger.info("redis_initialized", Map.of(
                "host", config.redis().host(),
                "port", config.redis().port()
            ));
        } catch (Exception e) {
            JsonLogger.error("redis_init_failed", Map.of(), e);
            // Redis is optional, continue without it
            this.redisManager = null;
        }
    }

    private void initializeServices() {
        this.playerCache = new PlayerCache(
                config.tracking().cache().maxActivitiesPerPlayer()
        );
        
        this.playerService = new PlayerService(databaseManager, this);
        this.playerStatsService = new PlayerStatsService(databaseManager, this);
        
        if (config.currency().enabled()) {
            this.currencyService = new CurrencyService(databaseManager, this);
            this.economyService = new EconomyService(databaseManager, currencyService, this);
        }
        
        if (config.marketplace().enabled()) {
            this.marketplaceService = new MarketplaceService(databaseManager, this);
        }
        
        this.moderationService = new ModerationService(databaseManager, this);
        this.socialService = new SocialService(databaseManager, this);
        this.tradingService = new TradingService(databaseManager, this);
        
        JsonLogger.info("services_initialized", Map.of(
            "currency", config.currency().enabled(),
            "marketplace", config.marketplace().enabled()
        ));
    }

    private void initializeRealTimeServers() {
        // Initialize WebSocket server
        if (config.websocket().enabled()) {
            try {
                this.webSocketServer = new NcDevWebSocketServer(
                        config.websocket().port(),
                        config.websocket(),
                        this
                );
                this.webSocketServer.start();
            } catch (Exception e) {
                JsonLogger.error("websocket_init_failed", Map.of(), e);
            }
        }
        
        // Initialize Socket.IO server
        if (config.socketio().enabled()) {
            try {
                this.socketIOManager = new SocketIOManager(
                        config.socketio().port(),
                        config.socketio(),
                        this
                );
                this.socketIOManager.start();
            } catch (Exception e) {
                JsonLogger.error("socketio_init_failed", Map.of(), e);
            }
        }
        
        // Initialize Config API server
        if (config.configApi().enabled()) {
            try {
                this.configApiServer = new ConfigApiServer(
                        config.configApi().port(),
                        config,
                        this
                );
                this.configApiServer.start();
            } catch (Exception e) {
                JsonLogger.error("config_api_init_failed", Map.of(), e);
            }
        }
    }

    private void initializeLifecycle() {
        if (!config.lifecycle().enabled()) {
            return;
        }
        
        try {
            this.lifecycleManager = new LifecycleManager(config.lifecycle(), databaseManager, this);
            this.lifecycleManager.start();
            
            JsonLogger.info("lifecycle_initialized", Map.of(
                "cleanup_schedule", config.lifecycle().cleanup().schedule()
            ));
        } catch (Exception e) {
            JsonLogger.error("lifecycle_init_failed", Map.of(), e);
        }
    }

    private void registerEventListeners() {
        Bukkit.getPluginManager().registerEvents(this, this);
        
        // Register moderation events
        if (config.moderation().enabled()) {
            getServer().getPluginManager().registerEvents(
                    moderationService.createEventListener(), this
            );
        }
    }

    private void scheduleBackgroundTasks() {
        // Activity queue flusher
        if (config.performance().batching().enabled()) {
            int flushInterval = config.performance().batching().activityFlushMs();
            new BukkitRunnable() {
                @Override
                public void run() {
                    flushActivityQueue();
                }
            }.runTaskTimerAsynchronously(this, flushInterval / 50, flushInterval / 50);
        }
        
        // Real-time data updater
        new BukkitRunnable() {
            @Override
            public void run() {
                updateRealTimeData();
            }
        }.runTaskTimerAsynchronously(this, 20L, 20L);
        
        // Marketplace expiration checker
        if (config.marketplace().enabled()) {
            new BukkitRunnable() {
                @Override
                public void run() {
                    checkMarketplaceExpirations();
                }
            }.runTaskTimerAsynchronously(this, 1200L, 1200L);
        }
    }

    private void registerCommands() {
        JsonLogger.info("commands_registered", Map.of());
    }

    // ==================== SHUTDOWN ====================

    private void stopBackgroundTasks() {
        Bukkit.getScheduler().cancelTasks(this);
        JsonLogger.info("background_tasks_stopped", Map.of());
    }

    private void shutdownAsyncExecutor() {
        if (asyncExecutor != null && !asyncExecutor.isShutdown()) {
            asyncExecutor.shutdown();
            try {
                if (!asyncExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
                    asyncExecutor.shutdownNow();
                }
            } catch (InterruptedException e) {
                asyncExecutor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }

    private void flushActivityQueue() {
        if (activityQueue.isEmpty()) {
            return;
        }
        
        List<ActivityEvent> batch = new ArrayList<>();
        int batchSize = config.performance().batching().activityBatchSize();
        
        while (!activityQueue.isEmpty() && batch.size() < batchSize) {
            ActivityEvent event = activityQueue.poll();
            if (event != null) {
                batch.add(event);
            }
        }
        
        if (!batch.isEmpty()) {
            asyncExecutor.execute(() -> {
                try {
                    databaseManager.batchInsertActivities(batch);
                } catch (Exception e) {
                    JsonLogger.error("activity_batch_insert_failed", 
                            Map.of("batch_size", batch.size()), e);
                }
            });
        }
    }

    private void stopRealTimeServers() {
        if (webSocketServer != null) {
            try {
                webSocketServer.stop();
            } catch (Exception e) {
                JsonLogger.error("websocket_stop_failed", Map.of(), e);
            }
        }
        
        if (socketIOManager != null) {
            try {
                socketIOManager.stop();
            } catch (Exception e) {
                JsonLogger.error("socketio_stop_failed", Map.of(), e);
            }
        }
        
        if (configApiServer != null) {
            try {
                configApiServer.stop();
            } catch (Exception e) {
                JsonLogger.error("config_api_stop_failed", Map.of(), e);
            }
        }
    }

    private void disableRedis() {
        if (redisManager != null) {
            try {
                redisManager.disconnect();
            } catch (Exception e) {
                JsonLogger.error("redis_disconnect_failed", Map.of(), e);
            }
        }
    }

    private void closeDatabase() {
        if (databaseManager != null) {
            databaseManager.close();
        }
    }

    private void stopLifecycleManager() {
        if (lifecycleManager != null) {
            lifecycleManager.stop();
        }
    }

    // ==================== BACKGROUND TASKS ====================

    private void updateRealTimeData() {
        long now = System.currentTimeMillis();
        
        for (Player player : Bukkit.getOnlinePlayers()) {
            UUID uuid = player.getUniqueId();
            
            PlayerCache.PlayerData data = new PlayerCache.PlayerData(
                    uuid,
                    player.getName(),
                    player.getPing(),
                    getHighestRole(uuid),
                    player.getLocation().clone(),
                    player.getHealth(),
                    player.getFoodLevel(),
                    player.getGameMode(),
                    now
            );
            
            playerDataCache.put(uuid, data);
            
            // Broadcast to WebSocket/Socket.IO
            if (webSocketServer != null) {
                webSocketServer.broadcastPlayerUpdate(uuid, data);
            }
            if (socketIOManager != null) {
                socketIOManager.broadcastPlayerUpdate(uuid, data);
            }
            
            // Publish to Redis for multi-server sync
            if (redisManager != null) {
                redisManager.publishPlayerUpdate(data);
            }
        }
        
        // Broadcast server stats
        broadcastServerStats();
    }

    private void broadcastServerStats() {
        Map<String, Object> serverStats = Map.of(
                "online_players", Bukkit.getOnlinePlayers().size(),
                "max_players", Bukkit.getMaxPlayers(),
                "tps", getTPS(),
                "average_ping", getAveragePing(),
                "timestamp", Instant.now().toString()
        );
        
        if (webSocketServer != null) {
            webSocketServer.broadcastServerStats(serverStats);
        }
        if (socketIOManager != null) {
            socketIOManager.broadcastServerStats(serverStats);
        }
    }

    private void checkMarketplaceExpirations() {
        if (marketplaceService != null) {
            try {
                marketplaceService.processExpiredListings();
            } catch (Exception e) {
                JsonLogger.error("marketplace_expiration_check_failed", Map.of(), e);
            }
        }
    }

    // ==================== EVENT HANDLERS ====================

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        
        // Initialize player in database
        playerService.recordJoin(player);
        
        // Initialize currency
        if (currencyService != null) {
            currencyService.initializePlayerBalance(uuid);
        }
        
        // Record activity
        recordActivity(uuid, player.getName(), "JOIN", "server", 
                player.getLocation(), null, 1, null);
        
        JsonLogger.info("player_join", Map.of(
                "player_uuid", uuid.toString(),
                "player_name", player.getName(),
                "role", getHighestRole(uuid)
        ));
        
        // Broadcast via Socket.IO
        if (socketIOManager != null) {
            socketIOManager.broadcastEvent("join", Map.of(
                    "uuid", uuid.toString(),
                    "name", player.getName()
            ));
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        
        // Update last seen
        playerService.recordQuit(player);
        
        // Record activity
        recordActivity(uuid, player.getName(), "QUIT", "server", 
                player.getLocation(), null, 1, null);
        
        // Clean up cache
        playerDataCache.remove(uuid);
        
        JsonLogger.info("player_quit", Map.of(
                "player_uuid", uuid.toString(),
                "player_name", player.getName()
        ));
        
        // Broadcast via Socket.IO
        if (socketIOManager != null) {
            socketIOManager.broadcastEvent("quit", Map.of(
                    "uuid", uuid.toString(),
                    "name", player.getName()
            ));
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        if (event.getPlayer().getGameMode().name().equals("CREATIVE")) {
            return;
        }
        
        Player player = event.getPlayer();
        recordActivity(
                player.getUniqueId(),
                player.getName(),
                "BLOCK_BREAK",
                event.getBlock().getType().name(),
                event.getBlock().getLocation(),
                getItemName(player.getInventory().getItemInMainHand()),
                1,
                null
        );
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        recordActivity(
                player.getUniqueId(),
                player.getName(),
                "BLOCK_PLACE",
                event.getBlockPlaced().getType().name(),
                event.getBlockPlaced().getLocation(),
                getItemName(player.getInventory().getItemInMainHand()),
                1,
                null
        );
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onItemPickup(EntityPickupItemEvent event) {
        if (!(event.getEntity() instanceof Player player)) {
            return;
        }
        
        recordActivity(
                player.getUniqueId(),
                player.getName(),
                "ITEM_PICKUP",
                event.getItem().getItemStack().getType().name(),
                player.getLocation(),
                null,
                event.getItem().getItemStack().getAmount(),
                null
        );
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        
        // Death record
        recordActivity(
                player.getUniqueId(),
                player.getName(),
                "DEATH",
                event.getDeathMessage() != null ? event.getDeathMessage() : "death",
                player.getLocation(),
                null,
                1,
                null
        );
        
        // Killer record
        Player killer = player.getKiller();
        if (killer != null) {
            recordActivity(
                    killer.getUniqueId(),
                    killer.getName(),
                    "KILL",
                    player.getName(),
                    player.getLocation(),
                    getItemName(killer.getInventory().getItemInMainHand()),
                    1,
                    null
            );
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCraft(CraftItemEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        
        if (event.getCurrentItem() != null) {
            recordActivity(
                    player.getUniqueId(),
                    player.getName(),
                    "CRAFT",
                    event.getCurrentItem().getType().name(),
                    player.getLocation(),
                    null,
                    event.getCurrentItem().getAmount(),
                    null
            );
        }
    }

    // ==================== HELPER METHODS ====================

    private void recordActivity(UUID playerId, String playerName, String action, 
            String target, org.bukkit.Location location, String tool, int amount, String detail) {
        
        // Apply sampling if enabled
        if (config.tracking().sampling().enabled()) {
            double rate = config.tracking().sampling().rate();
            
            // Check if this is a high-priority event
            if (config.tracking().sampling().highPriority().contains(action)) {
                // Always log high-priority events
            } else if (Math.random() > rate) {
                return; // Skip this event
            }
        }
        
        ActivityEvent activityEvent = new ActivityEvent(
                playerId,
                playerName,
                action,
                target,
                location != null ? location.getWorld().getName() : null,
                location != null ? location.getBlockX() : 0,
                location != null ? location.getBlockY() : 0,
                location != null ? location.getBlockZ() : 0,
                tool,
                amount,
                detail,
                Instant.now()
        );
        
        // Add to queue for batch processing
        activityQueue.offer(activityEvent);
        
        // Also update in-memory cache
        playerCache.recordActivity(playerId, activityEvent);
        
        // Broadcast real-time
        if (socketIOManager != null) {
            socketIOManager.broadcastActivity(activityEvent.toMap());
        }
        
        // Publish to Redis
        if (redisManager != null && config.redis().features().pubsubEnabled()) {
            redisManager.publishActivity(activityEvent);
        }
    }

    private String getHighestRole(UUID uuid) {
        Set<String> roles = playerService.getPlayerRoles(uuid);
        return roles.stream()
                .max(Comparator.<String>comparingInt(a -> ROLE_HIERARCHY.getOrDefault(a, 0))
                .orElse("Member");
    }

    private String getItemName(org.bukkit.inventory.ItemStack stack) {
        return stack == null ? "NONE" : stack.getType().name();
    }

    private double getTPS() {
        try {
            // Try Paper API first
            try {
                Method getTPS = Bukkit.getServer().getClass().getMethod("getTPS");
                double[] tps = (double[]) getTPS.invoke(Bukkit.getServer());
                return tps != null && tps.length > 0 ? tps[0] : -1;
            } catch (Exception e) {
                // Fallback: return estimated TPS
                return 20.0;
            }
        } catch (Exception e) {
            return -1;
        }
    }

    private int getAveragePing() {
        return (int) Bukkit.getOnlinePlayers().stream()
                .mapToInt(Player::getPing)
                .average()
                .orElse(0);
    }

    // ==================== GETTERS ====================

    public NcDevConfig getNcDevConfig() {
        return config;
    }
    
    public DatabaseManager getDatabaseManager() {
        return databaseManager;
    }
    
    public RedisManager getRedisManager() {
        return redisManager;
    }
    
    public PlayerService getPlayerService() {
        return playerService;
    }
    
    public PlayerStatsService getPlayerStatsService() {
        return playerStatsService;
    }
    
    public PlayerCache getPlayerCache() {
        return playerCache;
    }
    
    public CurrencyService getCurrencyService() {
        return currencyService;
    }
    
    public EconomyService getEconomyService() {
        return economyService;
    }
    
    public MarketplaceService getMarketplaceService() {
        return marketplaceService;
    }
    
    public ModerationService getModerationService() {
        return moderationService;
    }
    
    public SocialService getSocialService() {
        return socialService;
    }
    
    public TradingService getTradingService() {
        return tradingService;
    }
    
    public LifecycleManager getLifecycleManager() {
        return lifecycleManager;
    }
    
    public NcDevWebSocketServer getWebSocketServer() {
        return webSocketServer;
    }
    
    public SocketIOManager getSocketIOManager() {
        return socketIOManager;
    }
    
    public ConfigApiServer getConfigApiServer() {
        return configApiServer;
    }
    
    public ExecutorService getAsyncExecutor() {
        return asyncExecutor;
    }
    
    public Map<UUID, PlayerCache.PlayerData> getPlayerDataCache() {
        return playerDataCache;
    }
    
    public Map<String, Integer> getRoleHierarchy() {
        return ROLE_HIERARCHY;
    }

    // ==================== INNER CLASSES ====================

    /**
     * Activity event for queue processing
     */
    public record ActivityEvent(
            UUID playerId,
            String playerName,
            String action,
            String target,
            String world,
            int x, int y, int z,
            String tool,
            int amount,
            String detail,
            Instant timestamp
    ) {
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("player_id", playerId.toString());
            map.put("player_name", playerName);
            map.put("action", action);
            map.put("target", target);
            map.put("amount", amount);
            map.put("timestamp", timestamp.toString());
            if (tool != null) map.put("tool", tool);
            if (detail != null) map.put("detail", detail);
            if (world != null) {
                map.put("location", Map.of("world", world, "x", x, "y", y, "z", z));
            }
            return map;
        }
    }
}
