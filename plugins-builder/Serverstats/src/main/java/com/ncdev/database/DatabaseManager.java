package com.ncdev.database;

import com.ncdev.NcDevPlugin;
import com.ncdev.config.NcDevConfig;
import com.ncdev.util.JsonLogger;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Database manager for NCDev plugin.
 * Supports H2, PostgreSQL, and MySQL databases.
 */
public class DatabaseManager {

    private final String dbType;
    private final HikariDataSource dataSource;
    private final NcDevPlugin plugin;

    public DatabaseManager(String dbType, String url, String username, String password, NcDevPlugin plugin) {
        this.dbType = dbType;
        this.plugin = plugin;
        
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        
        // Pool settings from config
        var poolConfig = plugin.getNcDevConfig().database().pool();
        config.setMaximumPoolSize(poolConfig.size());
        config.setMinimumIdle(poolConfig.minIdle());
        config.setConnectionTimeout(poolConfig.connectionTimeoutMs());
        config.setIdleTimeout(poolConfig.idleTimeoutMs());
        config.setMaxLifetime(poolConfig.maxLifetimeMs());
        
        if (dbType.equals("postgresql")) {
            config.setDriverClassName("org.postgresql.Driver");
        } else if (dbType.equals("mysql")) {
            config.setDriverClassName("com.mysql.cj.jdbc.Driver");
        } else {
            config.setDriverClassName("org.h2.Driver");
        }
        
        this.dataSource = new HikariDataSource(config);
    }

    /**
     * Initialize database schema
     */
    public void initializeSchema() {
        try (Connection conn = getConnection()) {
            if (dbType.equals("h2")) {
                initializeH2Schema(conn);
            } else {
                initializePostgreSQLSchema(conn);
            }
            JsonLogger.info("database_schema_initialized", Map.of("type", dbType));
        } catch (SQLException e) {
            JsonLogger.error("database_schema_init_failed", Map.of("type", dbType), e);
            throw new RuntimeException("Failed to initialize database schema", e);
        }
    }

