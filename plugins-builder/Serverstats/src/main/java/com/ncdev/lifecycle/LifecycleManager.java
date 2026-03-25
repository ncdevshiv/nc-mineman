package com.ncdev.lifecycle;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.database.DatabaseManager;
import com.ncdev.util.JsonLogger;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scheduler.BukkitTask;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Lifecycle manager for data retention and cleanup.
 * Automatically deletes old data based on configurable retention periods.
 */
public class LifecycleManager {

    private final NcDevConfig.Lifecycle config;
    private final DatabaseManager db;
    private final NcDevPlugin plugin;
    
    private BukkitTask cleanupTask;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile boolean stopped = false;

    public LifecycleManager(NcDevConfig.Lifecycle config, DatabaseManager db, NcDevPlugin plugin) {
        this.config = config;
        this.db = db;
        this.plugin = plugin;
    }

    /**
     * Start the lifecycle manager
     */
    public void start() {
        if (!config.enabled()) {
            JsonLogger.info("lifecycle_disabled", Map.of());
            return;
        }
        
        stopped = false;
        
        // Schedule cleanup task
        if (config.cleanup().schedule() != null && !config.cleanup().schedule().isEmpty()) {
            // Parse cron expression (simplified)
            // Format: "minute hour day month weekday"
            scheduleCronCleanup(config.cleanup().schedule());
        } else if (config.cleanup().intervalMinutes() > 0) {
            // Use interval-based scheduling
            scheduleIntervalCleanup();
        } else {
            // Default: daily at 3 AM
            scheduleCronCleanup("0 3 * * *");
        }
        
        JsonLogger.info("lifecycle_started", Map.of(
                "schedule", config.cleanup().schedule() != null ? 
                        config.cleanup().schedule() : "interval:" + config.cleanup().intervalMinutes()
        ));
    }

    /**
     * Stop the lifecycle manager
     */
    public void stop() {
        stopped = true;
        
        if (cleanupTask != null) {
            cleanupTask.cancel();
            cleanupTask = null;
        }
        
        running.set(false);
        JsonLogger.info("lifecycle_stopped", Map.of());
    }

    /**
     * Schedule cleanup based on cron expression
     */
    private void scheduleCronCleanup(String cron) {
        // Simplified cron parser - for production use a proper library like Quartz
        String[] parts = cron.split(" ");
        if (parts.length < 5) {
            JsonLogger.warn("invalid_cron_expression", Map.of("cron", cron));
            scheduleIntervalCleanup();
            return;
        }
        
        int minute = parseCronField(parts[0], 0, 59);
        int hour = parseCronField(parts[1], 0, 23);
        
        // Calculate delay until next occurrence
        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime next = now.withHour(hour).withMinute(minute).withSecond(0);
        
        if (next.isBefore(now)) {
            next = next.plusDays(1);
        }
        
        long delaySeconds = java.time.Duration.between(now, next).getSeconds();
        
        cleanupTask = new BukkitRunnable() {
            @Override
            public void run() {
                if (!stopped) {
                    runCleanup();
                    // Reschedule for next day
                    scheduleCronCleanup(cron);
                }
            }
        }.runTaskLaterAsynchronously(plugin, delaySeconds * 20L);
        
        JsonLogger.info("lifecycle_scheduled", Map.of(
                "type", "cron",
                "next_run", next.toString(),
                "delay_seconds", delaySeconds
        ));
    }

    /**
     * Schedule cleanup based on interval
     */
    private void scheduleIntervalCleanup() {
        long intervalTicks = config.cleanup().intervalMinutes() * 60 * 20L;
        
        cleanupTask = new BukkitRunnable() {
            @Override
            public void run() {
                if (!stopped) {
                    runCleanup();
                }
            }
        }.runTaskTimerAsynchronously(plugin, intervalTicks, intervalTicks);
        
        JsonLogger.info("lifecycle_scheduled", Map.of(
                "type", "interval",
                "interval_minutes", config.cleanup().intervalMinutes()
        ));
    }

    /**
     * Run the cleanup process
     */
    public void runCleanup() {
        if (running.compareAndSet(false, true)) {
            try {
                if (config.dryRun()) {
                    runDryRun();
                } else {
                    runActualCleanup();
                }
            } finally {
                running.set(false);
            }
        }
    }

    /**
     * Run actual cleanup (deletes data)
     */
    private void runActualCleanup() {
        long startTime = System.currentTimeMillis();
        int totalDeleted = 0;
        
        JsonLogger.info("lifecycle_cleanup_started", Map.of(
                "dry_run", false
        ));
        
        // Cleanup activity logs
        if (config.retention().activity().enabled()) {
            int deleted = db.deleteOldRecords(
                    "activity_log",
                    "timestamp",
                    config.retention().activity().days()
            );
            totalDeleted += deleted;
            
            if (deleted > 0) {
                JsonLogger.info("lifecycle_activity_cleaned", Map.of("deleted", deleted));
            }
        }
        
        // Cleanup chat logs
        if (config.retention().chatLogs().enabled()) {
            int deleted = db.deleteOldRecords(
                    "activity_log",
                    "timestamp",
                    config.retention().chatLogs().days()
            );
            totalDeleted += deleted;
        }
        
        // Cleanup expired marketplace listings
        if (config.retention().marketplace() != null) {
            // Handle completed listings older than X days
            // Handle cancelled listings older than X days
        }
        
        // Cleanup economy transactions
        if (config.retention().transactions().enabled()) {
            int deleted = db.deleteOldRecords(
                    "currency_transactions",
                    "timestamp",
                    config.retention().transactions().days()
            );
            totalDeleted += deleted;
        }
        
        // Cleanup inactive players (optional)
        if (config.retention().inactivePlayers().enabled() && 
            config.retention().inactivePlayers().days() > 0) {
            cleanupInactivePlayers();
        }
        
        long duration = System.currentTimeMillis() - startTime;
        
        JsonLogger.info("lifecycle_cleanup_completed", Map.of(
                "total_deleted", totalDeleted,
                "duration_ms", duration
        ));
        
        // Send notification if configured
        sendNotification(totalDeleted);
    }

