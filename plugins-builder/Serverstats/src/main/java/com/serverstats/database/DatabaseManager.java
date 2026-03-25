package com.serverstats.database;

import com.serverstats.util.JsonLogger;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Map;

public class DatabaseManager {
    private final HikariDataSource dataSource;
    private final String dbType;

    public DatabaseManager(String dbType, String url, String username, String password) {
        this.dbType = dbType;

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);

        if (dbType.equals("h2")) {
            config.setDriverClassName("org.h2.Driver");
        } else if (dbType.equals("postgresql")) {
            config.setDriverClassName("org.postgresql.Driver");
        }

        this.dataSource = new HikariDataSource(config);
    }

    public void initializeSchema() {
        try (Connection conn = getConnection()) {
            if (dbType.equals("h2")) {
                initializeH2Schema(conn);
            } else {
                initializePostgreSQLSchema(conn);
            }
            JsonLogger.info("database_initialized", Map.of("type", dbType));
        } catch (SQLException e) {
            JsonLogger.error("database_init_failed", Map.of("type", dbType), e);
            throw new RuntimeException("Failed to initialize database", e);
        }
    }

    private void initializeH2Schema(Connection conn) throws SQLException {
        String[] statements = {
            // Players table
            "CREATE TABLE IF NOT EXISTS players (" +
            "uuid VARCHAR(36) PRIMARY KEY, " +
            "name VARCHAR(16) NOT NULL, " +
            "first_join TIMESTAMP, " +
            "last_seen TIMESTAMP, " +
            "total_playtime BIGINT DEFAULT 0, " +
            "status VARCHAR(16) DEFAULT 'active', " +
            "roles CLOB DEFAULT 'Member')",

            // Player stats
            "CREATE TABLE IF NOT EXISTS player_stats (" +
            "uuid VARCHAR(36) PRIMARY KEY, " +
            "health DOUBLE DEFAULT 20.0, " +
            "food INT DEFAULT 20, " +
            "saturation FLOAT DEFAULT 5.0, " +
            "experience_level INT DEFAULT 0, " +
            "experience_progress FLOAT DEFAULT 0.0, " +
            "gamemode VARCHAR(16) DEFAULT 'SURVIVAL', " +
            "ping INT DEFAULT 0, " +
            "FOREIGN KEY (uuid) REFERENCES players(uuid))",

            // Inventory
            "CREATE TABLE IF NOT EXISTS inventory (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY, " +
            "player_uuid VARCHAR(36), " +
            "slot INT, " +
            "item_type VARCHAR(64), " +
            "amount INT DEFAULT 1, " +
            "display_name VARCHAR(255), " +
            "lore CLOB, " +
            "enchantments CLOB, " +
            "locked BOOLEAN DEFAULT FALSE, " +
            "FOREIGN KEY (player_uuid) REFERENCES players(uuid))",

            // Activity log
            "CREATE TABLE IF NOT EXISTS activity_log (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY, " +
            "player_uuid VARCHAR(36), " +
            "action VARCHAR(32), " +
            "target VARCHAR(64), " +
            "amount INT, " +
            "location_world VARCHAR(64), " +
            "location_x INT, " +
            "location_y INT, " +
            "location_z INT, " +
            "timestamp TIMESTAMP, " +
            "FOREIGN KEY (player_uuid) REFERENCES players(uuid))",

            // Transactions
            "CREATE TABLE IF NOT EXISTS transactions (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY, " +
            "from_uuid VARCHAR(36), " +
            "to_uuid VARCHAR(36), " +
            "item_type VARCHAR(64), " +
            "amount INT, " +
            "type VARCHAR(16), " +
            "status VARCHAR(16) DEFAULT 'completed', " +
            "timestamp TIMESTAMP)",

            // Moderation
            "CREATE TABLE IF NOT EXISTS bans (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY, " +
            "player_uuid VARCHAR(36), " +
            "reason CLOB, " +
            "banned_by VARCHAR(36), " +
            "banned_at TIMESTAMP, " +
            "expires_at TIMESTAMP, " +
            "active BOOLEAN DEFAULT TRUE, " +
            "FOREIGN KEY (player_uuid) REFERENCES players(uuid))",

            // Social features
            "CREATE TABLE IF NOT EXISTS friendships (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY, " +
            "player_uuid VARCHAR(36), " +
            "friend_uuid VARCHAR(36), " +
            "status VARCHAR(16) DEFAULT 'pending', " +
            "created_at TIMESTAMP, " +
            "UNIQUE(player_uuid, friend_uuid))",

            "CREATE TABLE IF NOT EXISTS reports (" +
            "id BIGINT AUTO_INCREMENT PRIMARY KEY, " +
            "reporter_uuid VARCHAR(36), " +
            "target_uuid VARCHAR(36), " +
            "reason CLOB, " +
            "timestamp TIMESTAMP, " +
            "status VARCHAR(16) DEFAULT 'open')"
        };

        for (String sql : statements) {
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.execute();
            }
        }
    }

    private void initializePostgreSQLSchema(Connection conn) throws SQLException {
        // Similar to H2 but with PostgreSQL syntax adjustments
        String[] statements = {
            "CREATE TABLE IF NOT EXISTS players (" +
            "uuid VARCHAR(36) PRIMARY KEY, " +
            "name VARCHAR(16) NOT NULL, " +
            "first_join TIMESTAMP, " +
            "last_seen TIMESTAMP, " +
            "total_playtime BIGINT DEFAULT 0, " +
            "status VARCHAR(16) DEFAULT 'active', " +
            "roles TEXT DEFAULT 'Member')",

            "CREATE TABLE IF NOT EXISTS player_stats (" +
            "uuid VARCHAR(36) PRIMARY KEY REFERENCES players(uuid), " +
            "health DOUBLE PRECISION DEFAULT 20.0, " +
            "food INTEGER DEFAULT 20, " +
            "saturation REAL DEFAULT 5.0, " +
            "experience_level INTEGER DEFAULT 0, " +
            "experience_progress REAL DEFAULT 0.0, " +
            "gamemode VARCHAR(16) DEFAULT 'SURVIVAL', " +
            "ping INTEGER DEFAULT 0)",

            "CREATE TABLE IF NOT EXISTS inventory (" +
            "id BIGSERIAL PRIMARY KEY, " +
            "player_uuid VARCHAR(36) REFERENCES players(uuid), " +
            "slot INTEGER, " +
            "item_type VARCHAR(64), " +
            "amount INTEGER DEFAULT 1, " +
            "display_name VARCHAR(255), " +
            "lore TEXT, " +
            "enchantments TEXT, " +
            "locked BOOLEAN DEFAULT FALSE)",

            "CREATE TABLE IF NOT EXISTS activity_log (" +
            "id BIGSERIAL PRIMARY KEY, " +
            "player_uuid VARCHAR(36) REFERENCES players(uuid), " +
            "action VARCHAR(32), " +
            "target VARCHAR(64), " +
            "amount INTEGER, " +
            "location_world VARCHAR(64), " +
            "location_x INTEGER, " +
            "location_y INTEGER, " +
            "location_z INTEGER, " +
            "timestamp TIMESTAMP)",

            "CREATE TABLE IF NOT EXISTS transactions (" +
            "id BIGSERIAL PRIMARY KEY, " +
            "from_uuid VARCHAR(36), " +
            "to_uuid VARCHAR(36), " +
            "item_type VARCHAR(64), " +
            "amount INTEGER, " +
            "type VARCHAR(16), " +
            "status VARCHAR(16) DEFAULT 'completed', " +
            "timestamp TIMESTAMP)",

            "CREATE TABLE IF NOT EXISTS bans (" +
            "id BIGSERIAL PRIMARY KEY, " +
            "player_uuid VARCHAR(36) REFERENCES players(uuid), " +
            "reason TEXT, " +
            "banned_by VARCHAR(36), " +
            "banned_at TIMESTAMP, " +
            "expires_at TIMESTAMP, " +
            "active BOOLEAN DEFAULT TRUE)",

            "CREATE TABLE IF NOT EXISTS friendships (" +
            "id BIGSERIAL PRIMARY KEY, " +
            "player_uuid VARCHAR(36), " +
            "friend_uuid VARCHAR(36), " +
            "status VARCHAR(16) DEFAULT 'pending', " +
            "created_at TIMESTAMP, " +
            "UNIQUE(player_uuid, friend_uuid))",

            "CREATE TABLE IF NOT EXISTS reports (" +
            "id BIGSERIAL PRIMARY KEY, " +
            "reporter_uuid VARCHAR(36), " +
            "target_uuid VARCHAR(36), " +
            "reason TEXT, " +
            "timestamp TIMESTAMP, " +
            "status VARCHAR(16) DEFAULT 'open')"
        };

        for (String sql : statements) {
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.execute();
            }
        }
    }

    public Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    public void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }
}