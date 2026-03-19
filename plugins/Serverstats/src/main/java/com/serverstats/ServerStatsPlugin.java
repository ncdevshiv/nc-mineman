package com.serverstats;

import com.serverstats.http.ServerStatsHttpServer;
import com.serverstats.model.PlayerActivityRecord;
import com.serverstats.service.PlayerStatsService;
import com.serverstats.util.JsonLogger;
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
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public final class ServerStatsPlugin extends JavaPlugin implements Listener {

    private PlayerStatsService playerStatsService;
    private ServerStatsHttpServer httpServer;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        int activityLimit = getConfig().getInt("activity.per_player_limit", 200);
        this.playerStatsService = new PlayerStatsService(activityLimit);
        int httpPort = getConfig().getInt("http.port", 8088);
        long broadcastIntervalTicks = getConfig().getLong("broadcast.interval_ticks", 200L);
        this.httpServer = new ServerStatsHttpServer(httpPort, playerStatsService);
        this.httpServer.start();

        Bukkit.getPluginManager().registerEvents(this, this);
        scheduleBroadcastTask(broadcastIntervalTicks);

        JsonLogger.info("plugin_enabled", Map.of(
                "service", "serverstats",
                "http_port", httpPort,
                "broadcast_interval_ticks", broadcastIntervalTicks,
                "activity_limit", activityLimit));
    }

    @Override
    public void onDisable() {
        if (httpServer != null) {
            httpServer.stop();
        }
        JsonLogger.info("plugin_disabled", Map.of("service", "serverstats"));
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        playerStatsService.markJoin(player);
        JsonLogger.info("player_join", playerStatsService.playerSnapshot(player));
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        playerStatsService.markQuit(player);
        JsonLogger.info("player_quit", playerStatsService.playerSnapshot(player));
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
                itemName(player.getInventory().getItemInMainHand()),
                Instant.now()
        );
        playerStatsService.recordActivity(record);
        JsonLogger.info("block_break", record.toMap());
    }

    @EventHandler
    public void onItemPickup(EntityPickupItemEvent event) {
        if (!(event.getEntity() instanceof Player player)) {
            return;
        }
        PlayerActivityRecord record = PlayerActivityRecord.itemPickup(
                player.getUniqueId(),
                player.getName(),
                itemName(event.getItem().getItemStack()),
                event.getItem().getItemStack().getAmount(),
                event.getItem().getLocation(),
                Instant.now()
        );
        playerStatsService.recordActivity(record);
        JsonLogger.info("item_pickup", record.toMap());
    }

    @EventHandler
    public void onItemDrop(PlayerDropItemEvent event) {
        Player player = event.getPlayer();
        ItemStack stack = event.getItemDrop().getItemStack();
        PlayerActivityRecord record = PlayerActivityRecord.itemDrop(
                player.getUniqueId(),
                player.getName(),
                itemName(stack),
                stack.getAmount(),
                event.getItemDrop().getLocation(),
                Instant.now()
        );
        playerStatsService.recordActivity(record);
        JsonLogger.info("item_drop", record.toMap());
    }

    @EventHandler
    public void onBlockPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        PlayerActivityRecord record = PlayerActivityRecord.blockPlace(
                player.getUniqueId(),
                player.getName(),
                event.getBlockPlaced().getType().name(),
                event.getBlockPlaced().getLocation(),
                itemName(player.getInventory().getItemInMainHand()),
                Instant.now()
        );
        playerStatsService.recordActivity(record);
        JsonLogger.info("block_place", record.toMap());
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
        playerStatsService.recordActivity(deathRecord);
        JsonLogger.info("player_death", deathRecord.toMap());

        Player killer = player.getKiller();
        if (killer != null) {
            PlayerActivityRecord killRecord = PlayerActivityRecord.kill(
                    killer.getUniqueId(),
                    killer.getName(),
                    player.getName(),
                    player.getLocation(),
                    Instant.now()
            );
            playerStatsService.recordActivity(killRecord);
            JsonLogger.info("player_kill", killRecord.toMap());
        }
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
        playerStatsService.recordActivity(record);
        JsonLogger.info("player_chat", record.toMap());
    }

    @EventHandler
    public void onCraft(CraftItemEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        ItemStack result = event.getCurrentItem();
        int amount = result != null ? result.getAmount() : 0;
        String type = result != null ? result.getType().name() : "UNKNOWN";
        PlayerActivityRecord record = PlayerActivityRecord.craft(
                player.getUniqueId(),
                player.getName(),
                type,
                amount,
                player.getLocation(),
                Instant.now()
        );
        playerStatsService.recordActivity(record);
        JsonLogger.info("player_craft", record.toMap());
    }

    private void scheduleBroadcastTask(long intervalTicks) {
        new BukkitRunnable() {
            @Override
            public void run() {
                broadcastSnapshot();
            }
        }.runTaskTimer(this, 40L, Math.max(20L, intervalTicks));
    }

    private void broadcastSnapshot() {
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("service", "serverstats");
        snapshot.put("players", playerStatsService.allPlayerSnapshots());
        snapshot.put("server", playerStatsService.serverSnapshot());
        JsonLogger.info("server_broadcast", snapshot);
    }

    private String itemName(ItemStack stack) {
        if (stack == null) {
            return "NONE";
        }
        return stack.getType().name();
    }
}