    /**
     * Run dry run (log what would be deleted)
     */
    private void runDryRun() {
        JsonLogger.info("lifecycle_dry_run_started", Map.of());
        
        // Count records that would be deleted
        if (config.retention().activity().enabled()) {
            try {
                // Just log the retention setting
                JsonLogger.info("lifecycle_dry_run_activity", Map.of(
                        "days", config.retention().activity().days()
                ));
            } catch (Exception e) {
                JsonLogger.error("lifecycle_dry_run_failed", Map.of(), e);
            }
        }
        
        JsonLogger.info("lifecycle_dry_run_completed", Map.of());
    }

    /**
     * Cleanup inactive players (mark for deletion or archive)
     */
    private void cleanupInactivePlayers() {
        try {
            int days = config.retention().inactivePlayers().days();
            
            // Archive and optionally delete inactive players
            // This is a placeholder - implement based on your needs
            
            JsonLogger.info("lifecycle_inactive_players_checked", Map.of(
                    "inactive_days", days
            ));
        } catch (Exception e) {
            JsonLogger.error("lifecycle_inactive_cleanup_failed", Map.of(), e);
        }
    }

    /**
     * Send notification about cleanup
     */
    private void sendNotification(int deletedRecords) {
        if (config.notifications().webhookUrl() == null || 
            config.notifications().webhookUrl().isEmpty()) {
            return;
        }
        
        // Send webhook notification
        // This would use an HTTP client to POST to the webhook URL
    }

    /**
     * Parse cron field to integer value
     */
    private int parseCronField(String field, int min, int max) {
        if (field.equals("*")) {
            return min;
        }
        try {
            int value = Integer.parseInt(field);
            return Math.max(min, Math.min(max, value));
        } catch (NumberFormatException e) {
            return min;
        }
    }

    /**
     * Get retention info for a specific table
     */
    public RetentionInfo getRetentionInfo(String tableName) {
        return switch (tableName) {
            case "activity_log" -> new RetentionInfo(
                    config.retention().activity().enabled(),
                    config.retention().activity().days(),
                    "action, target, timestamp"
            );
            case "chat_logs" -> new RetentionInfo(
                    config.retention().chatLogs().enabled(),
                    config.retention().chatLogs().days(),
                    "message, timestamp"
            );
            case "transactions" -> new RetentionInfo(
                    config.retention().transactions().enabled(),
                    config.retention().transactions().days(),
                    "amount, type, timestamp"
            );
            case "moderation_logs" -> new RetentionInfo(
                    config.retention().moderationLogs().enabled(),
                    config.retention().moderationLogs().days(),
                    "action, reason, timestamp"
            );
            case "players" -> new RetentionInfo(
                    config.retention().inactivePlayers().enabled(),
                    config.retention().inactivePlayers().days(),
                    "inactive players only"
            );
            default -> new RetentionInfo(false, 0, "unknown table");
        };
    }

    /**
     * Manual trigger for cleanup (admin command)
     */
    public ManualCleanupResult triggerManualCleanup(String tableName) {
        if (running.get()) {
            return new ManualCleanupResult(false, "Cleanup already in progress", 0);
        }
        
        RetentionInfo info = getRetentionInfo(tableName);
        if (!info.enabled()) {
            return new ManualCleanupResult(false, "Retention not enabled for " + tableName, 0);
        }
        
        try {
            int deleted = db.deleteOldRecords(tableName, "timestamp", info.days());
            return new ManualCleanupResult(true, "Cleanup completed", deleted);
        } catch (Exception e) {
            return new ManualCleanupResult(false, "Cleanup failed: " + e.getMessage(), 0);
        }
    }

    /**
     * Check if lifecycle manager is running
     */
    public boolean isRunning() {
        return running.get() && !stopped;
    }

    /**
     * Get next scheduled cleanup time
     */
    public String getNextScheduledTime() {
        if (!config.enabled()) {
            return "Disabled";
        }
        
        if (config.cleanup().schedule() != null) {
            return "Cron: " + config.cleanup().schedule();
        }
        
        if (config.cleanup().intervalMinutes() > 0) {
            return "Every " + config.cleanup().intervalMinutes() + " minutes";
        }
        
        return "Daily at 3:00 AM";
    }

    // ==================== DATA CLASSES ====================

    public record RetentionInfo(boolean enabled, int days, String details) {}
    
    public record ManualCleanupResult(boolean success, String message, int deletedRecords) {}
}
