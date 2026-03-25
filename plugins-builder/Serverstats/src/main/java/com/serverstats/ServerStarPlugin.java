package com.serverstats;

import com.serverstats.api.ServerStarApiServer;
import com.serverstats.database.DatabaseManager;
import com.serverstats.model.*;
import com.serverstats.service.*;
import com.serverstats.util.JsonLogger;
import com.serverstats.websocket.ServerStarWebSocketServer;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.inventory.CraftItemEvent;
import org.bukkit.event.player.*;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class ServerStarPlugin extends JavaPlugin implements Listener {

    // Server compatibility detection
    private enum ServerType {
        PAPER, FOLIA, SPIGOT, VELOCITY, UNKNOWN
    }

    private ServerType serverType = ServerType.UNKNOWN;
    private String minecraftVersion = "unknown";
    private boolean isFoliaSupported = false;
    private boolean isVelocityProxy = false;

    // Core services
    private DatabaseManager databaseManager;
    private PlayerService playerService;
    private InventoryService inventoryService;
    private ModerationService moderationService;
    private SocialService socialService;
    private TradingService tradingService;

    // API and real-time services
    private ServerStarApiServer apiServer;
    private ServerStarWebSocketServer webSocketServer;

    // Role hierarchy (higher number = higher priority)
    private static final Map<String, Integer> ROLE_HIERARCHY = new HashMap<>() {{
        put("Member", 1); put("Iron", 2); put("Silver", 3); put("Copper", 4); put("Gold", 5);
        put("Plat", 6); put("Diamond", 7); put("Olaf", 8); put("VIP", 9); put("VVIP", 10);
        put("Youtuber", 11); put("Helper", 12); put("God", 13); put("Admin", 14); put("Owner", 15);
    }};

    // Real-time player data cache
    private final Map<UUID, PlayerData> playerDataCache = new ConcurrentHashMap<>();

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
            // Check for Folia support
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
            // Check if Velocity proxy
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

    private void checkCompatibility() {
        // Check Minecraft version compatibility
        if (minecraftVersion.startsWith("1.20") || minecraftVersion.startsWith("1.21") ||
            minecraftVersion.startsWith("1.22") || minecraftVersion.startsWith("1.23") ||
            minecraftVersion.startsWith("1.24") || minecraftVersion.startsWith("1.25") ||
            minecraftVersion.startsWith("1.26")) {
            JsonLogger.info("version_compatible", Map.of("minecraft_version", minecraftVersion));
        } else {
            JsonLogger.warn("version_unknown", Map.of(
                "minecraft_version", minecraftVersion,
                "supported_range", "1.20.0+"
            ), null);
        }

        // Warn about features that might not work on certain server types
        if (serverType == ServerType.SPIGOT && !isFoliaSupported) {
            JsonLogger.warn("limited_features", Map.of(
                "server_type", "Spigot",
                "limitation", "Some advanced features may not be available"
            ), null);
        }

        if (isVelocityProxy) {
            JsonLogger.warn("proxy_mode", Map.of(
                "server_type", "Velocity",
                "note", "Running as proxy - some world-specific features disabled"
            ), null);
        }
    }

    @Override
    public void onEnable() {
        saveDefaultConfig();

        // Detect server type and version
        detectServerType();
        checkCompatibility();

        // Initialize database
        initializeDatabase();

        // Initialize services
        initializeServices();

        // Start API server (HTTP + GraphQL)
        int apiPort = getConfig().getInt("api.port", 8088);
        this.apiServer = new ServerStarApiServer(apiPort, this);
        this.apiServer.start();

        // Start WebSocket server
        int wsPort = getConfig().getInt("websocket.port", 8089);
        this.webSocketServer = new ServerStarWebSocketServer(wsPort, this);
        this.webSocketServer.start();

        // Register events
        Bukkit.getPluginManager().registerEvents(this, this);

        // Start background tasks
        scheduleTasks();

        JsonLogger.info("plugin_enabled", Map.of(
            "service", "serverstar",
            "api_port", apiPort,
            "websocket_port", wsPort,
            "database_type", getConfig().getString("database.type", "h2"),
            "server_type", serverType.name(),
            "minecraft_version", minecraftVersion,
            "folia_supported", isFoliaSupported,
            "proxy_mode", isVelocityProxy
        ));
    }

    @Override
    public void onDisable() {
        if (webSocketServer != null) {
            try {
                webSocketServer.stop();
            } catch (InterruptedException e) {
                JsonLogger.error("websocket_stop_error", Map.of(), e);
                Thread.currentThread().interrupt();
            }
        }
        if (apiServer != null) {
            apiServer.stop();
        }
        if (databaseManager != null) {
            databaseManager.close();
        }
        JsonLogger.info("plugin_disabled", Map.of("service", "serverstar"));
    }

    private void initializeDatabase() {
        String dbType = getConfig().getString("database.type", "h2");
        String dbUrl = getConfig().getString("database.url",
            dbType.equals("postgresql") ?
            "jdbc:postgresql://localhost:5432/serverstar" :
            "jdbc:h2:./plugins/ServerStar/database"
        );
        String dbUser = getConfig().getString("database.username", "sa");
        String dbPass = getConfig().getString("database.password", "");

        this.databaseManager = new DatabaseManager(dbType, dbUrl, dbUser, dbPass);
        this.databaseManager.initializeSchema();
    }

    private void initializeServices() {
        this.playerService = new PlayerService(databaseManager, this);
        this.inventoryService = new InventoryService(databaseManager, this);
        this.moderationService = new ModerationService(databaseManager, this);
        this.socialService = new SocialService(databaseManager, this);
        this.tradingService = new TradingService(databaseManager, this);
    }

    private void scheduleTasks() {
        // Adapt scheduling based on server type
        if (isFoliaSupported) {
            // Folia uses regionized scheduling
            scheduleFoliaTasks();
        } else {
            // Standard Bukkit scheduling
            scheduleStandardTasks();
        }
    }

    private void scheduleStandardTasks() {
        // Real-time data updates (every 20 ticks = 1 second)
        new BukkitRunnable() {
            @Override
            public void run() {
                updateRealTimeData();
            }
        }.runTaskTimer(this, 20L, 20L);

        // Periodic cleanup (every 5 minutes)
        new BukkitRunnable() {
            @Override
            public void run() {
                cleanupInactiveData();
            }
        }.runTaskTimer(this, 6000L, 6000L);
    }

    private void scheduleFoliaTasks() {
        // Folia-specific scheduling for better performance
        try {
            // Use Folia's regionized server for scheduling
            Class<?> regionizedServerClass = Class.forName("io.papermc.paper.threadedregions.RegionizedServer");
            Object regionizedServer = regionizedServerClass.getMethod("getInstance").invoke(null);

            // Schedule on global region for server-wide tasks
            new BukkitRunnable() {
                @Override
                public void run() {
                    updateRealTimeData();
                }
            }.runTaskTimer(this, 20L, 20L);

            new BukkitRunnable() {
                @Override
                public void run() {
                    cleanupInactiveData();
                }
            }.runTaskTimer(this, 6000L, 6000L);

            JsonLogger.info("folia_scheduling_enabled", Map.of("optimization", "regionized"));
        } catch (Exception e) {
            // Fallback to standard scheduling if Folia API fails
            JsonLogger.warn("folia_scheduling_failed", Map.of("error", e.getMessage()), e);
            scheduleStandardTasks();
        }
    }

    private void updateRealTimeData() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            UUID uuid = player.getUniqueId();
            PlayerData data = new PlayerData(
                uuid,
                player.getName(),
                player.getPing(),
                getHighestRole(uuid),
                player.getLocation(),
                player.getHealth(),
                player.getFoodLevel(),
                player.getGameMode(),
                System.currentTimeMillis()
            );
            playerDataCache.put(uuid, data);

            // Broadcast to WebSocket clients
            webSocketServer.broadcastPlayerUpdate(uuid, data);
        }

        // Update server stats
        ServerData serverData = new ServerData(
            Bukkit.getOnlinePlayers().size(),
            Bukkit.getMaxPlayers(),
            safeTpsIndex(0),
            getAveragePing(),
            Instant.now()
        );
        webSocketServer.broadcastServerUpdate(serverData);
    }

    private void cleanupInactiveData() {
        long cutoff = System.currentTimeMillis() - 300000; // 5 minutes ago
        playerDataCache.entrySet().removeIf(entry -> entry.getValue().lastUpdate() < cutoff);
    }

    private String getHighestRole(UUID uuid) {
        Set<String> roles = playerService.getPlayerRoles(uuid);
        return roles.stream()
            .max(Comparator.comparingInt(ROLE_HIERARCHY::get))
            .orElse("Member");
    }

    // Event Handlers
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        // Initialize player in database
        playerService.recordJoin(player);

        // Record activity
        PlayerActivityRecord record = PlayerActivityRecord.join(
            uuid, player.getName(), player.getLocation(), Instant.now()
        );
        playerService.recordActivity(record);

        JsonLogger.info("player_join", Map.of(
            "player_uuid", uuid.toString(),
            "player_name", player.getName(),
            "role", getHighestRole(uuid)
        ));

        // Notify WebSocket clients
        webSocketServer.broadcastEvent("player_join", Map.of("uuid", uuid.toString()));
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        playerService.recordQuit(player);

        PlayerActivityRecord record = PlayerActivityRecord.quit(
            uuid, player.getName(), player.getLocation(), Instant.now()
        );
        playerService.recordActivity(record);

        // Clean up cache
        playerDataCache.remove(uuid);

        JsonLogger.info("player_quit", Map.of(
            "player_uuid", uuid.toString(),
            "player_name", player.getName()
        ));

        webSocketServer.broadcastEvent("player_quit", Map.of("uuid", uuid.toString()));
    }

    @EventHandler
    public void onBlockBreak(BlockBreakEvent event) {
        if (event.getPlayer() == null || event.getPlayer().getGameMode() == GameMode.CREATIVE) {
            return;
        }
        Player player = event.getPlayer();
        PlayerActivityRecord record = PlayerActivityRecord.blockBreak(
            player.getUniqueId(),
            player.getName(),
            event.getBlock().getType().name(),
            event.getBlock().getLocation(),
            getItemName(player.getInventory().getItemInMainHand()),
            Instant.now()
        );
        playerService.recordActivity(record);
        webSocketServer.broadcastActivity(record);
    }

    @EventHandler
    public void onBlockPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        PlayerActivityRecord record = PlayerActivityRecord.blockPlace(
            player.getUniqueId(),
            player.getName(),
            event.getBlockPlaced().getType().name(),
            event.getBlockPlaced().getLocation(),
            getItemName(player.getInventory().getItemInMainHand()),
            Instant.now()
        );
        playerService.recordActivity(record);
        webSocketServer.broadcastActivity(record);
    }

    @EventHandler
    public void onItemPickup(EntityPickupItemEvent event) {
        if (!(event.getEntity() instanceof Player player)) {
            return;
        }
        ItemStack item = event.getItem().getItemStack();
        inventoryService.recordItemPickup(player.getUniqueId(), item);
        webSocketServer.broadcastInventoryUpdate(player.getUniqueId());
    }

    @EventHandler
    public void onItemDrop(PlayerDropItemEvent event) {
        Player player = event.getPlayer();
        ItemStack item = event.getItemDrop().getItemStack();
        inventoryService.recordItemDrop(player.getUniqueId(), item);
        webSocketServer.broadcastInventoryUpdate(player.getUniqueId());
    }

    @EventHandler
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        PlayerActivityRecord deathRecord = PlayerActivityRecord.death(
            player.getUniqueId(),
            player.getName(),
            event.getDeathMessage() != null ? event.getDeathMessage() : "death",
            player.getLocation(),
            Instant.now()
        );
        playerService.recordActivity(deathRecord);

        Player killer = player.getKiller();
        if (killer != null) {
            PlayerActivityRecord killRecord = PlayerActivityRecord.kill(
                killer.getUniqueId(),
                killer.getName(),
                player.getName(),
                player.getLocation(),
                Instant.now()
            );
            playerService.recordActivity(killRecord);
            webSocketServer.broadcastActivity(killRecord);
        }
        webSocketServer.broadcastActivity(deathRecord);
    }

    @EventHandler
    public void onChat(AsyncPlayerChatEvent event) {
        Player player = event.getPlayer();
        PlayerActivityRecord record = PlayerActivityRecord.chat(
            player.getUniqueId(),
            player.getName(),
            event.getMessage(),
            Instant.now()
        );
        playerService.recordActivity(record);
        webSocketServer.broadcastActivity(record);
    }

    @EventHandler
    public void onCraft(CraftItemEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        ItemStack result = event.getCurrentItem();
        if (result != null) {
            inventoryService.recordCrafting(player.getUniqueId(), result);
            webSocketServer.broadcastInventoryUpdate(player.getUniqueId());
        }
    }

    private String getItemName(ItemStack stack) {
        return stack == null ? "NONE" : stack.getType().name();
    }

    private double safeTpsIndex(int index) {
        // TPS is available on most server types
        if (serverType == ServerType.VELOCITY) {
            // Velocity doesn't have TPS, return -1
            return -1D;
        }

        try {
            // Try to get TPS using reflection for compatibility
            Object server = Bukkit.getServer();
            java.lang.reflect.Method getTpsMethod = server.getClass().getMethod("getTPS");
            double[] tps = (double[]) getTpsMethod.invoke(server);
            if (tps != null && tps.length > index) {
                return tps[index];
            }
        } catch (Exception err) {
            JsonLogger.warn("tps_unavailable", Map.of(
                "server_type", serverType.name(),
                "index", index
            ), err);
        }
        return -1D;
    }

    private int getAveragePing() {
        return (int) Bukkit.getOnlinePlayers().stream()
            .mapToInt(Player::getPing)
            .average()
            .orElse(0);
    }

    // Getters for services (used by API)
    public DatabaseManager getDatabaseManager() { return databaseManager; }
    public PlayerService getPlayerService() { return playerService; }
    public InventoryService getInventoryService() { return inventoryService; }
    public ModerationService getModerationService() { return moderationService; }
    public SocialService getSocialService() { return socialService; }
    public TradingService getTradingService() { return tradingService; }
    public ServerStarWebSocketServer getWebSocketServer() { return webSocketServer; }
    public Map<UUID, PlayerData> getPlayerDataCache() { return playerDataCache; }
    public Map<String, Integer> getRoleHierarchy() { return ROLE_HIERARCHY; }
}