    private void initializeH2Schema(Connection conn) throws SQLException {
        String[] statements = {
            // Players table
            """
            CREATE TABLE IF NOT EXISTS players (
                uuid VARCHAR(36) PRIMARY KEY,
                name VARCHAR(16) NOT NULL,
                first_join TIMESTAMP,
                last_seen TIMESTAMP,
                last_location_world VARCHAR(64),
                last_location_x INT,
                last_location_y INT,
                last_location_z INT,
                total_playtime BIGINT DEFAULT 0,
                status VARCHAR(16) DEFAULT 'active',
                roles CLOB DEFAULT 'Member',
                last_interaction TIMESTAMP
            )
            """,
            
            // Player stats
            """
            CREATE TABLE IF NOT EXISTS player_stats (
                uuid VARCHAR(36) PRIMARY KEY,
                health DOUBLE DEFAULT 20.0,
                food INT DEFAULT 20,
                saturation FLOAT DEFAULT 5.0,
                experience_level INT DEFAULT 0,
                experience_progress FLOAT DEFAULT 0.0,
                gamemode VARCHAR(16) DEFAULT 'SURVIVAL',
                ping INT DEFAULT 0,
                blocks_mined BIGINT DEFAULT 0,
                blocks_placed BIGINT DEFAULT 0,
                deaths INT DEFAULT 0,
                kills INT DEFAULT 0,
                fish_caught BIGINT DEFAULT 0,
                animals_bred BIGINT DEFAULT 0,
                last_updated TIMESTAMP
            )
            """,
            
            // Inventory tracking
            """
            CREATE TABLE IF NOT EXISTS inventory (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                slot INT,
                item_type VARCHAR(64),
                amount INT DEFAULT 1,
                display_name VARCHAR(255),
                lore CLOB,
                enchantments CLOB,
                item_data CLOB,
                locked BOOLEAN DEFAULT FALSE,
                last_updated TIMESTAMP
            )
            """,
            
            // Activity log
            """
            CREATE TABLE IF NOT EXISTS activity_log (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                player_name VARCHAR(16),
                action VARCHAR(32),
                target VARCHAR(128),
                amount INT DEFAULT 1,
                location_world VARCHAR(64),
                location_x INT,
                location_y INT,
                location_z INT,
                tool VARCHAR(64),
                detail CLOB,
                timestamp TIMESTAMP
            )
            """,
            
            // Currency/Balance
            """
            CREATE TABLE IF NOT EXISTS currency_balance (
                player_uuid VARCHAR(36) PRIMARY KEY,
                balance DOUBLE DEFAULT 0,
                last_daily_bonus TIMESTAMP,
                login_streak INT DEFAULT 0,
                total_earned DOUBLE DEFAULT 0,
                total_spent DOUBLE DEFAULT 0,
                last_updated TIMESTAMP
            )
            """,
            
            // Transaction history
            """
            CREATE TABLE IF NOT EXISTS currency_transactions (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                type VARCHAR(32),
                amount DOUBLE,
                balance_before DOUBLE,
                balance_after DOUBLE,
                reason VARCHAR(255),
                other_party VARCHAR(36),
                timestamp TIMESTAMP
            )
            """,
            
            // Marketplace listings
            """
            CREATE TABLE IF NOT EXISTS marketplace_listings (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                seller_uuid VARCHAR(36),
                seller_name VARCHAR(16),
                listing_type VARCHAR(16),
                item_type VARCHAR(64),
                item_data CLOB,
                amount INT,
                price DOUBLE,
                current_bid DOUBLE,
                current_bidder VARCHAR(36),
                bid_count INT DEFAULT 0,
                buyout_price DOUBLE,
                status VARCHAR(16) DEFAULT 'active',
                category VARCHAR(32),
                created_at TIMESTAMP,
                expires_at TIMESTAMP,
                completed_at TIMESTAMP
            )
            """,
            
            // Marketplace bids
            """
            CREATE TABLE IF NOT EXISTS marketplace_bids (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                listing_id BIGINT,
                bidder_uuid VARCHAR(36),
                bidder_name VARCHAR(16),
                bid_amount DOUBLE,
                timestamp TIMESTAMP
            )
            """,
            
            // Player exchanges (P2P)
            """
            CREATE TABLE IF NOT EXISTS player_exchanges (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                sender_uuid VARCHAR(36),
                sender_name VARCHAR(16),
                receiver_uuid VARCHAR(36),
                receiver_name VARCHAR(16),
                offered_items CLOB,
                requested_items CLOB,
                offered_money DOUBLE DEFAULT 0,
                requested_money DOUBLE DEFAULT 0,
                status VARCHAR(16) DEFAULT 'pending',
                created_at TIMESTAMP,
                responded_at TIMESTAMP,
                completed_at TIMESTAMP
            )
            """,
            
            // Moderation
            """
            CREATE TABLE IF NOT EXISTS bans (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                player_name VARCHAR(16),
                reason CLOB,
                banned_by VARCHAR(36),
                banned_by_name VARCHAR(16),
                banned_at TIMESTAMP,
                expires_at TIMESTAMP,
                active BOOLEAN DEFAULT TRUE,
                appeal_status VARCHAR(16) DEFAULT 'open'
            )
            """,
            
            """
            CREATE TABLE IF NOT EXISTS mutes (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                player_name VARCHAR(16),
                reason CLOB,
                muted_by VARCHAR(36),
                muted_by_name VARCHAR(16),
                muted_at TIMESTAMP,
                expires_at TIMESTAMP,
                active BOOLEAN DEFAULT TRUE
            )
            """,
            
            """
            CREATE TABLE IF NOT EXISTS warnings (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                player_name VARCHAR(16),
                reason CLOB,
                warned_by VARCHAR(36),
                warned_by_name VARCHAR(16),
                warned_at TIMESTAMP,
                active BOOLEAN DEFAULT TRUE
            )
            """,
            
            """
            CREATE TABLE IF NOT EXISTS jail_records (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                player_name VARCHAR(16),
                reason CLOB,
                jailed_by VARCHAR(36),
                jailed_by_name VARCHAR(16),
                jail_location VARCHAR(64),
                jailed_at TIMESTAMP,
                released_at TIMESTAMP,
                released_by VARCHAR(36)
            )
            """,
            
            // Social features
            """
            CREATE TABLE IF NOT EXISTS friendships (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                player_uuid VARCHAR(36),
                friend_uuid VARCHAR(36),
                status VARCHAR(16) DEFAULT 'pending',
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            )
            """,
            
            """
            CREATE TABLE IF NOT EXISTS follows (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                follower_uuid VARCHAR(36),
                following_uuid VARCHAR(36),
                created_at TIMESTAMP
            )
            """,
            
            """
            CREATE TABLE IF NOT EXISTS reports (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                reporter_uuid VARCHAR(36),
                reporter_name VARCHAR(16),
                target_uuid VARCHAR(36),
                target_name VARCHAR(16),
                reason CLOB,
                timestamp TIMESTAMP,
                status VARCHAR(16) DEFAULT 'open',
                handled_by VARCHAR(36),
                handled_at TIMESTAMP,
                resolution CLOB
            )
            """,
            
            // Configuration history (for audit)
            """
            CREATE TABLE IF NOT EXISTS config_changes (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                changed_by VARCHAR(36),
                changed_by_name VARCHAR(16),
                config_path VARCHAR(255),
                old_value CLOB,
                new_value CLOB,
                changed_at TIMESTAMP
            )
            """
        };

        for (String sql : statements) {
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.execute();
            }
        }
        
        // Create indexes
        createIndexes(conn);
    }

    private void initializePostgreSQLSchema(Connection conn) throws SQLException {
        // Similar to H2 but with PostgreSQL-specific syntax
        String[] statements = {
            """
            CREATE TABLE IF NOT EXISTS players (
                uuid VARCHAR(36) PRIMARY KEY,
                name VARCHAR(16) NOT NULL,
                first_join TIMESTAMP,
                last_seen TIMESTAMP,
                last_location_world VARCHAR(64),
                last_location_x INTEGER,
                last_location_y INTEGER,
                last_location_z INTEGER,
                total_playtime BIGINT DEFAULT 0,
                status VARCHAR(16) DEFAULT 'active',
                roles TEXT DEFAULT 'Member',
                last_interaction TIMESTAMP
            )
            """,
            
            // Add more PostgreSQL-specific DDL...
        };

        for (String sql : statements) {
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.execute();
            }
        }
        
        createIndexes(conn);
    }

    private void createIndexes(Connection conn) throws SQLException {
        String[] indexes = {
            "CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)",
            "CREATE INDEX IF NOT EXISTS idx_players_status ON players(status)",
            "CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen)",
            "CREATE INDEX IF NOT EXISTS idx_activity_player ON activity_log(player_uuid)",
            "CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action)",
            "CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace_listings(seller_uuid)",
            "CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_listings(status)",
            "CREATE INDEX IF NOT EXISTS idx_marketplace_expires ON marketplace_listings(expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_bans_player ON bans(player_uuid)",
            "CREATE INDEX IF NOT EXISTS idx_bans_active ON bans(active)",
            "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_player ON currency_transactions(player_uuid)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON currency_transactions(timestamp)"
        };

        for (String sql : indexes) {
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.execute();
            }
        }
    }

    /**
     * Get a connection from the pool
     */
    public Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    /**
     * Close the database pool
     */
    public void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
            JsonLogger.info("database_closed", Map.of());
        }
    }

    /**
     * Batch insert activity events
     */
    public void batchInsertActivities(List<com.ncdev.NcDevPlugin.ActivityEvent> events) {
        if (events.isEmpty()) return;
        
        String sql = """
            INSERT INTO activity_log (player_uuid, player_name, action, target, location_world,
                location_x, location_y, location_z, tool, amount, detail, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
        
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                for (var event : events) {
                    stmt.setString(1, event.playerId().toString());
                    stmt.setString(2, event.playerName());
                    stmt.setString(3, event.action());
                    stmt.setString(4, event.target());
                    stmt.setString(5, event.world());
                    stmt.setInt(6, event.x());
                    stmt.setInt(7, event.y());
                    stmt.setInt(8, event.z());
                    stmt.setString(9, event.tool());
                    stmt.setInt(10, event.amount());
                    stmt.setString(11, event.detail());
                    stmt.setTimestamp(12, Timestamp.from(event.timestamp()));
                    stmt.addBatch();
                }
                
                stmt.executeBatch();
                conn.commit();
                
                JsonLogger.info("activity_batch_inserted", Map.of("count", events.size()));
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            JsonLogger.error("activity_batch_insert_failed", Map.of("count", events.size()), e);
        }
    }

    /**
     * Execute a delete query (for lifecycle cleanup)
     */
    public int deleteOldRecords(String table, String timestampColumn, int daysToKeep) {
        String sql = String.format(
            "DELETE FROM %s WHERE %s < ?",
            table,
            timestampColumn
        );
        
        Instant cutoff = Instant.now().minusSeconds(daysToKeep * 24L * 60 * 60);
        
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setTimestamp(1, Timestamp.from(cutoff));
            int deleted = stmt.executeUpdate();
            
            JsonLogger.info("cleanup_deleted", Map.of(
                "table", table,
                "deleted", deleted,
                "cutoff", cutoff.toString()
            ));
            
            return deleted;
        } catch (SQLException e) {
            JsonLogger.error("cleanup_delete_failed", Map.of("table", table), e);
            return 0;
        }
    }

    /**
     * Get database type
     */
    public String getDbType() {
        return dbType;
    }

    /**
     * Check if database is healthy
     */
    public boolean isHealthy() {
        try (Connection conn = getConnection()) {
            return conn.isValid(5);
        } catch (SQLException e) {
            return false;
        }
    }
}
